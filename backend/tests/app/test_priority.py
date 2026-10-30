from datetime import timedelta

import pytest

from app.jobs import nightly_scoring, priority_build
from app.jobs.registry import get_job
from app.modules.alerts.models import Alert
from app.modules.coordinators import repository as crepo
from app.modules.coordinators import service as cs
from app.modules.coordinators.models import PriorityList, PriorityListItem
from app.modules.risk import service as risk_service
from app.modules.risk.models import DailyRiskScore
from tests.app.factories import auth, make_senior, make_user
from tests.app.test_risk_support import ON, baseline, call, cue, fall_window, med, vital
from tests.app.test_alerts import FakeScorer

API = "/api/v1"


@pytest.fixture
def fake(monkeypatch):
    f = FakeScorer()
    monkeypatch.setattr(risk_service, "get_scorer", lambda: f)
    monkeypatch.setattr("app.modules.alerts.service.safe_notify", lambda *a, **k: None)
    monkeypatch.setattr("app.modules.coordinators.service.safe_notify", lambda *a, **k: None)
    return f


@pytest.fixture
def world(db_session):
    db = db_session
    c1 = make_user(db, "coordinator", city="Jaipur")
    c2 = make_user(db, "coordinator", city="Pune")
    seniors = [make_senior(db, c1, sid=f"S1{i:02d}")[0] for i in range(3)]
    other, _ = make_senior(db, c2, sid="S900", city="Pune")
    return dict(db=db, c1=c1, c2=c2, s=seniors, other=other)


def items(db, pl):
    return crepo.items_of(db, [pl.id])[pl.id]


def test_build_ranks_by_score_with_ties_by_senior_id(world, fake):
    db, s = world["db"], world["s"]
    fake.set(s[0], 30)
    fake.set(s[1], 70)
    fake.set(s[2], 30)
    pl = cs.build_priority_lists(db, ON, coordinator_ids=[world["c1"].id])[0]
    got = items(db, pl)
    assert [i.senior_id for i in got] == ["S101", "S100", "S102"] and [i.rank for i in got] == [1, 2, 3]
    assert pl.revision == 1 and pl.reason == "morning_build"
    assert all(i.previous_rank is None for i in got)
    assert got[0].alert_id is not None and got[1].alert_id is None  # 70 raises an alert, 30 does not
    assert got[0].reasons == ["Steps were low"] and got[0].suggested_action == "Call today"
    assert got[0].risk_level == "HIGH"


def test_low_risk_senior_gets_a_plain_reason(world, fake):
    pl = cs.build_priority_lists(world["db"], ON, coordinator_ids=[world["c1"].id])[0]
    assert items(world["db"], pl)[0].reasons == ["Nothing unusual in the recent data"]


def test_top_25_cap(db_session, fake):
    c = make_user(db_session, "coordinator")
    for i in range(28):
        s, _ = make_senior(db_session, c, sid=f"S5{i:02d}")
        fake.set(s, i)
    pl = cs.build_priority_lists(db_session, ON, coordinator_ids=[c.id])[0]
    got = items(db_session, pl)
    assert len(got) == 25 and got[0].risk_score == 27 and got[-1].risk_score == 3


def test_morning_build_is_idempotent(world, fake):
    db, s = world["db"], world["s"]
    fake.set(s[0], 70)
    cs.build_priority_lists(db, ON)
    fake.set(s[0], 20)
    again = cs.build_priority_lists(db, ON)  # no new score computed yet for the date: lists rebuilt in place
    assert db.query(PriorityList).filter_by(list_date=ON).count() == 2  # one per coordinator
    assert {p.revision for p in again} == {1}
    n_items = db.query(PriorityListItem).count()
    cs.build_priority_lists(db, ON)
    assert db.query(PriorityListItem).count() == n_items


def test_morning_build_skipped_once_later_revisions_exist(world, fake):
    db, s = world["db"], world["s"]
    cs.build_priority_lists(db, ON)
    fake.set(s[1], 80)
    risk_service.rescore_and_rerank(db, s[1].senior_id, ON)
    out = cs.build_priority_lists(db, ON, "morning_build", [world["c1"].id])
    assert out[0].revision == 2
    assert db.query(PriorityList).filter_by(coordinator_id=world["c1"].id).count() == 2


