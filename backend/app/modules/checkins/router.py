from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.checkins import service
from app.modules.checkins.schemas import CueOut

router = APIRouter(prefix="/seniors/{senior_id}", tags=["checkins"])


@router.get("/cues", response_model=list[CueOut], summary="NLP cues, newest first")
def senior_cues(senior_id: str, date_from: date | None = Query(None, alias="from"),
                date_to: date | None = Query(None, alias="to"),
                limit: int = Query(200, ge=1, le=1000),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.cues(db, user, senior_id, date_from, date_to, limit)
