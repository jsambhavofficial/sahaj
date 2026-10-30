from datetime import date

from sqlalchemy.orm import Session

from app.modules.auth import scope
from app.modules.auth.models import User
from app.modules.seniors.service import audit_read, date_bounds
from app.modules.vitals import repository


def vitals(db: Session, user: User, senior_id: str, measurement_type: str | None,
           date_from: date | None, date_to: date | None, limit: int):
    scope.require_senior_access(db, user, senior_id)
    start, end = date_bounds(date_from, date_to)
    rows = repository.list_vitals(db, senior_id, measurement_type, start, end, limit)
    audit_read(db, user, "view_vitals", senior_id)
    return rows


def activity(db: Session, user: User, senior_id: str, date_from: date | None,
             date_to: date | None, limit: int):
    scope.require_senior_access(db, user, senior_id)
    date_bounds(date_from, date_to)  # validates the range
    rows = repository.list_activity(db, senior_id, date_from, date_to, limit)
    audit_read(db, user, "view_activity", senior_id)
    return rows
