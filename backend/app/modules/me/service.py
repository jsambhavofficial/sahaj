"""Senior app: home screen, dose confirmation, self-reported vitals and free-text reports.

Everything resolves the senior from the signed-in user (seniors.user_id); there is no senior id
in any /me path, so a senior can never reach someone else's data.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import today
from app.core.exceptions import AppError, NotFound
from app.modules.auth.models import User
from app.modules.me.schemas import (ConfirmOut, HomeOut, MedicationToday, NextCheckin, ReportOut, VitalIn,
                                    VitalOut)
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.messages import repository as message_repo
from app.modules.messages import service as message_service
from app.modules.seniors.models import Senior, SeniorContact
from app.modules.vitals import service as vitals_service
from app.modules.vitals.models import Vital

IST = timezone(timedelta(hours=5, minutes=30))
PENDING_GRACE = timedelta(hours=3)  # a dose with no record becomes "unknown" after this
_TAKEN = {"taken", "double_dose"}
_WEEKDAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}

# measurement_type -> (allowed units, default unit, {unit: (min, max)})
VITAL_RULES = {
    "blood_pressure_systolic": (("mmHg",), {"mmHg": (60, 260)}),
    "blood_pressure_diastolic": (("mmHg",), {"mmHg": (30, 160)}),
    "blood_glucose": (("mg/dL",), {"mg/dL": (30, 600)}),
    "spo2": (("%",), {"%": (50, 100)}),
    "weight": (("kg",), {"kg": (20, 250)}),
    "heart_rate": (("bpm",), {"bpm": (25, 220)}),
    "temperature": (("degF", "degC"), {"degF": (90, 110), "degC": (32, 43)}),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: datetime) -> datetime:
    """Aware UTC. Naive values (SQLite, or a client that omitted the offset) are IST for input, UTC from the DB."""
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _input_utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=IST).astimezone(timezone.utc)


def own_senior(db: Session, user: User) -> Senior:
    senior = db.scalar(select(Senior).where(Senior.user_id == user.id))
    if senior is None:
        raise NotFound("No senior profile is linked to this account")
    return senior


# ---- home --------------------------------------------------------------------------------------
def greeting_name(db: Session, senior: Senior) -> str | None:
    contact = db.get(SeniorContact, senior.senior_id)
    parts = (contact.full_name or "").split() if contact else []
    if not parts:
        return None
    first = parts[0]
    return first if senior.preferred_language == "english" else f"{first} ji"


def _dose_times(schedule: MedicationSchedule, day: date) -> list[datetime]:
    out = []
    for raw in schedule.scheduled_times or []:
        try:
            hh, mm = (int(x) for x in str(raw).split(":")[:2])
            out.append(datetime(day.year, day.month, day.day, hh, mm, tzinfo=IST))
        except (ValueError, TypeError):
            continue
    return out


def _active_schedules(db: Session, senior_id: str, day: date) -> list[MedicationSchedule]:
    return list(db.scalars(select(MedicationSchedule).where(
        MedicationSchedule.senior_id == senior_id, MedicationSchedule.is_active.is_(True),
        MedicationSchedule.is_sos.is_(False), MedicationSchedule.start_date <= day,
        (MedicationSchedule.end_date.is_(None)) | (MedicationSchedule.end_date >= day))
        .order_by(MedicationSchedule.medication_id)))


def medications_today(db: Session, senior: Senior, day: date) -> list[MedicationToday]:
    schedules = _active_schedules(db, senior.senior_id, day)
    start = datetime(day.year, day.month, day.day, tzinfo=IST).astimezone(timezone.utc)
    events = db.scalars(select(MedicationEvent).where(
        MedicationEvent.senior_id == senior.senior_id, MedicationEvent.scheduled_at >= start,
        MedicationEvent.scheduled_at < start + timedelta(days=1)))
    status_by_key: dict[tuple[str, datetime], str] = {}
    for ev in events:
        key = (ev.medication_id, _utc(ev.scheduled_at))
        mapped = "taken" if ev.status in _TAKEN else ev.status if ev.status in ("missed", "unknown") else None
        if mapped and status_by_key.get(key) != "taken":
            status_by_key[key] = mapped
    now = _now()
    items = []
    for sched in schedules:
        for at in _dose_times(sched, day):
            status = status_by_key.get((sched.medication_id, at.astimezone(timezone.utc)))
            if status is None:
                status = "pending" if now < at + PENDING_GRACE else "unknown"
            items.append(MedicationToday(medication_id=sched.medication_id, drug_name=sched.drug_name,
                                         dosage=sched.dosage, scheduled_at=at, status=status))
    return sorted(items, key=lambda m: (m.scheduled_at, m.medication_id))


def next_checkin(senior: Senior, day: date) -> NextCheckin | None:
    days = {_WEEKDAYS[str(d)[:3].lower()] for d in (senior.checkin_days_of_week or []) if str(d)[:3].lower() in _WEEKDAYS}
    hour = senior.checkin_preferred_hour
    if not days or hour is None:
        return None
    now_ist = _now().astimezone(IST)
    ref = now_ist if day == now_ist.date() else datetime(day.year, day.month, day.day, tzinfo=IST)
    for offset in range(0, 8):
        d = ref.date() + timedelta(days=offset)
        at = datetime(d.year, d.month, d.day, hour, tzinfo=IST)
        if d.weekday() in days and at >= ref:
            return NextCheckin(at=at)
    return None


def home(db: Session, user: User, day: date | None) -> HomeOut:
    senior = own_senior(db, user)
    day = day or today()
    last = message_repo.last_message_from_others(db, senior.senior_id, senior.user_id)
    last_out = None
    if last is not None:
        users = message_repo.users_by_id(db, {last.sender_user_id})
        last_out = message_service.to_out(last, users, user)
    return HomeOut(greeting_name=greeting_name(db, senior), language=senior.preferred_language, date=day,
                   medications_today=medications_today(db, senior, day), last_message=last_out,
                   next_checkin=next_checkin(senior, day))


# ---- confirming a dose -------------------------------------------------------------------------
def confirm_medication(db: Session, user: User, medication_id: str, scheduled_at: datetime) -> ConfirmOut:
    senior = own_senior(db, user)
    schedule = db.get(MedicationSchedule, medication_id)
    if schedule is None or schedule.senior_id != senior.senior_id:
        raise NotFound("Medication not found")
    when = _input_utc(scheduled_at).replace(second=0, microsecond=0)
    local = when.astimezone(IST)
    valid = (schedule.is_active and not schedule.is_sos and schedule.start_date <= local.date()
             and (schedule.end_date is None or schedule.end_date >= local.date())
             and when in {t.astimezone(timezone.utc) for t in _dose_times(schedule, local.date())})
    if not valid:
        raise AppError("scheduled_at is not a scheduled dose time for this medicine", code="validation_error",
                       status_code=422)
    existing = db.scalar(select(MedicationEvent).where(
        MedicationEvent.medication_id == medication_id, MedicationEvent.scheduled_at == when))
    if existing is not None and existing.status in _TAKEN:
        return ConfirmOut(actual_at=_utc(existing.actual_at or existing.scheduled_at))  # idempotent
    now = _now()
    if existing is None:
        existing = MedicationEvent(medication_event_id=f"ME_APP_{uuid.uuid4().hex[:16].upper()}",
                                   senior_id=senior.senior_id, medication_id=medication_id, scheduled_at=when)
        db.add(existing)
    existing.status, existing.actual_at = "taken", now
    existing.record_source, existing.verification_status = "senior_app_confirmation", "self_reported"
    db.commit()
    return ConfirmOut(actual_at=now)


# ---- vitals and reports ------------------------------------------------------------------------
def add_vital(db: Session, user: User, body: VitalIn) -> VitalOut:
    senior = own_senior(db, user)
    units, ranges = VITAL_RULES[body.measurement_type]
    unit = body.unit or units[0]
    if unit not in units:
        raise AppError(f"unit must be one of {', '.join(units)}", code="validation_error", status_code=422)
    low, high = ranges[unit]
    if not low <= body.value <= high:
        raise AppError(f"value is outside the plausible range ({low}-{high} {unit}); please measure again",
                       code="validation_error", status_code=422)
    measured_at = _input_utc(body.measured_at) if body.measured_at else _now()
    if measured_at > _now() + timedelta(minutes=10):
        raise AppError("measured_at cannot be in the future", code="validation_error", status_code=422)
    vital = Vital(measurement_id=f"VM_APP_{uuid.uuid4().hex[:16].upper()}", senior_id=senior.senior_id,
                  measured_at=measured_at, measurement_type=body.measurement_type, value=body.value, unit=unit,
                  context="self_reported", source="senior_app", quality_status="valid")
    db.add(vital)
    db.commit()
    vitals_service.safe_rescore(db, senior.senior_id, measured_at.astimezone(IST).date())
    return VitalOut(measurement_id=vital.measurement_id, measured_at=_utc(vital.measured_at),
                    measurement_type=vital.measurement_type, value=float(vital.value), unit=unit,
                    source=vital.source, quality_status=vital.quality_status)


def report(db: Session, user: User, text: str, language: str | None) -> ReportOut:
    senior = own_senior(db, user)
    checkin_id, urgent = message_service.record_checkin(
        db, senior, text, channel="app_checkin", language=language or senior.preferred_language)
    db.commit()
    message_service.safe_rescore(db, senior.senior_id, reason="new_alert" if urgent else "report")
    return ReportOut(checkin_id=checkin_id)  # never any interpretation of what the senior wrote
