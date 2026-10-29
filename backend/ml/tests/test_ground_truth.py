"""Tests for hidden evaluation ground truth, absence of target leakage, and scenario catalog."""

import pytest
import pandas as pd
from src.config_loader import load_config


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_target_leakage_absence_in_model_inputs(config):
    forbidden = ["planted", "severity_category", "expected_escalation", "scenario_description"]
    input_files = [
        config.processed_data_dir / "daily_master.csv",
        config.raw_data_dir / "vitals.csv",
        config.raw_data_dir / "daily_activity.csv",
        config.raw_data_dir / "medication_events.csv",
        config.raw_data_dir / "family_observations.csv",
    ]

    for fpath in input_files:
        df = pd.read_csv(fpath)
        for col in forbidden:
            assert col not in df.columns, f"Target leakage detected: {col} present in {fpath.name}!"


def test_scenario_allocation_proportions(config):
    episodes = pd.read_csv(config.evaluation_data_dir / "decline_episodes.csv")
    total_seniors = len(episodes)

    type_counts = episodes["episode_type"].value_counts()

    stable_cnt = type_counts.get("stable_baseline", 0)
    intermittent_cnt = type_counts.get("intermittent_concern", 0)
    gradual_cnt = type_counts.get("gradual_decline", 0) + type_counts.get("recovery_trajectory", 0)
    acute_cnt = type_counts.get("acute_event", 0)

    assert stable_cnt == int(total_seniors * 0.50)
    assert intermittent_cnt == int(total_seniors * 0.20)
    assert gradual_cnt == int(total_seniors * 0.20)
    assert acute_cnt == int(total_seniors * 0.10)


def test_recovery_scenario_presence(config):
    episodes = pd.read_csv(config.evaluation_data_dir / "decline_episodes.csv")
    rec_eps = episodes[episodes["episode_type"] == "recovery_trajectory"]
    assert len(rec_eps) > 0, "No recovery trajectory episodes found in ground truth!"


def test_nlp_annotation_ground_truth(config):
    annotations = pd.read_csv(config.processed_data_dir / "nlp_annotations.csv")

    assert (annotations["annotation_source"] == "synthetic_ground_truth").all()
    assert (annotations["negation_status"] == True).sum() > 0
    assert (annotations["cue_value"] == "uncertain").sum() > 0
    assert (annotations["cue_value"] == "absent").sum() > 0
    assert (annotations["cue_value"] == "present").sum() > 0

