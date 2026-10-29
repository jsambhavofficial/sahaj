"""Tests for risk scoring engine, bounded scale, risk bands, and safety tripwires."""

import pytest
import numpy as np
import pandas as pd
from src.risk_engine.scoring import RiskScoringEngine


@pytest.fixture
def baseline_feature_row():
    return {
        "senior_id": "S0001",
        "date": "2026-02-01",
        "bp_systolic_latest": 128.0,
        "bp_systolic_dev_baseline": 0.0,
        "bp_systolic_rolling_3d": 128.0,
        "bp_sustained_high_flag": False,
        "bp_severe_spike_flag": False,
        "bp_hypotension_flag": False,
        "spo2_latest": 97.0,
        "spo2_dev_baseline": 0.0,
        "spo2_hypoxia_flag": False,
        "steps_latest": 3500,
        "steps_rolling_3d_ratio": 1.0,
        "steps_sustained_drop_flag": False,
        "steps_acute_drop_flag": False,
        "sleep_hours_latest": 7.2,
        "sleep_dev_baseline": 0.0,
        "sleep_disrupted_flag": False,
        "appetite_sustained_drop_flag": False,
        "consecutive_miss_flag": False,
        "cue_fall_current": False,
        "cue_weakness_current": False,
        "cue_dizziness_current": False,
        "cue_pain_current": False,
        "cue_confusion_current": False,
        "family_mobility_flag": False,
        "family_routine_flag": False,
        "cue_no_new_concern_count": 1,
        "cue_recovery_count": 0,
        "data_confidence": "HIGH",
        "baseline_confidence": "HIGH",
    }


def test_score_range_and_low_band(baseline_feature_row):
    res = RiskScoringEngine.score_row(baseline_feature_row)
    assert 0 <= res.risk_score <= 100
    assert res.risk_score < 25
    assert res.risk_level == "LOW"


def test_safety_tripwire_fall_triggers_urgent_review(baseline_feature_row):
    row = dict(baseline_feature_row)
    row["cue_fall_current"] = True
    res = RiskScoringEngine.score_row(row)
    assert res.risk_score >= 75
    assert res.risk_level == "URGENT_REVIEW"
    assert any(f["is_safety_tripwire"] for f in res.top_contributing_factors)


def test_severe_hypertensive_spike_tripwire(baseline_feature_row):
    row = dict(baseline_feature_row)
    row["bp_systolic_latest"] = 185.0
    row["bp_severe_spike_flag"] = True
    res = RiskScoringEngine.score_row(row)
    assert res.risk_score >= 75
    assert res.risk_level == "URGENT_REVIEW"


def test_score_saturation_caps_prevent_unbounded_inflation(baseline_feature_row):
    # Trigger all NLP symptoms and multiple deviations
    row = dict(baseline_feature_row)
    row["cue_weakness_current"] = True
    row["cue_dizziness_current"] = True
    row["cue_pain_current"] = True
    row["cue_confusion_current"] = True
    row["sleep_disrupted_flag"] = True
    row["steps_sustained_drop_flag"] = True
    row["steps_rolling_3d_ratio"] = 0.40
    row["bp_sustained_high_flag"] = True
    row["consecutive_miss_flag"] = True

    res = RiskScoringEngine.score_row(row)
    assert 0 <= res.risk_score <= 100, f"Score {res.risk_score} went out of bounds!"


def test_reproducible_scoring(baseline_feature_row):
    res1 = RiskScoringEngine.score_row(baseline_feature_row)
    res2 = RiskScoringEngine.score_row(baseline_feature_row)
    assert res1.risk_score == res2.risk_score
    assert res1.risk_level == res2.risk_level

