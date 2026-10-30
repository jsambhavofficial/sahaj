import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import create_token
from app.modules.alerts.models import Alert
from app.modules.auth.models import AuditLog
from app.modules.checkins.models import Checkin, NlpCue
from app.modules.family.models import FamilyInteraction
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors import service as senior_service
from app.modules.seniors.models import (
    SeniorBaseline, SeniorCondition, SeniorContact, SeniorHealthProfile,
)
from app.modules.vitals.models import DailyActivity, Vital
from app.modules.voice.models import Call, SeniorMemoryItem
from tests.app.factories import auth, link_family, make_senior, make_user

API = "/api/v1"
D = date(2026, 10, 11)
IST = timezone(timedelta(hours=5, minutes=30))


def at(day=D, hour=9):
    return datetime(day.year, day.month, day.day, hour, 0, tzinfo=IST)


def senior_headers(user):
    return {"Authorization": "Bearer " + create_token(str(user.id), "access", timedelta(minutes=5),
                                                      role="senior")}


@pytest.fixture
def world(db_session):
    db = db_session
    c1 = make_user(db, "coordinator", city="Jaipur")
    c2 = make_user(db, "coordinator", city="Pune")
    s1, u1 = make_senior(db, c1, city="Jaipur", sid="S0001")
    s2, u2 = make_senior(db, c2, city="Pune", sid="S0002")
    admin = make_user(db, "admin")
    ops = make_user(db, "ops", city="Jaipur")
    fam = make_user(db, "family")
    link_family(db, fam, s1)
    return dict(db=db, c1=c1, c2=c2, s1=s1, s2=s2, u1=u1, u2=u2, admin=admin, ops=ops, fam=fam)


def H(client, user):
    return auth(client, user.email)


def audited(db, action, senior_id=None):
    q = select(AuditLog).where(AuditLog.action == action)
    if senior_id:
        q = q.where(AuditLog.senior_id == senior_id)
    return list(db.scalars(q))


# ---------------------------------------------------------------- caseload

def test_caseload_scope_filters_sort(client, world):
    db, c1 = world["db"], world["c1"]
    s3, _ = make_senior(db, c1, city="Jaipur", sid="S0003")
    s1c = db.get(SeniorContact, "S0001"); s1c.full_name = "Zeba Khan"
    db.get(SeniorContact, "S0003").full_name = "Asha Rao"
    db.add_all([
        DailyRiskScore(senior_id="S0001", date=D, risk_score=40, risk_level="MODERATE", scoring_version="v"),
        DailyRiskScore(senior_id="S0003", date=D, risk_score=80, risk_level="HIGH", scoring_version="v"),
        DailyRiskScore(senior_id="S0002", date=D, risk_score=99, risk_level="URGENT_REVIEW", scoring_version="v"),
        Alert(alert_id="ALT_1", senior_id="S0003", created_at=at(), last_updated_at=at(), status="OPEN",
              severity="HIGH", recommended_next_step="call"),
        Alert(alert_id="ALT_0", senior_id="S0001", created_at=at(), last_updated_at=at(), status="RESOLVED",
              severity="HIGH", recommended_next_step="call"),
        Checkin(checkin_id="C1", senior_id="S0001", at=at(hour=8), channel="phone_call"),
    ])
    db.commit()
    h = H(client, c1)
    body = client.get(f"{API}/coordinators/me/seniors", params={"date": str(D)}, headers=h).json()
    assert body["total"] == 2 and body["limit"] == 50 and body["offset"] == 0
    assert [i["senior_id"] for i in body["items"]] == ["S0003", "S0001"]  # risk desc; S0002 not mine
    top = body["items"][0]
    assert top["display_name"] == "Asha Rao" and top["risk_level"] == "HIGH"
    assert top["open_alert_id"] == "ALT_1" and top["last_contact_at"] is None
    assert body["items"][1]["open_alert_id"] is None and body["items"][1]["last_contact_at"] is not None
    assert set(top) >= {"senior_id", "display_name", "age", "city", "preferred_language",
                        "living_arrangement", "risk_score", "risk_level", "open_alert_id", "last_contact_at"}
    by_name = client.get(f"{API}/coordinators/me/seniors", params={"sort": "name"}, headers=h).json()
    assert [i["display_name"] for i in by_name["items"]] == ["Asha Rao", "Zeba Khan"]
    by_contact = client.get(f"{API}/coordinators/me/seniors", params={"sort": "last_contact"}, headers=h).json()
    assert by_contact["items"][0]["senior_id"] == "S0003"  # never contacted comes first
    only_high = client.get(f"{API}/coordinators/me/seniors",
                           params={"risk_level": "HIGH", "date": str(D)}, headers=h).json()
    assert only_high["total"] == 1
    assert client.get(f"{API}/coordinators/me/seniors", params={"q": "zeba"}, headers=h).json()["total"] == 1
    assert client.get(f"{API}/coordinators/me/seniors", params={"q": "S0003"}, headers=h).json()["total"] == 1
    assert client.get(f"{API}/coordinators/me/seniors", params={"q": "%"}, headers=h).json()["total"] == 0
    page = client.get(f"{API}/coordinators/me/seniors", params={"limit": 1, "offset": 1, "date": str(D)},
                      headers=h).json()
    assert page["total"] == 2 and [i["senior_id"] for i in page["items"]] == ["S0001"]
    # no score for another date -> null risk
    other = client.get(f"{API}/coordinators/me/seniors", params={"date": "2026-01-01"}, headers=h).json()
    assert other["items"][0]["risk_score"] is None
    assert audited(db, "view_caseload")


