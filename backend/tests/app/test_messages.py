import io
import wave

import pytest
from sqlalchemy import select

from app.integrations.base import Segment
from app.integrations.storage import LocalStorage
from app.modules.auth.models import AuditLog
from app.modules.checkins.models import Checkin, NlpCue
from app.modules.messages import service as msg_service
from app.modules.messages.models import Message
from tests.app.factories import auth, make_senior, make_user, senior_headers as _sh


def senior_headers(client, db_session, suser):
    return _sh(suser)

API = "/api/v1"


@pytest.fixture(autouse=True)
def storage(tmp_path, monkeypatch):
    store = LocalStorage(tmp_path)
    monkeypatch.setattr(msg_service, "get_storage", lambda: store)
    return store


@pytest.fixture
def world(db_session, client):
    coord = make_user(db_session, "coordinator", city="Jaipur", email="c1@test.local")
    other = make_user(db_session, "coordinator", city="Jaipur", email="c2@test.local")
    senior, suser = make_senior(db_session, coord, sid="S9001")
    senior2, suser2 = make_senior(db_session, other, sid="S9002")
    ops = make_user(db_session, "ops", city="Jaipur", email="ops@test.local")
    admin = make_user(db_session, "admin", email="admin@test.local")
    family = make_user(db_session, "family", email="fam@test.local")
    return dict(coord=coord, other=other, senior=senior, suser=suser, senior2=senior2, suser2=suser2,
                H=dict(coord=auth(client, "c1@test.local"), other=auth(client, "c2@test.local"),
                       ops=auth(client, "ops@test.local"), admin=auth(client, "admin@test.local"),
                       family=auth(client, "fam@test.local")))


def wav_bytes(seconds: float, rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(rate * seconds))
    return buf.getvalue()


# ---- text ----------------------------------------------------------------------------------
def test_coordinator_sends_and_lists_text(client, world):
    r = client.post(f"{API}/seniors/S9001/messages", json={"body": " Namaste "}, headers=world["H"]["coord"])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "text" and body["body"] == "Namaste" and body["sender"]["role"] == "coordinator"
    assert body["language"] == "hindi" and body["audio_url"] is None
    r = client.get(f"{API}/seniors/S9001/messages", headers=world["H"]["coord"])
    assert r.status_code == 200
    assert r.json()["total"] == 1 and r.json()["limit"] == 50 and r.json()["items"][0]["id"] == body["id"]


def test_list_is_newest_first_and_paginates(client, world):
    for i in range(3):
        client.post(f"{API}/seniors/S9001/messages", json={"body": f"m{i}"}, headers=world["H"]["coord"])
    r = client.get(f"{API}/seniors/S9001/messages?limit=2", headers=world["H"]["coord"]).json()
    assert [m["body"] for m in r["items"]] == ["m2", "m1"] and r["total"] == 3
    r = client.get(f"{API}/seniors/S9001/messages?limit=2&offset=2", headers=world["H"]["coord"]).json()
    assert [m["body"] for m in r["items"]] == ["m0"]
    assert client.get(f"{API}/seniors/S9001/messages?limit=201", headers=world["H"]["coord"]).status_code == 422
    before = r["items"][0]["created_at"]
    r = client.get(f"{API}/seniors/S9001/messages", params={"before": before}, headers=world["H"]["coord"]).json()
    assert r["items"] == []


@pytest.mark.parametrize("payload", [{"body": "   "}, {}, {"body": "x" * 2001}, {"body": "hi", "language": "klingon"}])
def test_text_validation_422(client, world, payload):
    r = client.post(f"{API}/seniors/S9001/messages", json=payload, headers=world["H"]["coord"])
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_invalid_json_body_422(client, world):
    r = client.post(f"{API}/seniors/S9001/messages", content=b"not json",
                    headers={**world["H"]["coord"], "Content-Type": "application/json"})
    assert r.status_code == 422


def test_auth_rules_for_thread(client, world, db_session):
    H = world["H"]
    url = f"{API}/seniors/S9001/messages"
    assert client.get(url).status_code == 401
    assert client.post(url, json={"body": "x"}).status_code == 401
    assert client.get(url, headers=H["other"]).status_code == 403          # wrong coordinator
    assert client.post(url, json={"body": "x"}, headers=H["other"]).status_code == 403
    assert client.get(url, headers=H["family"]).status_code == 403
    assert client.post(url, json={"body": "x"}, headers=H["family"]).status_code == 403
    assert client.post(url, json={"body": "x"}, headers=H["ops"]).status_code == 403   # ops cannot send
    assert client.get(url, headers=H["ops"]).status_code == 200                        # but can read in scope
    assert client.get(url, headers=H["admin"]).status_code == 200
    assert client.post(url, json={"body": "x"}, headers=H["admin"]).status_code == 201
    assert client.get(f"{API}/seniors/NOPE/messages", headers=H["coord"]).status_code == 404
    assert client.post(f"{API}/seniors/NOPE/messages", json={"body": "x"}, headers=H["coord"]).status_code == 404


