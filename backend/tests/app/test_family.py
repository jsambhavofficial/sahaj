from datetime import date, datetime, timedelta, timezone

import pytest

from app.core import safety
from app.modules.alerts.models import Alert
from app.modules.auth.models import AuditLog
from app.modules.checkins.models import Checkin
from app.modules.family import service
from app.modules.family.models import WeeklyFamilySummary
from app.modules.medications.models import MedicationEvent
from app.modules.vitals.models import DailyActivity
from tests.app.factories import auth, link_family, make_schedule, make_senior, make_user

API = "/api/v1"
WEEK = date(2026, 10, 5)  # Monday
IST = service.IST


def _utc(d, h=9):
    return datetime(d.year, d.month, d.day, h, tzinfo=IST).astimezone(timezone.utc)


def _data(db, senior):
    sched = make_schedule(db, senior, times=["08:00"])
    for i, status in enumerate(["taken", "taken", "taken", "missed", "unknown"]):
        db.add(MedicationEvent(medication_event_id=f"E{senior.senior_id}{i}", senior_id=senior.senior_id,
                               medication_id=sched.medication_id,
                               scheduled_at=_utc(WEEK + timedelta(days=i)), status=status,
                               record_source="smart_pillbox"))
    for i in range(7):  # steps: 6000 this week vs 4000 before => higher
        db.add(DailyActivity(senior_id=senior.senior_id, date=WEEK + timedelta(days=i), steps=6000))
        db.add(DailyActivity(senior_id=senior.senior_id, date=WEEK - timedelta(days=i + 1), steps=4000))
    db.add(Checkin(checkin_id=f"C{senior.senior_id}", senior_id=senior.senior_id, at=_utc(WEEK, 10),
                   channel="phone_call"))
    db.add(Alert(alert_id=f"A{senior.senior_id}", senior_id=senior.senior_id, created_at=_utc(WEEK, 12),
                 last_updated_at=_utc(WEEK, 12), severity="HIGH", recommended_next_step="Call"))
    db.commit()


@pytest.fixture
def world(db_session):
    coord = make_user(db_session, "coordinator", city="Jaipur")
    senior, suser = make_senior(db_session, coord)
    fam = make_user(db_session, "family")
    link_family(db_session, fam, senior, level="full")
    _data(db_session, senior)
    return db_session, coord, senior, fam


def test_generate_content_from_real_data(world):
    db, _, senior, _ = world
    s = service.generate_weekly_summary(db, senior.senior_id, WEEK + timedelta(days=3))  # any day in week
    assert s.week_start == WEEK and s.generated_by == "template" and s.language == "hindi"
    assert "3 mein se" not in s.body_text and "5 mein se 3" in s.body_text and "(60%)" in s.body_text
    assert "zyada" in s.body_text  # activity higher
    assert "1 check-in" in s.body_text and "1 alert" in s.body_text
    assert safety.is_safe(s.body_text)


def test_generate_is_idempotent(world):
    db, _, senior, _ = world
    a = service.generate_weekly_summary(db, senior.senior_id, WEEK)
    b = service.generate_weekly_summary(db, senior.senior_id, WEEK)
    assert a.id == b.id and db.query(WeeklyFamilySummary).count() == 1


def test_empty_week_still_safe(db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    link_family(db_session, make_user(db_session, "family"), senior)
    s = service.generate_weekly_summary(db_session, senior.senior_id, WEEK)
    assert "0 check-in" in s.body_text and "koi alert nahi" in s.body_text
    assert safety.is_safe(s.body_text)


@pytest.mark.parametrize("senior_level,link_level,consent", [
    ("urgent_only", "full", True), ("full", "urgent_only", True), ("full", "full", False)])
def test_no_summary_without_consent(db_session, senior_level, link_level, consent):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord, family_level=senior_level)
    link_family(db_session, make_user(db_session, "family"), senior, level=link_level, consent=consent)
    assert service.generate_weekly_summary(db_session, senior.senior_id, WEEK) is None
    assert db_session.query(WeeklyFamilySummary).count() == 0


def test_template_languages_pass_guard():
    for lang, t in service._T.items():
        text = " ".join([t["head"], t["meds"], *t["act"].values(), t["checkins"], t["alerts_0"],
                         t["alerts_n"], t["tail"]])
        assert safety.is_safe(text), lang


def test_job_run_and_delivery(world):
    db, _, senior, fam = world
    provider = service.StubMessageProvider()
    on = WEEK + timedelta(days=7)  # next Monday => summarises WEEK
    out = service.run_weekly(db, on, provider)
    assert out["generated"] == 1 and out["delivered"] == 1 and out["week_start"] == "2026-10-05"
    assert [m["recipient_user_id"] for m in provider.sent] == [str(fam.id)]
    row = db.query(WeeklyFamilySummary).one()
    assert row.sent_at is not None
    again = service.run_weekly(db, on, provider)
    assert again["generated"] == 0 and again["existing"] == 1 and again["delivered"] == 0
    assert len(provider.sent) == 1


def test_job_skips_urgent_only_seniors(db_session):
    from app.jobs import weekly_family_summary

    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord, family_level="urgent_only")
    link_family(db_session, make_user(db_session, "family"), senior, level="urgent_only")
    out = weekly_family_summary.run(db_session, WEEK + timedelta(days=7))
    assert out["skipped_no_consent"] == 1 and out["generated"] == 0


