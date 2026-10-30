"""Audit logging. `detail` must never contain names, phone numbers or other PII."""

from sqlalchemy.orm import Session

from app.modules.auth import repository
from app.modules.auth.models import User


def audit(db: Session, actor: User | None, action: str, senior_id: str | None = None,
          detail: dict | None = None) -> None:
    """Add an audit row to the session; the caller's commit persists it."""
    repository.add_audit(db, actor_user_id=actor.id if actor else None, action=action,
                         senior_id=senior_id, detail=detail or {})
