import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.core.config import get_settings
from app.modules.alerts.models import Alert, AlertEvent, AlertFeedback
from app.modules.auth.models import AuditLog
from app.modules.coordinators.models import PriorityList, PriorityListItem
from app.modules.risk.models import DailyRiskScore
from app.modules.voice.models import Call
from tests.app.factories import auth, make_senior, make_user

TODAY = date(2026, 10, 11)
IST = timezone(timedelta(hours=5, minutes=30))


@pytest.fixture(autouse=True)
def demo_today(monkeypatch):
    monkeypatch.setattr(get_settings(), "demo_today", TODAY)


def at(day=TODAY, hour=10, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=IST)


def make_alert(db, senior, *, status="OPEN", severity="HIGH", created=None, reason=None):
    created = created or at(hour=9)
    a = Alert(alert_id=f"ALT_{uuid.uuid4().hex[:8]}", senior_id=senior.senior_id, created_at=created,
              last_updated_at=created, status=status, severity=severity, triggering_signals=[],
              recommended_next_step="Call", resolution_reason=reason)
    db.add(a)
    db.commit()
    return a


def add_event(db, alert, coord, to_status, when):
    db.add(AlertEvent(alert_id=alert.alert_id, actor_user_id=coord.id, to_status=to_status, at=when))
    db.commit()


def add_feedback(db, alert, coord, useful, outcome="called", when=None):
    db.add(AlertFeedback(alert_id=alert.alert_id, coordinator_id=coord.id, useful=useful,
                         outcome=outcome, at=when or at(hour=12)))
    db.commit()


@pytest.fixture
def world(db_session, client):
    db = db_session
    jaipur_c = make_user(db, "coordinator", city="Jaipur")
    pune_c = make_user(db, "coordinator", city="Pune")
    sj, _ = make_senior(db, jaipur_c, city="Jaipur")
    sp, _ = make_senior(db, pune_c, city="Pune")
    ops_j = make_user(db, "ops", city="Jaipur", email="opsj@test.local")
    ops_all = make_user(db, "ops", email="opsall@test.local")
    admin = make_user(db, "admin", email="admin@test.local")
    h = {k: auth(client, e) for k, e in
         [("ops_j", "opsj@test.local"), ("ops_all", "opsall@test.local"), ("admin", "admin@test.local"),
          ("coord", jaipur_c.email)]}
    return dict(db=db, jc=jaipur_c, pc=pune_c, sj=sj, sp=sp, ops_j=ops_j, h=h)


ENDPOINTS = ["/ops/overview", "/ops/alerts/volume", "/ops/alerts/response-times", "/ops/alerts/outcomes",
             "/ops/alerts/precision", "/ops/coordinators", "/ops/seniors", "/ops/cities",
             "/ops/reports/daily"]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_auth_and_roles(client, world, path):
    assert client.get(f"/api/v1{path}").status_code == 401
    assert client.get(f"/api/v1{path}", headers=world["h"]["coord"]).status_code == 403
    for who in ("ops_j", "ops_all", "admin"):
        assert client.get(f"/api/v1{path}", headers=world["h"][who]).status_code == 200


def test_senior_and_family_forbidden(client, world, db_session):
    from tests.app.factories import senior_headers
    _, su = make_senior(db_session, world["jc"])
    assert client.get("/api/v1/ops/overview", headers=senior_headers(su)).status_code == 403


def test_empty_tables(client, world):
    h = world["h"]["admin"]
    o = client.get("/api/v1/ops/overview", headers=h).json()
    assert o["open_alerts"] == 0 and o["alerts_in_range"] == 0
    for k in ("median_minutes_to_ack", "median_minutes_to_resolve", "useful_share",
              "ai_call_completion_rate"):
        assert o[k] is None
    assert o["seniors_total"] == 2 and o["seniors_covered"] == 0
    for p in ("alerts/volume", "alerts/response-times", "alerts/outcomes", "alerts/precision", "reports/daily"):
        assert client.get(f"/api/v1/ops/{p}", headers=h).json() == []
    assert client.get("/api/v1/ops/cities", headers=h).json()[0]["avg_risk"] is None


