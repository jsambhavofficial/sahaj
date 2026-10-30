from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.checkins.models import Checkin, NlpCue
from app.modules.me import service as me_service
from app.modules.medications.models import MedicationEvent
from app.modules.messages import service as msg_service
from app.modules.vitals.models import Vital
from tests.app.factories import auth, make_schedule, make_senior, make_user, senior_headers

API = "/api/v1"
IST = timezone(timedelta(hours=5, minutes=30))
DAY = date(2026, 10, 11)


@pytest.fixture
def world(db_session, client):
    coord = make_user(db_session, "coordinator", city="Jaipur", email="c1@test.local")
    senior, suser = make_senior(db_session, coord, sid="S9001")
    senior.preferred_language = "hinglish"
    senior.checkin_days_of_week = ["Tue", "Fri"]
    senior.checkin_preferred_hour = 16
    db_session.commit()
    senior2, suser2 = make_senior(db_session, coord, sid="S9002")
    make_user(db_session, "ops", city="Jaipur", email="ops@test.local")
    make_user(db_session, "family", email="fam@test.local")
    return dict(coord=coord, senior=senior, suser=suser, suser2=suser2, senior2=senior2,
                SH=senior_headers(suser), SH2=senior_headers(suser2),
                CH=auth(client, "c1@test.local"), OH=auth(client, "ops@test.local"),
                FH=auth(client, "fam@test.local"))


def at(hhmm: str, day=DAY) -> datetime:
    h, m = hhmm.split(":")
    return datetime(day.year, day.month, day.day, int(h), int(m), tzinfo=IST)


def add_event(db, senior, sched, when, status, source="smart_pillbox"):
    ev = MedicationEvent(medication_event_id=f"E{when.timestamp()}{sched.medication_id}", senior_id=senior.senior_id,
                         medication_id=sched.medication_id, scheduled_at=when.astimezone(timezone.utc),
                         status=status, record_source=source, verification_status="verified")
    db.add(ev)
    db.commit()
    return ev


ALL_ME_ROUTES = [
    ("get", "/me/home", None),
    ("post", "/me/medications/M1/confirm", {"scheduled_at": "2026-10-11T08:00:00+05:30"}),
    ("post", "/me/vitals", {"measurement_type": "spo2", "value": 97}),
    ("post", "/me/report", {"text": "theek hoon"}),
    ("get", "/me/messages", None),
    ("post", "/me/messages", {"body": "hi"}),
]


@pytest.mark.parametrize("method,path,body", ALL_ME_ROUTES)
def test_me_requires_senior_role(client, world, method, path, body):
    send = getattr(client, method)
    kw = {"json": body} if body is not None else {}
    assert send(API + path, **kw).status_code == 401
    for key in ("CH", "OH", "FH"):
        assert send(API + path, headers=world[key], **kw).status_code == 403, key


def test_senior_without_profile_gets_404(client, db_session):
    orphan = make_user(db_session, "senior", ref="X")
    assert client.get(f"{API}/me/home", headers=senior_headers(orphan)).status_code == 404


