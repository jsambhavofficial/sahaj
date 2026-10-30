"""Medication reminders, missed-dose grace pass and check-in prompts.

All times are Asia/Kolkata. Every step is idempotent: running it twice for the same date creates
no duplicate notifications and no duplicate medication events. The grace pass only ever records
`unknown` (we do not know the dose was missed, only that nobody confirmed it); it never invents
`taken`.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.notifications import repository as notif_repo
from app.modules.notifications import service as notif
from app.modules.seniors.models import Senior

IST = ZoneInfo("Asia/Kolkata")
_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

_MED_TEXT = {
    "english": ("Medicine reminder", "It is time for your medicine."),
    "hindi": ("Dawai ka samay", "Aapki dawai ka samay ho gaya hai."),
    "hinglish": ("Dawai ka samay", "Aapki dawai ka samay ho gaya hai."),
}
_CHECKIN_TEXT = {
    "english": ("Daily check-in", "Your daily check-in is ready. Tap to start."),
    "hindi": ("Aaj ki baat-cheet", "Aapki roz ki baat-cheet ka samay hai."),
    "hinglish": ("Aaj ki baat-cheet", "Aapki roz ki baat-cheet ka samay hai."),
}


def _text(table: dict, language: str | None) -> tuple[str, str]:
    return table.get(language or "hinglish", table["hinglish"])


def _utc(dt: datetime) -> datetime:
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def _parse_hhmm(value) -> time | None:
    try:
        h, m = str(value).strip().split(":")[:2]
        return time(int(h), int(m))
    except (ValueError, TypeError):
        return None


def _slots(db: Session, on_date: date):
    """Yield (schedule, senior, scheduled datetime in IST) for every due dose on `on_date`."""
    rows = db.execute(
        select(MedicationSchedule, Senior)
        .join(Senior, Senior.senior_id == MedicationSchedule.senior_id)
        .where(MedicationSchedule.is_active.is_(True), MedicationSchedule.is_sos.is_(False),
               MedicationSchedule.start_date <= on_date,
               (MedicationSchedule.end_date.is_(None)) | (MedicationSchedule.end_date >= on_date),
               Senior.is_active.is_(True))
        .order_by(MedicationSchedule.medication_id)).all()
    for sched, senior in rows:
        for raw in sched.scheduled_times or []:
            t = _parse_hhmm(raw)
            if t is not None:
                yield sched, senior, datetime.combine(on_date, t, tzinfo=IST)


def create_medication_reminders(db: Session, on_date: date) -> int:
    created = 0
    for sched, senior, when in _slots(db, on_date):
        if senior.user_id is None:
            continue
        existing = notif_repo.find_notifications(db, senior.user_id, "medication_reminder", _utc(when))
        if any((n.data or {}).get("medication_id") == sched.medication_id for n in existing):
            continue
        title, body = _text(_MED_TEXT, senior.preferred_language)
        notif.notify(db, senior.user_id, "medication_reminder", title, body,
                     data={"medication_id": sched.medication_id, "senior_id": senior.senior_id,
                           "scheduled_at": when.isoformat()},
                     scheduled_for=when, commit=False)
        created += 1
    return created


def record_unconfirmed_doses(db: Session, on_date: date, now: datetime) -> int:
    """Record doses past the grace period with no event as `unknown` (never `taken`)."""
    grace = timedelta(minutes=get_settings().reminder_grace_minutes)
    due = [(s, sn, w) for s, sn, w in _slots(db, on_date) if w + grace <= now]
    if not due:
        return 0
    med_ids = {s.medication_id for s, _, _ in due}
    lo, hi = _utc(min(w for _, _, w in due)), _utc(max(w for _, _, w in due))
    seen = {(e.medication_id, _utc(e.scheduled_at)) for e in db.scalars(
        select(MedicationEvent).where(MedicationEvent.medication_id.in_(med_ids),
                                      MedicationEvent.scheduled_at >= lo - timedelta(minutes=1),
                                      MedicationEvent.scheduled_at <= hi + timedelta(minutes=1)))}
    created = 0
    for sched, senior, when in due:
        key = (sched.medication_id, _utc(when))
        if key in seen:
            continue
        db.add(MedicationEvent(
            medication_event_id=f"ME_AUTO_{sched.medication_id}_{when:%Y%m%d%H%M}",
            senior_id=senior.senior_id, medication_id=sched.medication_id, scheduled_at=_utc(when),
            status="unknown", actual_at=None, record_source="system_grace_period",
            verification_status="unverified"))
        seen.add(key)
        created += 1
    return created


def _checkin_days(senior: Senior) -> set[str]:
    out = set()
    for d in senior.checkin_days_of_week or []:
        if isinstance(d, int) and 0 <= d <= 6:
            out.add(_DAYS[d])
        else:
            out.add(str(d).strip()[:3].lower())
    return out


def create_checkin_prompts(db: Session, on_date: date) -> int:
    created = 0
    day = _DAYS[on_date.weekday()]
    for senior in db.scalars(select(Senior).where(Senior.is_active.is_(True),
                                                  Senior.user_id.is_not(None))):
        if senior.checkin_preferred_hour is None or day not in _checkin_days(senior):
            continue
        when = datetime.combine(on_date, time(int(senior.checkin_preferred_hour)), tzinfo=IST)
        existing = notif_repo.find_notifications(db, senior.user_id, "checkin_prompt", _utc(when))
        if any((n.data or {}).get("date") == on_date.isoformat() for n in existing):
            continue
        title, body = _text(_CHECKIN_TEXT, senior.preferred_language)
        notif.notify(db, senior.user_id, "checkin_prompt", title, body,
                     data={"senior_id": senior.senior_id, "date": on_date.isoformat()},
                     scheduled_for=when, commit=False)
        created += 1
    return created


def run(db: Session, on_date: date, now: datetime | None = None) -> dict:
    now = now or datetime.now(IST)
    result = {
        "date": on_date.isoformat(),
        "medication_reminders": create_medication_reminders(db, on_date),
        "unconfirmed_doses_recorded": record_unconfirmed_doses(db, on_date, now),
        "checkin_prompts": create_checkin_prompts(db, on_date),
    }
    db.commit()
    return result


def process_due(db: Session, now: datetime | None = None) -> dict:
    """Scheduler entry point: today's reminders/prompts plus the grace pass for yesterday too."""
    now = now or datetime.now(IST)
    today = now.astimezone(IST).date()
    result = run(db, today, now=now)
    late = record_unconfirmed_doses(db, today - timedelta(days=1), now)
    db.commit()
    result["unconfirmed_doses_recorded"] += late
    return result
