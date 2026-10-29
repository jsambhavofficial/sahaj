"""Tests for temporal consistency, sequential ordering, and causal trajectory integrity."""

import pytest
import pandas as pd
from datetime import datetime, timedelta
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_consecutive_days_per_senior(config):
    df = pd.read_csv(config.processed_data_dir / "daily_master.csv")
    df["dt"] = pd.to_datetime(df["date"])

    for senior_id, group in df.groupby("senior_id"):
        sorted_dates = group.sort_values("dt")["dt"].tolist()
        assert len(sorted_dates) == config.observation_days

        # Check consecutive days
        for i in range(len(sorted_dates) - 1):
            diff = (sorted_dates[i + 1] - sorted_dates[i]).days
            assert diff == 1, f"Senior {senior_id} has date gap between {sorted_dates[i]} and {sorted_dates[i+1]}"


def test_episode_date_invariants(config):
    episodes = pd.read_csv(config.evaluation_data_dir / "decline_episodes.csv")
    start_str = config.observation_start_date
    end_date = config.start_date + timedelta(days=config.observation_days - 1)
    end_str = end_date.strftime("%Y-%m-%d")

    for _, ep in episodes.iterrows():
        assert ep["onset_date"] <= ep["end_date"], f"Episode {ep['episode_id']} has onset after end."
        assert ep["onset_date"] >= start_str, f"Episode {ep['episode_id']} onset {ep['onset_date']} < start {start_str}."
        assert ep["end_date"] <= end_str, f"Episode {ep['episode_id']} end {ep['end_date']} > end {end_str}."


def test_vital_timestamps_consistency(config):
    vitals = pd.read_csv(config.raw_data_dir / "vitals.csv")
    start_str = config.observation_start_date
    end_date = config.start_date + timedelta(days=config.observation_days - 1)
    end_str = end_date.strftime("%Y-%m-%d")

    dates = vitals["timestamp"].str.slice(0, 10)
    assert dates.min() >= start_str
    assert dates.max() <= end_str


def test_gradual_decline_trajectory_signal(config):
    """Verifies that seniors in gradual mobility decline experience lower average steps post-onset."""
    episodes = pd.read_csv(config.evaluation_data_dir / "decline_episodes.csv")
    master = pd.read_csv(config.processed_data_dir / "daily_master.csv")

    mobility_eps = episodes[episodes["scenario_id"] == "SCEN_GRADUAL_MOBILITY_DECLINE"]
    assert not mobility_eps.empty

    drops = []
    for _, ep in mobility_eps.iterrows():
        s_id = ep["senior_id"]
        onset = ep["onset_date"]
        s_master = master[master["senior_id"] == s_id].dropna(subset=["steps"])

        pre_onset_steps = s_master[s_master["date"] < onset]["steps"].mean()
        post_onset_steps = s_master[s_master["date"] >= onset]["steps"].mean()

        if pd.notna(pre_onset_steps) and pd.notna(post_onset_steps):
            drops.append(pre_onset_steps - post_onset_steps)

    avg_drop = sum(drops) / len(drops)
    assert avg_drop > 300, f"Expected noticeable drop in mobility decline, got average drop of {avg_drop:.1f} steps"

