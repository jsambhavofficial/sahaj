"""Tests for missingness mechanisms, nullable semantics, and quality statuses."""

import pytest
import pandas as pd
import numpy as np
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_missing_values_presence_and_not_zero(config):
    df = pd.read_csv(config.processed_data_dir / "daily_master.csv")

    # Verify that missing numeric values are present as nulls / NaNs
    assert df["bp_systolic_mmhg"].isna().sum() > 0, "Expected missing systolic BP readings"
    assert df["blood_glucose_mg_dl"].isna().sum() > 0, "Expected missing blood glucose readings"
    assert df["weight_kg"].isna().sum() > 0, "Expected missing weight readings"
    assert df["steps"].isna().sum() > 0, "Expected missing steps readings"

    # Verify that zero is not substituted for missing vitals
    assert (df["bp_systolic_mmhg"] == 0).sum() == 0, "Found 0 substituted for BP systolic!"
    assert (df["blood_glucose_mg_dl"] == 0).sum() == 0, "Found 0 substituted for blood glucose!"
    assert (df["spo2_percent"] == 0).sum() == 0, "Found 0 substituted for SpO2!"
    assert (df["weight_kg"] == 0).sum() == 0, "Found 0 substituted for weight!"


def test_missingness_flags_consistency(config):
    df = pd.read_csv(config.processed_data_dir / "daily_master.csv")

    # Check missing_vitals_count
    v_cols = ["bp_systolic_mmhg", "blood_glucose_mg_dl", "spo2_percent", "weight_kg"]
    calculated_counts = df[v_cols].isna().sum(axis=1)
    assert (df["missing_vitals_count"] == calculated_counts).all()

    # Check missing_activity_flag
    expected_act_flag = df["steps"].isna() | df["active_minutes"].isna()
    assert (df["missing_activity_flag"] == expected_act_flag).all()

    # Check missing_checkin_flag
    assert (df["missing_checkin_flag"] == ~df["checkin_completed"]).all()


def test_quality_statuses_in_vitals(config):
    vitals = pd.read_csv(config.raw_data_dir / "vitals.csv")
    statuses = set(vitals["quality_status"].unique())
    assert "valid" in statuses
    assert "questionable" in statuses
    assert "device_artifact" in statuses


def test_medication_unknown_status_presence(config):
    events = pd.read_csv(config.raw_data_dir / "medication_events.csv")
    statuses = set(events["status"].unique())
    assert "taken" in statuses
    assert "missed" in statuses
    assert "unknown" in statuses

