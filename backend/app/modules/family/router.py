from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.modules.auth.models import User
from app.modules.family import service
from app.modules.family.schemas import FamilySummaryOut

router = APIRouter(tags=["family"])

_WEEK = Query(None, description="Any date in the week (Monday-Sunday); default is the last complete week")


@router.get("/seniors/{senior_id}/family-summary", response_model=FamilySummaryOut,
            summary="Staff view of a senior's weekly family summary")
def staff_family_summary(senior_id: str, week: date | None = _WEEK,
                         user: User = Depends(require_role("coordinator", "ops", "admin")),
                         db: Session = Depends(get_db)):
    return service.staff_summary(db, user, senior_id, week)


@router.get("/family/me/summary", response_model=FamilySummaryOut,
            summary="Family member: weekly summary for the linked senior, filtered by consent")
def my_family_summary(week: date | None = _WEEK,
                      senior_id: str | None = Query(None, description="Needed only if several seniors are linked"),
                      user: User = Depends(require_role("family")), db: Session = Depends(get_db)):
    return service.family_summary(db, user, senior_id, week)
