"""Tests for referential integrity, foreign key relations, and consent validity."""

import pytest
import pandas as pd
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_senior_id_foreign_keys(config):
    profiles = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    valid_seniors = set(profiles["senior_id"].unique())

    # Check all tables referencing senior_id
    tables = [
        config.raw_data_dir / "senior_baselines.csv",
        config.raw_data_dir / "daily_activity.csv",
        config.raw_data_dir / "vitals.csv",
        config.raw_data_dir / "medication_schedules.csv",
        config.raw_data_dir / "medication_events.csv",
        config.raw_data_dir / "checkins.csv",
        config.raw_data_dir / "family_observations.csv",
        config.evaluation_data_dir / "decline_episodes.csv",
        config.processed_data_dir / "daily_master.csv",
    ]

    for tbl_path in tables:
        df = pd.read_csv(tbl_path)
        table_seniors = set(df["senior_id"].unique())
        assert table_seniors.issubset(valid_seniors), f"Found invalid senior_id in {tbl_path.name}"


def test_medication_foreign_keys(config):
    schedules = pd.read_csv(config.raw_data_dir / "medication_schedules.csv")
    events = pd.read_csv(config.raw_data_dir / "medication_events.csv")

    valid_meds = set(schedules["medication_id"].unique())
    event_meds = set(events["medication_id"].unique())
    assert event_meds.issubset(valid_meds), "Found invalid medication_id in medication_events.csv"


def test_checkin_annotation_foreign_keys(config):
    checkins = pd.read_csv(config.raw_data_dir / "checkins.csv")
    annotations = pd.read_csv(config.processed_data_dir / "nlp_annotations.csv")

    valid_chks = set(checkins["checkin_id"].unique())
    ann_chks = set(annotations["checkin_id"].unique())
    assert ann_chks.issubset(valid_chks), "Found invalid checkin_id in nlp_annotations.csv"


def test_family_consent_integrity(config):
    profiles = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    family = pd.read_csv(config.raw_data_dir / "family_observations.csv")

    consent_map = dict(zip(profiles["senior_id"], profiles["family_consent"]))
    for senior_id in family["senior_id"].unique():
        assert consent_map.get(senior_id, False) is True, f"Senior {senior_id} has family observations without consent!"

    if not family.empty:
        assert (family["consent_valid"] == True).all(), "Found invalid consent_valid flags in family_observations.csv"

