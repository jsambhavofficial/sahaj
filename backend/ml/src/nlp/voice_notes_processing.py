"""Voice note NLP processor for SamarthCare AI.

Extracts clinical and operational events from senior voice note transcripts,
computes risk deltas with saturation caps, preserves actionable talking points,
writes to `context_repo` in the database, and triggers the risk calculation model.
Supports pluggable/switchable LLM providers (Gemini, OpenAI, Groq, Anthropic, Ollama).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional

try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore

from .llm_client import BaseLLMProvider, MockFallbackProvider, get_llm_provider
from .prompts import VOICE_NOTE_SYSTEM_PROMPT

logger = logging.getLogger("voice_nlp")


def _parse_iso_timestamp(ts: Optional[str | datetime]) -> datetime:
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if isinstance(ts, str) and ts.strip():
        try:
            parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _domain_to_memory_kind(domain: str) -> str:
    d = (domain or "").upper()
    if "MEDICATION" in d:
        return "medication_issue"
    if "MOOD" in d or "PSYCH" in d:
        return "mood"
    if "ASSISTANCE" in d or "SERVICE" in d:
        return "topic"
    return "symptom"


@dataclass
class VoiceEvent:
    intent: str
    category: str  # "RISK", "ATTENTION_REQUIRED", "NEUTRAL"
    specific_issue: str
    status: str  # "present", "negated", "uncertain"
    temporality: str  # "current", "historical", "hypothetical"
    severity: str  # "LOW", "MODERATE", "HIGH", "CRITICAL"
    urgency: str  # "IMMEDIATE", "SAME_DAY", "ROUTINE"
    evidence_text: str
    confidence: float
    risk_delta: float
    recommended_action: str


@dataclass
class TalkingPoint:
    topic: str
    domain: str  # "PHYSICAL_DISCOMFORT", "MOOD_AND_WELLBEING", "MEDICATION", "ASSISTANCE_AND_SERVICE"
    status: str  # "OPEN", "RESOLVED", "MONITORING"
    priority: int  # 1 to 10
    target_signal_to_verify: str
    suggested_bot_question_hinglish: str
    suggested_bot_question_english: str


@dataclass
class VoiceNoteProcessingResult:
    senior_id: str
    timestamp: str
    summary: str
    dominant_sentiment: str
    events: List[VoiceEvent]
    talking_points: List[TalkingPoint]
    total_nlp_risk_delta: float
    requires_clinical_escalation: bool
    requires_operations_action: bool
    raw_transcript: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "senior_id": self.senior_id,
            "timestamp": self.timestamp,
            "summary": self.summary,
            "dominant_sentiment": self.dominant_sentiment,
            "events": [asdict(e) for e in self.events],
            "talking_points": [asdict(t) for t in self.talking_points],
            "total_nlp_risk_delta": self.total_nlp_risk_delta,
            "requires_clinical_escalation": self.requires_clinical_escalation,
            "requires_operations_action": self.requires_operations_action,
            "raw_transcript": self.raw_transcript,
        }


class VoiceNotesProcessor:
    """Processes senior citizen voice notes with pluggable LLM provider support and DB persistence."""

    NLP_MAX_SATURATION_CAP = 35.0

    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        provider_name: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        if provider is not None:
            self.provider = provider
        else:
            self.provider = get_llm_provider(
                provider_name=provider_name,
                api_key=api_key,
                model=model,
            )

    def process(
        self,
        senior_id: str,
        transcript: str,
        timestamp: Optional[str] = None,
    ) -> VoiceNoteProcessingResult:
        """Processes a voice note transcript and extracts events + talking points."""
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        clean_text = (transcript or "").strip()

        if not clean_text:
            return VoiceNoteProcessingResult(
                senior_id=senior_id,
                timestamp=ts,
                summary="Empty audio note received.",
                dominant_sentiment="NEUTRAL",
                events=[],
                talking_points=[],
                total_nlp_risk_delta=0.0,
                requires_clinical_escalation=False,
                requires_operations_action=False,
                raw_transcript="",
            )

        try:
            raw_json = self.provider.generate_json(
                system_prompt=VOICE_NOTE_SYSTEM_PROMPT,
                user_prompt=clean_text,
            )
            return self._parse_llm_response(senior_id, ts, clean_text, raw_json)
        except Exception as exc:
            logger.warning("Primary LLM provider failed (%s); falling back to heuristic mock.", exc)
            fallback_provider = MockFallbackProvider()
            raw_json = fallback_provider.generate_json(
                system_prompt=VOICE_NOTE_SYSTEM_PROMPT,
                user_prompt=clean_text,
            )
            return self._parse_llm_response(senior_id, ts, clean_text, raw_json)

    def process_and_save(
        self,
        db: Session,
        senior_id: str,
        transcript: str,
        timestamp: Optional[str | datetime] = None,
        source_id: Optional[str] = None,
        trigger_risk_calc: bool = True,
        commit: bool = True,
    ) -> VoiceNoteProcessingResult:
        """
        Processes a voice note transcript and writes to the database:
        1. Writes to `context_repo` (PK: `(senior_id, timestamp)`):
           - `risk_score_contribution` (`total_nlp_risk_delta`)
           - `extracted_signals` (`events`)
           - `summary` and `talking_points`
        2. Syncs open talking points into `senior_memory_items` and updates `messages.summary` if `source_id` is given.
        3. Calls the `risk_calculation` model (`rescore_and_rerank`) to update `daily_risk_scores` in the DB.
        """
        ts_dt = _parse_iso_timestamp(timestamp)
        result = self.process(
            senior_id=senior_id,
            transcript=transcript,
            timestamp=ts_dt.isoformat(),
        )
        save_voice_note_result_to_db(
            db=db,
            result=result,
            timestamp_dt=ts_dt,
            source_id=source_id,
            trigger_risk_calc=trigger_risk_calc,
            commit=commit,
        )
        return result

    def _parse_llm_response(
        self,
        senior_id: str,
        timestamp: str,
        transcript: str,
        data: Dict[str, Any],
    ) -> VoiceNoteProcessingResult:
        """Parses and bounds LLM JSON output."""
        summary = data.get("summary", "")
        dominant_sentiment = data.get("dominant_sentiment", "NEUTRAL")

        events: List[VoiceEvent] = []
        raw_delta_sum = 0.0
        has_clinical = False
        has_ops = False

        for ev in data.get("events", []):
            delta = float(ev.get("risk_delta", 0.0))
            is_present = ev.get("status") == "present"
            is_current = ev.get("temporality") == "current"

            if is_present and is_current:
                raw_delta_sum += delta

            cat = ev.get("category", "NEUTRAL")
            if cat == "RISK" and is_present and is_current:
                has_clinical = True
            elif cat == "ATTENTION_REQUIRED" and is_present:
                has_ops = True

            events.append(
                VoiceEvent(
                    intent=ev.get("intent", "ROUTINE_WELLBEING"),
                    category=cat,
                    specific_issue=ev.get("specific_issue", "general"),
                    status=ev.get("status", "present"),
                    temporality=ev.get("temporality", "current"),
                    severity=ev.get("severity", "LOW"),
                    urgency=ev.get("urgency", "ROUTINE"),
                    evidence_text=ev.get("evidence_text", ""),
                    confidence=float(ev.get("confidence", 0.9)),
                    risk_delta=delta,
                    recommended_action=ev.get("recommended_action", ""),
                )
            )

        talking_points: List[TalkingPoint] = []
        for tp in data.get("talking_points", []):
            talking_points.append(
                TalkingPoint(
                    topic=tp.get("topic", "general_checkin"),
                    domain=tp.get("domain", "PHYSICAL_DISCOMFORT"),
                    status=tp.get("status", "OPEN"),
                    priority=int(tp.get("priority", 5)),
                    target_signal_to_verify=tp.get("target_signal_to_verify", ""),
                    suggested_bot_question_hinglish=tp.get("suggested_bot_question_hinglish", ""),
                    suggested_bot_question_english=tp.get("suggested_bot_question_english", ""),
                )
            )

        # Enforce saturation cap
        capped_delta = min(max(0.0, raw_delta_sum), self.NLP_MAX_SATURATION_CAP)

        return VoiceNoteProcessingResult(
            senior_id=senior_id,
            timestamp=timestamp,
            summary=summary,
            dominant_sentiment=dominant_sentiment,
            events=events,
            talking_points=talking_points,
            total_nlp_risk_delta=capped_delta,
            requires_clinical_escalation=has_clinical or data.get("requires_clinical_escalation", False),
            requires_operations_action=has_ops or data.get("requires_operations_action", False),
            raw_transcript=transcript,
        )


def save_voice_note_result_to_db(
    db: Session,
    result: VoiceNoteProcessingResult,
    timestamp_dt: Optional[datetime] = None,
    source_id: Optional[str] = None,
    trigger_risk_calc: bool = True,
    commit: bool = True,
) -> None:
    """
    Persist `VoiceNoteProcessingResult` into `context_repo` (plus `senior_memory_items` and `messages`)
    and trigger the risk calculation model.
    """
    import uuid
    from app.core.config import today as get_today
    from app.modules.checkins.models import NlpCue
    from app.modules.messages.models import Message
    from app.modules.seniors.models import Senior
    from app.modules.voice import repository as voice_repo
    from app.modules.voice.models import ContextRepo

    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception as exc:
        logger.debug("ContextRepo table creation check skipped: %s", exc)

    ts = timestamp_dt or _parse_iso_timestamp(result.timestamp)
    # Ensure unique (senior_id, timestamp) PK if called multiple times in the same microsecond
    while db.get(ContextRepo, (result.senior_id, ts)) is not None:
        ts = ts + timedelta(microseconds=1)

    row = ContextRepo(
        senior_id=result.senior_id,
        timestamp=ts,
        source_type="voice_note",
        source_id=source_id,
        raw_transcript=result.raw_transcript,
        summary=result.summary,
        dominant_sentiment=result.dominant_sentiment,
        extracted_signals=[asdict(e) for e in result.events],
        talking_points=[asdict(t) for t in result.talking_points],
        state_transitions=[],
        risk_score_contribution=float(result.total_nlp_risk_delta),
        requires_clinical_escalation=bool(result.requires_clinical_escalation),
        requires_operations_action=bool(result.requires_operations_action),
    )
    db.add(row)

    senior_exists = db.get(Senior, result.senior_id) is not None

    # Update Message row if source_id corresponds to a Message UUID
    if source_id:
        try:
            msg_uuid = uuid.UUID(str(source_id))
            msg = db.get(Message, msg_uuid)
            if msg is not None:
                if result.summary and not msg.summary:
                    msg.summary = result.summary
                if result.requires_clinical_escalation:
                    msg.urgency_flag = True
        except (ValueError, TypeError):
            pass

    if senior_exists:
        # Persist extracted signals as NlpCue rows if linked to a source or context_repo
        cue_src_id = source_id or f"CTX_{ts.strftime('%Y%m%d%H%M%S%f')}"
        for ev in result.events:
            db.add(
                NlpCue(
                    source_type="message",
                    source_id=str(cue_src_id),
                    senior_id=result.senior_id,
                    cue_type=ev.intent.lower(),
                    cue_value=ev.status,
                    temporal_context=ev.temporality,
                    negated=(ev.status == "negated"),
                    uncertain=(ev.status == "uncertain"),
                    severity=ev.severity.lower() if ev.severity else None,
                    cue_origin="volunteered",
                    confidence=ev.confidence,
                    extractor_version="voice_notes_processor_v1",
                )
            )

        # Sync open talking points into SeniorMemoryItem for compatibility with existing views
        for tp in result.talking_points:
            if tp.status.upper() != "OPEN":
                continue
            kind = _domain_to_memory_kind(tp.domain)
            content = f"{tp.topic}: {tp.target_signal_to_verify}" if tp.target_signal_to_verify else tp.topic
            existing_mem = voice_repo.find_memory_item(db, result.senior_id, kind, content)
            if existing_mem is not None:
                existing_mem.last_seen_at = ts
            else:
                voice_repo.add_memory_item(
                    db,
                    senior_id=result.senior_id,
                    kind=kind,
                    content=content,
                    status="open",
                    first_seen_at=ts,
                    last_seen_at=ts,
                )

    if commit:
        db.commit()
    else:
        db.flush()

    if trigger_risk_calc and senior_exists:
        try:
            from app.modules.risk.service import rescore_and_rerank

            rescore_and_rerank(
                db,
                result.senior_id,
                get_today(),
                reason="new_alert" if result.requires_clinical_escalation else "manual_refresh",
            )
        except Exception:
            logger.warning("Risk calculation after voice note failed for %s", result.senior_id, exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
