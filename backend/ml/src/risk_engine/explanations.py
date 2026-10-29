"""Explainability and rationale generation module for SamarthCare AI early-warning engine."""

from typing import Dict, List, Any
import json
from src.risk_engine.scoring import ScoringResult


class ExplanationFormatter:
    """Formats clinical risk scores into transparent, coordinator-friendly narratives."""

    @staticmethod
    def format_text_summary(res: ScoringResult) -> str:
        lines = [
            f"=== Risk Assessment Summary for Senior {res.senior_id} on {res.date} ===",
            f"Risk Score:        {res.risk_score} / 100",
            f"Risk Level:        {res.risk_level}",
            f"Model Confidence:  {res.confidence_level}",
            f"Baseline Quality:  {res.baseline_confidence}",
            "",
            "Top Contributing Clinical Factors:",
        ]

        if not res.top_contributing_factors:
            lines.append("  - No acute or sustained deterioration detected; signals align with baseline.")
        else:
            for idx, factor in enumerate(res.top_contributing_factors, 1):
                rule_name = factor.get("rule_id", "RULE")
                ev = factor.get("evidence", "Signal abnormality")
                win = factor.get("window", "Recent")
                pts = factor.get("points_contributed", 0)
                tripwire_note = " [CRITICAL SAFETY TRIPWIRE]" if factor.get("is_safety_tripwire") else ""
                lines.append(f"  {idx}. {ev}{tripwire_note} (Timeframe: {win}, Rule: {rule_name})")

        lines.extend([
            "",
            "Recommended Coordinator Action:",
            f"  {res.recommended_action}",
            "",
            "Data Quality & Telemetry Notes:",
        ])

        if not res.data_quality_flags:
            lines.append("  - Complete daily telemetry recorded across vitals, activity, and communication.")
        else:
            for flag in res.data_quality_flags:
                lines.append(f"  - {flag}")

        return "\n".join(lines)

    @staticmethod
    def format_dict(res: ScoringResult) -> Dict[str, Any]:
        return {
            "senior_id": res.senior_id,
            "date": res.date,
            "risk_score": res.risk_score,
            "risk_level": res.risk_level,
            "confidence_level": res.confidence_level,
            "baseline_confidence": res.baseline_confidence,
            "contributing_factors": res.top_contributing_factors,
            "recommended_action": res.recommended_action,
            "data_quality_flags": res.data_quality_flags,
            "scoring_version": res.scoring_version,
        }

