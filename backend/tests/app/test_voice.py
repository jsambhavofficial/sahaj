"""Voice agent WebSocket: protocol, call lifecycle, memory, masking, safety and failure handling."""

import base64
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.core.config import today
from app.core.safety import violations
from app.core.security import create_token
from app.integrations import factory
from app.integrations.base import Segment
from app.modules.auth.models import AuditLog
from app.modules.checkins.models import Checkin, NlpCue
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.seniors.models import SeniorContact, SeniorHealthProfile
from app.modules.voice import agent as agent_mod
from app.modules.voice.models import Call, CallTurn, SeniorMemoryItem
from tests.app.factories import make_senior, make_user

WS = "/api/v1/ws/voice-agent"
AUDIO = b"RIFF-fake-wav"


class FakeSTT:
    """Returns the next scripted sentence for every utterance (stays on the last one)."""

    def __init__(self, *texts, speaker="senior"):
        self.texts, self.speaker, self.calls = list(texts), speaker, 0

    def transcribe(self, audio, language):
        text = self.texts[min(self.calls, len(self.texts) - 1)]
        self.calls += 1
        return [Segment(text=text, speaker=self.speaker, confidence=0.9)] if text else []


class RecordingLLM:
    def __init__(self, reply="Achha ji. Aur bataiye?"):
        self.reply, self.prompts = reply, []

    def complete(self, system, user):
        self.prompts.append((system, user))
        return self.reply(system, user) if callable(self.reply) else self.reply

    @property
    def everything(self):
        return "\n".join(s + "\n" + u for s, u in self.prompts)


class Boom:
    def __init__(self, name="x"):
        self.name = name

    def transcribe(self, *a, **k):
        raise RuntimeError("stt down")

    def synthesize(self, *a, **k):
        raise RuntimeError("tts down")

    def complete(self, *a, **k):
        raise RuntimeError("llm down")


@pytest.fixture
def world(db_session):
    coord = make_user(db_session, "coordinator", city="Jaipur")
    senior, suser = make_senior(db_session, coord)
    contact = db_session.get(SeniorContact, senior.senior_id)
    contact.full_name, contact.phone = "Ramesh Kumar", "9876543210"
    db_session.commit()
    token = create_token(str(suser.id), "access", timedelta(minutes=30))
    return dict(coord=coord, senior=senior, suser=suser, token=token, db=db_session)


@pytest.fixture(autouse=True)
def rescores(monkeypatch):
    calls = []
    monkeypatch.setattr("app.modules.risk.service.rescore_and_rerank",
                        lambda db, sid, day, reason="x": calls.append((sid, day, reason)), raising=False)
    return calls


def use(monkeypatch, *, stt=None, llm=None, tts=None):
    if stt:
        monkeypatch.setattr(factory, "get_stt", lambda: stt)
    if llm:
        monkeypatch.setattr(factory, "get_llm", lambda: llm)
    if tts:
        monkeypatch.setattr(factory, "get_tts", lambda: tts)


def until(ws, *types):
    """Read events up to and including the first one of `types`."""
    events = []
    while True:
        e = ws.receive_json()
        events.append(e)
        if e["type"] in types:
            return events


def speak(ws, *, until_types=("turn_done", "call_end")):
    ws.send_bytes(AUDIO)
    ws.send_json({"type": "end_utterance"})
    return until(ws, *until_types)


def connect(client, token):
    return client.websocket_connect(f"{WS}?token={token}")


def start(ws, language="hinglish"):
    ws.send_json({"type": "start", "language": language})
    return until(ws, "turn_done", "call_end")


def run_call(client, w, *, language="hinglish", answers=4):
    """Full call. Returns the list of every server event."""
    out = []
    with connect(client, w["token"]) as ws:
        out += start(ws, language)
        for _ in range(answers):
            out += speak(ws)
            if out[-1]["type"] != "turn_done":
                break
        if out[-1]["type"] == "turn_done":  # hang up when fewer answers than questions were given
            ws.send_json({"type": "end_call"})
            out += until(ws, "call_end")
    return out


