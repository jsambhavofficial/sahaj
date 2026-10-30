from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.checkins import service
from app.modules.checkins.schemas import CallProcessRequest, CallProcessResponse, CueOut
from app.modules.checkins.service import CallProcessingService

router = APIRouter(prefix="/seniors/{senior_id}", tags=["checkins"])
call_process_router = APIRouter(prefix="/checkins", tags=["Call Transcript Processing"])


def get_call_service() -> CallProcessingService:
    return CallProcessingService()


@router.get("/cues", response_model=list[CueOut], summary="NLP cues, newest first")
def senior_cues(senior_id: str, date_from: date | None = Query(None, alias="from"),
                date_to: date | None = Query(None, alias="to"),
                limit: int = Query(200, ge=1, le=1000),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.cues(db, user, senior_id, date_from, date_to, limit)


@call_process_router.post(
    "/process-call",
    response_model=CallProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process a diarized coordinator-senior or AI-agent call transcript",
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