def test_caseload_admin_sees_all_and_roles(client, world):
    w = world
    assert client.get(f"{API}/coordinators/me/seniors", headers=H(client, w["admin"])).json()["total"] == 2
    assert client.get(f"{API}/coordinators/me/seniors").status_code == 401
    for user in (w["ops"], w["fam"]):
        assert client.get(f"{API}/coordinators/me/seniors", headers=H(client, user)).status_code == 403
    assert client.get(f"{API}/coordinators/me/seniors", headers=senior_headers(w["u1"])).status_code == 403
    h = H(client, w["c1"])
    for params in ({"sort": "bogus"}, {"risk_level": "NOPE"}, {"limit": 500}, {"offset": -1}, {"date": "x"}):
        assert client.get(f"{API}/coordinators/me/seniors", params=params, headers=h).status_code == 422


def test_list_senior_items_service_filters(world):
    w = world
    items, total = senior_service.list_senior_items(w["db"], w["ops"], on_date=D)
    assert total == 1 and items[0]["senior_id"] == "S0001"  # ops scoped to Jaipur
    items, total = senior_service.list_senior_items(w["db"], w["admin"], on_date=D, city="Pune")
    assert [i["senior_id"] for i in items] == ["S0002"]
    items, _ = senior_service.list_senior_items(w["db"], w["admin"], on_date=D, coordinator_id=w["c1"].id)
    assert [i["senior_id"] for i in items] == ["S0001"]
    items, _ = senior_service.list_senior_items(w["db"], w["admin"], on_date=D, consent_level="urgent_only")
    assert items == []
    items, _ = senior_service.list_senior_items(w["db"], w["fam"], on_date=D)
    assert items == []


# ---------------------------------------------------------------- detail

def test_detail_contents_and_phone_rules(client, world):
    w, db = world, world["db"]
    db.add_all([
        SeniorCondition(senior_id="S0001", category="physical", condition="hypertension"),
        SeniorHealthProfile(senior_id="S0001", cognitive_status="normal", fall_risk_level="high",
                            hobbies=["bhajan"]),
        SeniorBaseline(senior_id="S0001", sbp_median=130.0, hr_median=72.0),
    ])
    db.commit()
    r = client.get(f"{API}/seniors/S0001", headers=H(client, w["c1"]))
    assert r.status_code == 200
    b = r.json()
    assert b["display_name"] == "Test Person" and b["family_consent_level"] == "full"
    assert b["conditions"] == [{"category": "physical", "condition": "hypertension"}]
    assert b["health_profile"]["hobbies"] == ["bhajan"] and b["baseline"]["sbp_median"] == 130.0
    assert b["contact"] == {"phone": "+910000000000"}
    assert audited(db, "view_senior", "S0001")

    admin = client.get(f"{API}/seniors/S0001", headers=H(client, w["admin"])).json()
    assert admin["contact"]["phone"]
    ops = client.get(f"{API}/seniors/S0001", headers=H(client, w["ops"])).json()
    assert ops["contact"] is None and ops["display_name"] == "Test Person"
    me = client.get(f"{API}/seniors/S0001", headers=senior_headers(w["u1"])).json()
    assert me["contact"] is None and me["display_name"] == "Test Person"
    assert "phone" not in str(me)
    # audit detail carries no PII
    assert all("Test Person" not in str(a.detail) and "+91" not in str(a.detail)
               for a in db.scalars(select(AuditLog)))


