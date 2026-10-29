"""Test suite for Multimodal Risk Calculation Engine and API endpoint."""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
ml_dir = backend_dir / "ml"
for p in (backend_dir, ml_dir):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from ml.src.risk_engine.risk_score_calculation import MultimodalRiskCalculator
from app.modules.risk.schemas import RiskCalculationRequest
from app.modules.risk.service import RiskScoringService
from app.modules.risk.router import calculate_risk_score


def test_normal_steady_state():
    """Scenario 1: Completely stable senior within baseline limits."""
    calc = MultimodalRiskCalculator()
    res = calc.calculate({
        "senior_id": "SR_1001",
        "bp_systolic_forecast": 122.0,
        "spo2_forecast": 98.0,
        "pulse_forecast": 72.0,
        "daily_step_count_ratio": 1.05,
        "cue_routine_wellbeing_streak": 3,
    })
    print("\nScenario 1 (Normal Steady State):")
    print(f"  Score: {res.final_risk_score} | Level: {res.risk_level}")
    print(f"  Clinical Escalation: {res.requires_clinical_escalation}")
    assert res.final_risk_score == 0
    assert res.risk_level == "LOW"
    assert res.requires_clinical_escalation is False


def test_safety_tripwire_fall():
    """Scenario 2: Acute fall reported; must trigger tripwire floor >= 75."""
    calc = MultimodalRiskCalculator()
    res = calc.calculate({
        "senior_id": "SR_1002",
        "bp_systolic_forecast": 125.0,
        "spo2_forecast": 97.0,
        "cue_fall_incident": True,
    })
    print("\nScenario 2 (Safety Tripwire - Fall Incident):")
    print(f"  Score: {res.final_risk_score} | Level: {res.risk_level}")
    print(f"  Tripwire Active: {res.safety_tripwire_triggered}")
    print(f"  Clinical Action: {res.recommended_clinical_action}")
    assert res.final_risk_score >= 80
    assert res.risk_level == "URGENT_REVIEW"
    assert res.safety_tripwire_triggered is True
    assert res.requires_clinical_escalation is True


def test_cross_modal_orthostatic_synergy():
    """Scenario 3: Forecasted BP plunge + reported dizziness triggers synergy multiplier."""
    calc = MultimodalRiskCalculator()
    res = calc.calculate({
        "senior_id": "SR_1003",
        "bp_systolic_forecast": 94.0,       # Hypotension
        "bp_systolic_slope_3d": -7.5,       # Steep plunge
        "cue_dizziness_vertigo": True,      # Stated dizziness
        "med_consecutive_missed_doses": 1,
    })
    print("\nScenario 3 (Orthostatic Synergy):")
    print(f"  Score: {res.final_risk_score} | Level: {res.risk_level}")
    print(f"  Active Synergies: {[s['synergy_name'] for s in res.active_synergies]}")
    print(f"  Top Factors: {[f.factor_id for f in res.top_factors]}")
    assert len(res.active_synergies) >= 1
    assert res.active_synergies[0]["synergy_name"] == "Orthostatic Collapse Synergy"
    assert res.final_risk_score >= 50
    assert res.risk_level in ("HIGH", "URGENT_REVIEW")


def test_operational_friction_aging():
    """Scenario 4: Senior has unmet assistance ticket >48h + medicine refill needed."""
    service = RiskScoringService()
    req = RiskCalculationRequest(
        senior_id="SR_1004",
        bp_systolic_forecast=128.0,
        spo2_forecast=96.0,
        needs_transport_escort=True,
        med_refill_depleted=True,
        assistance_unresolved_aging_hours=52,
    )
    resp = calculate_risk_score(req, service=service)
    print("\nScenario 4 (Operational Friction & Meds Refill):")
    print(f"  Score: {resp.final_risk_score} | Level: {resp.risk_level}")
    print(f"  Ops Action Required: {resp.requires_operations_action}")
    print(f"  Ops Recommendation: {resp.recommended_operations_action}")
    assert resp.requires_operations_action is True
    assert "refill" in resp.recommended_operations_action.lower()


if __name__ == "__main__":
    test_normal_steady_state()
    test_safety_tripwire_fall()
    test_cross_modal_orthostatic_synergy()
    test_operational_friction_aging()
    print("\n=== ALL RISK CALCULATION TESTS PASSED 100% ===")
