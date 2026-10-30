from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.vitals import service
from app.modules.vitals.schemas import ActivityOut, VitalOut

router = APIRouter(prefix="/seniors/{senior_id}", tags=["vitals"])

MeasurementType = Literal["blood_pressure_systolic", "blood_pressure_diastolic", "heart_rate",
                          "spo2", "blood_glucose", "weight", "temperature"]


@router.get("/vitals", response_model=list[VitalOut], summary="Vitals readings, oldest first")
def senior_vitals(senior_id: str, type: MeasurementType | None = None,
                  date_from: date | None = Query(None, alias="from"),
                  date_to: date | None = Query(None, alias="to"),
                  limit: int = Query(500, ge=1, le=2000, description="Newest N readings in range"),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.vitals(db, user, senior_id, type, date_from, date_to, limit)


@router.get("/activity", response_model=list[ActivityOut], summary="Daily activity, oldest first")
def senior_activity(senior_id: str, date_from: date | None = Query(None, alias="from"),
                    date_to: date | None = Query(None, alias="to"),
                    limit: int = Query(90, ge=1, le=366),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.activity(db, user, senior_id, date_from, date_to, limit)