def the_call(db):
    db.expire_all()
    return db.scalars(select(Call)).one()


# ------------------------------------------------------------------ happy path with stubs
def test_full_call_with_stubs(client, world):
    events = run_call(client, world)
    types = [e["type"] for e in events]
    assert types[0] == "ready" and types[-1] == "call_end"
    assert types.count("transcript") == 4 and types.count("turn_done") == 5  # opening + 3 questions + goodbye
    first_text = next(e for e in events if e["type"] == "agent_text")["text"]
    assert "समर्थ" in first_text
    audio = next(e for e in events if e["type"] == "agent_audio")
    assert audio["format"] == "wav" and base64.b64decode(audio["base64"]).startswith(b"RIFF")

    db = world["db"]
    call = the_call(db)
    assert call.kind == "ai_agent" and call.provider == "in_app" and call.status == "completed"
    assert call.language == "hindi" and call.senior_id == world["senior"].senior_id
    assert call.coordinator_id == world["coord"].id and call.initiated_by_user_id == world["suser"].id
    assert call.ended_at and call.duration_sec is not None and not call.urgency_flag
    assert call.model_info["agent"] == "scripted"
    assert events[-1]["summary"] == call.summary and "Mentioned" in call.summary
    assert call.context_snapshot["context"]["language"] == "hindi"

    turns = db.scalars(select(CallTurn).where(CallTurn.call_id == call.id).order_by(CallTurn.turn_index)).all()
    assert [t.turn_index for t in turns] == list(range(len(turns))) and len(turns) == 9
    assert [t.speaker for t in turns[:3]] == ["agent", "senior", "agent"]
    assert db.scalars(select(NlpCue).where(NlpCue.source_id == str(call.id))).all()
    kinds = {(m.kind, m.content) for m in db.scalars(select(SeniorMemoryItem))}
    assert ("symptom", "Senior reported dizziness") in kinds and ("symptom", "Senior reported weakness") in kinds
    assert db.scalars(select(Checkin).where(Checkin.call_id == call.id)).one().channel == "voice_agent"
    actions = [a.action for a in db.scalars(select(AuditLog))]
    assert "voice_call.start" in actions and "voice_call.end" in actions


def test_scripted_agent_never_calls_the_stub_llm(client, world, monkeypatch):
    run_call(client, world)
    assert the_call(world["db"]).model_info["llm"] == "StubLLM"


def test_hindi_and_english_prompts(client, world):
    ev = run_call(client, world, language="hindi", answers=1)
    assert "समर्थ" in ev[1]["text"]
    assert the_call(world["db"]).language == "hindi"


def test_language_defaults_to_senior_preference(client, world):
    with connect(client, world["token"]) as ws:
        ws.send_json({"type": "start"})
        until(ws, "turn_done")
        ws.send_json({"type": "end_call"})
        until(ws, "call_end")
    assert the_call(world["db"]).language == "hindi"  # factories give seniors preferred_language hindi


def test_rescore_is_called_after_the_call(client, world, rescores):
    run_call(client, world)
    assert [r[2] for r in rescores] == ["post_ai_call"] and rescores[0][1] == today()


