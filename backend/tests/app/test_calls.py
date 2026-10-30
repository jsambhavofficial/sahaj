import contextlib
import uuid

import httpx
import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.integrations.base import CallInfo, Segment
from app.integrations.exotel.client import ExotelTelephony, to_call_info
from app.integrations.masking import mask, unmask
from app.integrations.storage import LocalStorage
from app.integrations.stub.providers import StubLLM, StubSTT, StubTelephony
from app.main import create_app
from app.modules.auth.models import User
from app.modules.calls import router as calls_router
from app.modules.calls import service as calls_service
from app.modules.calls.service import CallService, poll_and_finalize
from app.modules.checkins.models import NlpCue
from app.modules.seniors.models import Senior, SeniorContact
from app.modules.voice.models import Call, CallTurn


@pytest.fixture
def people(db_session):
    coord = User(id=uuid.uuid4(), role="coordinator", display_name="Care Coordinator Rekha", phone="+919800000001")
    db_session.add(coord)
    db_session.flush()
    db_session.add(Senior(senior_id="S0001", age=71, city="Pune", living_arrangement="alone",
                          preferred_language="hinglish", coordinator_id=coord.id))
    db_session.add(SeniorContact(senior_id="S0001", full_name="Shanti Khanna", phone="+910000123456"))
    db_session.commit()
    return coord


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(tmp_path)


def make_service(db, storage, **kw):
    return CallService(db, telephony=kw.pop("telephony", StubTelephony()), stt=kw.pop("stt", StubSTT()),
                       llm=kw.pop("llm", StubLLM()), storage=storage)


# ---- masking -------------------------------------------------------------------------------
def test_masking_hides_names_and_phones_and_restores():
    text = "Shanti ji ka number 98765 43210 hai, Khanna ji ne bataya."
    masked, mapping = mask(text, ["Shanti Khanna"])
    assert "Shanti" not in masked and "Khanna" not in masked and "98765" not in masked
    assert unmask(masked, mapping) == text


