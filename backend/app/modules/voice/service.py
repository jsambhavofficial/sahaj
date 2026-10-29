"""Voice Note service layer connecting API to ML NLP processor."""

from collections import defaultdict
import logging
from pathlib import Path
import sys
from typing import Dict, List, Optional

from app.core.config import get_settings
from app.modules.voice.schemas import (
    VoiceNoteProcessRequest,
    VoiceNoteProcessResponse,
    VoiceEventItem,
    TalkingPointItem,
)

# Ensure backend and backend/ml are on sys.path for direct import
_backend_dir = Path(__file__).resolve().parents[3]
_ml_dir = _backend_dir / "ml"
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))
if str(_ml_dir) not in sys.path:
    sys.path.insert(0, str(_ml_dir))

try:
    from ml.src.nlp.voice_notes_processing import VoiceNotesProcessor, VoiceNoteProcessingResult
except ImportError:
    from src.nlp.voice_notes_processing import VoiceNotesProcessor, VoiceNoteProcessingResult

logger = logging.getLogger("voice_service")


class VoiceNoteService:
    """Service to process incoming voice note transcriptions and manage talking points."""

    # In-memory store for active talking points per senior: {senior_id: [TalkingPointItem, ...]}
    _talking_points_store: Dict[str, List[TalkingPointItem]] = defaultdict(list)

    def __init__(self):
        settings = get_settings()
        api_key = settings.llm_api_key or settings.gemini_api_key or settings.openai_api_key or settings.groq_api_key or settings.anthropic_api_key
        model = settings.llm_model or settings.gemini_model
        self.processor = VoiceNotesProcessor(
            provider_name=settings.llm_provider,
            api_key=api_key,
            model=model,
        )

    def process_voice_note(self, request: VoiceNoteProcessRequest) -> VoiceNoteProcessResponse:
        """Processes audio transcript, computes risk delta, and persists talking points."""
        logger.info("Processing voice note for senior_id=%s (len=%d chars)", request.senior_id, len(request.transcript))

        # Check if caller specified a provider override
        if request.provider or request.model:
            from ml.src.nlp.voice_notes_processing import VoiceNotesProcessor
            processor = VoiceNotesProcessor(
                provider_name=request.provider,
                model=request.model,
            )
        else:
            processor = self.processor

        result: VoiceNoteProcessingResult = processor.process(
            senior_id=request.senior_id,
            transcript=request.transcript,
            timestamp=request.timestamp,
        )

        events_schema = [
            VoiceEventItem(
                intent=e.intent,
                category=e.category,
                specific_issue=e.specific_issue,
                status=e.status,
                temporality=e.temporality,
                severity=e.severity,
                urgency=e.urgency,
                evidence_text=e.evidence_text,
                confidence=e.confidence,
                risk_delta=e.risk_delta,
                recommended_action=e.recommended_action,
            )
            for e in result.events
        ]

        tp_schema = [
            TalkingPointItem(
                topic=t.topic,
                domain=t.domain,
                status=t.status,
                priority=t.priority,
                target_signal_to_verify=t.target_signal_to_verify,
                suggested_bot_question_hinglish=t.suggested_bot_question_hinglish,
                suggested_bot_question_english=t.suggested_bot_question_english,
            )
            for t in result.talking_points
        ]

        # Update in-memory living context registry for this senior
        if tp_schema:
            self._talking_points_store[request.senior_id].extend(tp_schema)

        return VoiceNoteProcessResponse(
            senior_id=result.senior_id,
            timestamp=result.timestamp,
            summary=result.summary,
            dominant_sentiment=result.dominant_sentiment,
            events=events_schema,
            talking_points=tp_schema,
            total_nlp_risk_delta=result.total_nlp_risk_delta,
            requires_clinical_escalation=result.requires_clinical_escalation,
            requires_operations_action=result.requires_operations_action,
            raw_transcript=result.raw_transcript,
        )

    def get_active_talking_points(self, senior_id: str) -> List[TalkingPointItem]:
        """Fetches active talking points for check-in bot or coordinator triage."""
        all_points = self._talking_points_store.get(senior_id, [])
        return [tp for tp in all_points if tp.status == "OPEN"]
