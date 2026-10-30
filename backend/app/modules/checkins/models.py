import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, created_at_col, one_of, uuid_pk


class Checkin(Base):
    """A check-in from any source: coordinator notes, app check-ins, AI calls, recorded phone calls."""

    __tablename__ = "checkins"
    __table_args__ = (
        one_of("channel", ("phone_call", "coordinator_visit", "whatsapp_voice", "app_checkin",
                           "voice_agent", "phone_bridge", "voice_note", "one_tap", "missed_call")),
        one_of("source_role", ("care_coordinator", "senior_citizen", "voice_agent", "coordinator")),
        Index("ix_checkins_senior_time", "senior_id", "at"),
    )

    checkin_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    at: Mapped[datetime] = mapped_column(TZ)
    channel: Mapped[str] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    note_text: Mapped[str | None] = mapped_column(Text)
    transcription_status: Mapped[str | None] = mapped_column(Text)
    consent_status: Mapped[str | None] = mapped_column(Text)
    source_role: Mapped[str | None] = mapped_column(Text)
    call_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("calls.id"), index=True)


class NlpCue(Base):
    """Cue extracted by the live NLP extractor from a check-in, call or message."""

    __tablename__ = "nlp_cues"
    __table_args__ = (
        one_of("source_type", ("checkin", "call", "message")),
        Index("ix_nlp_cues_source", "source_type", "source_id"),
        Index("ix_nlp_cues_senior_cue", "senior_id", "cue_type"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    source_type: Mapped[str] = mapped_column(Text)
    source_id: Mapped[str] = mapped_column(Text)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    cue_type: Mapped[str] = mapped_column(Text)
    cue_value: Mapped[str] = mapped_column(Text)
    temporal_context: Mapped[str | None] = mapped_column(Text)
    negated: Mapped[bool] = mapped_column(Boolean, default=False)
    uncertain: Mapped[bool] = mapped_column(Boolean, default=False)
    severity: Mapped[str | None] = mapped_column(Text)
    cue_origin: Mapped[str | None] = mapped_column(Text)  # asked / volunteered
    confidence: Mapped[float | None] = mapped_column(Numeric)
    extractor_version: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