# ---- Exotel client (HTTP mocked) -----------------------------------------------------------
def exotel(handler):
    return ExotelTelephony(api_key="k", api_token="t", account_sid="acct", subdomain="api.exotel.com",
                           client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_exotel_connect_call_sends_recording_and_callback_fields():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["body"] = str(request.url), request.content.decode()
        return httpx.Response(200, json={"Call": {"Sid": "abc123", "Status": "in-progress"}})

    sid = exotel(handler).connect_call(from_number="+911", to_number="+912", caller_id="080",
                                       status_callback="https://x/cb?token=s")
    assert sid == "abc123"
    assert seen["url"].endswith("/v1/Accounts/acct/Calls/connect")
    for field in ("Record=true", "RecordingChannels=dual", "CallerId=080", "StatusCallbackContentType"):
        assert field in seen["body"]


def test_exotel_get_call_parses_json_and_xml():
    info = exotel(lambda r: httpx.Response(200, json={"Call": {
        "Sid": "s1", "Status": "completed", "Duration": "45", "RecordingUrl": "https://r/x.mp3",
        "StartTime": "2026-02-25 10:48:33"}})).get_call("s1")
    assert (info.status, info.duration_sec, info.recording_url) == ("completed", 45, "https://r/x.mp3")
    xml = "<TwilioResponse><Call><Sid>s2</Sid><Status>no-answer</Status></Call></TwilioResponse>"
    assert exotel(lambda r: httpx.Response(200, text=xml)).get_call("s2").status == "no_answer"


def test_exotel_error_is_raised():
    with pytest.raises(Exception, match="HTTP 401"):
        exotel(lambda r: httpx.Response(401, text="no")).get_call("s")


# ---- service: consent, pipeline ------------------------------------------------------------
def test_call_requires_consent(db_session, people, storage):
    with pytest.raises(Exception) as err:
        make_service(db_session, storage).start_call(senior_id="S0001", recording_consent=False)
    assert err.value.code == "consent_required"


def test_start_call_creates_row_with_provider_sid(db_session, people, storage):
    call = make_service(db_session, storage).start_call(senior_id="S0001", recording_consent=True)
    assert call.provider_call_sid.startswith("STUB-") and call.status == "queued"
    assert call.transcript_status == "pending" and call.recording_consent and call.consent_at


def test_real_provider_refuses_placeholder_numbers(db_session, people, storage, monkeypatch):
    monkeypatch.setenv("TELEPHONY_PROVIDER", "exotel")
    get_settings.cache_clear()
    try:
        with pytest.raises(Exception) as err:
            make_service(db_session, storage).start_call(senior_id="S0001", recording_consent=True)
        assert err.value.code == "no_phone_number"
    finally:
        get_settings.cache_clear()


def test_finalize_stores_audio_turns_summary_cues(db_session, people, storage):
    svc = make_service(db_session, storage)
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    svc.finalize(call.id)
    db_session.refresh(call)
    assert call.transcript_status == "done" and call.processed_at
    assert storage.get(call.recording_path).startswith(b"STUB-AUDIO")
    assert call.recording_expires_at > call.processed_at
    turns = db_session.scalars(select(CallTurn).where(CallTurn.call_id == call.id)
                               .order_by(CallTurn.turn_index)).all()
    assert [t.speaker for t in turns][:2] == ["coordinator", "senior"]
    cues = {(c.cue_type, c.cue_value) for c in db_session.scalars(select(NlpCue))}
    assert ("dizziness", "present") in cues and ("weakness", "present") in cues
    assert call.summary.startswith("Auto-summary")


def test_finalize_twice_does_not_duplicate(db_session, people, storage):
    svc = make_service(db_session, storage)
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    svc.finalize(call.id)
    svc.finalize(call.id)
    assert len(db_session.scalars(select(CallTurn)).all()) == 5


def test_personal_data_never_reaches_the_llm(db_session, people, storage):
    class Talky:
        def transcribe(self, audio, language):
            return [Segment("Namaste Shanti ji, aapka number 98765 43210 hai na?", "coordinator"),
                    Segment("Haan, Khanna bol rahi hoon.", "senior")]

    class Spy:
        seen = ""

        def complete(self, system, user):
            Spy.seen = user
            return "Call with [NAME_1] about [PHONE_1]."

    svc = make_service(db_session, storage, stt=Talky(), llm=Spy())
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    svc.finalize(call.id)
    assert "Shanti" not in Spy.seen and "Khanna" not in Spy.seen and "98765" not in Spy.seen
    db_session.refresh(call)
    assert "Khanna" in call.summary and "98765 43210" in call.summary  # restored for the coordinator


def test_fall_mentioned_sets_urgency(db_session, people, storage):
    class Fall:
        def transcribe(self, audio, language):
            return [Segment("Kal main gir gaya tha bathroom mein, chot aayi.", "senior")]

    svc = make_service(db_session, storage, stt=Fall())
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    svc.finalize(call.id)
    db_session.refresh(call)
    assert call.urgency_flag is True


def test_poll_waits_for_recording_then_finalizes(db_session, people, storage):
    class Slow(StubTelephony):
        n = 0

        def get_call(self, sid):
            Slow.n += 1
            if Slow.n < 3:
                return CallInfo(sid=sid, status="in_progress")
            return super().get_call(sid)

    svc = make_service(db_session, storage, telephony=Slow())
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    poll_and_finalize(call.id, lambda: contextlib.nullcontext(db_session), sleep=lambda s: None,
                      telephony=Slow(), stt=StubSTT(), llm=StubLLM(), storage=storage)
    db_session.refresh(call)
    assert call.transcript_status == "done" and Slow.n >= 3


def test_unanswered_call_is_not_processed(db_session, people, storage):
    class NoAnswer(StubTelephony):
        def get_call(self, sid):
            return CallInfo(sid=sid, status="no_answer")

    call = make_service(db_session, storage).start_call(senior_id="S0001", recording_consent=True)
    poll_and_finalize(call.id, lambda: contextlib.nullcontext(db_session), sleep=lambda s: None,
                      telephony=NoAnswer(), stt=StubSTT(), llm=StubLLM(), storage=storage)
    db_session.refresh(call)
    assert call.status == "no_answer" and call.transcript_status == "not_applicable"
    assert call.recording_path is None


# ---- HTTP API ------------------------------------------------------------------------------
@pytest.fixture
def api(db_session, storage, monkeypatch):
    monkeypatch.setattr(calls_service, "get_storage", lambda: storage)
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[calls_router.get_session_factory] = lambda: (
        lambda: contextlib.nullcontext(db_session))
    from fastapi.testclient import TestClient
    return TestClient(app)


def H(user):
    from tests.app.factories import senior_headers
    return senior_headers(user)


def test_connect_endpoint_processes_call_in_background(api, db_session, people):
    r = api.post("/api/v1/calls/connect", json={"senior_id": "S0001", "recording_consent": True},
                 headers=H(people))
    assert r.status_code == 202 and r.json()["transcript_status"] == "pending"
    body = api.get(f"/api/v1/calls/{r.json()['id']}", headers=H(people)).json()
    assert body["transcript_status"] == "done" and body["recording_stored"] is True
    assert len(body["turns"]) == 5 and {c["cue_type"] for c in body["cues"]} >= {"dizziness"}


def test_connect_without_consent_is_rejected(api, people):
    r = api.post("/api/v1/calls/connect", json={"senior_id": "S0001", "recording_consent": False},
                 headers=H(people))
    assert r.status_code == 400 and r.json()["error"]["code"] == "consent_required"


def test_unknown_senior_is_404(api, people):
    r = api.post("/api/v1/calls/connect", json={"senior_id": "S9999", "recording_consent": True},
                 headers=H(people))
    assert r.status_code == 404


def test_webhook_rejects_wrong_token(api, monkeypatch):
    monkeypatch.setenv("EXOTEL_WEBHOOK_SECRET", "right")
    get_settings.cache_clear()
    try:
        r = api.post("/api/v1/webhooks/exotel/call-status?token=wrong", json={"CallSid": "x"})
        assert r.status_code == 401
    finally:
        get_settings.cache_clear()


def test_webhook_updates_call_and_processes_recording(api, db_session, people, storage):
    call = make_service(db_session, storage).start_call(senior_id="S0001", recording_consent=True)
    r = api.post("/api/v1/webhooks/exotel/call-status", json={
        "CallSid": call.provider_call_sid, "Status": "completed", "Duration": "58",
        "RecordingUrl": "https://example/recording.mp3", "StartTime": "2026-02-25 10:48:33"})
    assert r.json() == {"ok": True, "matched": True}
    db_session.refresh(call)
    assert call.transcript_status == "done" and call.duration_sec == 58


def test_webhook_ignores_unknown_call(api):
    assert api.post("/api/v1/webhooks/exotel/call-status", json={"CallSid": "nope"}).json()["matched"] is False


def test_call_endpoints_require_authentication_and_scope(api, db_session, people):
    from tests.app.factories import make_user
    body = {"senior_id": "S0001", "recording_consent": True}
    assert api.post("/api/v1/calls/connect", json=body).status_code == 401
    other = make_user(db_session, "coordinator")
    assert api.post("/api/v1/calls/connect", json=body, headers=H(other)).status_code == 403
    ops = make_user(db_session, "ops")
    assert api.post("/api/v1/calls/connect", json=body, headers=H(ops)).status_code == 403
    call_id = api.post("/api/v1/calls/connect", json=body, headers=H(people)).json()["id"]
    assert api.get(f"/api/v1/calls/{call_id}").status_code == 401
    assert api.get(f"/api/v1/calls/{call_id}", headers=H(other)).status_code == 403
    assert api.post(f"/api/v1/calls/{call_id}/process", headers=H(ops)).status_code == 403


def test_senior_can_call_coordinator_but_never_sees_transcript(api, db_session, people):
    from app.modules.seniors.models import Senior
    from tests.app.factories import make_user
    suser = make_user(db_session, "senior", ref="S0001")
    db_session.get(Senior, "S0001").user_id = suser.id
    db_session.commit()
    r = api.post("/api/v1/me/call-coordinator", json={"recording_consent": True}, headers=H(suser))
    assert r.status_code == 202 and r.json()["senior_id"] == "S0001"
    body = api.get(f"/api/v1/calls/{r.json()['id']}", headers=H(suser)).json()
    assert body["turns"] == [] and body["cues"] == [] and body["summary"] is None
    assert api.post("/api/v1/me/call-coordinator", json={"recording_consent": False},
                    headers=H(suser)).status_code == 400
    # a senior cannot start a call for another senior
    assert api.post("/api/v1/calls/connect", json={"senior_id": "S0002", "recording_consent": True},
                    headers=H(suser)).status_code in (403, 404)


def test_finished_call_triggers_rescore_and_coordinator_notification(db_session, people, storage, monkeypatch):
    seen = {}
    monkeypatch.setattr("app.modules.risk.service.rescore_and_rerank",
                        lambda db, sid, day, reason: seen.update(sid=sid, reason=reason))
    monkeypatch.setattr("app.modules.notifications.service.notify",
                        lambda db, uid, kind, title, body, data=None, **kw: seen.update(kind=kind, uid=uid))
    svc = make_service(db_session, storage)
    call = svc.start_call(senior_id="S0001", recording_consent=True)
    svc.finalize(call.id)
    assert seen["sid"] == "S0001" and seen["kind"] == "call_summary_ready" and seen["uid"] == people.id


# ---- uploaded recordings (no telephony) ----------------------------------------------------
def _tone_wav(stereo: bool = False, seconds: int = 3) -> bytes:
    import subprocess
    args = ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=f=440:d={seconds}"]
    if stereo:
        args += ["-f", "lavfi", "-i", f"sine=f=880:d={seconds}", "-filter_complex", "[0][1]amerge=inputs=2"]
    return subprocess.run([*args, "-f", "wav", "-"], check=True, capture_output=True).stdout


def _upload(api, user, data=None, name="talk.wav", **form):
    fields = {"senior_id": "S0001", "recording_consent": "true", **form}
    return api.post("/api/v1/calls/import", data=fields, files={"file": (name, data if data is not None else _tone_wav(), "audio/wav")},
                    headers=H(user))


def test_import_processes_an_uploaded_recording(api, db_session, people, storage):
    r = _upload(api, people, _tone_wav(stereo=True))
    assert r.status_code == 202 and r.json()["transcript_status"] == "pending"
    body = api.get(f"/api/v1/calls/{r.json()['id']}", headers=H(people)).json()
    assert body["transcript_status"] == "done" and body["recording_stored"] is True
    assert body["duration_sec"] in (2, 3) and len(body["turns"]) == 5
    call = db_session.get(Call, uuid.UUID(body["id"]))
    assert call.provider == "import" and call.recording_consent and call.consent_at
    assert storage.get(call.recording_path)[:4] == b"RIFF"


def test_import_requires_consent(api, people):
    r = _upload(api, people, recording_consent="false")
    assert r.status_code == 400 and r.json()["error"]["code"] == "consent_required"


@pytest.mark.parametrize("name,data,code", [("notes.txt", b"hello", "unsupported_audio"),
                                            ("fake.mp3", b"this is not audio at all", "unreadable_audio")])
def test_import_rejects_bad_files(api, people, name, data, code):
    r = _upload(api, people, data, name=name)
    assert r.status_code == 422 and r.json()["error"]["code"] == code


def test_import_rejects_oversized_and_overlong_files(api, people, monkeypatch):
    monkeypatch.setattr(calls_service, "MAX_IMPORT_BYTES", 1000)
    assert _upload(api, people).json()["error"]["code"] == "file_too_large"
    monkeypatch.setattr(calls_service, "MAX_IMPORT_BYTES", 25 * 1024 * 1024)
    monkeypatch.setattr(calls_service, "MAX_IMPORT_SECONDS", 1)
    assert _upload(api, people).json()["error"]["code"] == "recording_too_long"


def test_import_is_limited_to_the_coordinators_own_seniors(api, db_session, people):
    other = User(id=uuid.uuid4(), role="coordinator", display_name="Other Coordinator")
    db_session.add(other)
    db_session.commit()
    assert _upload(api, other).status_code in (403, 404)


def test_import_needs_login(api, people):
    r = api.post("/api/v1/calls/import", data={"senior_id": "S0001", "recording_consent": "true"},
                 files={"file": ("a.wav", _tone_wav(), "audio/wav")})
    assert r.status_code == 401


def test_processing_a_stored_recording_never_touches_telephony(db_session, people, storage):
    class Boom(StubTelephony):
        def get_call(self, sid): raise AssertionError("telephony must not be used")
        def download_recording(self, url): raise AssertionError("telephony must not be used")

    svc = make_service(db_session, storage, telephony=Boom())
    call = svc.import_recording(senior_id="S0001", audio=_tone_wav(), filename="x.wav", recording_consent=True)
    svc.finalize(call.id)
    db_session.refresh(call)
    assert call.transcript_status == "done"


def test_mono_speakers_are_stored_as_unknown_and_still_yield_cues(db_session, people, storage):
    class Mono:
        def transcribe(self, audio, language):
            return [Segment("Thoda chakkar aa raha hai", speaker="unknown")]

    svc = make_service(db_session, storage, stt=Mono())
    call = svc.import_recording(senior_id="S0001", audio=_tone_wav(), filename="x.wav", recording_consent=True)
    svc.finalize(call.id)
    assert db_session.scalars(select(CallTurn.speaker).where(CallTurn.call_id == call.id)).all() == ["unknown"]
    assert ("dizziness", "present") in {(c.cue_type, c.cue_value) for c in db_session.scalars(select(NlpCue))}