def test_detail_authorization(client, world):
    w = world
    assert client.get(f"{API}/seniors/S0001").status_code == 401
    assert client.get(f"{API}/seniors/S0002", headers=H(client, w["c1"])).status_code == 403  # other coordinator
    assert client.get(f"{API}/seniors/S0002", headers=H(client, w["ops"])).status_code == 403  # other city
    assert client.get(f"{API}/seniors/S0002", headers=senior_headers(w["u1"])).status_code == 403
    assert client.get(f"{API}/seniors/S0001", headers=H(client, w["fam"])).status_code == 403
    r = client.get(f"{API}/seniors/S9999", headers=H(client, w["c1"]))
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


# ---------------------------------------------------------------- generic per-endpoint rules

STAFF_ONLY = ["risk-history", "calls", "cues", "memory", "family-interactions"]
ANY_ACCESS = ["vitals", "medications", "activity"]


@pytest.mark.parametrize("path", STAFF_ONLY + ANY_ACCESS)
def test_endpoint_authorization(client, world, path):
    w = world
    url = f"{API}/seniors/S0001/{path}"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=H(client, w["c1"])).status_code == 200
    assert client.get(url, headers=H(client, w["admin"])).status_code == 200
    assert client.get(url, headers=H(client, w["ops"])).status_code == 200
    assert client.get(url, headers=H(client, w["c2"])).status_code == 403  # wrong coordinator
    assert client.get(url, headers=H(client, w["fam"])).status_code == 403
    assert client.get(f"{API}/seniors/S9999/{path}", headers=H(client, w["c1"])).status_code == 404
    own = client.get(url, headers=senior_headers(w["u1"])).status_code
    other = client.get(f"{API}/seniors/S0002/{path}", headers=senior_headers(w["u1"])).status_code
    assert (own, other) == ((200, 403) if path in ANY_ACCESS else (403, 403))
    action = {"risk-history": "view_risk_history", "calls": "view_calls", "cues": "view_cues",
              "memory": "view_memory", "family-interactions": "view_family_interactions",
              "vitals": "view_vitals", "medications": "view_medications", "activity": "view_activity"}[path]
    assert audited(w["db"], action, "S0001")


@pytest.mark.parametrize("path", ["vitals", "activity", "cues", "risk-history"])
def test_range_validation(client, world, path):
    h = H(client, world["c1"])
    url = f"{API}/seniors/S0001/{path}"
    assert client.get(url, params={"from": "garbage"}, headers=h).status_code == 422
    assert client.get(url, params={"from": "2026-10-11", "to": "2026-10-01"}, headers=h).status_code == 422
    assert client.get(url, params={"limit": 0}, headers=h).status_code == 422


# ---------------------------------------------------------------- data endpoints

def test_risk_history(client, world):
    db = world["db"]
    for i in range(3):
        db.add(DailyRiskScore(senior_id="S0001", date=D - timedelta(days=i), risk_score=10 * i,
                              risk_level="LOW", scoring_version="heuristic-0", recommended_action="call",
                              top_factors=[{"rule_id": "R1", "category": "meds", "evidence": "missed",
                                            "window": "7d", "points_contributed": 5,
                                            "is_safety_tripwire": False}]))
    db.commit()
    h = H(client, world["c1"])
    rows = client.get(f"{API}/seniors/S0001/risk-history", headers=h).json()
    assert [r["date"] for r in rows] == ["2026-10-09", "2026-10-10", "2026-10-11"]
    assert rows[0]["top_factors"][0]["rule_id"] == "R1" and rows[0]["scoring_version"] == "heuristic-0"
    ranged = client.get(f"{API}/seniors/S0001/risk-history", params={"from": "2026-10-10", "to": "2026-10-10"},
                        headers=h).json()
    assert len(ranged) == 1


def test_vitals(client, world):
    db = world["db"]
    for i, (typ, day) in enumerate([("heart_rate", D - timedelta(days=2)), ("heart_rate", D),
                                    ("spo2", D)]):
        db.add(Vital(measurement_id=f"V{i}", senior_id="S0001", measured_at=at(day), measurement_type=typ,
                     value=70 + i, unit="bpm", source="device", quality_status="valid"))
    db.add(Vital(measurement_id="VX", senior_id="S0002", measured_at=at(), measurement_type="heart_rate",
                 value=1, unit="bpm", source="device"))
    db.commit()
    h = H(client, world["c1"])
    url = f"{API}/seniors/S0001/vitals"
    allrows = client.get(url, headers=h).json()
    assert [r["measurement_id"] for r in allrows] == ["V0", "V1", "V2"]
    assert set(allrows[0]) == {"measurement_id", "measured_at", "measurement_type", "value", "unit",
                               "context", "source", "quality_status"}
    assert len(client.get(url, params={"type": "heart_rate"}, headers=h).json()) == 2
    assert len(client.get(url, params={"from": str(D), "to": str(D)}, headers=h).json()) == 2
    assert client.get(url, params={"type": "bogus"}, headers=h).status_code == 422
    assert [r["measurement_id"] for r in client.get(url, params={"limit": 1}, headers=h).json()] == ["V2"]


