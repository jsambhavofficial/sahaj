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
from app.modules.vitals import service as vitals_service

router = APIRouter(prefix="/risk", tags=["Multimodal Risk Calculation"])


def get_risk_service() -> RiskScoringService:
    return RiskScoringService()


@router.post(
    "/calculate-score",
    response_model=RiskCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute Multimodal Daily Risk Score (Direct Payload)",
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
    "/calculate-senior/{senior_id}",
    response_model=RiskCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run Full Forecast + Risk Calculation Pipeline for 1 Senior (DB-backed)",
    description=(
        "Calls the Vitals Forecast Model for 1 senior first (writing to `vital_forecasts`), "
        "combines with DB signals, calculates the Multimodal Risk Score, writes to `daily_risk_scores`, "
        "and updates alerts and priority lists."
    ),
)
def calculate_senior_risk_endpoint(
    senior_id: str,
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin", "senior")),
    service: RiskScoringService = Depends(get_risk_service),
    db: Session = Depends(get_db),
) -> RiskCalculationResponse:
    target_date = on_date or demo_today()
    resp = service.calculate_senior_from_db(db, senior_id, target_date)
    audit(db, user, "risk.calculate_senior", senior_id, {"date": target_date.isoformat()})
    db.commit()
    return resp


@router.post(
    "/calculate-cohort",
    status_code=status.HTTP_200_OK,
    summary="Run Full Forecast + Risk Calculation Pipeline for Full Cohort (DB-backed)",
    description=(
        "Calls the Vitals Forecast Model for the full cohort first (writing to `vital_forecasts`), "
        "combines with DB signals, calculates Multimodal Risk Scores for all active seniors, "
        "and writes to `daily_risk_scores`, alerts, and coordinator priority lists."
    ),
)
def calculate_cohort_risk_endpoint(
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    target_date = on_date or demo_today()
    summary = nightly_scoring.run(db, target_date, build_lists=True)
    audit(db, user, "risk.calculate_cohort", None, {"date": target_date.isoformat()})
    db.commit()
    return {"status": "ok", **summary}


@router.post(
    "/forecast-cohort",
    status_code=status.HTTP_200_OK,
    summary="Run Vitals Forecast Model for Full Cohort (reads from DB & writes to DB)",
    description=(
        "Batch-loads vitals, baselines, conditions, and profiles for all active seniors from the DB, "
        "runs the Vitals Forecast Model, and writes all forecast rows to `vital_forecasts`."
    ),
)
def forecast_cohort_vitals(
    on_date: date | None = Query(None, alias="date", description="Default: demo today"),
    user: User = Depends(require_role("coordinator", "ops", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    summary = vitals_service.run_cohort_forecast(db, user, on_date)
    return {
        "status": "ok",
        "date": summary["date"],
        "total_seniors_processed": summary["total_seniors_processed"],
        "seniors_with_vitals_forecasted": summary["seniors_with_vitals_forecasted"],
    }


@router.post(
    "/run-pipeline",
    status_code=status.HTTP_200_OK,
    summary="Run Risk Calculation Pipeline for All Seniors",
    description=(
        "Runs the nightly risk calculation pipeline across all active seniors, "
        "updating vital_forecasts, daily_risk_scores, alerts, and coordinator priority lists."
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