def test_rescore_failure_does_not_break_the_call(client, world, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("risk down")
    monkeypatch.setattr("app.modules.risk.service.rescore_and_rerank", boom, raising=False)
    events = run_call(client, world)
    assert events[-1]["type"] == "call_end" and the_call(world["db"]).status == "completed"


# ------------------------------------------------------------------ auth
def test_bad_tokens_close_with_4401(client, world, db_session):
    other_coord_token = create_token(str(world["coord"].id), "access", timedelta(minutes=5))
    refresh = create_token(str(world["suser"].id), "refresh", timedelta(minutes=5))
    expired = create_token(str(world["suser"].id), "access", timedelta(seconds=-5))
    orphan = make_user(db_session, "senior")  # senior login with no seniors row
    orphan_token = create_token(str(orphan.id), "access", timedelta(minutes=5))
    for token in ["", "junk", other_coord_token, refresh, expired, orphan_token]:
        with pytest.raises(WebSocketDisconnect) as exc:
            with connect(client, token) as ws:
                ws.receive_json()
        assert exc.value.code == 4401, token
    assert db_session.scalars(select(Call)).all() == []


def test_deactivated_senior_cannot_connect(client, world):
    world["suser"].is_active = False
    world["db"].commit()
    with pytest.raises(WebSocketDisconnect) as exc:
        with connect(client, world["token"]) as ws:
            ws.receive_json()
    assert exc.value.code == 4401


# ------------------------------------------------------------------ protocol errors
def test_protocol_errors_keep_the_socket_open(client, world):
    with connect(client, world["token"]) as ws:
        ws.send_text("not json")
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_json({"type": "dance"})
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_json({"type": "start", "language": "klingon"})
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_bytes(AUDIO)
        assert ws.receive_json()["code"] == "not_started"
        ws.send_json({"type": "end_utterance"})
        assert ws.receive_json()["code"] == "not_started"
        start(ws)
        ws.send_json({"type": "start"})
        assert ws.receive_json()["code"] == "already_started"
        ws.send_json({"type": "end_utterance"})  # no audio
        assert ws.receive_json()["code"] == "no_audio"
        ws.send_json({"type": "end_call"})
        assert until(ws, "call_end")


def test_hang_up_early_is_abandoned_and_still_saved(client, world):
    with connect(client, world["token"]) as ws:
        start(ws)
        speak(ws)
        ws.send_json({"type": "end_call"})
        end = until(ws, "call_end")[-1]
    call = the_call(world["db"])
    assert call.status == "abandoned" and end["call_id"] == str(call.id)
    assert call.call_insights["end_reason"] == "hung_up" and "ended early" in call.summary


def test_dropped_connection_marks_call_abandoned(client, world):
    with connect(client, world["token"]) as ws:
        start(ws)
    call = the_call(world["db"])
    assert call.status == "abandoned" and call.ended_at is not None


def test_silence_is_re_asked_then_skipped(client, world, monkeypatch):
    use(monkeypatch, stt=FakeSTT("", "", "", "ji theek hoon"))
    with connect(client, world["token"]) as ws:
        start(ws)
        first = speak(ws)
        assert [e["type"] for e in first] == ["agent_text", "agent_audio", "turn_done"]  # retry, no transcript
        speak(ws)
        third = speak(ws)  # third silence: move to the next question
        assert "नींद" in third[0]["text"]
        ws.send_json({"type": "end_call"})
        until(ws, "call_end")


# ------------------------------------------------------------------ urgent
@pytest.mark.parametrize("phrase", ["Mere seene mein dard ho raha hai", "mujhe saans nahi aa rahi",
                                    "main gir gayi hoon", "I fell down in the bathroom",
                                    "I have chest pain"],
                         ids=["seene", "saans", "gir", "fell", "chest"])
def test_urgent_phrases_flag_call_and_alert_coordinator(client, world, monkeypatch, rescores, phrase):
    use(monkeypatch, stt=FakeSTT(phrase))
    events = run_call(client, world)
    texts = [e["text"] for e in events if e["type"] == "agent_text"]
    assert texts[-1] == agent_mod.load_phrases("hindi")["urgent"]
    assert "कोऑर्डिनेटर" in texts[-1] and events[-1]["type"] == "call_end"
    call = the_call(world["db"])
    assert call.urgency_flag is True and call.status == "completed" and call.sentiment == "concerned"
    assert [r[2] for r in rescores] == ["new_alert", "post_ai_call"]
    promise = world["db"].scalars(select(SeniorMemoryItem).where(SeniorMemoryItem.kind == "promise")).one()
    assert promise.status == "open"


def test_negated_urgent_words_do_not_trigger(client, world, monkeypatch, rescores):
    use(monkeypatch, stt=FakeSTT("sab theek hai, koi dikkat nahi"))
    run_call(client, world)
    assert not the_call(world["db"]).urgency_flag and "new_alert" not in [r[2] for r in rescores]


# ------------------------------------------------------------------ provider failures
# An LLM outage is not in this list: the agent falls back to the scripted line instead (next test).
@pytest.mark.parametrize("which,code", [("stt", "stt_error"), ("tts", "tts_error")])
def test_provider_failure_degrades_gracefully(client, world, monkeypatch, which, code):
    stt = FakeSTT("theek hoon")
    llm, tts = RecordingLLM(), factory.get_tts()
    if which == "stt":
        stt = Boom()
    if which == "llm":
        llm = Boom()
    if which == "tts":
        tts = Boom()
    use(monkeypatch, stt=stt, llm=llm, tts=tts)
    with connect(client, world["token"]) as ws:
        ws.send_json({"type": "start", "language": "hinglish"})
        events = until(ws, "turn_done", "call_end")
        if which == "stt":
            events = speak(ws, until_types=("call_end",))
    types = [e["type"] for e in events]
    err = next(e for e in events if e["type"] == "error")
    assert err["code"] == code and types[-1] == "call_end"
    assert "agent_text" in types and "turn_done" not in types[types.index("error"):]
    call = the_call(world["db"])
    assert call.status == "failed" and call.ended_at and call.summary
    assert call.call_insights["end_reason"] == code


def test_llm_failure_mid_call_falls_back_to_the_scripted_questions(client, world, monkeypatch):
    calls = {"n": 0}

    def flaky(system, user):
        calls["n"] += 1
        if calls["n"] > 1:
            raise RuntimeError("model throttled")
        return "Namaste ji, aaj kaisa lag raha hai?"
    use(monkeypatch, llm=RecordingLLM(flaky), stt=FakeSTT("mujhe chakkar aa raha hai"))
    with connect(client, world["token"]) as ws:
        start(ws)
        events = speak(ws)  # the model fails on this turn
        assert events[-1]["type"] == "turn_done"  # the call goes on, with the scripted question
        assert any(e["type"] == "agent_text" for e in events) and not [e for e in events if e["type"] == "error"]
        ws.send_json({"type": "end_call"})
        until(ws, "call_end")
    db = world["db"]
    assert the_call(db).status == "abandoned"  # hung up by the senior, not failed
    assert db.scalars(select(SeniorMemoryItem).where(SeniorMemoryItem.kind == "symptom")).one()


# ------------------------------------------------------------------ real LLM path: masking and safety
def test_nothing_personal_reaches_the_llm(client, world, monkeypatch):
    said = FakeSTT("Mera naam Ramesh Kumar hai, mera number 9876543210 hai, chakkar aa raha hai",
                   "Kumar ji ko neend nahi aayi", "theek hoon", "kuch nahi")
    llm = RecordingLLM("Achha ji. Kaisa lag raha hai?")
    use(monkeypatch, stt=said, llm=llm)
    SeniorHealthProfile  # profile is optional; hobbies come from it when present
    run_call(client, world)
    sent = llm.everything
    assert llm.prompts and "[NAME_" in sent and "[PHONE_1]" in sent
    for secret in ["Ramesh", "Kumar", "9876543210"]:
        assert secret not in sent
    db = world["db"]
    call = the_call(db)
    stored = str(call.context_snapshot) + (call.summary or "") + \
        " ".join(m.content for m in db.scalars(select(SeniorMemoryItem)))
    for secret in ["Ramesh", "Kumar", "9876543210"]:
        assert secret not in stored
    assert call.model_info["agent"] == "llm"


def test_llm_name_tokens_are_restored_for_the_senior(client, world, monkeypatch):
    use(monkeypatch, stt=FakeSTT("main Ramesh bol raha hoon"),
        llm=RecordingLLM(lambda s, u: "Namaste [NAME_1] ji, aap kaise hain?"))
    with connect(client, world["token"]) as ws:
        ws.send_json({"type": "start"})
        until(ws, "turn_done")
        ev = speak(ws)
        assert next(e for e in ev if e["type"] == "agent_text")["text"] == "Namaste Ramesh ji, aap kaise hain?"
        ws.send_json({"type": "end_call"})
        until(ws, "call_end")


def test_unsafe_llm_reply_is_replaced(client, world, monkeypatch):
    unsafe = "You have diabetes. Stop taking your medicine and you are fine."
    use(monkeypatch, llm=RecordingLLM(unsafe), stt=FakeSTT("thoda thaka hua hoon"))
    events = run_call(client, world)
    texts = " ".join(e["text"] for e in events if e["type"] == "agent_text")
    assert "diabetes" not in texts and "Stop taking" not in texts
    assert agent_mod.load_phrases("hindi")["safe_fallback"] in texts
    assert all(not violations(e["text"]) for e in events if e["type"] == "agent_text")
    summary = events[-1]["summary"]
    assert not violations(summary) and "diabetes" not in summary.lower()
    assert world["db"].scalars(select(Call)).one().status == "completed"


def test_system_prompt_forbids_diagnosis(client, world, monkeypatch):
    llm = RecordingLLM()
    use(monkeypatch, llm=llm)
    run_call(client, world, answers=1)
    system = llm.prompts[0][0].lower()
    assert "never diagnose" in system and "medicine" in system


# ------------------------------------------------------------------ memory across calls
def test_memory_item_is_created_then_resolved_on_the_next_call(client, world, monkeypatch):
    db = world["db"]
    use(monkeypatch, stt=FakeSTT("mujhe chakkar aa raha hai", "haan", "haan", "nahi"))
    run_call(client, world)
    item = db.scalars(select(SeniorMemoryItem)).one()
    assert (item.kind, item.status, item.content) == ("symptom", "open", "Senior reported dizziness")
    first_call = the_call(db)
    assert item.first_seen_call_id == first_call.id and item.follow_up_after == today() + timedelta(days=1)
    first_call.started_at = datetime.now().astimezone() - timedelta(days=1)
    db.commit()

    # second call: the agent is told about the open item and the last summary, and asks a follow-up
    llm = RecordingLLM()
    use(monkeypatch, stt=FakeSTT("chakkar nahi hai ab, theek hoon", "haan", "haan", "nahi"), llm=llm)
    ev = run_call(client, world)
    sent = llm.everything
    assert "Open item (symptom): Senior reported dizziness" in sent and "Last call summary:" in sent
    calls = db.scalars(select(Call).order_by(Call.started_at)).all()
    assert len(calls) == 2
    snap = calls[1].context_snapshot["context"]
    assert snap["open_memory_items"] == [{"kind": "symptom", "content": "Senior reported dizziness"}]
    assert snap["last_call_summary"] == first_call.summary
    db.expire_all()
    item = db.scalars(select(SeniorMemoryItem)).one()
    assert item.status == "resolved" and item.resolved_at and item.last_seen_call_id == calls[1].id


def test_repeated_symptom_updates_instead_of_duplicating(client, world, monkeypatch):
    use(monkeypatch, stt=FakeSTT("kamzori lag rahi hai"))
    run_call(client, world)
    run_call(client, world)
    items = world["db"].scalars(select(SeniorMemoryItem).where(SeniorMemoryItem.content.contains("weakness"))).all()
    assert len(items) == 1 and items[0].last_seen_call_id != items[0].first_seen_call_id


def test_scripted_agent_follows_up_on_open_symptom(client, world, monkeypatch):
    use(monkeypatch, stt=FakeSTT("kamzori lag rahi hai"))
    run_call(client, world)
    ev = run_call(client, world)
    opening = next(e for e in ev if e["type"] == "agent_text")["text"]
    assert opening.endswith(agent_mod.load_phrases("hindi")["followup"])


def test_medicine_and_hobby_memory(client, world, monkeypatch):
    db = world["db"]
    db.add(SeniorHealthProfile(senior_id=world["senior"].senior_id, hobbies=["carrom", "morning_walk"],
                               usual_activity_summary="carrom, morning walk"))
    db.commit()
    use(monkeypatch, stt=FakeSTT("aaj dawai nahi li, carrom khela", "theek"))
    run_call(client, world)
    items = {(m.kind, m.content) for m in db.scalars(select(SeniorMemoryItem))}
    assert ("medication_issue", "Senior said a medicine was missed or confusing") in items
    assert ("topic", "Enjoys talking about carrom") in items
    assert not any("morning walk" in c for _, c in items)


def test_system_facts_missed_medicine_goes_to_context_and_memory(client, world, monkeypatch):
    db, sid = world["db"], world["senior"].senior_id
    db.add(MedicationSchedule(medication_id="M1", senior_id=sid, drug_name="Amlodipine", dosage="5mg",
                              start_date=today() - timedelta(days=30), times_per_day=1,
                              scheduled_times=["08:00"]))
    db.add(MedicationEvent(medication_event_id="E1", senior_id=sid, medication_id="M1", status="missed",
                           scheduled_at=datetime.combine(today(), datetime.min.time()).astimezone() + timedelta(hours=8),
                           record_source="smart_pillbox"))
    db.commit()
    llm = RecordingLLM()
    use(monkeypatch, llm=llm, stt=FakeSTT("theek hoon"))
    run_call(client, world, answers=1)
    assert "Medicines marked missed today: Amlodipine" in llm.everything
    item = db.scalars(select(SeniorMemoryItem)).one()
    assert item.kind == "medication_issue" and "records" in item.content
    # the senior then says they took it: the system item is resolved at the end of the call
    use(monkeypatch, stt=FakeSTT("haan dawai le li"))
    run_call(client, world, answers=1)
    db.expire_all()
    assert db.scalars(select(SeniorMemoryItem)).one().status == "resolved"


def test_context_builder_collects_facts_without_identity(world):
    from app.modules.risk.models import DailyRiskScore
    from app.modules.vitals.models import Vital
    from app.modules.voice import context_builder
    db, senior = world["db"], world["senior"]
    sid = senior.senior_id
    db.add(SeniorHealthProfile(senior_id=sid, hobbies=["yoga"], usual_activity_summary="Ramesh Kumar does yoga"))
    db.add(DailyRiskScore(senior_id=sid, date=today(), risk_score=70, risk_level="HIGH", scoring_version="t",
                          top_factors=[{"label": "Low sleep for 3 days"}, "Missed evening medicine"]))
    db.add(Vital(measurement_id="V1", senior_id=sid, measured_at=datetime.now().astimezone(),
                 measurement_type="blood_pressure_systolic", value=150, unit="mmHg", source="manual"))
    db.add(Call(kind="ai_agent", senior_id=sid, provider="in_app", status="completed", started_at=datetime.now().astimezone(),
                summary="Spoke to Ramesh on 9876543210"))
    db.commit()
    ctx = context_builder.build_context(db, senior, "hinglish", today(), full_name="Ramesh Kumar")
    assert ctx.risk_factors_today == ["Low sleep for 3 days", "Missed evening medicine"]
    assert ctx.recent_vitals[0]["type"] == "blood_pressure_systolic" and ctx.hobbies == ["yoga"]
    rendered = context_builder.render_context(ctx) + str(ctx.to_dict())
    assert "Ramesh" not in rendered and "9876543210" not in rendered and "[NAME_1]" in rendered