# ---- home ----------------------------------------------------------------------------------
def test_home_statuses(client, world, db_session):
    s = world["senior"]
    taken = make_schedule(db_session, s, times=("08:00",), med_id="MED_T")
    missed = make_schedule(db_session, s, times=("13:00",), med_id="MED_M")
    unknown = make_schedule(db_session, s, times=("14:00",), med_id="MED_U")
    none = make_schedule(db_session, s, times=("21:30",), med_id="MED_N")
    make_schedule(db_session, s, sos=True, med_id="MED_SOS")
    make_schedule(db_session, s, active=False, med_id="MED_OFF")
    make_schedule(db_session, s, end=date(2026, 10, 1), med_id="MED_ENDED")
    make_schedule(db_session, world["senior2"], med_id="MED_OTHER")
    add_event(db_session, s, taken, at("08:00"), "taken")
    add_event(db_session, s, missed, at("13:00"), "missed")
    add_event(db_session, s, unknown, at("14:00"), "unknown")
    r = client.get(f"{API}/me/home?date=2026-10-11", headers=world["SH"])
    assert r.status_code == 200, r.text
    body = r.json()
    got = {m["medication_id"]: m["status"] for m in body["medications_today"]}
    # the date is in the past, so the unrecorded evening dose is "unknown", not "pending"
    assert got == {"MED_T": "taken", "MED_M": "missed", "MED_U": "unknown", "MED_N": "unknown"}
    assert [m["medication_id"] for m in body["medications_today"]] == ["MED_T", "MED_M", "MED_U", "MED_N"]
    assert body["medications_today"][0]["scheduled_at"].endswith("+05:30")
    assert body["greeting_name"] == "Test ji" and body["language"] == "hinglish" and body["date"] == "2026-10-11"


def test_home_future_dose_is_pending(client, world, db_session):
    make_schedule(db_session, world["senior"], times=("09:00",), med_id="MED_F")
    tomorrow = (datetime.now(IST) + timedelta(days=2)).date()
    r = client.get(f"{API}/me/home?date={tomorrow}", headers=world["SH"]).json()
    assert r["medications_today"][0]["status"] == "pending"


def test_home_last_message_and_next_checkin(client, world):
    client.post(f"{API}/seniors/S9001/messages", json={"body": "first"}, headers=world["CH"])
    client.post(f"{API}/me/messages", json={"body": "from senior"}, headers=world["SH"])
    client.post(f"{API}/seniors/S9001/messages", json={"body": "second"}, headers=world["CH"])
    r = client.get(f"{API}/me/home?date=2026-10-11", headers=world["SH"]).json()
    assert r["last_message"]["body"] == "second" and r["last_message"]["sender"]["role"] == "coordinator"
    assert r["last_message"]["urgency_flag"] is None
    # 2026-10-11 is a Sunday: next configured day is Tuesday 13 Oct, 16:00 IST
    assert r["next_checkin"] == {"at": "2026-10-13T16:00:00+05:30", "kind": "ai_call"}


def test_home_no_messages_no_schedule(client, world, db_session):
    world["senior"].checkin_days_of_week = []
    db_session.commit()
    r = client.get(f"{API}/me/home", headers=world["SH"]).json()
    assert r["last_message"] is None and r["next_checkin"] is None and r["medications_today"] == []


def test_home_bad_date_422(client, world):
    assert client.get(f"{API}/me/home?date=nope", headers=world["SH"]).status_code == 422


def test_english_greeting_has_no_honorific(world, db_session):
    world["senior"].preferred_language = "english"
    assert me_service.greeting_name(db_session, world["senior"]) == "Test"


# ---- confirm -------------------------------------------------------------------------------
def test_confirm_creates_event_and_is_idempotent(client, world, db_session):
    sched = make_schedule(db_session, world["senior"], times=("08:00",), med_id="MED_C")
    url = f"{API}/me/medications/MED_C/confirm"
    body = {"scheduled_at": "2026-10-11T08:00:00+05:30"}
    r = client.post(url, json=body, headers=world["SH"])
    assert r.status_code == 200 and r.json()["status"] == "taken" and r.json()["actual_at"]
    again = client.post(url, json={"scheduled_at": "2026-10-11T02:30:00Z"}, headers=world["SH"])
    assert again.status_code == 200 and again.json()["actual_at"] == r.json()["actual_at"]
    events = db_session.scalars(select(MedicationEvent)).all()
    assert len(events) == 1
    assert events[0].record_source == "senior_app_confirmation" and events[0].status == "taken"
    assert events[0].verification_status == "self_reported"
    home = client.get(f"{API}/me/home?date=2026-10-11", headers=world["SH"]).json()
    assert home["medications_today"][0]["status"] == "taken"


