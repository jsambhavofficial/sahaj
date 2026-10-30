"""SQLAlchemy queries for the voice agent. No business rules here."""

import uuid
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.checkins.models import Checkin, NlpCue
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors.models import Senior, SeniorContact, SeniorHealthProfile
from app.modules.vitals.models import Vital
from app.modules.voice.models import Call, CallTurn, ContextRepo, SeniorMemoryItem


def get_senior_by_user(db: Session, user_id: uuid.UUID) -> Senior | None:
    return db.scalar(select(Senior).where(Senior.user_id == user_id, Senior.is_active.is_(True)))


def get_contact_name(db: Session, senior_id: str) -> str | None:
    contact = db.get(SeniorContact, senior_id)
    return contact.full_name if contact else None


def get_profile(db: Session, senior_id: str) -> SeniorHealthProfile | None:
    return db.get(SeniorHealthProfile, senior_id)


def last_summary(db: Session, senior_id: str, exclude_call_id: uuid.UUID | None = None) -> str | None:
    q = select(Call.summary).where(Call.senior_id == senior_id, Call.kind == "ai_agent",
                                   Call.status == "completed", Call.summary.is_not(None))
    if exclude_call_id:
        q = q.where(Call.id != exclude_call_id)
    return db.scalar(q.order_by(Call.started_at.desc()).limit(1))


def last_context_summary(db: Session, senior_id: str) -> str | None:
    """Latest NLP summary written to context_repo for this senior."""
    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
        return db.scalar(
            select(ContextRepo.summary)
            .where(ContextRepo.senior_id == senior_id, ContextRepo.summary.is_not(None))
            .order_by(ContextRepo.timestamp.desc())
            .limit(1)
        )
    except Exception:
        return None


def open_context_talking_points(db: Session, senior_id: str, limit: int = 10) -> list[dict]:
    """Open talking points from context_repo for dynamic check-in bot script generation."""
    try:
        from ml.src.nlp.call_processing import load_open_talking_points_from_context_repo
    except ImportError:
        from src.nlp.call_processing import load_open_talking_points_from_context_repo

    try:
        return load_open_talking_points_from_context_repo(db, senior_id)[:limit]
    except Exception:
        return []


def open_memory_items(db: Session, senior_id: str, limit: int = 10) -> list[SeniorMemoryItem]:
    return list(db.scalars(select(SeniorMemoryItem)
                           .where(SeniorMemoryItem.senior_id == senior_id, SeniorMemoryItem.status == "open")
                           .order_by(SeniorMemoryItem.last_seen_at.desc()).limit(limit)))


def latest_risk_factors(db: Session, senior_id: str, day: date) -> list:
    row = db.scalar(select(DailyRiskScore).where(DailyRiskScore.senior_id == senior_id, DailyRiskScore.date <= day)
                    .order_by(DailyRiskScore.date.desc()).limit(1))
    return list(row.top_factors or []) if row else []


def missed_medicine_names(db: Session, senior_id: str, day: date) -> list[str]:
    start = datetime.combine(day, time.min).astimezone()
    end = start + timedelta(days=1)
    rows = db.execute(select(MedicationSchedule.drug_name)
                      .join(MedicationEvent, MedicationEvent.medication_id == MedicationSchedule.medication_id)
                      .where(MedicationEvent.senior_id == senior_id, MedicationEvent.status == "missed",
                             MedicationEvent.scheduled_at >= start, MedicationEvent.scheduled_at < end)
                      .distinct()).all()
    return [r[0] for r in rows]


def recent_vitals(db: Session, senior_id: str, day: date, days: int = 7) -> list[Vital]:
    """Latest valid reading of each measurement type in the last `days` days."""
    end = datetime.combine(day + timedelta(days=1), time.min).astimezone()
    start = end - timedelta(days=days + 1)
    rows = db.scalars(select(Vital).where(Vital.senior_id == senior_id, Vital.quality_status == "valid",
                                          Vital.measured_at >= start, Vital.measured_at < end)
                      .order_by(Vital.measured_at.desc()))
    latest: dict[str, Vital] = {}
    for v in rows:
        latest.setdefault(v.measurement_type, v)
    return list(latest.values())


def add_call(db: Session, **fields) -> Call:
    call = Call(id=uuid.uuid4(), **fields)
    db.add(call)
    db.flush()
    return call


def add_turn(db: Session, call_id: uuid.UUID, index: int, speaker: str, text: str, *, language: str | None,
             offset_ms: int, at: datetime, confidence: float | None = None, cues: dict | None = None) -> CallTurn:
    turn = CallTurn(call_id=call_id, turn_index=index, speaker=speaker, text=text, language=language,
                    stt_confidence=confidence, cues=cues, offset_ms=offset_ms, at=at)
    db.add(turn)
    return turn


def add_nlp_cues(db: Session, call_id: uuid.UUID, senior_id: str, cues: list[dict], version: str) -> None:
    for c in cues:
        db.add(NlpCue(source_type="call", source_id=str(call_id), senior_id=senior_id, cue_origin="asked",
                      extractor_version=version, **c))


def add_checkin(db: Session, call: Call, note_text: str, at: datetime) -> None:
    db.add(Checkin(checkin_id=f"VA_{uuid.uuid4().hex[:12]}", senior_id=call.senior_id, at=at,
                   channel="voice_agent", language=call.language, note_text=note_text,
                   transcription_status="done", source_role="voice_agent", call_id=call.id))


def find_memory_item(db: Session, senior_id: str, kind: str, content: str) -> SeniorMemoryItem | None:
    return db.scalar(select(SeniorMemoryItem).where(
        SeniorMemoryItem.senior_id == senior_id, SeniorMemoryItem.kind == kind,
        SeniorMemoryItem.content == content, SeniorMemoryItem.status == "open"))


def add_memory_item(db: Session, **fields) -> SeniorMemoryItem:
    item = SeniorMemoryItem(id=uuid.uuid4(), **fields)
    db.add(item)
    return item
