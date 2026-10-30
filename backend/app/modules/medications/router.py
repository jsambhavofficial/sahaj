from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import today
from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.medications import service
from app.modules.medications.schemas import MedicationsOut

router = APIRouter(prefix="/seniors/{senior_id}", tags=["medications"])


@router.get("/medications", response_model=MedicationsOut,
            summary="Medication schedules, adherence (7d/30d) and recent events")
def senior_medications(senior_id: str,
                       on_date: date | None = Query(None, alias="date", description="Default demo date"),
                       events_limit: int = Query(20, ge=1, le=100),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.medications(db, user, senior_id, on_date or today(), events_limit)
