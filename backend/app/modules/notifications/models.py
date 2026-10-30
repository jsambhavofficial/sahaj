import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, created_at_col, one_of, uuid_pk

ALL_NOTIFICATION_KINDS = (
    # Senior Citizen Portal kinds
    "daily_wellbeing",
    "checkin_prompt",
    "ai_saathi",
    "caretaker_visit",
    "medication_reminder",
    "appointment_reminder",
    "care_update",
    # Care Coordinator Portal kinds
    "wellbeing_concern",
    "senior_assigned",
    "ai_concern_review",
    "missed_checkin",
    "pending_followup",
    "overdue_visit",
    "family_observation",
    "escalation",
    "followup_update",
    # Legacy / system kinds
    "alert_new",
    "alert_escalated",
    "priority_list_updated",
    "message_received",
    "call_summary_ready",
)


class DeviceToken(Base):
    __tablename__ = "device_tokens"
    __table_args__ = (one_of("platform", ("android", "ios", "web")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(Text)
    token: Mapped[str] = mapped_column(Text, unique=True)
    app_version: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
    last_seen_at: Mapped[datetime | None] = mapped_column(TZ)
    revoked_at: Mapped[datetime | None] = mapped_column(TZ)


class Notification(Base):
    """Push text must stay generic (no names or conditions): it travels through a third party."""

    __tablename__ = "notifications"
    __table_args__ = (
        one_of("kind", ALL_NOTIFICATION_KINDS),
        one_of("delivery_status", ("pending", "sent", "failed", "skipped")),
        Index("ix_notifications_user_time", "user_id", "scheduled_for"),
        Index("ix_notifications_status_time", "delivery_status", "scheduled_for"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSONType, default=dict)
    scheduled_for: Mapped[datetime] = mapped_column(TZ)
    sent_at: Mapped[datetime | None] = mapped_column(TZ)
    delivery_status: Mapped[str] = mapped_column(Text, default="pending")
    read_at: Mapped[datetime | None] = mapped_column(TZ)


class NotificationPreference(Base):
    """User-level notification category preferences and reminder timings."""

    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    preferences: Mapped[dict] = mapped_column(JSONType, default=dict)
    updated_at: Mapped[datetime] = created_at_col()
