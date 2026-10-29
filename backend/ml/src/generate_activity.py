"""Generate synthetic daily activity and wellbeing observations."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def generate_daily_activity(
    profiles_df: pd.DataFrame,
    baselines_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> pd.DataFrame:
    """
    Generates longitudinal daily physical activity and wellbeing logs for all seniors.
    Maintains causal consistency with baseline parameters and scenario progression.
    """
    logger.info("Generating daily physical activity and wellbeing records...")
    rows: List[Dict[str, Any]] = []

    baselines_by_id = baselines_df.set_index("senior_id").to_dict(orient="index")
    start_dt = config.start_date
    total_days = config.observation_days

    missing_sensor_rate = config.missingness_settings.get("activity_sensor_failure_rate", 0.05)

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        base = baselines_by_id[senior_id]
        alloc = allocations[senior_id]

        rng = np.random.default_rng(senior_seed + 303)

        base_steps = base["baseline_steps"]
        base_active = base["baseline_active_minutes"]
        base_sleep = base["baseline_sleep_hours"]
        base_appetite = base["baseline_appetite_level"]
        base_mood = base["baseline_mood_level"]

        # Autoregressive memory terms
        prev_step_delta = 0.0
        prev_sleep_delta = 0.0

        for day in range(total_days):
            current_date = start_dt + timedelta(days=day)
            date_str = current_date.strftime("%Y-%m-%d")

            # Determine progression factor (0.0 to 1.0)
            in_episode = (day >= alloc["onset_day"]) and (day <= alloc["end_day"])
            episode_day = max(0, day - alloc["onset_day"])
            episode_len = max(1, alloc["end_day"] - alloc["onset_day"] + 1)
            
            progression = 0.0
            if in_episode:
                if alloc["sub_type"] == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY":
                    # Progression increases to peak at 40% duration, then recovers
                    mid = episode_len * 0.4
                    if episode_day <= mid:
                        progression = episode_day / mid
                    else:
                        progression = max(0.0, 1.0 - (episode_day - mid) / (episode_len - mid))
                elif alloc["main_type"] == "intermittent":
                    # Bell-shaped transient flare
                    mid = episode_len / 2.0
                    progression = np.exp(-((episode_day - mid) ** 2) / (2 * (episode_len / 3.0) ** 2))
                elif alloc["main_type"] == "acute":
                    # Sudden jump, slow recovery or lingering drop
                    progression = 1.0 if episode_day < 4 else max(0.3, 1.0 - (episode_day - 4) * 0.1)
                else:  # gradual decline
                    progression = min(1.0, episode_day / max(20.0, float(episode_len)))

            # Dynamic modifier based on scenario
            sub_type = alloc["sub_type"]
            step_mult = 1.0
            sleep_add = 0.0
            appetite_sub = 0.0
            mood_sub = 0.0

            if progression > 0:
                if sub_type == "SCEN_GRADUAL_MOBILITY_DECLINE":
                    step_mult = max(0.20, 1.0 - progression * 0.70)
                    mood_sub = progression * 0.8
                elif sub_type == "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS":
                    appetite_sub = progression * 2.2
                    step_mult = max(0.50, 1.0 - progression * 0.45)
                    mood_sub = progression * 0.6
                elif sub_type == "SCEN_GRADUAL_COGNITIVE_FRAILTY":
                    sleep_add = rng.choice([-1.5, 1.5]) * progression  # erratic sleep
                    step_mult = max(0.40, 1.0 - progression * 0.50)
                    mood_sub = progression * 1.0
                    appetite_sub = progression * 1.2
                elif sub_type == "SCEN_INTERMITTENT_SLEEP_DISRUPTION":
                    sleep_add = -progression * 2.5
                    mood_sub = progression * 0.7
                    step_mult = max(0.70, 1.0 - progression * 0.25)
                elif sub_type == "SCEN_INTERMITTENT_MILD_PAIN_FLARE":
                    step_mult = max(0.55, 1.0 - progression * 0.40)
                    mood_sub = progression * 0.8
                elif sub_type == "SCEN_ACUTE_FALL_INCIDENT":
                    step_mult = max(0.08, 1.0 - progression * 0.90)  # sudden immobilization
                    mood_sub = progression * 1.8
                    appetite_sub = progression * 1.5
                elif sub_type == "SCEN_ACUTE_DIZZINESS_ORTHOSTATIC":
                    step_mult = max(0.25, 1.0 - progression * 0.75)
                    mood_sub = progression * 1.2
                else:
                    step_mult = max(0.45, 1.0 - progression * 0.50)
                    appetite_sub = progression * 0.9
                    mood_sub = progression * 0.7

            # Natural autocorrelation + noise
            step_noise = 0.4 * prev_step_delta + 0.6 * rng.normal(0, base_steps * 0.12)
            prev_step_delta = step_noise
            cur_steps = int(np.clip(base_steps * step_mult + step_noise, 50, 15000))

            cur_active = int(np.clip(cur_steps / 65.0 + rng.normal(0, 3.5), 2, 180))

            sleep_noise = 0.3 * prev_sleep_delta + 0.7 * rng.normal(0, 0.45)
            prev_sleep_delta = sleep_noise
            cur_sleep = float(np.clip(base_sleep + sleep_add + sleep_noise, 2.5, 12.0))

            cur_appetite = float(np.clip(base_appetite - appetite_sub + rng.normal(0, 0.2), 1.0, 5.0))
            cur_mood = float(np.clip(base_mood - mood_sub + rng.normal(0, 0.25), 1.0, 5.0))

            # Social contacts (0 to 6)
            base_social = 2 if profile["living_arrangement"] != "alone" else 1
            cur_social = int(np.clip(base_social + rng.poisson(1.0) - (1 if mood_sub > 0.8 else 0), 0, 6))

            # Missingness: sensor uncharged / unwearable
            sensor_fail_prob = missing_sensor_rate
            if sub_type == "SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED" and progression > 0:
                sensor_fail_prob = 0.28  # heightened missingness in masked scenario

            is_sensor_missing = bool(rng.random() < sensor_fail_prob)

            if is_sensor_missing:
                steps_val = None
                active_val = None
                sleep_val = None
                source = "manual_coordinator_log"
                data_available = False
            else:
                steps_val = cur_steps
                active_val = cur_active
                sleep_val = round(cur_sleep, 2)
                source = "smartwatch_pedometer"
                data_available = True

            rows.append({
                "senior_id": senior_id,
                "date": date_str,
                "steps": steps_val,
                "active_minutes": active_val,
                "sleep_hours": sleep_val,
                "appetite_level": round(cur_appetite, 1),
                "mood_level": round(cur_mood, 1),
                "social_contact_count": cur_social,
                "activity_source": source,
                "data_available": data_available,
            })

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} daily activity records.")
    return df


def save_daily_activity(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "daily_activity.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved daily activity records to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    b_df = pd.read_csv(cfg.raw_data_dir / "senior_baselines.csv")
    from src.generate_episodes import allocate_scenarios
    allocs = allocate_scenarios(p_df, cfg)
    act_df = generate_daily_activity(p_df, b_df, allocs, cfg)
    save_daily_activity(act_df, cfg.raw_data_dir)

