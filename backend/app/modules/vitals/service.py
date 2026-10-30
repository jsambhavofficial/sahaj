from datetime import date, datetime, timedelta, timezone
import logging
import uuid

from sqlalchemy.orm import Session

from app.core.config import today
from app.core.exceptions import AppError
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.seniors.service import audit_read, date_bounds
from app.modules.vitals import repository
from app.modules.vitals.models import Vital
from app.modules.vitals.schemas import VitalIn

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))

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
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _input_utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=IST).astimezone(timezone.utc)


def safe_rescore(db: Session, senior_id: str, on_date: date | None = None, reason: str = "vital_recorded") -> None:
    try:
        from app.modules.risk.service import rescore_and_rerank
        rescore_and_rerank(db, senior_id, on_date or today(), reason=reason)
    except Exception:
        logger.warning("Re-score after vital skipped for senior %s", senior_id, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass


def vitals(db: Session, user: User, senior_id: str, measurement_type: str | None,
           date_from: date | None, date_to: date | None, limit: int):
    scope.require_senior_access(db, user, senior_id)
    start, end = date_bounds(date_from, date_to)
    rows = repository.list_vitals(db, senior_id, measurement_type, start, end, limit)
    audit_read(db, user, "view_vitals", senior_id)
    return rows


def add_vital(db: Session, user: User, senior_id: str, body: VitalIn) -> Vital:
    scope.require_senior_access(db, user, senior_id)
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
    source = "senior_app" if user.role == "senior" else "coordinator"
    context = body.context or ("self_reported" if user.role == "senior" else "coordinator_entry")
    vital = Vital(
        measurement_id=f"VM_APP_{uuid.uuid4().hex[:16].upper()}",
        senior_id=senior_id,
        measured_at=measured_at,
        measurement_type=body.measurement_type,
        value=body.value,
        unit=unit,
        context=context,
        source=source,
        quality_status="valid",
    )
    db.add(vital)
    audit(db, user, "vitals.add", senior_id, {"measurement_type": body.measurement_type, "value": body.value})
    db.commit()
    safe_rescore(db, senior_id, measured_at.astimezone(IST).date())
    return vital


def activity(db: Session, user: User, senior_id: str, date_from: date | None,
             date_to: date | None, limit: int):
    scope.require_senior_access(db, user, senior_id)
    date_bounds(date_from, date_to)  # validates the range
    rows = repository.list_activity(db, senior_id, date_from, date_to, limit)
    audit_read(db, user, "view_activity", senior_id)
    return rows