def test_confirm_upgrades_missed_event(client, world, db_session):
    sched = make_schedule(db_session, world["senior"], times=("08:00",), med_id="MED_C")
    add_event(db_session, world["senior"], sched, at("08:00"), "missed")
    r = client.post(f"{API}/me/medications/MED_C/confirm", json={"scheduled_at": at("08:00").isoformat()},
                    headers=world["SH"])
    assert r.status_code == 200
    ev = db_session.scalar(select(MedicationEvent))
    assert ev.status == "taken" and ev.record_source == "senior_app_confirmation"


def test_confirm_leaves_pillbox_taken_untouched(client, world, db_session):
    sched = make_schedule(db_session, world["senior"], times=("08:00",), med_id="MED_C")
    add_event(db_session, world["senior"], sched, at("08:00"), "taken")
    client.post(f"{API}/me/medications/MED_C/confirm", json={"scheduled_at": at("08:00").isoformat()},
                headers=world["SH"])
    assert db_session.scalar(select(MedicationEvent)).record_source == "smart_pillbox"


def test_confirm_errors(client, world, db_session):
    make_schedule(db_session, world["senior"], times=("08:00",), med_id="MED_C")
    make_schedule(db_session, world["senior"], times=("08:00",), sos=True, med_id="MED_SOS")
    make_schedule(db_session, world["senior2"], times=("08:00",), med_id="MED_OTHER")
    ok = {"scheduled_at": "2026-10-11T08:00:00+05:30"}
    h = world["SH"]
    assert client.post(f"{API}/me/medications/NOPE/confirm", json=ok, headers=h).status_code == 404
    assert client.post(f"{API}/me/medications/MED_OTHER/confirm", json=ok, headers=h).status_code == 404
    assert client.post(f"{API}/me/medications/MED_C/confirm", json={"scheduled_at": "2026-10-11T09:00:00+05:30"},
                       headers=h).status_code == 422
    assert client.post(f"{API}/me/medications/MED_SOS/confirm", json=ok, headers=h).status_code == 422
    assert client.post(f"{API}/me/medications/MED_C/confirm", json={"scheduled_at": "2020-01-01T08:00:00+05:30"},
                       headers=h).status_code == 422   # before the schedule started
    assert client.post(f"{API}/me/medications/MED_C/confirm", json={}, headers=h).status_code == 422
    assert client.post(f"{API}/me/medications/MED_C/confirm", json={"scheduled_at": "x"}, headers=h).status_code == 422
    assert db_session.scalar(select(MedicationEvent)) is None


# ---- vitals --------------------------------------------------------------------------------
def test_post_vital(client, world, db_session):
    r = client.post(f"{API}/me/vitals", json={"measurement_type": "blood_pressure_systolic", "value": 130,
                                               "unit": "mmHg", "measured_at": "2026-10-11T07:30:00+05:30"},
                    headers=world["SH"])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["source"] == "senior_app" and body["unit"] == "mmHg" and body["value"] == 130
    row = db_session.scalar(select(Vital))
    assert row.senior_id == "S9001" and row.source == "senior_app"
    r = client.post(f"{API}/me/vitals", json={"measurement_type": "spo2", "value": 97}, headers=world["SH"])
    assert r.status_code == 201 and r.json()["unit"] == "%"


@pytest.mark.parametrize("payload", [
    {"measurement_type": "spo2", "value": 150},
    {"measurement_type": "blood_pressure_systolic", "value": 20},
    {"measurement_type": "blood_glucose", "value": 9000},
    {"measurement_type": "weight", "value": -5},
    {"measurement_type": "temperature", "value": 40, "unit": "degF"},
    {"measurement_type": "heart_rate", "value": 80, "unit": "mmHg"},
    {"measurement_type": "pulse", "value": 80},
    {"measurement_type": "spo2"},
    {"measurement_type": "spo2", "value": "nan"},
    {"measurement_type": "spo2", "value": 97, "measured_at": "2999-01-01T00:00:00Z"},
])
def test_post_vital_rejected(client, world, db_session, payload):
    r = client.post(f"{API}/me/vitals", json=payload, headers=world["SH"])
    assert r.status_code == 422, r.text
    assert db_session.scalar(select(Vital)) is None