def test_overview_metrics_and_scope(client, world):
    db, w = world["db"], world
    a1 = make_alert(db, w["sj"], created=at(hour=9))
    a2 = make_alert(db, w["sj"], created=at(hour=9), status="RESOLVED", reason="called family")
    pa = make_alert(db, w["sp"])
    add_event(db, a1, w["jc"], "ACKNOWLEDGED", at(hour=9, minute=30))
    add_event(db, a2, w["jc"], "ACKNOWLEDGED", at(hour=9, minute=10))
    add_event(db, a2, w["jc"], "RESOLVED", at(hour=11))
    add_feedback(db, a2, w["jc"], True)
    add_feedback(db, a1, w["jc"], False, "no_action")
    add_feedback(db, pa, w["pc"], True)
    db.add(Call(kind="ai_agent", senior_id=w["sj"].senior_id, coordinator_id=w["jc"].id, provider="in_app",
                status="completed", started_at=at(hour=8)))
    db.add(Call(kind="ai_agent", senior_id=w["sj"].senior_id, coordinator_id=w["jc"].id, provider="in_app",
                status="no_answer", started_at=at(hour=8)))
    db.commit()
    q = "?from=2026-10-01&to=2026-10-11"
    o = client.get(f"/api/v1/ops/overview{q}", headers=w["h"]["ops_j"]).json()
    assert o["open_alerts"] == 1 and o["alerts_in_range"] == 2
    assert o["median_minutes_to_ack"] == 20.0  # 30 and 10
    assert o["median_minutes_to_resolve"] == 120.0
    assert o["useful_share"] == 0.5
    assert o["ai_call_completion_rate"] == 0.5
    assert o["seniors_covered"] == 1 and o["seniors_total"] == 1
    admin = client.get(f"/api/v1/ops/overview{q}", headers=w["h"]["admin"]).json()
    assert admin["alerts_in_range"] == 3 and admin["seniors_total"] == 2
    # city filter narrows within scope but cannot widen it
    assert client.get(f"/api/v1/ops/overview{q}&city=Pune", headers=w["h"]["ops_j"]).json()["alerts_in_range"] == 0
    assert client.get(f"/api/v1/ops/overview{q}&city=Pune", headers=w["h"]["ops_all"]).json()["alerts_in_range"] == 1
    # outside the default window (30 days to today) nothing
    old = make_alert(db, w["sj"], created=at(day=TODAY - timedelta(days=60)))
    assert client.get("/api/v1/ops/overview", headers=w["h"]["admin"]).json()["alerts_in_range"] == 3
    assert old


def test_invalid_range_422(client, world):
    r = client.get("/api/v1/ops/overview?from=2026-10-11&to=2026-10-01", headers=world["h"]["admin"])
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    assert client.get("/api/v1/ops/overview?from=nope", headers=world["h"]["admin"]).status_code == 422
    assert client.get("/api/v1/ops/overview?coordinator_id=x", headers=world["h"]["admin"]).status_code == 422


def test_alert_series(client, world):
    db, w = world["db"], world
    a1 = make_alert(db, w["sj"], created=at(hour=9), severity="HIGH")
    make_alert(db, w["sj"], created=at(hour=9), severity="HIGH")
    a3 = make_alert(db, w["sj"], created=at(day=TODAY - timedelta(days=1)), severity="MODERATE",
                    status="RESOLVED", reason="ok")
    make_alert(db, w["sp"])
    add_event(db, a1, w["jc"], "ACKNOWLEDGED", at(hour=9, minute=45))
    add_feedback(db, a1, w["jc"], True, "called", at(hour=13))
    add_feedback(db, a3, w["jc"], False, "no_action", at(hour=13))
    h = w["h"]["ops_j"]
    vol = client.get("/api/v1/ops/alerts/volume", headers=h).json()
    assert {"day": "2026-10-11", "city": "Jaipur", "severity": "HIGH", "status": "OPEN", "alerts": 2} in vol
    assert all(v["city"] == "Jaipur" for v in vol) and len(vol) == 2
    rt = client.get("/api/v1/ops/alerts/response-times", headers=h).json()
    by = {r["alert_id"]: r for r in rt}
    assert by[a1.alert_id]["minutes_to_ack"] == 45.0 and by[a1.alert_id]["minutes_to_resolve"] is None
    assert by[a1.alert_id]["coordinator_id"] == str(w["jc"].id) and len(rt) == 3
    oc = client.get("/api/v1/ops/alerts/outcomes", headers=h).json()
    assert {"city": "Jaipur", "resolution_reason": None, "useful": True, "outcome": "called", "alerts": 1} in oc
    assert {"city": "Jaipur", "resolution_reason": "ok", "useful": False, "outcome": "no_action", "alerts": 1} in oc
    assert sum(r["alerts"] for r in oc) == 3
    pr = client.get("/api/v1/ops/alerts/precision", headers=h).json()
    assert pr == [{"city": "Jaipur", "week_start": "2026-10-05", "rated_alerts": 2, "useful_alerts": 1,
                   "precision": 0.5}]
    assert client.get("/api/v1/ops/alerts/response-times?limit=0", headers=h).status_code == 422
    # coordinator_id filter
    other = client.get(f"/api/v1/ops/alerts/volume?coordinator_id={w['pc'].id}", headers=h).json()
    assert other == []