def test_rerank_sets_previous_rank_and_ai_flag(world, fake):
    db, s = world["db"], world["s"]
    fake.set(s[0], 40)
    fake.set(s[1], 30)
    fake.set(s[2], 20)
    cs.build_priority_lists(db, ON)
    fake.set(s[2], 90)
    pl = risk_service.rescore_and_rerank(db, s[2].senior_id, ON)
    got = {i.senior_id: i for i in items(db, pl)}
    assert pl.revision == 2 and pl.reason == "post_ai_call"
    assert got["S102"].rank == 1 and got["S102"].previous_rank == 3 and got["S102"].ai_call_done
    assert got["S100"].rank == 2 and got["S100"].previous_rank == 1 and not got["S100"].ai_call_done
    assert got["S102"].alert_id is not None
    # other coordinators' lists are untouched
    assert db.query(PriorityList).filter_by(coordinator_id=world["c2"].id).count() == 1


def test_rerank_new_alert_reason_and_notification(world, fake, monkeypatch):
    sent = []
    monkeypatch.setattr("app.modules.coordinators.service.safe_notify", lambda db, uid, kind, *a, **k: sent.append((kind, uid)))
    db, s = world["db"], world["s"]
    pl = risk_service.rescore_and_rerank(db, s[0].senior_id, ON, reason="new_alert")
    assert pl.reason == "new_alert" and pl.revision == 1
    assert sent == [("priority_list_updated", world["c1"].id)]
    assert not items(db, pl)[0].ai_call_done


def test_ai_call_done_from_todays_ai_calls(world, fake):
    db, s = world["db"], world["s"]
    call(db, s[1], ON, kind="ai_agent", status="completed")
    call(db, s[2], ON - timedelta(days=1), kind="ai_agent", status="completed")  # yesterday
    call(db, s[0], ON, kind="ai_agent", status="failed")
    got = {i.senior_id: i.ai_call_done for i in items(db, cs.build_priority_lists(db, ON, coordinator_ids=[world["c1"].id])[0])}
    assert got == {"S100": False, "S101": True, "S102": False}


def test_inactive_seniors_are_left_out(world, fake):
    db, s = world["db"], world["s"]
    s[0].is_active = False
    db.commit()
    got = items(db, cs.build_priority_lists(db, ON, coordinator_ids=[world["c1"].id])[0])
    assert "S100" not in {i.senior_id for i in got}


# ---------------------------------------------------------------- endpoint

def test_today_requires_auth_and_role(client, world):
    assert client.get(f"{API}/coordinators/me/today").status_code == 401
    for role in ("ops", "family"):
        h = auth(client, make_user(world["db"], role).email)
        assert client.get(f"{API}/coordinators/me/today", headers=h).status_code == 403


def test_today_builds_on_the_fly_then_serves_highest_revision(client, world, fake):
    db, s = world["db"], world["s"]
    fake.set(s[1], 78, evidence=("Steps averaged 54% of baseline for 3 days", "Missed 2 of 3 BP tablets"))
    h = auth(client, world["c1"].email)
    r = client.get(f"{API}/coordinators/me/today?date={ON.isoformat()}", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"date", "revision", "reason", "generated_at", "items"}
    assert body["date"] == "2026-10-11" and body["revision"] == 1 and body["reason"] == "morning_build"
    top = body["items"][0]
    assert set(top) == {"rank", "previous_rank", "senior", "risk_score", "risk_level", "reasons",
                        "suggested_action", "alert_id", "ai_call_done"}
    assert top["rank"] == 1 and top["previous_rank"] is None and top["risk_score"] == 78
    assert top["risk_level"] == "URGENT_REVIEW" and top["reasons"][0].startswith("Steps averaged")
    assert top["senior"] == {"senior_id": "S101", "display_name": "Test Person", "age": 70,
                             "city": "Jaipur", "preferred_language": "hindi"}
    assert top["alert_id"].startswith("ALT_") and top["ai_call_done"] is False
    assert len(body["items"]) == 3
    # a second call does not build again
    client.get(f"{API}/coordinators/me/today?date={ON.isoformat()}", headers=h)
    assert db.query(PriorityList).filter_by(coordinator_id=world["c1"].id).count() == 1
    # after an AI call the new revision is served
    fake.set(s[2], 95)
    risk_service.rescore_and_rerank(db, s[2].senior_id, ON)
    body = client.get(f"{API}/coordinators/me/today?date={ON.isoformat()}", headers=h).json()
    assert body["revision"] == 2 and body["reason"] == "post_ai_call"
    assert body["items"][0]["senior"]["senior_id"] == "S102" and body["items"][0]["previous_rank"] == 3
    assert body["items"][0]["ai_call_done"] is True