def test_ops_outside_city_cannot_read(client, world, db_session):
    make_user(db_session, "ops", city="Pune", email="ops2@test.local")
    h = auth(client, "ops2@test.local")
    assert client.get(f"{API}/seniors/S9001/messages", headers=h).status_code == 403


def test_staff_reads_are_audited_without_pii(client, world, db_session):
    client.get(f"{API}/seniors/S9001/messages", headers=world["H"]["coord"])
    rows = db_session.scalars(select(AuditLog).where(AuditLog.action == "messages.list")).all()
    assert len(rows) == 1 and rows[0].senior_id == "S9001" and rows[0].detail == {}


# ---- read receipts --------------------------------------------------------------------------
def test_mark_read(client, world, db_session):
    H = world["H"]
    m = client.post(f"{API}/seniors/S9001/messages", json={"body": "hi"}, headers=H["coord"]).json()
    # sender marking own message is a no-op
    assert client.post(f"{API}/messages/{m['id']}/read", headers=H["coord"]).status_code == 204
    assert client.get(f"{API}/seniors/S9001/messages", headers=H["coord"]).json()["items"][0]["read_at"] is None
    sh = senior_headers(client, db_session, world["suser"])
    assert client.post(f"{API}/messages/{m['id']}/read", headers=sh).status_code == 204
    first = client.get(f"{API}/me/messages", headers=sh).json()["items"][0]["read_at"]
    assert first is not None
    client.post(f"{API}/messages/{m['id']}/read", headers=sh)
    assert client.get(f"{API}/me/messages", headers=sh).json()["items"][0]["read_at"] == first


def test_mark_read_rules(client, world, db_session):
    H = world["H"]
    m = client.post(f"{API}/seniors/S9001/messages", json={"body": "hi"}, headers=H["coord"]).json()
    url = f"{API}/messages/{m['id']}/read"
    assert client.post(url).status_code == 401
    assert client.post(url, headers=H["other"]).status_code == 403
    assert client.post(url, headers=H["ops"]).status_code == 403
    assert client.post(url, headers=H["family"]).status_code == 403
    sh2 = senior_headers(client, db_session, world["suser2"])
    assert client.post(url, headers=sh2).status_code == 403
    assert client.post(f"{API}/messages/00000000-0000-0000-0000-000000000000/read", headers=H["coord"]).status_code == 404
    assert client.post(f"{API}/messages/not-a-uuid/read", headers=H["coord"]).status_code == 422


# ---- voice notes ----------------------------------------------------------------------------
def upload(client, headers, url, data=b"fake-m4a-bytes", name="note.m4a", ctype="audio/mp4", **form):
    return client.post(url, files={"audio": (name, data, ctype)}, data=form, headers=headers)


def test_senior_voice_note_pipeline(client, world, db_session, storage):
    sh = senior_headers(client, db_session, world["suser"])
    r = upload(client, sh, f"{API}/me/messages", language="hinglish")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "voice_note" and body["sender"]["role"] == "senior"
    assert body["transcript"] and body["language"] == "hinglish"
    assert body["summary"] is None and body["urgency_flag"] is None          # hidden from the senior
    assert body["audio_url"].endswith(f"/api/v1/messages/{body['id']}/audio")
    row = db_session.scalar(select(Message))
    assert row.audio_path.startswith("messages/S9001/") and row.audio_path.endswith(".m4a")
    assert storage.get(row.audio_path) == b"fake-m4a-bytes"
    assert row.summary and row.checkin_id
    checkin = db_session.get(Checkin, row.checkin_id)
    assert checkin.channel == "voice_note" and checkin.senior_id == "S9001"
    cues = db_session.scalars(select(NlpCue).where(NlpCue.source_id == str(row.id))).all()
    assert cues and all(c.source_type == "message" for c in cues)
    # staff sees summary and urgency
    staff = client.get(f"{API}/seniors/S9001/messages", headers=world["H"]["coord"]).json()["items"][0]
    assert staff["summary"] and staff["urgency_flag"] is False


