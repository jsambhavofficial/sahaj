from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.modules.auth.models import User
from app.modules.me import service
from app.modules.me.schemas import ConfirmIn, ConfirmOut, HomeOut, ReportIn, ReportOut, VitalIn, VitalOut
from app.modules.messages import service as message_service
from app.modules.messages.router import SEND_BODY_DOC, send_from_request
from app.modules.messages.schemas import MessageList, MessageOut

router = APIRouter(prefix="/me", tags=["senior app"])
senior_only = require_role("senior")


@router.get("/home", response_model=HomeOut)
def home(date: date | None = Query(None, description="YYYY-MM-DD; defaults to the demo date"),
         db: Session = Depends(get_db), user: User = Depends(senior_only)):
    return service.home(db, user, date)


@router.post("/medications/{medication_id}/confirm", response_model=ConfirmOut)
def confirm_medication(medication_id: str, body: ConfirmIn, db: Session = Depends(get_db),
                       user: User = Depends(senior_only)):
    """Marks a dose as taken. Safe to repeat for the same `scheduled_at`."""
    return service.confirm_medication(db, user, medication_id, body.scheduled_at)


@router.post("/vitals", response_model=VitalOut, status_code=201)
def add_vital(body: VitalIn, db: Session = Depends(get_db), user: User = Depends(senior_only)):
    return service.add_vital(db, user, body)


@router.post("/report", response_model=ReportOut, status_code=201)
def report(body: ReportIn, db: Session = Depends(get_db), user: User = Depends(senior_only)):
    """Free-text 'how are you feeling'. Stored as a check-in; nothing is diagnosed or returned."""
    return service.report(db, user, body.text, body.language)


@router.get("/messages", response_model=MessageList)
def my_messages(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                before: datetime | None = Query(None), db: Session = Depends(get_db),
                user: User = Depends(senior_only)):
    senior = service.own_senior(db, user)
    return message_service.list_messages(db, user, senior.senior_id, limit=limit, offset=offset, before=before)


@router.post("/messages", response_model=MessageOut, status_code=201, openapi_extra=SEND_BODY_DOC)
async def send_my_message(request: Request, db: Session = Depends(get_db), user: User = Depends(senior_only)):
    """Text (JSON) or voice note (multipart `audio`) to your coordinator."""
    senior = service.own_senior(db, user)
    return await send_from_request(request, db, user, senior.senior_id)
