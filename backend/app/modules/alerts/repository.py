"""Alert queries only; rules live in service.py."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.alerts.models import Alert, AlertEvent, AlertFeedback
from app.modules.auth.models import User
from app.modules.seniors.models import Senior


def get_alert(db: Session, alert_id: str) -> Alert | None:
    return db.get(Alert, alert_id)


def list_alerts(db: Session, *, senior_conditions: list, status: str | None, severity: str | None,
                senior_id: str | None, limit: int, offset: int) -> tuple[list[Alert], int]:
    q = select(Alert).join(Senior, Senior.senior_id == Alert.senior_id).where(*senior_conditions)
    if status:
        q = q.where(Alert.status == status)
    if severity:
        q = q.where(Alert.severity == severity)
    if senior_id:
        q = q.where(Alert.senior_id == senior_id)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    q = q.order_by(Alert.last_updated_at.desc(), Alert.alert_id).limit(limit).offset(offset)
    return list(db.scalars(q)), total


def events_for(db: Session, alert_id: str) -> list[tuple[AlertEvent, str | None]]:
    """Events oldest first, with the acting user's display name (None for the system)."""
    rows = db.execute(
        select(AlertEvent, User.display_name).outerjoin(User, User.id == AlertEvent.actor_user_id)
        .where(AlertEvent.alert_id == alert_id).order_by(AlertEvent.at, AlertEvent.from_status.is_(None).desc()))
    return [(e, name) for e, name in rows]


def add_event(db: Session, alert_id: str, actor_id: uuid.UUID | None, from_status: str | None,
              to_status: str, note: str | None, at: datetime) -> AlertEvent:
    ev = AlertEvent(alert_id=alert_id, actor_user_id=actor_id, from_status=from_status,
                    to_status=to_status, note=note, at=at)
    db.add(ev)
    return ev


def unresolved_by_senior(db: Session, senior_ids: list[str]) -> dict[str, Alert]:
    out: dict[str, Alert] = {}
    if not senior_ids:
        return out
    for a in db.scalars(select(Alert).where(Alert.senior_id.in_(senior_ids), Alert.status != "RESOLVED")
                        .order_by(Alert.created_at)):
        out[a.senior_id] = a  # newest wins
    return out


def last_resolved_by_senior(db: Session, senior_ids: list[str]) -> dict[str, Alert]:
    out: dict[str, Alert] = {}
    if not senior_ids:
        return out
    for a in db.scalars(select(Alert).where(Alert.senior_id.in_(senior_ids), Alert.status == "RESOLVED")
                        .order_by(Alert.last_updated_at)):
        out[a.senior_id] = a
    return out


def get_feedback(db: Session, alert_id: str, coordinator_id: uuid.UUID) -> AlertFeedback | None:
    return db.scalar(select(AlertFeedback).where(
        AlertFeedback.alert_id == alert_id, AlertFeedback.coordinator_id == coordinator_id))


def add_feedback(db: Session, **fields) -> AlertFeedback:
    row = AlertFeedback(**fields)
    db.add(row)
    return row
