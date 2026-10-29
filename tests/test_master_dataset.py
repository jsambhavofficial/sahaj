"""Tests for the consolidated master dataset: lossless reconciliation, schema, JSON integrity, and ground-truth isolation."""

import json
import pytest
import pandas as pd
from src.config_loader import load_config
from src.consolidate_master_dataset import MasterDatasetConsolidator


@pytest.fixture(scope="session")
def config():
    return load_config()


@pytest.fixture(scope="session")
def master_df(config):
    path = config.processed_data_dir / "master_dataset.csv"
    assert path.exists(), "master_dataset.csv does not exist. Run consolidation first."
    return pd.read_csv(path, encoding="utf-8")


@pytest.fixture(scope="session")
def eval_master_df(config):
    path = config.evaluation_data_dir / "master_dataset_with_ground_truth.csv"
    assert path.exists(), "master_dataset_with_ground_truth.csv does not exist."
    return pd.read_csv(path, encoding="utf-8")


def test_master_dataset_grain_and_row_count(master_df, config):
    expected_rows = config.cohort_size * config.observation_days
    assert len(master_df) == expected_rows, f"Expected {expected_rows} rows, got {len(master_df)}"
    assert master_df["senior_id"].nunique() == config.cohort_size
    assert master_df["date"].nunique() == config.observation_days


def test_unique_composite_key(master_df):
    dup_count = master_df.duplicated(subset=["senior_id", "date"]).sum()
    assert dup_count == 0, f"Found {dup_count} duplicate senior_id + date combinations in master_dataset.csv!"


def test_no_ground_truth_leakage_in_master(master_df):
    forbidden = [
        "planted", "severity_category", "expected_escalation",
        "scenario_description", "is_in_decline_episode", "ground_truth_episode_id"
    ]
    for col in forbidden:
        assert col not in master_df.columns, f"Target leakage: {col} present in production master_dataset.csv!"


def test_ground_truth_present_in_evaluation_export(eval_master_df):
    expected_gt_cols = [
        "is_in_decline_episode", "ground_truth_episode_id",
        "ground_truth_episode_type", "ground_truth_severity", "ground_truth_planted"
    ]
    for col in expected_gt_cols:
        assert col in eval_master_df.columns, f"Missing evaluation column {col} in master_dataset_with_ground_truth.csv"
    assert eval_master_df["is_in_decline_episode"].sum() > 0


def test_json_columns_parse_cleanly(master_df):
    json_cols = [
        "baseline_json", "vitals_json", "medication_json",
        "checkins_json", "activity_json", "family_observations_json",
        "top_contributing_factors_json", "data_quality_flags_json", "active_alerts_json"
    ]
    for col in json_cols:
        assert col in master_df.columns, f"Missing JSON column {col}"
        # Test 50 sample non-empty cells
        for val in master_df[col].dropna().sample(min(50, len(master_df)), random_state=42):
            parsed = json.loads(val)
            assert parsed is not None


def test_unicode_hindi_hinglish_roundtrip(master_df):
    """Verifies that Devanagari Hindi and Hinglish notes survive lossless UTF-8 serialization."""
    # Find check-in notes with Hindi characters
    has_hindi = False
    for val in master_df["checkins_json"].dropna():
        parsed = json.loads(val)
        for chk in parsed:
            note = chk.get("raw_note", "")
            # Check for Devanagari Unicode block [U+0900 to U+097F]
            if any("\u0900" <= char <= "\u097f" for char in note):
                has_hindi = True
                break
        if has_hindi:
            break
    assert has_hindi, "Hindi Devanagari text was lost or not found in checkins_json!"


def test_lossless_source_reconciliation(config):
    val_path = config.processed_data_dir / "master_dataset_validation.json"
    assert val_path.exists()
    with open(val_path, "r", encoding="utf-8") as f:
        rep = json.load(f)

    assert rep["validation_status"] == "PASSED"
    lossless = rep["lossless_reconciliation"]

    assert lossless["unmapped_vitals_count"] == 0
    assert lossless["unmapped_medication_events_count"] == 0
    assert lossless["unmapped_checkins_count"] == 0
    assert lossless["unmapped_annotations_count"] == 0
    assert lossless["unmapped_family_count"] == 0


def test_missing_values_distinguishable_from_zero(master_df):
    # Verify that steps is null for missing sensor days, not zero
    null_steps = master_df["steps"].isna().sum()
    assert null_steps > 0, "Expected missing steps records"

    # In activity_json, null steps must be represented as null, not zero
    found_null_in_json = False
    for val in master_df["activity_json"].dropna():
        act = json.loads(val)
        if act.get("data_available") is False:
            assert act.get("steps") is None
            found_null_in_json = True
            break
    assert found_null_in_json

