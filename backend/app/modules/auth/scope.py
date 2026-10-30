"""Who may see which senior. Used by services; routers never decide access themselves.

- admin: every senior.
- ops: seniors in the ops user's city; an ops user with no city sees all cities.
- coordinator: seniors assigned to them.
- senior: only themselves.
- family: never through the generic staff endpoints; family reads go through consent-gated
  family endpoints using `family_consent_level`.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import Forbidden, NotFound
from app.modules.auth import repository
from app.modules.auth.models import FamilyLink, User
from app.modules.seniors.models import Senior

CONSENT_ORDER = {"urgent_only": 0, "summary_and_urgent": 1, "full": 2}


def senior_filters(user: User) -> list:
    """SQL conditions limiting `select(Senior)` to the seniors this user may access."""
    if user.role == "admin":
        return []
    if user.role == "ops":
        return [Senior.city == user.city] if user.city else []
    if user.role == "coordinator":
        return [Senior.coordinator_id == user.id]
    if user.role == "senior":
        return [Senior.user_id == user.id]
    return [Senior.senior_id.is_(None)]  # family and anything else: no generic access


def accessible_senior_ids(db: Session, user: User):
    return select(Senior.senior_id).where(*senior_filters(user))


def require_senior_access(db: Session, user: User, senior_id: str) -> Senior:
    senior = repository.get_senior(db, senior_id)
    if senior is None:
        raise NotFound("Senior not found")
    if user.role == "admin":
        return senior
    if user.role == "ops" and (not user.city or senior.city == user.city):
        return senior
    if user.role == "coordinator" and senior.coordinator_id == user.id:
        return senior
    if user.role == "senior" and senior.user_id == user.id:
        return senior
    raise Forbidden("You do not have access to this senior")


def family_consent_level(db: Session, user: User, senior_id: str) -> str:
    """The consent level a family user holds for a senior; Forbidden if there is no consent."""
    link = repository.get_family_link(db, user.id, senior_id)
    if user.role != "family" or link is None or not link.consent_given:
        raise Forbidden("No family consent for this senior")
    return link.consent_level


def family_allows(level: str, needed: str) -> bool:
    """True if a consent `level` covers `needed` (urgent_only < summary_and_urgent < full)."""
    return CONSENT_ORDER[level] >= CONSENT_ORDER[needed]
