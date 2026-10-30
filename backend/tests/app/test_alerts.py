from datetime import timedelta

import pytest

from app.modules.alerts import notifier
from app.modules.alerts import service as alert_service
from app.modules.alerts.models import Alert, AlertEvent, AlertFeedback
from app.modules.risk import service as risk_service
from app.modules.risk.scorer import ScoreResult, level_for
from tests.app.factories import auth, make_alert, make_senior, make_user
from tests.app.test_risk_support import ON

API = "/api/v1"


class FakeScorer:
    """Returns whatever score the test set for each senior."""

    def __init__(self):
        self.scores: dict[str, tuple[int, list]] = {}

    def set(self, senior, score, evidence=("Steps were low",), tripwire=False):
        factors = [{"rule_id": "R1", "category": "x", "evidence": e, "window": "w",
                    "points_contributed": score, "is_safety_tripwire": tripwire} for e in evidence]
        self.scores[senior.senior_id] = (score, factors if score else [])

    def score(self, db, senior_id, on_date):
        score, factors = self.scores.get(senior_id, (0, []))
        return ScoreResult(risk_score=score, risk_level=level_for(score), confidence_level="HIGH",
                           baseline_confidence="HIGH", top_factors=factors,
                           recommended_action="Call today" if score else "Routine")


@pytest.fixture
def fake(monkeypatch):
    f = FakeScorer()
    monkeypatch.setattr(risk_service, "get_scorer", lambda: f)
    return f


@pytest.fixture
def notes(monkeypatch):
    sent = []
    monkeypatch.setattr(alert_service, "safe_notify", lambda db, uid, kind, *a, **k: sent.append((kind, uid)))
    return sent


@pytest.fixture
def world(db_session):
    c1 = make_user(db_session, "coordinator", city="Jaipur")
    c2 = make_user(db_session, "coordinator", city="Pune")
    s1, _ = make_senior(db_session, c1, city="Jaipur")
    s2, _ = make_senior(db_session, c2, city="Pune")
    return dict(c1=c1, c2=c2, s1=s1, s2=s2, db=db_session)


def run(db, senior, day):
    return risk_service.score_and_alert(db, [senior.senior_id], day)[senior.senior_id][1]


def alerts(db):
    return db.query(Alert).order_by(Alert.created_at).all()


# ---------------------------------------------------------------- lifecycle rules

def test_creates_one_alert_with_signals_and_event(world, fake, notes):
    db, s = world["db"], world["s1"]
    fake.set(s, 60, evidence=("Steps were low", "Missed tablets"))
    ch = run(db, s, ON)
    assert ch.action == "created"
    [a] = alerts(db)
    assert a.status == "OPEN" and a.severity == "HIGH"
    assert a.triggering_signals == ["Steps were low", "Missed tablets"] and a.recommended_next_step == "Call today"
    [ev] = db.query(AlertEvent).all()
    assert (ev.from_status, ev.to_status, ev.actor_user_id) == (None, "OPEN", None)
    assert notes == [("alert_new", world["c1"].id)]


def test_moderate_scores_do_not_alert(world, fake, notes):
    fake.set(world["s1"], 40)
    assert run(world["db"], world["s1"], ON).action is None
    assert alerts(world["db"]) == [] and notes == []


def test_safety_tripwire_alerts_even_with_low_points(world, fake):
    fake.set(world["s1"], 30, tripwire=True)
    assert run(world["db"], world["s1"], ON).action == "created"


def test_rerun_same_day_is_idempotent(world, fake, notes):
    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    assert run(db, s, ON).action is None
    assert len(alerts(db)) == 1 and db.query(AlertEvent).count() == 1 and len(notes) == 1


def test_same_or_lower_severity_dedupes_and_refreshes_signals(world, fake, notes):
    db, s = world["db"], world["s1"]
    fake.set(s, 60, evidence=("A",))
    run(db, s, ON)
    fake.set(s, 55, evidence=("B",))
    assert run(db, s, ON + timedelta(days=1)).action == "refreshed"
    [a] = alerts(db)
    assert a.status == "OPEN" and a.triggering_signals == ["B"] and db.query(AlertEvent).count() == 1
    assert len(notes) == 1  # no second notification