def test_delivery_only_to_summary_level_members(world):
    db, _, senior, _ = world
    urgent = make_user(db, "family")
    link_family(db, urgent, senior, level="urgent_only")
    s = service.generate_weekly_summary(db, senior.senior_id, WEEK)
    p = service.StubMessageProvider()
    service.deliver_summary(db, s, p)
    assert str(urgent.id) not in [m["recipient_user_id"] for m in p.sent] and len(p.sent) == 1


# ---- endpoints ----

def test_staff_endpoint(client, world):
    db, coord, senior, _ = world
    service.generate_weekly_summary(db, senior.senior_id, WEEK)
    h = auth(client, coord.email)
    r = client.get(f"{API}/seniors/{senior.senior_id}/family-summary", headers=h, params={"week": "2026-10-08"})
    body = r.json()
    assert r.status_code == 200 and body["week_start"] == "2026-10-05" and body["generated_by"] == "template"
    assert body["details"]["adherence_pct"] == 60 and body["details"]["activity_trend"] == "higher"
    assert body["details"]["alerts"] == 1 and body["details"]["checkins"] == 1
    assert db.query(AuditLog).filter_by(action="family_summary.read", senior_id=senior.senior_id).count() == 1


def test_staff_endpoint_errors(client, world):
    db, coord, senior, fam = world
    url = f"{API}/seniors/{senior.senior_id}/family-summary"
    h = auth(client, coord.email)
    assert client.get(url).status_code == 401
    assert client.get(url, headers=h, params={"week": "2026-10-05"}).status_code == 404  # not generated
    assert client.get(f"{API}/seniors/NOPE/family-summary", headers=h).status_code == 404
    assert client.get(url, headers=h, params={"week": "notadate"}).status_code == 422
    other = make_user(db, "coordinator")
    assert client.get(url, headers=auth(client, other.email)).status_code == 403  # wrong coordinator
    assert client.get(url, headers=auth(client, fam.email)).status_code == 403  # wrong role
    ops = make_user(db, "ops", city="Delhi")
    assert client.get(url, headers=auth(client, ops.email)).status_code == 403  # other city


def test_family_endpoint_by_consent(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    _data(db_session, senior)
    full, mid, low = (make_user(db_session, "family") for _ in range(3))
    link_family(db_session, full, senior, level="full")
    link_family(db_session, mid, senior, level="summary_and_urgent")
    link_family(db_session, low, senior, level="urgent_only")
    service.generate_weekly_summary(db_session, senior.senior_id, WEEK)
    q = {"week": "2026-10-05"}
    r = client.get(f"{API}/family/me/summary", headers=auth(client, full.email), params=q)
    assert r.status_code == 200 and r.json()["details"]["doses_scheduled"] == 5 and r.json()["body_text"]
    assert set(r.json()) == {"senior_id", "week_start", "language", "body_text", "generated_by",
                             "sent_at", "details"}
    r = client.get(f"{API}/family/me/summary", headers=auth(client, mid.email), params=q)
    assert r.status_code == 200 and r.json()["details"] is None and r.json()["body_text"]
    assert client.get(f"{API}/family/me/summary", headers=auth(client, low.email), params=q).status_code == 403


def test_family_endpoint_errors(client, world):
    db, coord, senior, fam = world
    service.generate_weekly_summary(db, senior.senior_id, WEEK)
    url = f"{API}/family/me/summary"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=auth(client, coord.email)).status_code == 403  # wrong role
    stranger = make_user(db, "family")
    assert client.get(url, headers=auth(client, stranger.email)).status_code == 403  # no link
    h = auth(client, fam.email)
    assert client.get(url, headers=h, params={"week": "2026-09-01"}).status_code == 404
    assert client.get(url, headers=h, params={"week": "x"}).status_code == 422
    assert client.get(url, headers=h, params={"week": "2026-10-05", "senior_id": "SOTHER"}).status_code == 403


def test_family_without_consent_given_or_senior_level(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord, family_level="urgent_only")
    db_session.add(WeeklyFamilySummary(senior_id=senior.senior_id, week_start=WEEK, body_text="x",
                                       language="hindi"))
    db_session.commit()
    fam = make_user(db_session, "family")
    link_family(db_session, fam, senior, level="full")  # link says full, senior says urgent_only
    r = client.get(f"{API}/family/me/summary", headers=auth(client, fam.email), params={"week": "2026-10-05"})
    assert r.status_code == 403
    nocons = make_user(db_session, "family")
    link_family(db_session, nocons, senior, consent=False)
    assert client.get(f"{API}/family/me/summary", headers=auth(client, nocons.email)).status_code == 403


def test_family_multiple_links_need_senior_id(client, world):
    db, coord, senior, fam = world
    other, _ = make_senior(db, coord)
    link_family(db, fam, other)
    service.generate_weekly_summary(db, senior.senior_id, WEEK)
    h = auth(client, fam.email)
    assert client.get(f"{API}/family/me/summary", headers=h).status_code == 422
    r = client.get(f"{API}/family/me/summary", headers=h,
                   params={"senior_id": senior.senior_id, "week": "2026-10-05"})
    assert r.status_code == 200
