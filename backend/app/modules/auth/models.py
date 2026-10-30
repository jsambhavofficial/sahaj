import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, created_at_col, one_of, uuid_pk

ROLES = ("coordinator", "family", "ops", "admin", "senior")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (one_of("role", ROLES),)

    id: Mapped[uuid.UUID] = uuid_pk()
    role: Mapped[str] = mapped_column(Text)
    external_ref: Mapped[str | None] = mapped_column(Text, unique=True)
    display_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, unique=True)
    phone: Mapped[str | None] = mapped_column(Text)
    password_hash: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    team_id: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = created_at_col()


class FamilyLink(Base):
    __tablename__ = "family_links"
    __table_args__ = (
        UniqueConstraint("family_user_id", "senior_id"),
        one_of("consent_level", ("full", "summary_and_urgent", "urgent_only")),
        one_of("relationship", ("daughter", "son", "spouse", "daughter_in_law", "grandchild", "nephew_niece", "other")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    family_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), index=True)
    relationship: Mapped[str] = mapped_column(Text)
    consent_level: Mapped[str] = mapped_column(Text, default="urgent_only")
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    consent_at: Mapped[datetime | None] = mapped_column(TZ)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(Text)
    senior_id: Mapped[str | None] = mapped_column(Text, index=True)
    detail: Mapped[dict] = mapped_column(JSONType, default=dict)
    at: Mapped[datetime] = created_at_col()
