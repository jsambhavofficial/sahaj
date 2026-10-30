"""Authorisation and wiring for the voice-agent WebSocket and VoiceNoteService."""

from collections import defaultdict
from datetime import date
import logging
from pathlib import Path
import sys
from typing import Dict, List

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError, Forbidden, Unauthorized
from app.modules.auth.models import User
from app.modules.seniors.models import Senior
from app.modules.voice import repository as repo
from app.modules.voice.schemas import (
    TalkingPointItem,
    VoiceEventItem,
    VoiceNoteProcessRequest,
    VoiceNoteProcessResponse,
)
from app.modules.voice.session import VoiceSession

# Ensure backend and backend/ml are on sys.path for direct import
_backend_dir = Path(__file__).resolve().parents[3]
_ml_dir = _backend_dir / "ml"
for _p in (_backend_dir, _ml_dir):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from ml.src.nlp.call_processing import load_open_talking_points_from_context_repo
    from ml.src.nlp.voice_notes_processing import (
        VoiceNoteProcessingResult,
        VoiceNotesProcessor,
        save_voice_note_result_to_db,
    )
except ImportError:
    from src.nlp.call_processing import load_open_talking_points_from_context_repo
    from src.nlp.voice_notes_processing import (
        VoiceNoteProcessingResult,
        VoiceNotesProcessor,
        save_voice_note_result_to_db,
    )

log = logging.getLogger(__name__)


def authenticate(db: Session, token: str) -> tuple[User, Senior]:
    """The access token must belong to an active senior user that is linked to a senior record."""
    if not token:
        raise Unauthorized("Missing token")
    from app.modules.auth import service as auth_service
    user = auth_service.get_user_from_access_token(db, token)
    if user.role != "senior":
        raise Forbidden("Only a senior can use the voice agent")
    senior = repo.get_senior_by_user(db, user.id)
    if senior is None:
        raise Forbidden("No senior profile is linked to this account")
    return user, senior


def safe_rescore(db: Session, senior_id: str, day: date, reason: str) -> None:
    """Ask the risk module to re-score and re-rank. The risk module may be absent or fail; the call must not."""
    try:
        from app.modules.risk.service import rescore_and_rerank
        rescore_and_rerank(db, senior_id, day, reason=reason)
    except ImportError:
        log.warning("risk.rescore_and_rerank is not available yet (reason=%s)", reason)
    except Exception:
        log.exception("rescore_and_rerank failed (reason=%s)", reason)
        try:
            db.rollback()
        except Exception:
            pass


def new_session(db: Session, user: User, senior: Senior) -> VoiceSession:
    return VoiceSession(db, user, senior, repo.get_contact_name(db, senior.senior_id), safe_rescore)


class VoiceNoteService:
    """Service to process incoming voice note transcriptions and manage talking points."""

    _talking_points_store: Dict[str, List[TalkingPointItem]] = defaultdict(list)

    def __init__(self):
        settings = get_settings()
        api_key = (
            settings.llm_api_key or settings.gemini_api_key or settings.openai_api_key
            or settings.groq_api_key or settings.anthropic_api_key
        )
        model = settings.llm_model or settings.gemini_model
        provider = None if settings.llm_provider == "stub" else settings.llm_provider
        self.processor = VoiceNotesProcessor(
            provider_name=provider,
            api_key=api_key,
            model=model,
        )

    def process_voice_note(
        self,
        request: VoiceNoteProcessRequest,
        db: Session | None = None,
        source_id: str | None = None,
        trigger_risk_calc: bool = True,
    ) -> VoiceNoteProcessResponse:
        """Processes audio transcript, computes risk delta, writes to context_repo, and triggers risk calculation."""
        log.info("Processing voice note for senior_id=%s (len=%d chars)", request.senior_id, len(request.transcript))

        if request.provider or request.model:
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

        if db is not None:
            try:
                save_voice_note_result_to_db(
                    db=db,
                    result=result,
                    source_id=source_id,
                    trigger_risk_calc=trigger_risk_calc,
                    commit=True,
                )
            except Exception:
                log.exception("Failed to persist voice note result to context_repo for senior %s", request.senior_id)
                try:
                    db.rollback()
                except Exception:
                    pass

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

    def get_active_talking_points(self, senior_id: str, db: Session | None = None) -> List[TalkingPointItem]:
        """Fetches active talking points from context_repo (and in-memory store) for check-in bot or coordinator triage."""
        out: List[TalkingPointItem] = []
        seen_topics: set[str] = set()
        if db is not None:
            try:
                for tp in load_open_talking_points_from_context_repo(db, senior_id):
                    topic = str(tp.get("topic", ""))
                    if topic and topic not in seen_topics:
                        out.append(
                            TalkingPointItem(
                                topic=topic,
                                domain=str(tp.get("domain", "CLINICAL_FOLLOWUP")),
                                status=str(tp.get("status", "OPEN")),
                                priority=int(tp.get("priority", 5)),
                                target_signal_to_verify=str(tp.get("target_signal_to_verify", "")),
                                suggested_bot_question_hinglish=str(tp.get("suggested_bot_question_hinglish", "")),
                                suggested_bot_question_english=str(tp.get("suggested_bot_question_english", "")),
                            )
                        )
                        seen_topics.add(topic)
            except Exception:
                log.warning("Failed to load talking points from context_repo for %s", senior_id, exc_info=True)
        for tp in self._talking_points_store.get(senior_id, []):
            if tp.status == "OPEN" and tp.topic not in seen_topics:
                out.append(tp)
                seen_topics.add(tp.topic)
        return out


__all__ = ["authenticate", "new_session", "safe_rescore", "AppError", "VoiceNoteService"]
