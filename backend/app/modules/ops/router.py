import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import today
from app.core.database import get_db
from app.core.deps import require_role
from app.modules.auth.models import User
from app.modules.ops import service
from app.modules.ops.admin_router import router as admin_router
from app.modules.ops.schemas import (
    CityRow, CoordinatorDetail, CoordinatorRow, DailyReportEntry, OpsSeniorPage, OutcomeRow,
    Overview, PrecisionRow, ResponseTimeRow, VolumeRow,
)
from app.modules.seniors.schemas import SeniorDetail

router = APIRouter(tags=["ops"])
router.include_router(admin_router)  # POST /admin/jobs/{name}/run

_ops = require_role("ops", "admin")
_Q_FROM = Query(None, alias="from", description="Range start (default: 29 days before 'to')")
_Q_TO = Query(None, alias="to", description="Range end (default: today)")


@router.get("/ops/overview", response_model=Overview, summary="Headline KPIs")
def overview(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO, city: str | None = None,
             coordinator_id: uuid.UUID | None = None, user: User = Depends(_ops),
             db: Session = Depends(get_db)):
    return service.overview(db, user, date_from, date_to, city, coordinator_id)


@router.get("/ops/alerts/volume", response_model=list[VolumeRow], summary="Alerts per day/city/severity/status")
def alerts_volume(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO, city: str | None = None,
                  coordinator_id: uuid.UUID | None = None, user: User = Depends(_ops),
                  db: Session = Depends(get_db)):
    return service.alert_volume(db, user, date_from, date_to, city, coordinator_id)


@router.get("/ops/alerts/response-times", response_model=list[ResponseTimeRow],
            summary="Minutes to acknowledge and resolve, per alert")
def alerts_response_times(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO,
                          city: str | None = None, coordinator_id: uuid.UUID | None = None,
                          limit: int = Query(1000, ge=1, le=5000),
                          user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.response_times(db, user, date_from, date_to, city, coordinator_id, limit)


@router.get("/ops/alerts/outcomes", response_model=list[OutcomeRow], summary="Alert outcomes and feedback")
def alerts_outcomes(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO,
                    city: str | None = None, coordinator_id: uuid.UUID | None = None,
                    user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.outcomes(db, user, date_from, date_to, city, coordinator_id)


@router.get("/ops/alerts/precision", response_model=list[PrecisionRow],
            summary="Weekly share of alerts rated useful (0 to 1)")
def alerts_precision(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO,
                     city: str | None = None, coordinator_id: uuid.UUID | None = None,
                     user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.precision(db, user, date_from, date_to, city, coordinator_id)


@router.get("/ops/coordinators", response_model=list[CoordinatorRow], summary="Coordinator workload")
def coordinators(date_from: date | None = _Q_FROM, date_to: date | None = _Q_TO, city: str | None = None,
                 coordinator_id: uuid.UUID | None = None, user: User = Depends(_ops),
                 db: Session = Depends(get_db)):
    return service.list_coordinators(db, user, date_from, date_to, city, coordinator_id)


@router.get("/ops/coordinators/{coordinator_id}", response_model=CoordinatorDetail,
            summary="Coordinator detail with daily activity")
def coordinator_detail(coordinator_id: uuid.UUID, date_from: date | None = _Q_FROM,
                       date_to: date | None = _Q_TO, user: User = Depends(_ops),
                       db: Session = Depends(get_db)):
    return service.coordinator_detail(db, user, coordinator_id, date_from, date_to)


@router.get("/ops/seniors", response_model=OpsSeniorPage, summary="Seniors across the team")
def seniors(q: str | None = Query(None, max_length=100), city: str | None = None,
            risk_level: Literal["LOW", "MODERATE", "HIGH", "URGENT_REVIEW"] | None = None,
            coordinator_id: uuid.UUID | None = None,
            consent_level: Literal["full", "summary_and_urgent", "urgent_only"] | None = None,
            sort: Literal["risk", "name", "last_contact"] = "risk",
            on_date: date | None = Query(None, alias="date", description="Risk date; default today"),
            limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
            user: User = Depends(_ops), db: Session = Depends(get_db)):
    items, total = service.list_seniors(
        db, user, on_date=on_date or today(), q=q, risk_level=risk_level, city=city,
        coordinator_id=coordinator_id, consent_level=consent_level, sort=sort,
        limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/ops/seniors/{senior_id}", response_model=SeniorDetail, summary="Senior detail (audit-logged)")
def senior_detail(senior_id: str, user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.senior_detail(db, user, senior_id)


@router.get("/ops/cities", response_model=list[CityRow], summary="City rollups")
def cities(city: str | None = None, coordinator_id: uuid.UUID | None = None,
           on_date: date | None = Query(None, alias="date", description="Risk date; default today"),
           user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.cities(db, user, on_date or today(), city, coordinator_id)


@router.get("/ops/reports/daily", response_model=list[DailyReportEntry],
            summary="Team-wide priority lists for a date")
def daily_report(on_date: date | None = Query(None, alias="date", description="Default today"),
                 city: str | None = None, coordinator_id: uuid.UUID | None = None,
                 user: User = Depends(_ops), db: Session = Depends(get_db)):
    return service.daily_report(db, user, on_date or today(), city, coordinator_id)
