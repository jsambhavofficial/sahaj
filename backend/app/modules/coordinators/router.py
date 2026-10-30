import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.modules.auth.models import User
from app.modules.coordinators import service
from app.modules.coordinators.schemas import TodayOut

router = APIRouter(tags=["coordinators"])


@router.get("/coordinators/me/today", response_model=TodayOut,
            summary="Who needs attention today (latest priority-list revision)")
def today(date: date | None = None, coordinator_id: uuid.UUID | None = None,
          user: User = Depends(require_role("coordinator", "admin")), db: Session = Depends(get_db)):
    """`date` defaults to the demo date. `coordinator_id` is only used (and required) by admins."""
    return service.get_today(db, user, date, coordinator_id)
