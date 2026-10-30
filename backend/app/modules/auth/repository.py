import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import AuditLog, FamilyLink, User
from app.modules.seniors.models import Senior, SeniorContact


def get_user(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def get_senior(db: Session, senior_id: str) -> Senior | None:
    return db.get(Senior, senior_id)


def get_senior_contact(db: Session, senior_id: str) -> SeniorContact | None:
    return db.get(SeniorContact, senior_id)


def get_family_link(db: Session, family_user_id: uuid.UUID, senior_id: str) -> FamilyLink | None:
    return db.scalar(select(FamilyLink).where(
        FamilyLink.family_user_id == family_user_id, FamilyLink.senior_id == senior_id))


def add_audit(db: Session, **fields) -> AuditLog:
    row = AuditLog(**fields)
    db.add(row)
    return row