def test_today_only_shows_own_caseload(client, world, fake):
    h = auth(client, world["c2"].email)
    items_ = client.get(f"{API}/coordinators/me/today?date={ON.isoformat()}", headers=h).json()["items"]
    assert [i["senior"]["senior_id"] for i in items_] == ["S900"]


def test_today_defaults_to_demo_date(client, world, fake, monkeypatch):
    monkeypatch.setattr("app.modules.coordinators.service.demo_today", lambda: ON)
    h = auth(client, world["c1"].email)
    assert client.get(f"{API}/coordinators/me/today", headers=h).json()["date"] == "2026-10-11"


def test_today_bad_date_is_422(client, world):
    h = auth(client, world["c1"].email)
    assert client.get(f"{API}/coordinators/me/today?date=nope", headers=h).status_code == 422


def test_today_admin_needs_coordinator_id(client, world, fake):
    h = auth(client, make_user(world["db"], "admin").email)
    assert client.get(f"{API}/coordinators/me/today?date={ON}", headers=h).status_code == 422
    ok = client.get(f"{API}/coordinators/me/today?date={ON}&coordinator_id={world['c2'].id}", headers=h)
    assert ok.status_code == 200 and ok.json()["items"][0]["senior"]["senior_id"] == "S900"
    assert client.get(f"{API}/coordinators/me/today?date={ON}&coordinator_id={world['s'][0].user_id}",
                      headers=h).status_code == 404


def test_today_with_real_heuristic_end_to_end(client, db_session):
    c = make_user(db_session, "coordinator")
    s, _ = make_senior(db_session, c)
    baseline(db_session, s)
    fall_window(db_session, s, ON)
    vital(db_session, s, ON, "spo2", 96)
    h = auth(client, c.email)
    top = client.get(f"{API}/coordinators/me/today?date={ON}", headers=h).json()["items"][0]
    assert top["risk_level"] == "URGENT_REVIEW" and "fall" in top["reasons"][0]
    assert db_session.query(Alert).count() == 1


# ---------------------------------------------------------------- jobs

def test_nightly_scoring_job_summary_and_idempotence(world, fake):
    db, s = world["db"], world["s"]
    fake.set(s[0], 80)
    fake.set(s[1], 55)
    out = nightly_scoring.run(db, ON)
    assert out["seniors_scored"] == 4 and out["levels"] == {"URGENT_REVIEW": 1, "HIGH": 1, "LOW": 2}
    assert out["alerts"] == {"created": 2} and out["priority_lists"] == 2
    again = nightly_scoring.run(db, ON)
    assert again["alerts"] == {} and again["seniors_scored"] == 4
    assert db.query(DailyRiskScore).count() == 4 and db.query(Alert).count() == 2
    assert db.query(PriorityList).count() == 2


def test_jobs_registered_and_priority_job(world, fake):
    db = world["db"]
    assert get_job("nightly_scoring") is nightly_scoring.run and get_job("priority_build") is priority_build.run
    out = priority_build.run(db, ON)
    assert out == {"date": "2026-10-11", "priority_lists": 2, "items": 4}
    assert priority_build.run(db, ON)["items"] == 4


def test_nightly_job_with_heuristic_scorer_and_history(db_session):
    """Several nights in a row with the real scorer: alert appears, stays single, resolves."""
    c = make_user(db_session, "coordinator")
    s, _ = make_senior(db_session, c)
    baseline(db_session, s)
    fall_window(db_session, s, ON)
    nightly_scoring.run(db_session, ON)
    nightly_scoring.run(db_session, ON + timedelta(days=1))  # fall still inside the 2-day window
    assert db_session.query(Alert).count() == 1
    for i in range(2, 6):
        nightly_scoring.run(db_session, ON + timedelta(days=i))
    [a] = db_session.query(Alert).all()
    assert a.status == "RESOLVED"
    assert db_session.query(DailyRiskScore).count() == 6


def test_job_batches_many_seniors(db_session, fake, monkeypatch):
    monkeypatch.setattr(risk_service, "BATCH_SIZE", 7)
    c = make_user(db_session, "coordinator")
    for i in range(20):
        make_senior(db_session, c, sid=f"S7{i:02d}")
    assert nightly_scoring.run(db_session, ON)["seniors_scored"] == 20
