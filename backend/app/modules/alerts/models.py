import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, created_at_col, one_of, uuid_pk

STATUSES = ("OPEN", "ACKNOWLEDGED", "ESCALATED", "RESOLVED")


def new_alert_id() -> str:
    return f"ALT_{uuid.uuid4().hex[:8].upper()}"


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        one_of("status", STATUSES),
        one_of("severity", ("MODERATE", "HIGH", "URGENT_REVIEW")),
        Index("ix_alerts_status_severity", "status", "severity"),
        Index("ix_alerts_senior_created", "senior_id", "created_at"),
    )

    alert_id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_alert_id)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    created_at: Mapped[datetime] = mapped_column(TZ)
    last_updated_at: Mapped[datetime] = mapped_column(TZ)
    status: Mapped[str] = mapped_column(Text, default="OPEN")
    severity: Mapped[str] = mapped_column(Text)
    triggering_signals: Mapped[list] = mapped_column(JSONType, default=list)
    recommended_next_step: Mapped[str] = mapped_column(Text)
    resolution_reason: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)


class AlertEvent(Base):
    """Status history; response times for the ops dashboard are derived from this."""

    __tablename__ = "alert_events"
    __table_args__ = (Index("ix_alert_events_alert_time", "alert_id", "at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.alert_id"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(Text)
    to_status: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = created_at_col()


class AlertFeedback(Base):
    """Coordinator marks an alert useful or not (the learning loop)."""

    __tablename__ = "alert_feedback"
    __table_args__ = (one_of("outcome", ("called", "visited", "doctor", "no_action")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.alert_id"), index=True)
    coordinator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    useful: Mapped[bool] = mapped_column(Boolean)
    outcome: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = created_at_col()