def test_escalates_only_when_severity_increases(world, fake, notes):
    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    fake.set(s, 80)
    assert run(db, s, ON + timedelta(days=1)).action == "escalated"
    [a] = alerts(db)
    assert a.status == "ESCALATED" and a.severity == "URGENT_REVIEW"
    assert [(e.from_status, e.to_status) for e in db.query(AlertEvent).order_by(AlertEvent.at).all()
            if e.from_status] == [("OPEN", "ESCALATED")]
    assert [k for k, _ in notes] == ["alert_new", "alert_escalated"]
    fake.set(s, 60)  # drops back: no de-escalation, no new alert
    run(db, s, ON + timedelta(days=2))
    assert len(alerts(db)) == 1 and alerts(db)[0].severity == "URGENT_REVIEW"


def test_auto_resolves_after_three_low_days(world, fake):
    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    fake.set(s, 10)
    assert run(db, s, ON + timedelta(days=1)).action is None
    assert run(db, s, ON + timedelta(days=2)).action is None
    ch = run(db, s, ON + timedelta(days=3))
    assert ch.action == "resolved"
    [a] = alerts(db)
    assert a.status == "RESOLVED" and "low" in a.resolution_reason
    last = db.query(AlertEvent).order_by(AlertEvent.at.desc()).first()
    assert last.to_status == "RESOLVED" and last.actor_user_id is None


def test_a_high_day_resets_the_low_streak(world, fake):
    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    fake.set(s, 10)
    run(db, s, ON + timedelta(days=1))
    run(db, s, ON + timedelta(days=2))
    fake.set(s, 60)
    run(db, s, ON + timedelta(days=3))
    fake.set(s, 10)
    run(db, s, ON + timedelta(days=4))
    assert alerts(db)[0].status == "OPEN"


def test_cooldown_suppresses_repeat_alert_but_not_worse_or_new_tripwire(world, fake):
    db, s = world["db"], world["s1"]
    fake.set(s, 60, evidence=("A",))
    run(db, s, ON)
    a = alerts(db)[0]
    a.status, a.resolution_reason = "RESOLVED", "handled"
    a.last_updated_at = alert_service.stamp_for(ON + timedelta(days=1))
    db.commit()
    assert run(db, s, ON + timedelta(days=1)).action == "suppressed"
    assert len(alerts(db)) == 1
    fake.set(s, 80, evidence=("A",))  # clearly worse
    assert run(db, s, ON + timedelta(days=1)).action == "created"
    # resolved again, then a different safety event appears at the same severity
    b = alerts(db)[1]
    b.status, b.last_updated_at = "RESOLVED", alert_service.stamp_for(ON + timedelta(days=1))
    db.commit()
    fake.set(s, 80, evidence=("A",), tripwire=True)
    assert run(db, s, ON + timedelta(days=2)).action == "suppressed"
    fake.set(s, 80, evidence=("A fresh fall",), tripwire=True)
    assert run(db, s, ON + timedelta(days=2)).action == "created"


def test_new_alert_allowed_after_cooldown(world, fake):
    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    a = alerts(db)[0]
    a.status, a.last_updated_at = "RESOLVED", alert_service.stamp_for(ON)
    db.commit()
    assert run(db, s, ON + timedelta(days=3)).action == "created"


def test_safe_notify_never_raises(db_session, monkeypatch):
    import app.modules.notifications.service as ns

    def boom(*a, **k):
        raise RuntimeError("push exploded")

    monkeypatch.setattr(ns, "notify", boom)
    assert notifier.safe_notify(db_session, make_user(db_session, "coordinator").id, "alert_new", "t", "b") is False
    assert notifier.safe_notify(db_session, None, "alert_new", "t", "b") is False


def test_real_notification_is_generic_and_atomic(world, fake):
    """No monkeypatching: the real notify() runs inside the scoring transaction."""
    from app.modules.notifications.models import Notification

    db, s = world["db"], world["s1"]
    fake.set(s, 60)
    run(db, s, ON)
    [n] = db.query(Notification).all()
    assert n.user_id == world["c1"].id and n.kind == "alert_new"
    assert n.data == {"alert_id": alerts(db)[0].alert_id}
    assert "Test Person" not in n.title + n.body and s.senior_id not in n.title + n.body


# ---------------------------------------------------------------- API

