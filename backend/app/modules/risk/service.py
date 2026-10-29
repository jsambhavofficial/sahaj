"""Service layer for Multimodal Risk Calculation."""

import logging
from pathlib import Path
import sys

from app.modules.risk.schemas import RiskCalculationRequest, RiskCalculationResponse

# Ensure backend and backend/ml are on sys.path
_backend_dir = Path(__file__).resolve().parents[3]
_ml_dir = _backend_dir / "ml"
for _p in (_backend_dir, _ml_dir):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from ml.src.risk_engine.risk_score_calculation import MultimodalRiskCalculator, RiskCalculationResult
except ImportError:
    from src.risk_engine.risk_score_calculation import MultimodalRiskCalculator, RiskCalculationResult

logger = logging.getLogger("risk_service")


class RiskScoringService:
    """Computes daily multimodal risk scores and dual-queue recommendations."""

    def __init__(self):
        self.calculator = MultimodalRiskCalculator()

    def calculate_score(self, request: RiskCalculationRequest) -> RiskCalculationResponse:
        logger.info("Computing multimodal risk score for senior_id=%s, date=%s", request.senior_id, request.date)
        
        input_data = request.model_dump()
        result: RiskCalculationResult = self.calculator.calculate(input_data)
        
        return RiskCalculationResponse(**result.to_dict())
