"""Risk module package."""

from app.modules.risk.router import router as risk_router
from app.modules.risk.service import RiskScoringService

__all__ = ["risk_router", "RiskScoringService"]
