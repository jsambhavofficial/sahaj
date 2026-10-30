import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, one_of, uuid_pk


class Call(Base):
    """Both the AI wellbeing call and the recorded senior <-> coordinator phone call."""

    __tablename__ = "calls"
    __table_args__ = (
        one_of("kind", ("ai_agent", "phone_bridge")),
        one_of("provider", ("in_app", "exotel", "import")),
        one_of("status", ("queued", "in_progress", "completed", "abandoned", "failed",
                          "declined", "no_answer", "busy")),
        one_of("transcript_status", ("pending", "done", "failed", "not_applicable")),
        Index("ix_calls_senior_started", "senior_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    external_ref: Mapped[str | None] = mapped_column(Text, unique=True)  # dataset call id
    kind: Mapped[str] = mapped_column(Text)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    coordinator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    initiated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(Text)
    provider_call_sid: Mapped[str | None] = mapped_column(Text, unique=True)
    status: Mapped[str] = mapped_column(Text, default="queued")
    started_at: Mapped[datetime | None] = mapped_column(TZ)
    ended_at: Mapped[datetime | None] = mapped_column(TZ)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    sentiment: Mapped[str | None] = mapped_column(Text)
    urgency_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    call_insights: Mapped[dict | None] = mapped_column(JSONType)
    recording_path: Mapped[str | None] = mapped_column(Text)
    recording_expires_at: Mapped[datetime | None] = mapped_column(TZ)
    recording_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[datetime | None] = mapped_column(TZ)
    transcript_status: Mapped[str] = mapped_column(Text, default="not_applicable")
    context_snapshot: Mapped[dict | None] = mapped_column(JSONType)
    summary: Mapped[str | None] = mapped_column(Text)
    model_info: Mapped[dict] = mapped_column(JSONType, default=dict)
    processed_at: Mapped[datetime | None] = mapped_column(TZ)


class CallTurn(Base):
    __tablename__ = "call_turns"
    __table_args__ = (
        UniqueConstraint("call_id", "turn_index"),
        one_of("speaker", ("agent", "senior", "coordinator", "unknown")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("calls.id"))
    turn_index: Mapped[int] = mapped_column(Integer)
    speaker: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    stt_confidence: Mapped[float | None] = mapped_column(Numeric)
    cues: Mapped[dict | None] = mapped_column(JSONType)
    offset_ms: Mapped[int | None] = mapped_column(Integer)
    at: Mapped[datetime | None] = mapped_column(TZ)


class SeniorMemoryItem(Base):
    """What the voice agent knows from before. No names/phones; no diagnoses."""

    __tablename__ = "senior_memory_items"
    __table_args__ = (
        one_of("kind", ("symptom", "medication_issue", "mood", "promise", "topic")),
        one_of("status", ("open", "resolved")),
        Index("ix_senior_memory_senior_status", "senior_id", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    kind: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="open")
    first_seen_call_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("calls.id"), index=True)
    last_seen_call_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("calls.id"), index=True)
    first_seen_at: Mapped[datetime] = mapped_column(TZ)
    last_seen_at: Mapped[datetime] = mapped_column(TZ)
    follow_up_after: Mapped[date | None] = mapped_column(Date)
    resolved_at: Mapped[datetime | None] = mapped_column(TZ)


class ContextRepo(Base):
    """
    Unified NLP Context Repository (`context_repo`).
    Primary Key: (senior_id, timestamp).
    Every NLP processor (VoiceNotesProcessor, CallProcessor) writes its extracted signals,
    risk score contribution, summary, and talking points here.
    The check-in bot generates its dynamic conversation script from this table, and the
    MultimodalRiskCalculator reads extracted signals & risk score contributions from it.
    """

    __tablename__ = "context_repo"
    __table_args__ = (
        Index("ix_context_repo_senior_time", "senior_id", "timestamp"),
    )

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(TZ, primary_key=True)
    source_type: Mapped[str] = mapped_column(Text, default="voice_note")  # voice_note, checkin_call, coordinator_call
    source_id: Mapped[str | None] = mapped_column(Text)
    raw_transcript: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    dominant_sentiment: Mapped[str | None] = mapped_column(Text, default="NEUTRAL")
    extracted_signals: Mapped[list] = mapped_column(JSONType, default=list)
    talking_points: Mapped[list] = mapped_column(JSONType, default=list)
    state_transitions: Mapped[list] = mapped_column(JSONType, default=list)
    risk_score_contribution: Mapped[float] = mapped_column(Float, default=0.0)
    requires_clinical_escalation: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_operations_action: Mapped[bool] = mapped_column(Boolean, default=False)
