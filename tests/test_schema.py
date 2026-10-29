"""Tests for schema conformity, mandatory fields, and data types across all tables."""

import pytest
import pandas as pd
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_senior_profiles_schema(config):
    df = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    required = [
        "senior_id", "age", "preferred_language", "city_id",
        "living_arrangement", "coordinator_id", "expected_checkin_frequency",
        "family_consent", "cohort_start_date", "cohort_end_date", "synthetic_profile_seed"
    ]
    for col in required:
        assert col in df.columns, f"Missing {col} in senior_profiles.csv"
    assert len(df) == config.cohort_size
    assert df["senior_id"].nunique() == config.cohort_size


def test_senior_baselines_schema(config):
    df = pd.read_csv(config.raw_data_dir / "senior_baselines.csv")
    required = [
        "senior_id", "baseline_bp_systolic", "baseline_bp_diastolic",
        "baseline_blood_glucose", "baseline_glucose_context", "baseline_spo2",
        "baseline_weight", "baseline_steps", "baseline_active_minutes",
        "baseline_sleep_hours", "baseline_appetite_level", "baseline_mood_level",
        "baseline_med_adherence_tendency", "baseline_checkin_participation_tendency"
    ]
    for col in required:
        assert col in df.columns, f"Missing {col} in senior_baselines.csv"
    assert len(df) == config.cohort_size


def test_daily_master_schema(config):
    df = pd.read_csv(config.processed_data_dir / "daily_master.csv")
    required = [
        "senior_id", "date", "steps", "active_minutes", "sleep_hours",
        "appetite_level", "mood_level", "social_contact_count",
        "bp_systolic_mmhg", "bp_diastolic_mmhg", "blood_glucose_mg_dl",
        "glucose_context", "spo2_percent", "weight_kg", "scheduled_doses",
        "taken_doses", "missed_doses", "unknown_doses", "checkin_completed",
        "family_observation_available", "missing_vitals_count",
        "missing_activity_flag", "missing_checkin_flag", "data_completeness_flag"
    ]
    for col in required:
        assert col in df.columns, f"Missing {col} in daily_master.csv"
    assert len(df) == config.cohort_size * config.observation_days


def test_vitals_schema(config):
    df = pd.read_csv(config.raw_data_dir / "vitals.csv")
    required = [
        "measurement_id", "senior_id", "timestamp", "measurement_type",
        "measurement_value", "unit", "measurement_context",
        "measurement_source", "quality_status"
    ]
    for col in required:
        assert col in df.columns, f"Missing {col} in vitals.csv"
    valid_types = {
        "blood_pressure_systolic", "blood_pressure_diastolic",
        "blood_glucose", "spo2", "weight"
    }
    assert set(df["measurement_type"].unique()).issubset(valid_types)


def test_medication_schemas(config):
    sched_df = pd.read_csv(config.raw_data_dir / "medication_schedules.csv")
    sched_cols = [
        "medication_id", "senior_id", "scheduled_start_date",
        "scheduled_end_date", "scheduled_times_per_day", "active_status"
    ]
    for col in sched_cols:
        assert col in sched_df.columns

    event_df = pd.read_csv(config.raw_data_dir / "medication_events.csv")
    event_cols = [
        "medication_event_id", "senior_id", "medication_id",
        "scheduled_timestamp", "status", "actual_timestamp",
        "record_source", "verification_status"
    ]
    for col in event_cols:
        assert col in event_df.columns


def test_checkins_and_nlp_schemas(config):
    chk_df = pd.read_csv(config.raw_data_dir / "checkins.csv")
    chk_cols = [
        "checkin_id", "senior_id", "timestamp", "channel",
        "language", "raw_note", "transcription_status",
        "consent_status", "source_role", "synthetic_scenario_id"
    ]
    for col in chk_cols:
        assert col in chk_df.columns

    ann_df = pd.read_csv(config.processed_data_dir / "nlp_annotations.csv")
    ann_cols = [
        "annotation_id", "checkin_id", "cue_type", "cue_value",
        "temporal_context", "negation_status", "source_role",
        "annotation_confidence", "annotation_source"
    ]
    for col in ann_cols:
        assert col in ann_df.columns

