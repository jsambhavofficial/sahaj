import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, one_of, uuid_pk


class FamilyInteraction(Base):
    """Two-way family <-> coordinator communication (message, reply, summary, suggested action)."""

    __tablename__ = "family_interactions"
    __table_args__ = (
        one_of("consent_level", ("full", "summary_and_urgent", "urgent_only")),
        one_of("channel", ("whatsapp_message", "phone_call", "app_message")),
        Index("ix_family_interactions_senior_time", "senior_id", "at"),
    )

    interaction_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    family_id: Mapped[str | None] = mapped_column(Text)
    coordinator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    family_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    at: Mapped[datetime] = mapped_column(TZ)
    channel: Mapped[str] = mapped_column(Text)
    observer_relation: Mapped[str | None] = mapped_column(Text)
    message_language: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    primary_cue: Mapped[str | None] = mapped_column(Text)
    family_message: Mapped[str] = mapped_column(Text)
    coordinator_reply_en: Mapped[str | None] = mapped_column(Text)
    coordinator_reply_hi_roman: Mapped[str | None] = mapped_column(Text)
    counselor_summary: Mapped[str | None] = mapped_column(Text)
    suggested_action: Mapped[str | None] = mapped_column(Text)
    escalation_needed: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_level: Mapped[str] = mapped_column(Text)


class WeeklyFamilySummary(Base):
    """Only generated and sent within the senior's family consent level."""

    __tablename__ = "weekly_family_summaries"
    __table_args__ = (UniqueConstraint("senior_id", "week_start"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    week_start: Mapped[date] = mapped_column(Date)
    body_text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(Text)
    generated_by: Mapped[str] = mapped_column(Text, default="template")
    sent_at: Mapped[datetime | None] = mapped_column(TZ)
