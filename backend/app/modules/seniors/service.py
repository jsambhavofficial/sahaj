"""Senior read rules: who may see what, PII handling and audit logging."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, Forbidden
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.seniors import repository

IST = timezone(timedelta(hours=5, minutes=30))
STAFF_ROLES = ("coordinator", "admin", "ops")
NAME_ROLES = ("coordinator", "admin", "ops", "senior")


def date_bounds(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    """[start, end) datetimes (India time) for an inclusive from/to date range."""
    if date_from and date_to and date_from > date_to:
        raise AppError("'from' must not be after 'to'", code="validation_error", status_code=422)
    start = datetime.combine(date_from, time.min, tzinfo=IST) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=IST) if date_to else None
    return start, end


def require_staff(user: User) -> None:
    """Seniors may not read coordinator-side data (cues, memory, family, risk history)."""
    if user.role not in STAFF_ROLES:
        raise Forbidden("Your role cannot view this information")


def audit_read(db: Session, user: User, action: str, senior_id: str, **detail) -> None:
    audit(db, user, action, senior_id, detail or None)
    db.commit()


def list_senior_items(db: Session, user: User, *, on_date: date, q: str | None = None,
                      risk_level: str | None = None, city: str | None = None,
                      coordinator_id=None, consent_level: str | None = None, sort: str = "risk",
                      limit: int = 50, offset: int = 0) -> tuple[list[dict], int]:
    """Caseload rows within `user`'s scope. Not audited here; callers audit as they see fit."""
    rows, total = repository.list_seniors(
        db, scope.senior_filters(user), on_date=on_date, q=q, risk_level=risk_level, city=city,
        coordinator_id=coordinator_id, consent_level=consent_level, sort=sort,
        limit=limit, offset=offset)
    show_name = user.role in NAME_ROLES
    items = [{
        "senior_id": s.senior_id,
        "display_name": full_name if show_name else None,
        "age": s.age,
        "city": s.city,
        "preferred_language": s.preferred_language,
        "living_arrangement": s.living_arrangement,
        "coordinator_id": s.coordinator_id,
        "family_consent_level": s.family_consent_level,
        "risk_score": risk_score,
        "risk_level": level,
        "open_alert_id": open_alert_id,
        "last_contact_at": last_contact_at,
    } for s, full_name, risk_score, level, open_alert_id, last_contact_at in rows]
    return items, total


def caseload(db: Session, user: User, **kwargs) -> tuple[list[dict], int]:
    items, total = list_senior_items(db, user, **kwargs)
    audit_read(db, user, "view_caseload", None, count=len(items))
    return items, total


def legacy_list(db: Session, user: User, **kwargs) -> tuple[list[dict], int]:
    """The caseload in the flat shape the older dashboard pages expect."""
    items, total = list_senior_items(db, user, **kwargs)
    audit_read(db, user, "view_caseload", None, count=len(items))
    rows = [{
        "senior_id": i["senior_id"], "name": i["display_name"], "age": i["age"],
        "preferred_language": i["preferred_language"], "city_id": i["city"],
        "living_arrangement": i["living_arrangement"], "coordinator_id": i["coordinator_id"],
        "family_consent": bool(i["family_consent_level"]),
        "current_risk_level": i["risk_level"], "current_risk_score": i["risk_score"],
        "last_observation_date": i["last_contact_at"].date().isoformat() if i["last_contact_at"] else None,
        "active_alert_count": 1 if i["open_alert_id"] else 0,
    } for i in items]
    return rows, total


def _columns(obj, skip: tuple[str, ...] = ("senior_id",)) -> dict:
    return {c.key: getattr(obj, c.key) for c in inspect(obj).mapper.column_attrs if c.key not in skip}


def get_senior_detail(db: Session, user: User, senior_id: str) -> dict:
    """The GET /seniors/{id} body. Authorizes and audit-logs (`view_senior`)."""
    senior = scope.require_senior_access(db, user, senior_id)
    contact = repository.get_contact(db, senior_id)
    profile = repository.get_health_profile(db, senior_id)
    baseline = repository.get_baseline(db, senior_id)
    # Phone only for the senior's own coordinator and admin; scope already ensures a coordinator
    # reaching this point owns the senior.
    show_phone = user.role == "admin" or (user.role == "coordinator" and senior.coordinator_id == user.id)
    detail = {
        "senior_id": senior.senior_id,
        "display_name": contact.full_name if contact and user.role in NAME_ROLES else None,
        "age": senior.age,
        "gender": senior.gender,
        "marital_status": senior.marital_status,
        "city": senior.city,
        "living_arrangement": senior.living_arrangement,
        "preferred_language": senior.preferred_language,
        "communication_style": senior.communication_style,
        "coordinator_id": senior.coordinator_id,
        "family_consent_level": senior.family_consent_level,
        "conditions": repository.list_conditions(db, senior_id),
        "health_profile": _columns(profile) if profile else None,
        "baseline": _columns(baseline) if baseline else None,
        "contact": {"phone": contact.phone if contact else None} if show_phone else None,
    }
    audit_read(db, user, "view_senior", senior_id)
    return detail


def risk_history(db: Session, user: User, senior_id: str, date_from, date_to, limit: int):
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    date_bounds(date_from, date_to)  # validates the range
    rows = repository.list_risk_history(db, senior_id, date_from, date_to, limit)
    audit_read(db, user, "view_risk_history", senior_id)
    return rows


_INSIGHT_KEYS = ("questions_answered", "questions_total", "urgent", "end_reason", "cue_types")


def _public_insights(raw: dict | None) -> dict | None:
    """Only the report fields; the raw pipeline output and prompt context stay server side."""
    if not raw:
        return None
    return {k: raw[k] for k in _INSIGHT_KEYS if k in raw}


def calls(db: Session, user: User, senior_id: str, limit: int, offset: int, kind: str | None = None):
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    rows, total = repository.list_calls(db, senior_id, limit, offset, kind)
    items = [{
        "id": c.id, "senior_id": c.senior_id, "kind": c.kind, "status": c.status,
        "transcript_status": c.transcript_status, "started_at": c.started_at,
        "ended_at": c.ended_at, "duration_sec": c.duration_sec,
        "recording_stored": bool(c.recording_path), "recording_expires_at": c.recording_expires_at,
        "summary": c.summary, "urgency_flag": bool(c.urgency_flag),
        "language": c.language, "sentiment": c.sentiment, "insights": _public_insights(c.call_insights),
    } for c in rows]
    audit_read(db, user, "view_calls", senior_id)
    return items, total


def memory(db: Session, user: User, senior_id: str):
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    rows = repository.list_open_memory(db, senior_id)
    audit_read(db, user, "view_memory", senior_id)
    return rows


def family_interactions(db: Session, user: User, senior_id: str, limit: int, offset: int):
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    rows = repository.list_family_interactions(db, senior_id, limit, offset)
    audit_read(db, user, "view_family_interactions", senior_id)
    return rows