def test_list_requires_auth_and_role(client, world):
    assert client.get(f"{API}/alerts").status_code == 401
    db = world["db"]
    for role in ("family",):
        u = make_user(db, role)
        assert client.get(f"{API}/alerts", headers=auth(client, u.email)).status_code == 403
    senior_user = world["s1"].user_id
    from app.modules.auth.models import User
    from tests.app.factories import senior_headers

    assert client.get(f"{API}/alerts", headers=senior_headers(db.get(User, senior_user))).status_code == 403


def test_list_scoped_filtered_and_paginated(client, world):
    db = world["db"]
    a1 = make_alert(db, world["s1"], severity="HIGH")
    make_alert(db, world["s1"], severity="URGENT_REVIEW", status="RESOLVED")
    a3 = make_alert(db, world["s2"], severity="HIGH")
    h1 = auth(client, world["c1"].email)
    body = client.get(f"{API}/alerts", headers=h1).json()
    assert body["total"] == 2 and {i["senior_id"] for i in body["items"]} == {world["s1"].senior_id}
    assert set(body) == {"items", "total", "limit", "offset"}
    assert "events" not in body["items"][0]
    only = client.get(f"{API}/alerts?status=OPEN", headers=h1).json()
    assert [i["alert_id"] for i in only["items"]] == [a1.alert_id]
    assert client.get(f"{API}/alerts?severity=URGENT_REVIEW", headers=h1).json()["total"] == 1
    assert client.get(f"{API}/alerts?limit=1&offset=1", headers=h1).json()["items"].__len__() == 1
    assert client.get(f"{API}/alerts?limit=500", headers=h1).status_code == 422
    assert client.get(f"{API}/alerts?status=bogus", headers=h1).status_code == 422
    # filtering by someone else's senior is forbidden, unknown senior is 404
    assert client.get(f"{API}/alerts?senior_id={world['s2'].senior_id}", headers=h1).status_code == 403
    assert client.get(f"{API}/alerts?senior_id=NOPE", headers=h1).status_code == 404
    admin = auth(client, make_user(db, "admin").email)
    assert client.get(f"{API}/alerts", headers=admin).json()["total"] == 3
    ops = auth(client, make_user(db, "ops", city="Pune").email)
    assert [i["alert_id"] for i in client.get(f"{API}/alerts", headers=ops).json()["items"]] == [a3.alert_id]


