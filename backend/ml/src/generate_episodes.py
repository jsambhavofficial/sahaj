"""Generate synthetic scenarios and ground-truth decline episodes."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def allocate_scenarios(profiles_df: pd.DataFrame, config: DatasetConfig) -> Dict[str, Dict[str, Any]]:
    """
    Allocates high-level scenario types and specific sub-scenarios to each senior.
    Ensures exact compliance with configured proportions.
    """
    n_seniors = len(profiles_df)
    proportions = config.scenario_proportions

    n_stable = int(round(proportions.get("stable", 0.50) * n_seniors))
    n_intermittent = int(round(proportions.get("intermittent", 0.20) * n_seniors))
    n_gradual = int(round(proportions.get("gradual_decline", 0.20) * n_seniors))
    n_acute = n_seniors - (n_stable + n_intermittent + n_gradual)

    scenario_types = (
        ["stable"] * n_stable
        + ["intermittent"] * n_intermittent
        + ["gradual_decline"] * n_gradual
        + ["acute"] * n_acute
    )

    # Deterministic cohort shuffle using master seed
    cohort_rng = np.random.default_rng(config.random_seed + 999)
    cohort_rng.shuffle(scenario_types)

    sub_scenarios_map = {
        "stable": [
            "SCEN_STABLE_ACTIVE",
            "SCEN_STABLE_SEDENTARY",
            "SCEN_STABLE_MILD_FLUCTUATION"
        ],
        "intermittent": [
            "SCEN_INTERMITTENT_SLEEP_DISRUPTION",
            "SCEN_INTERMITTENT_MILD_PAIN_FLARE",
            "SCEN_ISOLATED_MEDICATION_OMISSION"
        ],
        "gradual_decline": [
            "SCEN_GRADUAL_MOBILITY_DECLINE",
            "SCEN_GRADUAL_COGNITIVE_FRAILTY",
            "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS",
            "SCEN_GRADUAL_RESPIRATORY_DECONDITIONING",
            "SCEN_GRADUAL_DECLINE_WITH_RECOVERY",       # Recovery scenario
            "SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED",    # Difficult detection
        ],
        "acute": [
            "SCEN_ACUTE_FALL_INCIDENT",
            "SCEN_ACUTE_HYPERTENSIVE_CRISIS",
            "SCEN_ACUTE_DIZZINESS_ORTHOSTATIC"
        ]
    }

    allocation: Dict[str, Dict[str, Any]] = {}
    start_dt = config.start_date
    total_days = config.observation_days

    for i, (_, profile) in enumerate(profiles_df.iterrows()):
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        senior_rng = np.random.default_rng(senior_seed + 202)

        main_type = scenario_types[i]
        possible_subs = sub_scenarios_map[main_type]
        sub_type = senior_rng.choice(possible_subs)

        # Configure onset and duration based on scenario
        if main_type == "stable":
            onset_day = 0
            duration = total_days
            severity = "none"
            escalation = "routine_monitoring"
            description = "Senior demonstrates consistent baseline vital signs and daily activity with standard noise."
        elif main_type == "intermittent":
            onset_day = int(senior_rng.integers(20, 65))
            duration = int(senior_rng.integers(3, 7))  # short transient flare
            severity = "mild"
            escalation = "care_coordinator_followup"
            description = f"Transient self-limiting concern ({sub_type}) lasting {duration} days before returning to baseline."
        elif main_type == "gradual_decline":
            onset_day = int(senior_rng.integers(20, 48))
            if sub_type == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY":
                duration = int(senior_rng.integers(25, 40))
                severity = "moderate"
                escalation = "care_coordinator_followup"
                description = "Gradual health deterioration followed by coordinator intervention and synthetic recovery."
            elif sub_type == "SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED":
                duration = total_days - onset_day
                severity = "moderate"
                escalation = "care_coordinator_followup"
                description = "Subtle gradual deterioration with high missingness and device non-adherence masking signals."
            else:
                duration = total_days - onset_day
                severity = senior_rng.choice(["moderate", "severe"])
                escalation = "urgent_family_notification"
                description = f"Progressive unremitting multidimensional decline ({sub_type}) with cumulative frailty."
        else:  # acute
            onset_day = int(senior_rng.integers(35, 70))
            duration = int(senior_rng.integers(5, 14))
            severity = senior_rng.choice(["severe", "critical"])
            escalation = "immediate_clinical_escalation"
            description = f"Acute sudden health deterioration event ({sub_type}) requiring immediate human review."

        onset_date = start_dt + timedelta(days=onset_day)
        end_date = min(start_dt + timedelta(days=total_days - 1), onset_date + timedelta(days=duration - 1))

        allocation[senior_id] = {
            "main_type": main_type,
            "sub_type": sub_type,
            "onset_day": onset_day,
            "end_day": min(total_days - 1, onset_day + duration - 1),
            "onset_date": onset_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "severity": severity,
            "escalation": escalation,
            "description": description,
        }

    return allocation


def generate_decline_episodes(
    profiles_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> pd.DataFrame:
    """Generates ground truth decline episodes evaluation table."""
    logger.info("Generating ground truth decline episodes table...")
    rows: List[Dict[str, Any]] = []
    ep_counter = 1

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        alloc = allocations[senior_id]

        episode_id = f"EP_{ep_counter:05d}"
        ep_counter += 1

        is_planted = alloc["main_type"] != "stable"
        ep_type = (
            "stable_baseline" if alloc["main_type"] == "stable"
            else "recovery_trajectory" if alloc["sub_type"] == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY"
            else "acute_event" if alloc["main_type"] == "acute"
            else "intermittent_concern" if alloc["main_type"] == "intermittent"
            else "gradual_decline"
        )

        rows.append({
            "episode_id": episode_id,
            "senior_id": senior_id,
            "episode_type": ep_type,
            "onset_date": alloc["onset_date"],
            "end_date": alloc["end_date"],
            "severity_category": alloc["severity"],
            "planted": is_planted,
            "scenario_id": alloc["sub_type"],
            "expected_escalation": alloc["escalation"],
            "scenario_description": alloc["description"],
        })

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} decline episode records.")
    return df


def save_episodes(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "decline_episodes.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved decline episodes to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    allocs = allocate_scenarios(p_df, cfg)
    ep_df = generate_decline_episodes(p_df, allocs, cfg)
    save_episodes(ep_df, cfg.evaluation_data_dir)