def test_coordinators(client, world):
    db, w = world["db"], world
    a = make_alert(db, w["sj"])
    add_event(db, a, w["jc"], "ACKNOWLEDGED", at(hour=9, minute=30))
    db.add(Call(kind="phone_bridge", senior_id=w["sj"].senior_id, coordinator_id=w["jc"].id,
                provider="exotel", status="completed", started_at=at(hour=8)))
    from app.modules.messages.models import Message
    db.add(Message(senior_id=w["sj"].senior_id, sender_user_id=w["jc"].id, kind="text", body="hi",
                   created_at=at(hour=8)))
    db.commit()
    rows = client.get("/api/v1/ops/coordinators", headers=w["h"]["ops_j"]).json()
    assert [r["coordinator_id"] for r in rows] == [str(w["jc"].id)]
    r = rows[0]
    assert (r["caseload"], r["open_alerts"], r["alerts_handled"], r["calls"], r["messages_sent"]) == (1, 1, 1, 1, 1)
    assert len(client.get("/api/v1/ops/coordinators", headers=w["h"]["admin"]).json()) == 2
    d = client.get(f"/api/v1/ops/coordinators/{w['jc'].id}", headers=w["h"]["ops_j"]).json()
    assert d["daily"] == [{"day": "2026-10-11", "alert_actions": 1, "calls": 1, "messages_sent": 1}]
    assert d["caseload"] == 1


def test_coordinator_detail_errors(client, world):
    w = world
    assert client.get(f"/api/v1/ops/coordinators/{w['pc'].id}", headers=w["h"]["ops_j"]).status_code == 403
    assert client.get(f"/api/v1/ops/coordinators/{w['pc'].id}", headers=w["h"]["ops_all"]).status_code == 200
    assert client.get(f"/api/v1/ops/coordinators/{uuid.uuid4()}", headers=w["h"]["admin"]).status_code == 404
    assert client.get(f"/api/v1/ops/coordinators/{w['ops_j'].id}", headers=w["h"]["admin"]).status_code == 404
    assert client.get("/api/v1/ops/coordinators/not-a-uuid", headers=w["h"]["admin"]).status_code == 422
    assert client.get(f"/api/v1/ops/coordinators/{w['jc'].id}").status_code == 401
    assert client.get(f"/api/v1/ops/coordinators/{w['jc'].id}", headers=w["h"]["coord"]).status_code == 403


def test_seniors_list_and_detail(client, world):
    db, w = world["db"], world
    db.add(DailyRiskScore(senior_id=w["sj"].senior_id, date=TODAY, risk_score=80, risk_level="HIGH",
                          scoring_version="t"))
    db.commit()
    r = client.get("/api/v1/ops/seniors", headers=w["h"]["ops_j"]).json()
    assert r["total"] == 1 and r["limit"] == 50
    item = r["items"][0]
    assert item["senior_id"] == w["sj"].senior_id and item["risk_level"] == "HIGH"
    assert item["coordinator_name"] == w["jc"].display_name and item["city"] == "Jaipur"
    assert client.get("/api/v1/ops/seniors?city=Pune", headers=w["h"]["ops_j"]).json()["total"] == 0
    assert client.get("/api/v1/ops/seniors", headers=w["h"]["admin"]).json()["total"] == 2
    assert client.get("/api/v1/ops/seniors?risk_level=HIGH", headers=w["h"]["admin"]).json()["total"] == 1
    assert client.get(f"/api/v1/ops/seniors?coordinator_id={w['pc'].id}", headers=w["h"]["admin"]).json()["total"] == 1
    assert client.get("/api/v1/ops/seniors?consent_level=urgent_only", headers=w["h"]["admin"]).json()["total"] == 0
    assert client.get("/api/v1/ops/seniors?limit=500", headers=w["h"]["admin"]).status_code == 422
    assert client.get("/api/v1/ops/seniors?risk_level=BAD", headers=w["h"]["admin"]).status_code == 422
    d = client.get(f"/api/v1/ops/seniors/{w['sj'].senior_id}", headers=w["h"]["ops_j"])
    assert d.status_code == 200 and d.json()["senior_id"] == w["sj"].senior_id
    assert d.json()["contact"] is None  # ops never gets the phone
    assert db.query(AuditLog).filter_by(action="view_senior", senior_id=w["sj"].senior_id).count() == 1
    assert client.get(f"/api/v1/ops/seniors/{w['sp'].senior_id}", headers=w["h"]["ops_j"]).status_code == 403
    assert client.get(f"/api/v1/ops/seniors/{w['sp'].senior_id}", headers=w["h"]["ops_all"]).status_code == 200
    assert client.get("/api/v1/ops/seniors/S9999", headers=w["h"]["admin"]).status_code == 404
    assert client.get(f"/api/v1/ops/seniors/{w['sj'].senior_id}").status_code == 401
    assert client.get(f"/api/v1/ops/seniors/{w['sj'].senior_id}", headers=w["h"]["coord"]).status_code == 403