def test_get_alert_with_events_scope_and_404(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"])
    h1, h2 = auth(client, world["c1"].email), auth(client, world["c2"].email)
    r = client.get(f"{API}/alerts/{a.alert_id}", headers=h1)
    assert r.status_code == 200
    body = r.json()
    assert body["alert_id"] == a.alert_id and body["triggering_signals"] == ["Steps were low"]
    assert body["events"][0]["to_status"] == "OPEN" and body["events"][0]["actor"] == "System"
    assert client.get(f"{API}/alerts/{a.alert_id}", headers=h2).status_code == 403
    assert client.get(f"{API}/alerts/ALT_NOPE", headers=h1).status_code == 404
    assert client.get(f"{API}/alerts/{a.alert_id}").status_code == 401
    ops_other = auth(client, make_user(db, "ops", city="Pune").email)
    assert client.get(f"{API}/alerts/{a.alert_id}", headers=ops_other).status_code == 403
    ops_ok = auth(client, make_user(db, "ops", city="Jaipur").email)
    assert client.get(f"{API}/alerts/{a.alert_id}", headers=ops_ok).status_code == 200


def test_acknowledge_flow_and_event_actor(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"])
    h = auth(client, world["c1"].email)
    r = client.post(f"{API}/alerts/{a.alert_id}/acknowledge", json={"note": "On it"}, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ACKNOWLEDGED" and body["assigned_to"] == str(world["c1"].id)
    last = body["events"][-1]
    assert (last["from_status"], last["to_status"], last["note"]) == ("OPEN", "ACKNOWLEDGED", "On it")
    assert last["actor"] == world["c1"].display_name
    # acknowledging again is an invalid transition
    assert client.post(f"{API}/alerts/{a.alert_id}/acknowledge", headers=h).status_code == 409


def test_acknowledge_without_body(client, world):
    a = make_alert(world["db"], world["s1"])
    h = auth(client, world["c1"].email)
    assert client.post(f"{API}/alerts/{a.alert_id}/acknowledge", headers=h).status_code == 200


def test_escalate_requires_note_and_valid_state(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"])
    h = auth(client, world["c1"].email)
    assert client.post(f"{API}/alerts/{a.alert_id}/escalate", json={}, headers=h).status_code == 422
    r = client.post(f"{API}/alerts/{a.alert_id}/escalate", json={"note": "Needs a doctor"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "ESCALATED"
    assert client.post(f"{API}/alerts/{a.alert_id}/escalate", json={"note": "again"}, headers=h).status_code == 409
    # an escalated alert can still be acknowledged, then resolved
    assert client.post(f"{API}/alerts/{a.alert_id}/acknowledge", headers=h).json()["status"] == "ACKNOWLEDGED"


def test_resolve_requires_reason_and_blocks_further_changes(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"])
    h = auth(client, world["c1"].email)
    assert client.post(f"{API}/alerts/{a.alert_id}/resolve", json={}, headers=h).status_code == 422
    r = client.post(f"{API}/alerts/{a.alert_id}/resolve",
                    json={"resolution_reason": "Called, all fine", "note": "Spoke to them"}, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "RESOLVED" and body["resolution_reason"] == "Called, all fine"
    assert body["events"][-1]["note"] == "Spoke to them"
    for action, payload in (("acknowledge", {}), ("escalate", {"note": "x"}),
                            ("resolve", {"resolution_reason": "again"})):
        assert client.post(f"{API}/alerts/{a.alert_id}/{action}", json=payload, headers=h).status_code == 409


def test_actions_forbidden_for_wrong_coordinator_ops_and_family(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"])
    bodies = {"acknowledge": {}, "escalate": {"note": "x"}, "resolve": {"resolution_reason": "r"},
              "feedback": {"useful": True}}
    wrong = auth(client, world["c2"].email)
    ops = auth(client, make_user(db, "ops", city="Jaipur").email)
    fam = auth(client, make_user(db, "family").email)
    for action, payload in bodies.items():
        url = f"{API}/alerts/{a.alert_id}/{action}"
        assert client.post(url, json=payload, headers=wrong).status_code == 403, action
        assert client.post(url, json=payload, headers=ops).status_code == 403, action
        assert client.post(url, json=payload, headers=fam).status_code == 403, action
        assert client.post(url, json=payload).status_code == 401, action
        assert client.post(f"{API}/alerts/ALT_NOPE/{action}", json=payload,
                           headers=auth(client, world["c1"].email)).status_code == 404, action
    db.refresh(a)
    assert a.status == "OPEN"


def test_admin_can_act_on_any_alert(client, world):
    a = make_alert(world["db"], world["s2"])
    admin = auth(client, make_user(world["db"], "admin").email)
    assert client.post(f"{API}/alerts/{a.alert_id}/acknowledge", headers=admin).status_code == 200


def test_feedback_create_update_and_validation(client, world):
    db = world["db"]
    a = make_alert(db, world["s1"], status="RESOLVED")
    h = auth(client, world["c1"].email)
    url = f"{API}/alerts/{a.alert_id}/feedback"
    r = client.post(url, json={"useful": True, "outcome": "called", "comment": "Good catch"}, headers=h)
    assert r.status_code == 201
    assert r.json()["useful"] is True and r.json()["outcome"] == "called" and r.json()["alert_id"] == a.alert_id
    r2 = client.post(url, json={"useful": False, "outcome": "no_action"}, headers=h)
    assert r2.status_code == 201 and r2.json()["id"] == r.json()["id"]
    [row] = db.query(AlertFeedback).all()
    assert row.useful is False and row.outcome == "no_action" and row.coordinator_id == world["c1"].id
    assert client.post(url, json={"outcome": "called"}, headers=h).status_code == 422
    assert client.post(url, json={"useful": True, "outcome": "bogus"}, headers=h).status_code == 422
    assert client.post(url, json={"useful": True}, headers=h).status_code == 201  # outcome optional


def test_actions_write_audit_rows_without_pii(client, world):
    from app.modules.auth.models import AuditLog

    db = world["db"]
    a = make_alert(db, world["s1"])
    h = auth(client, world["c1"].email)
    client.get(f"{API}/alerts/{a.alert_id}", headers=h)
    client.post(f"{API}/alerts/{a.alert_id}/acknowledge", headers=h)
    rows = db.query(AuditLog).filter(AuditLog.action.like("alert.%")).all()
    assert {r.action for r in rows} == {"alert.view", "alert.acknowledge"}
    assert all(r.senior_id == world["s1"].senior_id and "Test Person" not in str(r.detail) for r in rows)
