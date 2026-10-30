from datetime import date, datetime, timedelta, timezone

from app.jobs import reminders
from app.modules.medications.models import MedicationEvent
from app.modules.notifications.models import Notification
from tests.app.factories import make_schedule, make_senior, make_user

D = date(2026, 10, 12)  # a Monday
IST = reminders.IST


def _setup(db, **kw):
    coord = make_user(db, "coordinator")
    senior, suser = make_senior(db, coord)
    for k, v in kw.items():
        setattr(senior, k, v)
    db.commit()
    return senior, suser


def _now(h, m=0, d=D):
    return datetime(d.year, d.month, d.day, h, m, tzinfo=IST)


def test_creates_one_reminder_per_time_and_is_idempotent(db_session):
    senior, suser = _setup(db_session)
    make_schedule(db_session, senior, times=["08:00", "21:30"])
    r1 = reminders.run(db_session, D, now=_now(0))
    assert r1["medication_reminders"] == 2
    rows = db_session.query(Notification).filter_by(kind="medication_reminder").all()
    assert {n.user_id for n in rows} == {suser.id}
    assert sorted(n.scheduled_for.replace(tzinfo=timezone.utc).astimezone(IST).strftime("%H:%M")
                  for n in rows) == ["08:00", "21:30"]
    assert all(set(n.data) <= {"medication_id", "senior_id", "scheduled_at"} for n in rows)
    assert reminders.run(db_session, D, now=_now(0))["medication_reminders"] == 0
    assert db_session.query(Notification).count() == 2


def test_skips_sos_inactive_and_out_of_range(db_session):
    senior, _ = _setup(db_session)
    make_schedule(db_session, senior, sos=True)
    make_schedule(db_session, senior, active=False)
    make_schedule(db_session, senior, end=D - timedelta(days=1))
    make_schedule(db_session, senior, start=D + timedelta(days=1))
    assert reminders.run(db_session, D, now=_now(0))["medication_reminders"] == 0


def test_reminder_text_is_generic(db_session):
    senior, _ = _setup(db_session)
    make_schedule(db_session, senior)
    reminders.run(db_session, D, now=_now(0))
    n = db_session.query(Notification).one()
    assert "Drug" not in n.title + n.body and "Test Person" not in n.title + n.body


def test_grace_pass_records_unknown_only_after_grace(db_session):
    senior, _ = _setup(db_session)
    make_schedule(db_session, senior, times=["08:00"])
    assert reminders.run(db_session, D, now=_now(9, 29))["unconfirmed_doses_recorded"] == 0
    assert reminders.run(db_session, D, now=_now(9, 31))["unconfirmed_doses_recorded"] == 1
    ev = db_session.query(MedicationEvent).one()
    assert ev.status == "unknown" and ev.actual_at is None and ev.verification_status == "unverified"
    assert reminders.run(db_session, D, now=_now(12))["unconfirmed_doses_recorded"] == 0  # idempotent
    assert db_session.query(MedicationEvent).count() == 1


def test_grace_pass_respects_existing_event(db_session):
    senior, _ = _setup(db_session)
    sched = make_schedule(db_session, senior, times=["08:00"])
    db_session.add(MedicationEvent(medication_event_id="ME1", senior_id=senior.senior_id,
                                   medication_id=sched.medication_id, scheduled_at=_now(8).astimezone(timezone.utc),
                                   status="taken", actual_at=_now(8, 5).astimezone(timezone.utc),
                                   record_source="senior_app_confirmation"))
    db_session.commit()
    assert reminders.run(db_session, D, now=_now(23))["unconfirmed_doses_recorded"] == 0
    assert [e.status for e in db_session.query(MedicationEvent)] == ["taken"]


def test_checkin_prompt_on_checkin_day_and_hour(db_session):
    senior, suser = _setup(db_session, checkin_days_of_week=["Mon", "Thu"], checkin_preferred_hour=16)
    assert reminders.run(db_session, D, now=_now(0))["checkin_prompts"] == 1
    n = db_session.query(Notification).filter_by(kind="checkin_prompt").one()
    assert n.user_id == suser.id and n.data == {"senior_id": senior.senior_id, "date": "2026-10-12"}
    assert reminders.run(db_session, D, now=_now(0))["checkin_prompts"] == 0
    assert reminders.run(db_session, D + timedelta(days=1), now=_now(0))["checkin_prompts"] == 0  # Tuesday


def test_process_due_covers_today_and_yesterday_grace(db_session):
    senior, _ = _setup(db_session)
    make_schedule(db_session, senior, times=["23:30"])
    now = _now(1, 30, D + timedelta(days=1))  # 01:30 next day: yesterday's 23:30 dose is past grace
    out = reminders.process_due(db_session, now)
    assert out["unconfirmed_doses_recorded"] == 1
    assert reminders.process_due(db_session, now)["unconfirmed_doses_recorded"] == 0
