"""FastAPI Router for Multimodal Risk Calculation API."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import today as demo_today
from app.core.database import get_db
from app.core.deps import require_role
from app.jobs import nightly_scoring
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.risk.schemas import RiskCalculationRequest, RiskCalculationResponse
from app.modules.risk.service import RiskScoringService

router = APIRouter(prefix="/risk", tags=["Multimodal Risk Calculation"])


def get_risk_service() -> RiskScoringService:
    return RiskScoringService()


@router.post(
    "/calculate-score",
    response_model=RiskCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute Multimodal Daily Risk Score",
    description=(
        "Fuses forecasted vitals, slopes, momentum, physical cues, psychological distress, "
        "medicine adherence, and operational assistance needs into a single calibrated 0-100 score."
    ),
)
def calculate_risk_score(
    request: RiskCalculationRequest,
    service: RiskScoringService = Depends(get_risk_service),
) -> RiskCalculationResponse:
    try:
        return service.calculate_score(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate multimodal risk score: {str(exc)}",
        )


@router.post(
    "/run-pipeline",
    status_code=status.HTTP_200_OK,
    summary="Run Risk Calculation Pipeline for All Seniors",
    description=(
        "Runs the nightly risk calculation pipeline across all active seniors, "
        "updating daily_risk_scores, alerts, and coordinator priority lists."
    ),
)
def run_risk_pipeline(
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    target_date = on_date or demo_today()
    summary = nightly_scoring.run(db, target_date, build_lists=True)
    audit(db, user, "run_risk_pipeline", None, {"date": target_date.isoformat()})
    db.commit()
    return {"status": "ok", **summary}
