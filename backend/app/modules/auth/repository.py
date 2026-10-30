import uuid

from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.modules.auth.models import AuditLog, FamilyLink, PairingCode, User
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


def get_pairing_code(db: Session, code_hash: str) -> PairingCode | None:
    return db.scalar(select(PairingCode).where(PairingCode.code_hash == code_hash))


def add_pairing_code(db: Session, **fields) -> PairingCode:
    row = PairingCode(**fields)
    db.add(row)
    db.flush()
    return row


def expire_unused_pairing_codes(db: Session, senior_id: str, now: datetime) -> None:
    """Cancel earlier unused codes for this senior (used_at is set so they read as spent)."""
    db.execute(update(PairingCode).where(PairingCode.senior_id == senior_id, PairingCode.used_at.is_(None))
               .values(used_at=now))


def delete_old_pairing_codes(db: Session, before: datetime) -> None:
    db.execute(delete(PairingCode).where(PairingCode.expires_at < before))
