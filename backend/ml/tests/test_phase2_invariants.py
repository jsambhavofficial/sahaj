"""Tests for Phase 2 architectural invariants, leakage absence, and missingness semantics."""

import pytest
import pandas as pd
import numpy as np
from src.config_loader import load_config
from src.evaluation.evaluate_risk_engine import EpisodeEvaluator


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_no_target_leakage_in_daily_risk_features(config):
    features_df = pd.read_csv(config.processed_data_dir / "daily_risk_features.csv")
    forbidden_leakage = [
        "planted", "severity_category", "expected_escalation",
        "scenario_id", "scenario_description", "episode_type"
    ]
    for col in forbidden_leakage:
        assert col not in features_df.columns, f"TARGET LEAKAGE: Ground-truth column {col} in daily_risk_features.csv!"


def test_no_future_leakage(config):
    """Verifies that early observation days do not use future dates for rolling metrics."""
    features_df = pd.read_csv(config.processed_data_dir / "daily_risk_features.csv")
    day_0_records = features_df[features_df["date"] == config.observation_start_date]

    for _, r in day_0_records.iterrows():
        # On day 0, rolling 3-day and rolling 7-day values must equal day 0 itself (not future days)
        if pd.notna(r["bp_systolic_latest"]) and pd.notna(r["bp_systolic_rolling_3d"]):
            assert r["bp_systolic_latest"] == r["bp_systolic_rolling_3d"]


def test_missing_measurements_not_treated_as_normal():
    from src.risk_engine.scoring import RiskScoringEngine
    # A day with missing vitals and missing activity
    row = {
        "senior_id": "S0001",
        "date": "2026-02-01",
        "bp_systolic_latest": np.nan,
        "steps_latest": np.nan,
        "checkin_missing_3d": 2,
        "unknown_doses_3d": 1,
        "data_confidence": "LOW",
        "baseline_confidence": "HIGH",
    }
    res = RiskScoringEngine.score_row(row)
    assert res.confidence_level == "LOW"
    assert len(res.data_quality_flags) >= 2


def test_unknown_medication_not_treated_as_missed():
    from src.risk_engine.rules import RiskRulesRegistry
    row = {
        "senior_id": "S0001",
        "date": "2026-02-01",
        "missed_doses_3d": 0,
        "unknown_doses_3d": 2,  # unknown status
        "consecutive_miss_flag": False,
    }
    evals = RiskRulesRegistry.evaluate_all(row)
    med_rule = [e for e in evals if e.rule_id == "RULE_MEDICATION_MISSED_DOSES"][0]
    assert med_rule.triggered is False, "Unknown doses were incorrectly treated as confirmed missed doses!"


def test_evaluator_handles_zero_alerts_safely():
    ep_df = pd.DataFrame([{
        "episode_id": "EP_0001",
        "senior_id": "S0001",
        "episode_type": "gradual_decline",
        "onset_date": "2026-02-01",
        "end_date": "2026-02-28",
        "severity_category": "moderate",
        "planted": True,
        "scenario_id": "SCEN_GRADUAL_MOBILITY",
        "expected_escalation": "urgent_family_notification",
        "scenario_description": "Gradual decline test",
    }])
    empty_alerts = pd.DataFrame(columns=["alert_id", "senior_id", "created_at", "severity"])
    dummy_scores = pd.DataFrame([{"senior_id": "S0001", "date": "2026-02-01", "risk_score": 10}])

    evaluator = EpisodeEvaluator(ep_df, empty_alerts, dummy_scores)
    results = evaluator.evaluate_all()
    assert results["summary_metrics"]["episode_level_recall"] == 0.0
    assert results["summary_metrics"]["total_alerts_generated"] == 0
    assert results["summary_metrics"]["alert_precision"] == 0.0