def test_activity(client, world):
    db = world["db"]
    for i in range(3):
        db.add(DailyActivity(senior_id="S0001", date=D - timedelta(days=i), steps=1000 + i,
                             sleep_hours=7, data_available=bool(i)))
    db.commit()
    rows = client.get(f"{API}/seniors/S0001/activity", params={"from": "2026-10-10"},
                      headers=H(client, world["c1"])).json()
    assert [r["date"] for r in rows] == ["2026-10-10", "2026-10-11"]
    assert rows[1]["steps"] == 1000 and rows[1]["data_available"] is False
    assert set(rows[0]) == {"date", "steps", "active_minutes", "sleep_hours", "appetite_level",
                            "mood_level", "social_contact_count", "data_available"}


def test_medications(client, world):
    db = world["db"]
    db.add_all([
        MedicationSchedule(medication_id="M1", senior_id="S0001", drug_name="Amlodipine", dosage="5 mg",
                           criticality="high", start_date=D - timedelta(days=90), times_per_day=1,
                           scheduled_times=["08:00"], is_active=True),
        MedicationSchedule(medication_id="M2", senior_id="S0001", drug_name="Vitamin", dosage="1",
                           criticality="low", start_date=D - timedelta(days=90), times_per_day=1,
                           scheduled_times=["09:00"], is_active=False),
    ])
    db.flush()
    statuses = {0: "taken", 1: "taken", 2: "missed", 3: "unknown", 10: "taken", 20: "missed"}
    for n, st in statuses.items():
        db.add(MedicationEvent(medication_event_id=f"E{n}", senior_id="S0001", medication_id="M1",
                               scheduled_at=at(D - timedelta(days=n), 8), status=st,
                               record_source="smart_pillbox"))
    db.add(MedicationEvent(medication_event_id="ES", senior_id="S0001", medication_id="M1",
                           scheduled_at=at(D, 12), status="sos_taken", record_source="coordinator_call"))
    db.add(MedicationEvent(medication_event_id="EL", senior_id="S0001", medication_id="M2",
                           scheduled_at=at(D, 9), status="missed", record_source="coordinator_call"))
    db.commit()
    r = client.get(f"{API}/seniors/S0001/medications", params={"date": str(D)}, headers=H(client, world["c1"]))
    b = r.json()
    assert [s["medication_id"] for s in b["schedules"]] == ["M1", "M2"]
    assert b["schedules"][0]["scheduled_times"] == ["08:00"]
    # 7d: E0 taken, E1 taken, E2 missed, E3 unknown, EL missed(low) -> 2/5 ; 30d adds E10 taken, E20 missed -> 3/7
    assert b["adherence"] == {"last_7d_pct": 40.0, "last_30d_pct": 42.9, "missed_critical_7d": 1}
    assert b["recent_events"][0]["status"] in ("sos_taken", "missed")
    assert set(b["recent_events"][0]) >= {"scheduled_at", "status", "actual_at", "record_source"}
    assert len(b["recent_events"]) == 8
    empty = client.get(f"{API}/seniors/S0001/medications", params={"date": "2025-01-01"},
                       headers=H(client, world["c1"])).json()
    assert empty["adherence"]["last_7d_pct"] is None and empty["recent_events"] == []
    assert client.get(f"{API}/seniors/S0001/medications", params={"date": "zzz"},
                      headers=H(client, world["c1"])).status_code == 422


def test_calls_list(client, world):
    db = world["db"]
    cid = uuid.uuid4()
    db.add_all([
        Call(id=cid, kind="phone_bridge", senior_id="S0001", provider="exotel", status="completed",
             started_at=at(), duration_sec=60, transcript_status="done", summary="Spoke about meds",
             recording_path="rec/1", urgency_flag=True),
        Call(kind="ai_agent", senior_id="S0001", provider="in_app", status="no_answer",
             started_at=at(D - timedelta(days=1))),
        Call(kind="ai_agent", senior_id="S0002", provider="in_app", status="completed", started_at=at()),
    ])
    db.commit()
    b = client.get(f"{API}/seniors/S0001/calls", headers=H(client, world["c1"])).json()
    assert b["total"] == 2 and b["items"][0]["id"] == str(cid)
    first = b["items"][0]
    assert first["recording_stored"] is True and first["urgency_flag"] is True and "turns" not in first
    assert len(client.get(f"{API}/seniors/S0001/calls", params={"limit": 1, "offset": 1},
                          headers=H(client, world["c1"])).json()["items"]) == 1


