"""Transparent, bounded clinical risk scoring engine for SamarthCare AI."""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd

from src.risk_engine.rules import RiskRulesRegistry, RuleEvaluation


@dataclass
class ScoringResult:
    senior_id: str
    date: str
    risk_score: int
    risk_level: str
    confidence_level: str
    baseline_confidence: str
    top_contributing_factors: List[Dict[str, Any]]
    recommended_action: str
    data_quality_flags: List[str]
    scoring_version: str


class RiskScoringEngine:
    """
    Computes daily risk scores (0-100), maps to risk bands, generates
    structured explainability outputs, and enforces safety tripwires.
    """

    VERSION = "2.0.0"

    # Category saturation caps to prevent unbounded score inflation
    CATEGORY_CAPS = {
        "acute_safety": 85.0,
        "sustained_trend": 35.0,
        "baseline_deviation": 25.0,
        "medication": 30.0,
        "nlp_cues": 35.0,
        "cross_modal": 25.0,
    }

    @classmethod
    def score_row(cls, row: Dict[str, Any]) -> ScoringResult:
        senior_id = row["senior_id"]
        date_str = row["date"]

        evaluations = RiskRulesRegistry.evaluate_all(row)
        triggered_rules = [e for e in evaluations if e.triggered]

        # Check for safety tripwires
        tripwires = [e for e in triggered_rules if e.is_safety_tripwire]

        # Accumulate points by category with saturation caps
        category_points: Dict[str, float] = {}
        for rule in triggered_rules:
            cat = rule.category
            category_points[cat] = category_points.get(cat, 0.0) + rule.points

        # Apply category caps
        capped_total = 0.0
        for cat, pts in category_points.items():
            cap = cls.CATEGORY_CAPS.get(cat, 30.0)
            capped_total += min(pts, cap)

        # Recovery / wellbeing moderation
        rec_count = row.get("cue_recovery_count", 0)
        well_count = row.get("cue_no_new_concern_count", 0)
        if not tripwires and (rec_count > 0 or well_count > 1):
            capped_total = max(0.0, capped_total - 8.0)

        # Determine raw score
        if tripwires:
            # Safety tripwires enforce a baseline minimum of 75-85 points
            max_tripwire_pts = max(t.points for t in tripwires)
            final_score = int(np.clip(max(max_tripwire_pts, capped_total), 75, 100))
        else:
            final_score = int(np.clip(round(capped_total), 0, 100))

        # Map to Risk Level
        if final_score >= 75:
            risk_level = "URGENT_REVIEW"
        elif final_score >= 50:
            risk_level = "HIGH"
        elif final_score >= 25:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        # Data quality flags
        data_flags: List[str] = []
        if pd.isna(row.get("bp_systolic_latest")):
            data_flags.append("No valid blood pressure reading recorded today.")
        if pd.isna(row.get("steps_latest")):
            data_flags.append("Pedometer activity telemetry missing (device uncharged/unworn).")
        if row.get("checkin_missing_3d", 0) >= 2:
            data_flags.append("Senior has missed 2 or more scheduled check-in calls in the past 3 days.")
        if row.get("unknown_doses_3d", 0) > 0:
            data_flags.append(f"{row.get('unknown_doses_3d')} medication dose status(es) remain unverified.")

        # Confidence level
        raw_conf = row.get("data_confidence", "HIGH")
        if tripwires:
            confidence_level = "HIGH"  # Confirmed safety event
        elif raw_conf == "LOW":
            confidence_level = "LOW"
        elif raw_conf == "MEDIUM":
            confidence_level = "MEDIUM"
        else:
            confidence_level = "HIGH"

        baseline_conf = row.get("baseline_confidence", "HIGH")

        # Top contributing factors
        sorted_factors = sorted(triggered_rules, key=lambda x: x.points, reverse=True)
        top_factors = [
            {
                "rule_id": f.rule_id,
                "category": f.category,
                "evidence": f.evidence,
                "window": f.window,
                "points_contributed": round(f.points, 1),
                "is_safety_tripwire": f.is_safety_tripwire,
            }
            for f in sorted_factors[:4]
        ]

        # Recommended Action selection
        if tripwires:
            recommended_action = tripwires[0].recommended_action
        elif sorted_factors:
            recommended_action = sorted_factors[0].recommended_action
        else:
            recommended_action = "Maintain routine remote monitoring. All tracked parameters remain within habitual baseline ranges."

        return ScoringResult(
            senior_id=senior_id,
            date=date_str,
            risk_score=final_score,
            risk_level=risk_level,
            confidence_level=confidence_level,
            baseline_confidence=baseline_conf,
            top_contributing_factors=top_factors,
            recommended_action=recommended_action,
            data_quality_flags=data_flags,
            scoring_version=cls.VERSION,
        )


def score_all_features(features_df: pd.DataFrame) -> pd.DataFrame:
    """Scores an entire dataset of daily risk features."""
    results = []
    records = features_df.to_dict(orient="records")
    for r in records:
        res = RiskScoringEngine.score_row(r)
        results.append({
            "senior_id": res.senior_id,
            "date": res.date,
            "risk_score": res.risk_score,
            "risk_level": res.risk_level,
            "confidence_level": res.confidence_level,
            "baseline_confidence": res.baseline_confidence,
            "top_contributing_factors": str(res.top_contributing_factors),
            "recommended_action": res.recommended_action,
            "data_quality_flags": "; ".join(res.data_quality_flags) if res.data_quality_flags else "None",
            "scoring_version": res.scoring_version,
        })
    return pd.DataFrame(results)

