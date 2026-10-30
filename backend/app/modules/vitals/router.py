from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.vitals import service
from app.modules.vitals.schemas import ActivityOut, MeasurementType, VitalForecastOut, VitalIn, VitalOut

router = APIRouter(prefix="/seniors/{senior_id}", tags=["vitals"])


@router.get("/vitals", response_model=list[VitalOut], summary="Vitals readings, oldest first")
def senior_vitals(senior_id: str, type: MeasurementType | None = None,
                  date_from: date | None = Query(None, alias="from"),
                  date_to: date | None = Query(None, alias="to"),
                  limit: int = Query(500, ge=1, le=2000, description="Newest N readings in range"),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.vitals(db, user, senior_id, type, date_from, date_to, limit)


@router.post("/vitals", response_model=VitalOut, status_code=201,
             summary="Record a vital reading for a senior and trigger risk calculation")
def create_senior_vital(senior_id: str, body: VitalIn,
                        user: User = Depends(require_role("coordinator", "admin", "senior")),
                        db: Session = Depends(get_db)):
    return service.add_vital(db, user, senior_id, body)


@router.post("/vitals/forecast", response_model=VitalForecastOut,
             summary="Run vitals forecast model for 1 senior (reads from DB & writes to DB)")
def forecast_senior_vitals(senior_id: str,
                           on_date: date | None = Query(None, alias="date"),
                           user: User = Depends(require_role("coordinator", "ops", "admin", "senior")),
                           db: Session = Depends(get_db)):
    return service.run_senior_forecast(db, user, senior_id, on_date)


@router.get("/vitals/forecast", response_model=list[VitalForecastOut],
            summary="Get stored vitals forecasts for a senior, oldest first")
def list_senior_forecasts(senior_id: str,
                          date_from: date | None = Query(None, alias="from"),
                          date_to: date | None = Query(None, alias="to"),
                          limit: int = Query(90, ge=1, le=366),
                          user: User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    return service.get_senior_forecasts(db, user, senior_id, date_from, date_to, limit)


@router.get("/activity", response_model=list[ActivityOut], summary="Daily activity, oldest first")
def senior_activity(senior_id: str, date_from: date | None = Query(None, alias="from"),
                    date_to: date | None = Query(None, alias="to"),
                    limit: int = Query(90, ge=1, le=366),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.activity(db, user, senior_id, date_from, date_to, limit)
