from datetime import date, datetime, timezone
import logging
from pathlib import Path
import sys
from typing import List

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.auth import scope
from app.modules.auth.models import User
from app.modules.checkins import repository
from app.modules.checkins.schemas import (
    CallEventItem,
    CallProcessRequest,
    CallProcessResponse,
    CoordinatorFeedbackItem,
    StateTransitionItem,
)
from app.modules.seniors.service import audit_read, date_bounds, require_staff
from app.modules.voice.schemas import TalkingPointItem
from app.modules.voice.service import VoiceNoteService

_backend_dir = Path(__file__).resolve().parents[3]
_ml_dir = _backend_dir / "ml"
for _p in (_backend_dir, _ml_dir):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from ml.src.nlp.call_processing import CallProcessor
except ImportError:
    from src.nlp.call_processing import CallProcessor

logger = logging.getLogger("checkin_service")


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def cues(db: Session, user: User, senior_id: str, date_from: date | None, date_to: date | None,
         limit: int) -> list[dict]:
    """Cues for a senior, newest first, timed by when their source happened."""
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    start, end = date_bounds(date_from, date_to)
    rows = repository.list_cues(db, senior_id)
    times = repository.source_times(db, rows)
    out = []
    for c in rows:
        at = times.get((c.source_type, str(c.source_id)), c.created_at)
        if (start and _aware(at) < start) or (end and _aware(at) >= end):
            continue
        out.append({"cue_type": c.cue_type, "cue_value": c.cue_value,
                    "temporal_context": c.temporal_context, "negated": bool(c.negated),
                    "uncertain": bool(c.uncertain), "source_type": c.source_type, "at": at})
    out.sort(key=lambda r: _aware(r["at"]), reverse=True)
    audit_read(db, user, "view_cues", senior_id)
    return out[:limit]


class CallProcessingService:
    """Processes diarized call transcripts and reconciles the senior's talking points."""

    def __init__(self):
        settings = get_settings()
        api_key = (
            settings.llm_api_key or settings.gemini_api_key or settings.openai_api_key
            or settings.groq_api_key or settings.anthropic_api_key
        )
        provider = None if settings.llm_provider == "stub" else settings.llm_provider
        self.processor = CallProcessor(
            provider_name=provider,
            api_key=api_key,
            model=settings.llm_model or settings.gemini_model,
        )

    @staticmethod
    def _store(senior_id: str) -> List[TalkingPointItem]:
        # Shared living-context store (same one the voice module writes to).
        return VoiceNoteService._talking_points_store[senior_id]

    def process_call(self, request: CallProcessRequest) -> CallProcessResponse:
        logger.info("Processing call for senior_id=%s (%d turns)", request.senior_id, len(request.turns))

        processor = self.processor
        if request.provider or request.model:
            processor = CallProcessor(provider_name=request.provider, model=request.model)

        store = self._store(request.senior_id)
        active = [tp.model_dump() for tp in store if tp.status == "OPEN"]

        result = processor.process(
            senior_id=request.senior_id,
            turns=[t.model_dump() for t in request.turns],
            active_talking_points=active,
            call_id=request.call_id,
            timestamp=request.timestamp,
            call_duration_seconds=request.call_duration_seconds,
        )

        self._reconcile_store(store, result)

        return CallProcessResponse(
            call_id=result.call_id,
            senior_id=result.senior_id,
            timestamp=result.timestamp,
            call_duration_seconds=result.call_duration_seconds,
            summary=result.summary,
            dominant_sentiment=result.dominant_sentiment,
            state_transitions=[StateTransitionItem(**vars(t)) for t in result.state_transitions],
            new_events=[CallEventItem(**vars(e)) for e in result.new_events],
            new_talking_points=[TalkingPointItem(**vars(tp)) for tp in result.new_talking_points],
            coordinator_feedback=CoordinatorFeedbackItem(**vars(result.coordinator_feedback)),
            total_call_risk_delta=result.total_call_risk_delta,
            requires_clinical_escalation=result.requires_clinical_escalation,
            requires_operations_action=result.requires_operations_action,
            pairs_kept=result.pairs_kept,
            pairs_dropped=result.pairs_dropped,
            used_fallback=result.used_fallback,
        )

    @staticmethod
    def _reconcile_store(store: List[TalkingPointItem], result) -> None:
        """Apply state transitions to open points, then add new points (deduped by open topic)."""
        for t in result.state_transitions:
            for tp in store:
                if tp.topic == t.topic and tp.status == "OPEN":
                    if t.new_status == "RESOLVED":
                        tp.status = "RESOLVED"
                    elif t.new_status == "ESCALATED":
                        tp.priority = 10
        open_topics = {tp.topic for tp in store if tp.status == "OPEN"}
        for np_ in result.new_talking_points:
            if np_.topic not in open_topics:
                store.append(TalkingPointItem(**vars(np_)))
                open_topics.add(np_.topic)
