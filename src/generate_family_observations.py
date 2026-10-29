"""Generate synthetic family caregiver observations."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)

FAMILY_NOTES = {
    "mobility_change": [
        "Mother seemed unsteady on her feet while walking to the dining area today.",
        "Noticed father holding onto the hallway wall for support when walking.",
        "Walking speed has slowed down considerably over the past week.",
        "Had difficulty getting up from the low sofa without physical assistance.",
    ],
    "appetite_change": [
        "Mother barely ate half a roti for lunch, left most of her food untouched.",
        "Appetite has been unusually poor; he refused his evening milk and snacks.",
        "Ate a healthy lunch and finished seasonal fruits with good appetite.",
        "Skipped breakfast today stating lack of taste or hunger.",
    ],
    "mood_change": [
        "Father seemed unusually quiet and disengaged during our video call.",
        "Mother sounded cheerier today and enjoyed chatting about old memories.",
        "Noticed signs of anxiety and irritability when discussing daily routine.",
        "Appeared somewhat lonely and asked repeatedly when we would visit next.",
    ],
    "sleep_pattern": [
        "Father mentioned waking up at 3 AM and wandering around the house.",
        "Mother reported a sound and restful 8 hours of sleep last night.",
        "Seems exhausted during daytime, possibly due to poor nighttime rest.",
    ],
    "routine_disruption": [
        "Did not go for usual morning walk in the community park today.",
        "Missed regular prayer time, which is very unusual for her daily habits.",
        "Routine seemed well maintained today, everything on schedule.",
    ],
    "general_wellbeing": [
        "Overall looking healthy and energetic during our weekend visit.",
        "Appears visibly frail and low on energy compared to last month.",
        "Doing fine, no specific health complaints mentioned today.",
    ]
}


def generate_family_observations(
    profiles_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> pd.DataFrame:
    """
    Generates realistic caregiver and family observations.
    Strictly respects the family_consent flag: only seniors with family_consent=True
    will have family observation records generated.
    """
    logger.info("Generating family caregiver observations...")
    rows: List[Dict[str, Any]] = []
    obs_counter = 1

    start_dt = config.start_date
    total_days = config.observation_days

    roles = ["son", "daughter", "daughter_in_law", "spouse", "grandchild"]
    role_weights = [0.35, 0.35, 0.15, 0.10, 0.05]

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        has_consent = bool(profile["family_consent"])

        # Strictly respect consent: if no consent, no family observations
        if not has_consent:
            continue

        alloc = allocations[senior_id]
        rng = np.random.default_rng(senior_seed + 707)

        # Observations occur periodically (e.g. every 5 to 12 days)
        day = int(rng.integers(2, 7))
        while day < total_days:
            current_date = start_dt + timedelta(days=day)
            date_str = current_date.strftime("%Y-%m-%d")

            in_episode = (day >= alloc["onset_day"]) and (day <= alloc["end_day"])
            sub_type = alloc["sub_type"]

            if in_episode:
                if sub_type in ["SCEN_GRADUAL_MOBILITY_DECLINE", "SCEN_ACUTE_FALL_INCIDENT"]:
                    obs_type = "mobility_change"
                elif sub_type == "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS":
                    obs_type = "appetite_change"
                elif sub_type in ["SCEN_INTERMITTENT_SLEEP_DISRUPTION", "SCEN_GRADUAL_RESPIRATORY_DECONDITIONING"]:
                    obs_type = "sleep_pattern"
                elif sub_type == "SCEN_GRADUAL_COGNITIVE_FRAILTY":
                    obs_type = rng.choice(["routine_disruption", "mood_change"])
                else:
                    obs_type = rng.choice(list(FAMILY_NOTES.keys()))
            else:
                obs_type = rng.choice(list(FAMILY_NOTES.keys()))

            possible_notes = FAMILY_NOTES[obs_type]
            selected_note = rng.choice(possible_notes)

            hour = int(rng.integers(10, 21))
            minute = int(rng.integers(0, 60))
            second = int(rng.integers(0, 60))
            ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

            observer_role = rng.choice(roles, p=role_weights)
            verification = rng.choice(
                ["coordinator_reviewed", "unverified_family_report", "pending_review"],
                p=[0.60, 0.30, 0.10]
            )

            rows.append({
                "observation_id": f"FAM_{obs_counter:06d}",
                "senior_id": senior_id,
                "timestamp": ts,
                "observer_role": observer_role,
                "observation_type": obs_type,
                "note": selected_note,
                "consent_valid": True,
                "verification_status": verification,
            })
            obs_counter += 1

            # Advance to next observation day
            # If in decline or acute episode, family observes more frequently
            step_days = int(rng.integers(3, 7)) if in_episode else int(rng.integers(7, 14))
            day += step_days

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} family observations across consented seniors.")
    return df


def save_family_observations(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "family_observations.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved family observations to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    from src.generate_episodes import allocate_scenarios
    allocs = allocate_scenarios(p_df, cfg)
    f_df = generate_family_observations(p_df, allocs, cfg)
    save_family_observations(f_df, cfg.raw_data_dir)

