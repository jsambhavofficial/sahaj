import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import today as demo_today
from app.core.database import get_db
from app.core.deps import require_role
from app.jobs import nightly_scoring
from app.modules.auth.audit import audit
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


@router.post("/coordinators/me/run-risk-pipeline",
             summary="Trigger the nightly risk calculation pipeline for all seniors")
def run_coordinator_risk_pipeline(
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    target_date = on_date or demo_today()
    summary = nightly_scoring.run(db, target_date, build_lists=True)
    audit(db, user, "run_risk_pipeline", None, {"date": target_date.isoformat()})
    db.commit()
    return {"status": "ok", **summary}