def test_cities(client, world):
    db, w = world["db"], world
    db.add(DailyRiskScore(senior_id=w["sj"].senior_id, date=TODAY, risk_score=80, risk_level="URGENT_REVIEW",
                          scoring_version="t"))
    make_alert(db, w["sj"])
    make_alert(db, w["sp"], status="RESOLVED", reason="x")
    rows = client.get("/api/v1/ops/cities", headers=w["h"]["ops_j"]).json()
    assert rows == [{"city": "Jaipur", "seniors": 1, "coordinators": 1, "open_alerts": 1,
                     "avg_risk": 80.0, "high_risk_count": 1}]
    allrows = client.get("/api/v1/ops/cities", headers=w["h"]["admin"]).json()
    assert [r["city"] for r in allrows] == ["Jaipur", "Pune"] and allrows[1]["open_alerts"] == 0
    assert client.get("/api/v1/ops/cities?city=Pune", headers=w["h"]["ops_j"]).json() == []


def _plist(db, coord, senior, revision, rank_sid=None, d=TODAY):
    pl = PriorityList(coordinator_id=coord.id, list_date=d, revision=revision, reason="morning_build")
    db.add(pl)
    db.flush()
    db.add(PriorityListItem(list_id=pl.id, rank=1, senior_id=senior.senior_id, risk_score=70 + revision,
                            risk_level="HIGH", reasons=["Missed tablets"], suggested_action="Call",
                            ai_call_done=True, previous_rank=2))
    db.commit()
    return pl


def test_daily_report(client, world):
    db, w = world["db"], world
    _plist(db, w["jc"], w["sj"], 1)
    _plist(db, w["jc"], w["sj"], 2)
    _plist(db, w["pc"], w["sp"], 1)
    _plist(db, w["pc"], w["sp"], 1, d=TODAY - timedelta(days=1))
    rep = client.get(f"/api/v1/ops/reports/daily?date={TODAY}", headers=w["h"]["ops_j"]).json()
    assert len(rep) == 1 and rep[0]["revision"] == 2
    assert rep[0]["coordinator"] == {"id": str(w["jc"].id), "display_name": w["jc"].display_name,
                                     "city": "Jaipur"}
    it = rep[0]["items"][0]
    assert it["rank"] == 1 and it["previous_rank"] == 2 and it["risk_score"] == 72
    assert it["senior"]["senior_id"] == w["sj"].senior_id and it["senior"]["display_name"] == "Test Person"
    assert it["reasons"] == ["Missed tablets"] and it["ai_call_done"] is True
    assert len(client.get(f"/api/v1/ops/reports/daily?date={TODAY}", headers=w["h"]["admin"]).json()) == 2
    assert client.get(f"/api/v1/ops/reports/daily?date={TODAY}&city=Pune", headers=w["h"]["ops_j"]).json() == []
    assert client.get("/api/v1/ops/reports/daily?date=2026-01-01", headers=w["h"]["admin"]).json() == []
    assert client.get("/api/v1/ops/reports/daily?date=bad", headers=w["h"]["admin"]).status_code == 422


def test_run_job(client, world, monkeypatch):
    from app.jobs import registry
    calls = []
    monkeypatch.setattr(registry, "run_job", lambda name, db, d: calls.append((name, d)) or {"n": 1})
    url = "/api/v1/admin/jobs/nightly_scoring/run"
    r = client.post(f"{url}?date=2026-10-10", headers=world["h"]["admin"])
    assert r.status_code == 200 and r.json() == {"job": "nightly_scoring", "date": "2026-10-10", "status": "ok"}
    assert calls == [("nightly_scoring", date(2026, 10, 10))]
    assert client.post(url, headers=world["h"]["admin"]).json()["date"] == TODAY.isoformat()
    assert world["db"].query(AuditLog).filter_by(action="run_job").count() == 2
    assert client.post(url).status_code == 401
    assert client.post(url, headers=world["h"]["ops_all"]).status_code == 403
    assert client.post(url, headers=world["h"]["coord"]).status_code == 403
    assert client.post("/api/v1/admin/jobs/nope/run", headers=world["h"]["admin"]).status_code == 404
    assert client.post(f"{url}?date=bad", headers=world["h"]["admin"]).status_code == 422


def test_run_job_failure_rolls_back(client, world, monkeypatch):
    from app.jobs import registry

    def boom(name, db, d):
        db.add(AuditLog(action="should_roll_back"))
        db.flush()
        raise RuntimeError("secret detail")

    monkeypatch.setattr(registry, "run_job", boom)
    r = client.post("/api/v1/admin/jobs/reminders/run", headers=world["h"]["admin"])
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error" and "secret" not in r.text
    assert world["db"].query(AuditLog).filter_by(action="should_roll_back").count() == 0