def test_voice_note_summary_is_masked_before_llm(client, world, db_session, monkeypatch):
    seen = {}

    class Spy:
        def complete(self, system, user):
            seen["user"] = user
            return "ok summary"

    class Stt:
        def transcribe(self, audio, language):
            return [Segment(text="Main Test Person bol raha hoon, 98765 43210 par call karo", confidence=0.8)]

    monkeypatch.setattr(msg_service, "get_llm", lambda: Spy())
    monkeypatch.setattr(msg_service, "get_stt", lambda: Stt())
    sh = senior_headers(client, db_session, world["suser"])
    assert upload(client, sh, f"{API}/me/messages").status_code == 201
    assert "Person" not in seen["user"] and "98765" not in seen["user"]


def test_unsafe_summary_is_dropped(client, world, db_session, monkeypatch):
    class Llm:
        def complete(self, system, user):
            return "You have diabetes, stop your tablet."

    monkeypatch.setattr(msg_service, "get_llm", lambda: Llm())
    sh = senior_headers(client, db_session, world["suser"])
    r = upload(client, sh, f"{API}/me/messages")
    assert r.status_code == 201 and db_session.scalar(select(Message)).summary is None


def test_stt_failure_still_saves_message(client, world, db_session, monkeypatch):
    class Boom:
        def transcribe(self, *a):
            raise RuntimeError("stt down")

    monkeypatch.setattr(msg_service, "get_stt", lambda: Boom())
    sh = senior_headers(client, db_session, world["suser"])
    r = upload(client, sh, f"{API}/me/messages")
    assert r.status_code == 201
    assert r.json()["transcript"] is None
    assert db_session.scalar(select(Message)).audio_path


def test_llm_failure_still_saves_transcript(client, world, db_session, monkeypatch):
    class Boom:
        def complete(self, *a):
            raise RuntimeError("llm down")

    monkeypatch.setattr(msg_service, "get_llm", lambda: Boom())
    sh = senior_headers(client, db_session, world["suser"])
    r = upload(client, sh, f"{API}/me/messages")
    assert r.status_code == 201 and r.json()["transcript"]
    assert db_session.scalar(select(Message)).summary is None


def test_storage_failure_is_502(client, world, db_session, monkeypatch):
    class Boom:
        def put(self, *a):
            raise OSError("disk")

    monkeypatch.setattr(msg_service, "get_storage", lambda: Boom())
    sh = senior_headers(client, db_session, world["suser"])
    assert upload(client, sh, f"{API}/me/messages").status_code == 502
    assert db_session.scalar(select(Message)) is None


