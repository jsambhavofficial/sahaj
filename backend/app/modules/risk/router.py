"""FastAPI Router for Multimodal Risk Calculation API."""

from fastapi import APIRouter, Depends, HTTPException, status

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