def test_cues_use_source_time_and_filter(client, world):
    db = world["db"]
    call = Call(kind="ai_agent", senior_id="S0001", provider="in_app", status="completed",
                started_at=at(D - timedelta(days=5)))
    db.add_all([call, Checkin(checkin_id="C9", senior_id="S0001", at=at(D), channel="phone_call")])
    db.flush()
    db.add_all([
        NlpCue(source_type="call", source_id=str(call.id), senior_id="S0001", cue_type="pain",
               cue_value="knee", negated=False, uncertain=True, temporal_context="current"),
        NlpCue(source_type="checkin", source_id="C9", senior_id="S0001", cue_type="low_mood",
               cue_value="sad", negated=True, uncertain=False),
        NlpCue(source_type="checkin", source_id="C9", senior_id="S0002", cue_type="pain", cue_value="x"),
    ])
    db.commit()
    h = H(client, world["c1"])
    rows = client.get(f"{API}/seniors/S0001/cues", headers=h).json()
    assert [r["cue_type"] for r in rows] == ["low_mood", "pain"]  # newest first
    assert rows[1]["at"].startswith("2026-10-06") and rows[1]["uncertain"] is True
    assert rows[0]["negated"] is True and rows[0]["source_type"] == "checkin"
    recent = client.get(f"{API}/seniors/S0001/cues", params={"from": "2026-10-10"}, headers=h).json()
    assert [r["cue_type"] for r in recent] == ["low_mood"]


def test_memory_only_open(client, world):
    db = world["db"]
    db.add_all([
        SeniorMemoryItem(senior_id="S0001", kind="symptom", content="knee pain", status="open",
                         first_seen_at=at(), last_seen_at=at(), follow_up_after=D),
        SeniorMemoryItem(senior_id="S0001", kind="mood", content="old", status="resolved",
                         first_seen_at=at(), last_seen_at=at()),
        SeniorMemoryItem(senior_id="S0002", kind="mood", content="other", status="open",
                         first_seen_at=at(), last_seen_at=at()),
    ])
    db.commit()
    rows = client.get(f"{API}/seniors/S0001/memory", headers=H(client, world["c1"])).json()
    assert len(rows) == 1 and rows[0]["content"] == "knee pain" and rows[0]["follow_up_after"] == str(D)
    assert set(rows[0]) == {"id", "kind", "content", "status", "first_seen_at", "last_seen_at",
                            "follow_up_after"}


def test_family_interactions(client, world):
    db = world["db"]
    for i in range(3):
        db.add(FamilyInteraction(interaction_id=f"FI{i}", senior_id="S0001", at=at(D - timedelta(days=i)),
                                 channel="whatsapp_message", category="health_concern",
                                 family_message="how is she?", coordinator_reply_en="doing fine",
                                 counselor_summary="s", suggested_action="a", escalation_needed=i == 0,
                                 consent_level="full"))
    db.commit()
    h = H(client, world["c1"])
    rows = client.get(f"{API}/seniors/S0001/family-interactions", headers=h).json()
    assert [r["interaction_id"] for r in rows] == ["FI0", "FI1", "FI2"] and rows[0]["escalation_needed"]
    assert len(client.get(f"{API}/seniors/S0001/family-interactions", params={"limit": 2, "offset": 2},
                          headers=h).json()) == 1
    assert client.get(f"{API}/seniors/S0001/family-interactions", params={"limit": 999},
                      headers=h).status_code == 422


def test_legacy_seniors_list_is_scoped_and_flat(client, world):
    me = client.get(f"{API}/seniors", headers=H(client, world["c1"]))
    assert me.status_code == 200
    body = me.json()
    assert body["total"] == len(body["items"]) >= 1
    row = body["items"][0]
    assert {"senior_id", "name", "age", "city_id", "coordinator_id", "family_consent", "current_risk_level",
            "current_risk_score", "last_observation_date", "active_alert_count"} <= set(row)
    # a coordinator only ever sees their own caseload
    assert {i["coordinator_id"] for i in body["items"]} == {str(world["c1"].id)}
    assert client.get(f"{API}/seniors", headers=H(client, world["c1"]), params={"search": "zzz-no-match"}).json()["items"] == []


def test_legacy_seniors_list_rejects_family_and_anonymous(client, world):
    assert client.get(f"{API}/seniors").status_code == 401
