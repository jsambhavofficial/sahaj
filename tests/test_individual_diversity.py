"""Tests for individual diversity, non-identical profiles, and distinct trajectories."""

import pytest
import pandas as pd
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_baseline_diversity(config):
    baselines = pd.read_csv(config.raw_data_dir / "senior_baselines.csv")
    n_seniors = len(baselines)

    # Check distinct baseline BP, steps, weight
    assert baselines["baseline_bp_systolic"].nunique() > 25
    assert baselines["baseline_steps"].nunique() > 50
    assert baselines["baseline_weight"].nunique() > 50

    # Ensure no two seniors have identical full baseline rows
    assert baselines.drop(columns=["senior_id"]).drop_duplicates().shape[0] == n_seniors


def test_trajectory_diversity(config):
    master = pd.read_csv(config.processed_data_dir / "daily_master.csv")
    n_seniors = master["senior_id"].nunique()

    # Steps trajectory per senior
    step_trajectories = master.pivot(index="senior_id", columns="date", values="steps")
    assert step_trajectories.drop_duplicates().shape[0] == n_seniors


def test_linguistic_diversity(config):
    profiles = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    languages = set(profiles["preferred_language"].unique())
    assert {"hindi", "hinglish", "english"}.issubset(languages)

    checkins = pd.read_csv(config.raw_data_dir / "checkins.csv")
    chk_languages = set(checkins["language"].unique())
    assert {"hindi", "hinglish", "english"}.issubset(chk_languages)

    # Note diversity
    assert checkins["raw_note"].nunique() > 50


def test_demographic_distributions(config):
    profiles = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    assert profiles["age"].min() >= 60
    assert profiles["age"].max() <= 95
    assert profiles["living_arrangement"].nunique() >= 3
    assert profiles["city_id"].nunique() == config.city_count

