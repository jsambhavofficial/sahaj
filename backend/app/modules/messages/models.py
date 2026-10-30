import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, created_at_col, one_of, uuid_pk


class Message(Base):
    """Text or voice note between a senior and their coordinator."""

    __tablename__ = "messages"
    __table_args__ = (
        one_of("kind", ("text", "voice_note")),
        Index("ix_messages_senior_time", "senior_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    sender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    external_ref: Mapped[str | None] = mapped_column(Text, unique=True)  # dataset note id
    kind: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    urgency_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    stt_confidence: Mapped[float | None] = mapped_column(Numeric)
    body: Mapped[str | None] = mapped_column(Text)
    audio_path: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    checkin_id: Mapped[str | None] = mapped_column(ForeignKey("checkins.checkin_id"), index=True)
    created_at: Mapped[datetime] = created_at_col()
    delivered_at: Mapped[datetime | None] = mapped_column(TZ)
    read_at: Mapped[datetime | None] = mapped_column(TZ)
