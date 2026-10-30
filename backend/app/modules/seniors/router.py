import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import today
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.modules.auth import scope
from app.modules.auth.models import User
from app.modules.checkins.router import router as cues_router
from app.modules.medications.router import router as medications_router
from app.modules.risk import repository as risk_repo
from app.modules.risk import service as risk_service
from app.modules.seniors import service
from app.modules.seniors.schemas import (
    FamilyInteractionOut, MemoryItemOut, RiskHistoryItem, SeniorCallPage, SeniorDetail,
    LegacySeniorPage, SeniorListPage,
)
from app.modules.vitals.router import router as vitals_router

# Full paths are declared here so this router needs no prefix; the vitals, medications and
# cues routers are nested under /seniors/{senior_id}.
router = APIRouter(tags=["seniors"])
router.include_router(vitals_router)
router.include_router(medications_router)
router.include_router(cues_router)


@router.get("/coordinators/me/seniors", response_model=SeniorListPage,
            summary="Caseload: the coordinator's seniors with risk for a date")
def my_seniors(
    q: str | None = Query(None, max_length=100, description="Senior id or name contains"),
    risk_level: Literal["LOW", "MODERATE", "HIGH", "URGENT_REVIEW"] | None = None,
    sort: Literal["risk", "name", "last_contact"] = "risk",
    on_date: date | None = Query(None, alias="date", description="Risk date; default demo date"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("coordinator", "admin")),
    db: Session = Depends(get_db),
):
    items, total = service.caseload(db, user, on_date=on_date or today(), q=q, risk_level=risk_level,
                                    sort=sort, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/seniors", response_model=LegacySeniorPage,
            summary="Senior list in the older dashboard shape (scoped to the caller's role)")
def list_seniors(
    search: str | None = Query(None, max_length=100, description="Senior id or name contains"),
    risk_level: Literal["LOW", "MODERATE", "HIGH", "URGENT_REVIEW"] | None = None,
    city_id: str | None = Query(None, description="City name"),
    coordinator_id: uuid.UUID | None = None,
    on_date: date | None = Query(None, alias="date", description="Risk date; default demo date"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("coordinator", "ops", "admin")),
    db: Session = Depends(get_db),
):
    """A coordinator sees their own caseload; ops see their city or team; admin sees everyone."""
    items, total = service.legacy_list(db, user, on_date=on_date or today(), q=search, risk_level=risk_level,
                                       city=city_id, coordinator_id=coordinator_id, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/seniors/{senior_id}", response_model=SeniorDetail, summary="Senior detail")
def senior_detail(senior_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_senior_detail(db, user, senior_id)


@router.get("/seniors/{senior_id}/risk-history", response_model=list[RiskHistoryItem],
            summary="Daily risk scores, oldest first")
def risk_history(senior_id: str, date_from: date | None = Query(None, alias="from"),
                 date_to: date | None = Query(None, alias="to"),
                 limit: int = Query(90, ge=1, le=366),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.risk_history(db, user, senior_id, date_from, date_to, limit)


@router.post("/seniors/{senior_id}/calculate-risk", response_model=RiskHistoryItem,
             summary="Recalculate and persist risk score for a senior on a date")
def calculate_senior_risk(
    senior_id: str,
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin", "senior")),
    db: Session = Depends(get_db),
):
    scope.require_senior_access(db, user, senior_id)
    target_date = on_date or today()
    risk_service.rescore_and_rerank(db, senior_id, target_date, reason="manual_recalc")
    row = risk_repo.get_score(db, senior_id, target_date)
    return row


@router.get("/seniors/{senior_id}/calls", response_model=SeniorCallPage,
            summary="Calls with this senior (without turns)")
def senior_calls(senior_id: str, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                 kind: Literal["ai_agent", "phone_bridge"] | None = None,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items, total = service.calls(db, user, senior_id, limit, offset, kind)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/seniors/{senior_id}/memory", response_model=list[MemoryItemOut],
            summary="Open agent memory items")
def senior_memory(senior_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.memory(db, user, senior_id)


@router.get("/seniors/{senior_id}/family-interactions", response_model=list[FamilyInteractionOut],
            summary="Family conversations, newest first")
def senior_family_interactions(senior_id: str, limit: int = Query(50, ge=1, le=200),
                               offset: int = Query(0, ge=0),
                               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.family_interactions(db, user, senior_id, limit, offset)
