"""FastAPI Router for Voice Note NLP Ingestion and Living Context."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.voice.schemas import (
    VoiceNoteProcessRequest,
    VoiceNoteProcessResponse,
    TalkingPointItem,
)
from app.modules.voice.service import VoiceNoteService

router = APIRouter(prefix="/voice", tags=["Voice Notes & NLP Ingestion"])


def get_voice_service() -> VoiceNoteService:
    return VoiceNoteService()


@router.post(
    "/process-note",
    response_model=VoiceNoteProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Senior Voice Note Transcript",
    description=(
        "Ingests senior audio transcript, extracts Risk vs Attention Required events, "
        "computes bounded risk delta, and returns dynamic talking points for future bot check-ins."
    ),
)
def process_voice_note(
    request: VoiceNoteProcessRequest,
    service: VoiceNoteService = Depends(get_voice_service),
) -> VoiceNoteProcessResponse:
    try:
        return service.process_voice_note(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process voice note transcript: {str(exc)}",
        )


@router.get(
    "/talking-points/{senior_id}",
    response_model=List[TalkingPointItem],
    status_code=status.HTTP_200_OK,
    summary="Get Active Talking Points for Senior",
    description="Returns all active, unresolved talking points for dynamic check-in bot question generation.",
)
def get_talking_points(
    senior_id: str,
    service: VoiceNoteService = Depends(get_voice_service),
) -> List[TalkingPointItem]:
    return service.get_active_talking_points(senior_id)
