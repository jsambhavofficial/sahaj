import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, created_at_col, one_of, uuid_pk


class PriorityList(Base):
    """One build of a coordinator's day list; a new revision follows each AI call or new alert."""

    __tablename__ = "priority_lists"
    __table_args__ = (
        UniqueConstraint("coordinator_id", "list_date", "revision"),
        one_of("reason", ("morning_build", "post_ai_call", "new_alert", "manual_refresh")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    coordinator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    list_date: Mapped[date] = mapped_column(Date)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    reason: Mapped[str] = mapped_column(Text, default="morning_build")
    created_at: Mapped[datetime] = created_at_col()


class PriorityListItem(Base):
    __tablename__ = "priority_list_items"
    __table_args__ = (UniqueConstraint("list_id", "rank"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    list_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("priority_lists.id"), index=True)
    rank: Mapped[int] = mapped_column(Integer)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(Text)
    reasons: Mapped[list] = mapped_column(JSONType, default=list)
    suggested_action: Mapped[str | None] = mapped_column(Text)
    alert_id: Mapped[str | None] = mapped_column(ForeignKey("alerts.alert_id"), index=True)
    ai_call_done: Mapped[bool] = mapped_column(Boolean, default=False)
    previous_rank: Mapped[int | None] = mapped_column(Integer)
