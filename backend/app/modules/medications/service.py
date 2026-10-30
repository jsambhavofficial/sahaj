from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.modules.auth import scope
from app.modules.auth.models import User
from app.modules.medications import repository
from app.modules.seniors.service import IST, audit_read


def _pct(scheduled: int, taken: int) -> float | None:
    return round(100 * taken / scheduled, 1) if scheduled else None


def medications(db: Session, user: User, senior_id: str, on_date: date, events_limit: int = 20) -> dict:
    """Schedules, adherence and recent events. Windows are the 7 / 30 calendar days ending on
    `on_date`. Adherence = taken (incl. double_dose) / scheduled doses; 'unknown' counts as not
    taken; SOS doses are excluded. Null when there were no scheduled doses."""
    scope.require_senior_access(db, user, senior_id)
    end = datetime.combine(on_date + timedelta(days=1), time.min, tzinfo=IST)
    start_7 = end - timedelta(days=7)
    start_30 = end - timedelta(days=30)
    n7, t7 = repository.adherence_counts(db, senior_id, start_7, end)
    n30, t30 = repository.adherence_counts(db, senior_id, start_30, end)
    result = {
        "schedules": repository.list_schedules(db, senior_id),
        "adherence": {
            "last_7d_pct": _pct(n7, t7),
            "last_30d_pct": _pct(n30, t30),
            "missed_critical_7d": repository.missed_critical(db, senior_id, start_7, end),
        },
        "recent_events": [
            {"medication_id": e.medication_id, "drug_name": drug, "scheduled_at": e.scheduled_at,
             "status": e.status, "actual_at": e.actual_at, "record_source": e.record_source}
            for e, drug in repository.recent_events(db, senior_id, end, events_limit)],
    }
    audit_read(db, user, "view_medications", senior_id)
    return result
