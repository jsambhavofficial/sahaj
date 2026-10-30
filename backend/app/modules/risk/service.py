"""Risk Scoring Service - wraps the Multimodal Risk Engine and DB orchestration."""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import NotFound
from app.modules.risk.schemas import RiskCalculationRequest, RiskCalculationResponse
from app.modules.seniors.models import Senior
from ml.src.risk_engine.risk_score_calculation import (
    MultimodalRiskCalculator,
    RiskCalculationResult,
    calculate_cohort_risk,
    calculate_senior_risk,
)

logger = logging.getLogger(__name__)


def score_and_alert(db: Session, senior_ids: list[str], on_date: date, commit: bool = True):
    """Run multimodal risk scoring for given seniors, persist DailyRiskScore records,
    and generate/update open Alerts.

    Also generates LLM-powered primary driver summaries and suggested actions
    for the top 5% highest-risk seniors, persisting them into context_repo."""
    from app.modules.risk import repository as repo
    from app.modules.risk.alert_explainer import explain_and_persist_top_risk_alerts

    seniors = [db.get(Senior, sid) for sid in senior_ids]
    valid_seniors = [s for s in seniors if s is not None]
    if not valid_seniors:
        return []

    # Run cohort calculation for these seniors
    summary = calculate_cohort_risk(db=db, on_date=on_date, senior_ids=[s.id for s in valid_seniors], commit=False)

    scored_results = summary.get("results", [])

    # LLM explainability + context_repo persist for top 5% seniors
    try:
        explain_and_persist_top_risk_alerts(db, scored_results, on_date, top_percentile=0.05)
    except Exception as exc:
        logger.warning("Failed to generate top 5 percent risk alert explanations: %s", exc)

    # Upsert alerts for each senior based on new risk score
    out = []
    for res in scored_results:
        sid = res["senior_id"]
        score = res["final_risk_score"]
        level = res["risk_level"]
        top_factors = res.get("top_factors", [])
        driver = top_factors[0]["description"] if top_factors else "Multimodal risk elevated"
        alert = repo.upsert_alert(
            db=db,
            senior_id=sid,
            on_date=on_date,
            risk_score=score,
            risk_level=level,
            primary_driver=driver,
        )
        out.append(alert)

    if commit:
        db.commit()
    return out


def rescore_and_rerank(db: Session, senior_id: str, on_date: date, reason: str = "post_ai_call"):
    """Re-score one senior, update their alert, and write a new priority-list revision for their
    coordinator (previous_rank set; ai_call_done forced true for this senior after an AI call).
    Returns the new PriorityList."""
    from app.modules.coordinators import service as coordinator_service  # avoids an import cycle

    senior = db.get(Senior, senior_id)
    if senior is None:
        raise NotFound("Senior not found")
    score_and_alert(db, [senior_id], on_date)
    valid_reasons = {"morning_build", "post_ai_call", "new_alert", "manual_refresh"}
    list_reason = reason if reason in valid_reasons else "new_alert"
    lists = coordinator_service.build_priority_lists(
        db, on_date, reason=list_reason, coordinator_ids=[senior.coordinator_id],
        ai_done_seniors={senior_id} if reason == "post_ai_call" else None)
    return lists[0] if lists else None


class RiskScoringService:
    """Computes daily multimodal risk scores and dual-queue recommendations."""

    def __init__(self):
        self.calculator = MultimodalRiskCalculator()

    def calculate_score(self, request: RiskCalculationRequest) -> RiskCalculationResponse:
        logger.info("Computing multimodal risk score for senior_id=%s, date=%s", request.senior_id, request.date)
        input_data = request.model_dump()
        result: RiskCalculationResult = self.calculator.calculate(input_data)
        return RiskCalculationResponse(**result.to_dict())

    def calculate_senior_from_db(self, db: Session, senior_id: str, on_date: date) -> RiskCalculationResponse:
        """Run forecast model + MultimodalRiskCalculator for 1 individual from DB and write to DB."""
        if db.get(Senior, senior_id) is None:
            raise NotFound("Senior not found")
        res = calculate_senior_risk(db=db, senior_id=senior_id, on_date=on_date, commit=False)
        rescore_and_rerank(db, senior_id, on_date, reason="manual_rescore")
        resp_dict = res.to_dict()
        try:
            from app.modules.risk.alert_explainer import get_senior_risk_detail
            detail = get_senior_risk_detail(db, senior_id, on_date)
            resp_dict["is_top_5_percent"] = detail.get("is_top_5_percent", False)
            resp_dict["primary_driver_summary"] = detail.get("primary_driver_summary")
            resp_dict["suggested_action"] = detail.get("suggested_action")
            resp_dict["action_type"] = detail.get("action_type")
        except Exception:
            pass
        return RiskCalculationResponse(**resp_dict)

    def calculate_cohort_from_db(self, db: Session, on_date: date,
                                 senior_ids: list[str] | None = None) -> dict:
        """Run forecast model + MultimodalRiskCalculator for full cohort from DB and write to DB."""
        summary = calculate_cohort_risk(db=db, on_date=on_date, senior_ids=senior_ids, commit=True)
        return {
            "date": summary["date"],
            "seniors_scored": summary["seniors_scored"],
            "levels": summary["levels"],
        }