def test_temperature_celsius_accepted(client, world):
    r = client.post(f"{API}/me/vitals", json={"measurement_type": "temperature", "value": 37.2, "unit": "degC"},
                    headers=world["SH"])
    assert r.status_code == 201


# ---- report --------------------------------------------------------------------------------
def test_report_creates_checkin_and_cues(client, world, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr(msg_service, "safe_rescore", lambda db, sid, *a, **k: calls.append(sid))
    r = client.post(f"{API}/me/report", json={"text": "Mujhe kamzori lag rahi hai aur sar dard hai"},
                    headers=world["SH"])
    assert r.status_code == 201, r.text
    assert set(r.json()) == {"checkin_id"}                  # nothing about the content comes back
    c = db_session.get(Checkin, r.json()["checkin_id"])
    assert c.channel == "app_checkin" and c.senior_id == "S9001" and c.language == "hinglish"
    cues = db_session.scalars(select(NlpCue).where(NlpCue.source_id == c.checkin_id)).all()
    assert cues and all(x.source_type == "checkin" for x in cues)
    assert calls == []


def test_report_urgent_triggers_rescore(client, world, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr(msg_service, "safe_rescore", lambda db, sid, *a, **k: calls.append(sid))
    r = client.post(f"{API}/me/report", json={"text": "Main gir gaya", "language": "hindi"}, headers=world["SH"])
    assert r.status_code == 201 and calls == ["S9001"]


@pytest.mark.parametrize("payload", [{}, {"text": "  "}, {"text": "x" * 2001}, {"text": "ok", "language": "fr"}])
def test_report_validation(client, world, payload):
    assert client.post(f"{API}/me/report", json=payload, headers=world["SH"]).status_code == 422


# ---- me/messages ---------------------------------------------------------------------------
def test_me_messages_thread_and_isolation(client, world):
    r = client.post(f"{API}/me/messages", json={"body": "namaste"}, headers=world["SH"])
    assert r.status_code == 201 and r.json()["senior_id"] == "S9001" and r.json()["sender"]["role"] == "senior"
    client.post(f"{API}/seniors/S9001/messages", json={"body": "reply"}, headers=world["CH"])
    mine = client.get(f"{API}/me/messages", headers=world["SH"]).json()
    assert mine["total"] == 2 and [m["body"] for m in mine["items"]] == ["reply", "namaste"]
    assert client.get(f"{API}/me/messages", headers=world["SH2"]).json()["total"] == 0
    assert client.get(f"{API}/me/messages?limit=500", headers=world["SH"]).status_code == 422
    # senior cannot use the coordinator-side path for someone else
    assert client.get(f"{API}/seniors/S9001/messages", headers=world["SH2"]).status_code == 403
    assert client.post(f"{API}/seniors/S9001/messages", json={"body": "x"}, headers=world["SH2"]).status_code == 403
    assert client.post(f"{API}/me/messages", json={"body": ""}, headers=world["SH"]).status_code == 422


def test_home_includes_coordinator_contact(client, world, db_session):
    body = client.get(f"{API}/me/home", headers=world["SH"]).json()
    assert body["coordinator"]["display_name"] == world["coord"].display_name
    assert body["coordinator"]["phone"] is None or not body["coordinator"]["phone"].startswith("+910000")
    world["coord"].phone = "+919812345678"
    db_session.commit()
    assert client.get(f"{API}/me/home", headers=world["SH"]).json()["coordinator"]["phone"] == "+919812345678"
    world["coord"].phone = "+910000000001"  # seeded placeholder: not dialable
    db_session.commit()
    assert client.get(f"{API}/me/home", headers=world["SH"]).json()["coordinator"]["phone"] is None