def test_urgent_voice_note_triggers_rescore_and_flag(client, world, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr(msg_service, "safe_rescore", lambda db, sid, *a, **k: calls.append(sid))

    class Stt:
        def transcribe(self, audio, language):
            return [Segment(text="Main gir gaya, bahut dard hai", confidence=0.9)]

    monkeypatch.setattr(msg_service, "get_stt", lambda: Stt())
    sh = senior_headers(client, db_session, world["suser"])
    assert upload(client, sh, f"{API}/me/messages").status_code == 201
    row = db_session.scalar(select(Message))
    assert row.urgency_flag is True and calls == ["S9001"]


def test_rescore_wrapper_swallows_errors(db_session, monkeypatch):
    import sys, types
    mod = types.ModuleType("app.modules.risk.service")
    def boom(*a, **k):
        raise RuntimeError("x")
    mod.rescore_and_rerank = boom
    monkeypatch.setitem(sys.modules, "app.modules.risk.service", mod)
    msg_service.safe_rescore(db_session, "S1")  # must not raise


def test_notify_called_with_generic_text(client, world, db_session, monkeypatch):
    import sys, types
    sent = []
    mod = types.ModuleType("app.modules.notifications.service")
    mod.notify = lambda db, user_id, kind, title, body, data: sent.append((user_id, kind, title, body, data))
    monkeypatch.setitem(sys.modules, "app.modules.notifications.service", mod)
    client.post(f"{API}/seniors/S9001/messages", json={"body": "secret health text"}, headers=world["H"]["coord"])
    sh = senior_headers(client, db_session, world["suser"])
    client.post(f"{API}/me/messages", json={"body": "dard hai"}, headers=sh)
    assert [s[0] for s in sent] == [world["suser"].id, world["coord"].id]
    assert all(s[1] == "message_received" and "secret" not in s[3] and "dard" not in s[3] for s in sent)
    assert sent[0][4]["senior_id"] == "S9001"


def test_notify_failure_does_not_break_send(client, world, monkeypatch):
    import sys, types
    mod = types.ModuleType("app.modules.notifications.service")
    def boom(*a, **k):
        raise RuntimeError("push down")
    mod.notify = boom
    monkeypatch.setitem(sys.modules, "app.modules.notifications.service", mod)
    assert client.post(f"{API}/seniors/S9001/messages", json={"body": "x"}, headers=world["H"]["coord"]).status_code == 201


def test_coordinator_voice_note_has_transcript_but_no_checkin(client, world, db_session):
    r = upload(client, world["H"]["coord"], f"{API}/seniors/S9001/messages", name="a.wav", ctype="audio/wav",
               data=wav_bytes(1))
    assert r.status_code == 201 and r.json()["transcript"]
    assert db_session.scalar(select(Message)).checkin_id is None
    assert db_session.scalar(select(Checkin)) is None


@pytest.mark.parametrize("kwargs,status", [
    (dict(data=b""), 422),
    (dict(data=b"x" * (2 * 1024 * 1024 + 1)), 413),
    (dict(name="a.txt", ctype="text/plain"), 422),
    (dict(data=wav_bytes(61)), 422),
    (dict(duration_sec="75"), 422),
    (dict(duration_sec="abc"), 422),
    (dict(language="klingon"), 422),
])
def test_voice_note_validation(client, world, kwargs, status):
    kwargs = dict(kwargs)
    name = kwargs.pop("name", "a.wav" if "data" in kwargs and kwargs["data"][:4] == b"RIFF" else "a.m4a")
    ctype = kwargs.pop("ctype", "audio/wav" if name.endswith("wav") else "audio/mp4")
    r = upload(client, world["H"]["coord"], f"{API}/seniors/S9001/messages", name=name, ctype=ctype, **kwargs)
    assert r.status_code == status, r.text


def test_multipart_without_audio_422(client, world):
    r = client.post(f"{API}/seniors/S9001/messages", data={"language": "hindi"}, files={"x": ("a", b"b")},
                    headers=world["H"]["coord"])
    assert r.status_code == 422


def test_voice_note_upload_auth(client, world, db_session):
    url = f"{API}/seniors/S9001/messages"
    assert upload(client, {}, url).status_code == 401
    assert upload(client, world["H"]["other"], url).status_code == 403
    assert upload(client, world["H"]["ops"], url).status_code == 403
    assert upload(client, world["H"]["family"], url).status_code == 403
    assert upload(client, world["H"]["coord"], f"{API}/seniors/NOPE/messages").status_code == 404


# ---- audio streaming ------------------------------------------------------------------------
def test_audio_stream_and_access(client, world, db_session):
    sh = senior_headers(client, db_session, world["suser"])
    m = upload(client, sh, f"{API}/me/messages").json()
    url = f"{API}/messages/{m['id']}/audio"
    assert client.get(url).status_code == 401
    r = client.get(url, headers=world["H"]["coord"])
    assert r.status_code == 200 and r.content == b"fake-m4a-bytes" and r.headers["content-type"] == "audio/mp4"
    assert client.get(url, headers=sh).status_code == 200
    assert client.get(url, headers=world["H"]["ops"]).status_code == 200
    assert client.get(url, headers=world["H"]["admin"]).status_code == 200
    assert client.get(url, headers=world["H"]["other"]).status_code == 403
    assert client.get(url, headers=world["H"]["family"]).status_code == 403
    assert client.get(url, headers=senior_headers(client, db_session, world["suser2"])).status_code == 403
    assert client.get(f"{API}/messages/00000000-0000-0000-0000-000000000000/audio",
                      headers=world["H"]["coord"]).status_code == 404
    assert db_session.scalars(select(AuditLog).where(AuditLog.action == "messages.audio")).all()


def test_audio_404_for_text_and_deleted_file(client, world, db_session, storage):
    t = client.post(f"{API}/seniors/S9001/messages", json={"body": "hi"}, headers=world["H"]["coord"]).json()
    assert client.get(f"{API}/messages/{t['id']}/audio", headers=world["H"]["coord"]).status_code == 404
    sh = senior_headers(client, db_session, world["suser"])
    m = upload(client, sh, f"{API}/me/messages").json()
    storage.delete(db_session.scalar(select(Message).where(Message.kind == "voice_note")).audio_path)
    assert client.get(f"{API}/messages/{m['id']}/audio", headers=world["H"]["coord"]).status_code == 404


def test_senior_text_with_fall_is_urgent(client, world, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr(msg_service, "safe_rescore", lambda db, sid, *a, **k: calls.append(sid))
    sh = senior_headers(client, db_session, world["suser"])
    assert client.post(f"{API}/me/messages", json={"body": "Main gir gaya"}, headers=sh).status_code == 201
    assert calls == ["S9001"]
