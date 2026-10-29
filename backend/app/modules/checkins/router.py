"""FastAPI router for coordinator call transcript processing."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.checkins.schemas import CallProcessRequest, CallProcessResponse
from app.modules.checkins.service import CallProcessingService

router = APIRouter(prefix="/checkins", tags=["Call Transcript Processing"])


def get_call_service() -> CallProcessingService:
    return CallProcessingService()


@router.post(
    "/process-call",
    response_model=CallProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process a diarized coordinator-senior call transcript",
    description=(
        "Cleans and pairs the dialogue, extracts new Risk / Attention events from the senior's own words, "
        "reconciles open talking points (RESOLVED / PERSISTENT / ESCALATED) and returns a bounded risk delta."
    ),
)
def process_call(
    request: CallProcessRequest,
    service: CallProcessingService = Depends(get_call_service),
) -> CallProcessResponse:
    try:
        return service.process_call(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process call transcript: {exc}",
        )
