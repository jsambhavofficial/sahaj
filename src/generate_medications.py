"""Generate synthetic medication schedules and dose administration events."""

from datetime import datetime, timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def generate_medication_data(
    profiles_df: pd.DataFrame,
    baselines_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generates medication schedules and longitudinal dose events.
    Respects active schedules, individual baseline adherence, and scenario decline.
    """
    logger.info("Generating medication schedules and events...")

    schedules_rows: List[Dict[str, Any]] = []
    events_rows: List[Dict[str, Any]] = []
    event_counter = 1

    baselines_by_id = baselines_df.set_index("senior_id").to_dict(orient="index")
    start_dt = config.start_date
    total_days = config.observation_days

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        base = baselines_by_id[senior_id]
        alloc = allocations[senior_id]

        rng = np.random.default_rng(senior_seed + 505)

        base_adherence = base["baseline_med_adherence_tendency"]

        # Number of active prescriptions for this senior (1 to 4)
        n_meds = int(rng.choice([1, 2, 3, 4], p=[0.20, 0.45, 0.25, 0.10]))

        senior_schedules = []
        for m_idx in range(1, n_meds + 1):
            med_id = f"MED_{senior_id}_{m_idx:02d}"
            times_per_day = int(rng.choice([1, 2], p=[0.65, 0.35]))
            
            # Start date is at or before cohort start, end date at or after cohort end
            sched_start = (start_dt - timedelta(days=int(rng.integers(10, 60)))).strftime("%Y-%m-%d")
            sched_end = (start_dt + timedelta(days=total_days + int(rng.integers(30, 90)))).strftime("%Y-%m-%d")

            schedules_rows.append({
                "medication_id": med_id,
                "senior_id": senior_id,
                "scheduled_start_date": sched_start,
                "scheduled_end_date": sched_end,
                "scheduled_times_per_day": times_per_day,
                "active_status": True,
            })
            senior_schedules.append((med_id, times_per_day))

        # Generate daily dose events
        for day in range(total_days):
            current_date = start_dt + timedelta(days=day)
            date_str = current_date.strftime("%Y-%m-%d")

            in_episode = (day >= alloc["onset_day"]) and (day <= alloc["end_day"])
            episode_day = max(0, day - alloc["onset_day"])
            episode_len = max(1, alloc["end_day"] - alloc["onset_day"] + 1)

            progression = 0.0
            if in_episode:
                if alloc["sub_type"] == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY":
                    mid = episode_len * 0.4
                    progression = episode_day / mid if episode_day <= mid else max(0.0, 1.0 - (episode_day - mid) / (episode_len - mid))
                elif alloc["main_type"] == "intermittent":
                    mid = episode_len / 2.0
                    progression = np.exp(-((episode_day - mid) ** 2) / (2 * (episode_len / 3.0) ** 2))
                elif alloc["main_type"] == "acute":
                    progression = 1.0 if episode_day < 5 else max(0.2, 1.0 - (episode_day - 5) * 0.12)
                else:
                    progression = min(1.0, episode_day / max(20.0, float(episode_len)))

            # Scenario impact on adherence
            sub_type = alloc["sub_type"]
            adherence_drop = 0.0
            if progression > 0:
                if sub_type == "SCEN_GRADUAL_COGNITIVE_FRAILTY":
                    adherence_drop = progression * 0.45  # significant forgetfulness
                elif sub_type == "SCEN_ISOLATED_MEDICATION_OMISSION":
                    adherence_drop = progression * 0.65  # sharp transient drop
                elif sub_type == "SCEN_ACUTE_FALL_INCIDENT":
                    adherence_drop = progression * 0.35  # acute disruption
                else:
                    adherence_drop = progression * 0.15

            current_adherence = max(0.25, base_adherence - adherence_drop)

            for med_id, times_per_day in senior_schedules:
                scheduled_hours = [8] if times_per_day == 1 else [8, 20]

                for sched_hour in scheduled_hours:
                    sched_ts = f"{date_str} {sched_hour:02d}:00:00"

                    roll = rng.random()
                    # Determine event status: taken, missed, or unknown
                    if roll < current_adherence:
                        status = "taken"
                        # Actual time with slight jitter (-20 min to +45 min)
                        jitter_sec = int(rng.normal(10, 15) * 60)
                        base_dt = datetime(current_date.year, current_date.month, current_date.day, sched_hour, 0, 0)
                        actual_dt = base_dt + timedelta(seconds=jitter_sec)
                        actual_ts = actual_dt.strftime("%Y-%m-%d %H:%M:%S")
                        verif = "verified" if rng.random() < 0.70 else "self_reported"
                    elif roll < (current_adherence + (1.0 - current_adherence) * 0.75):
                        status = "missed"
                        actual_ts = None
                        verif = "verified" if rng.random() < 0.6 else "self_reported"
                    else:
                        status = "unknown"
                        actual_ts = None
                        verif = "unverified"

                    source = rng.choice(
                        ["smart_pillbox", "senior_app_confirmation", "coordinator_call"],
                        p=[0.55, 0.30, 0.15]
                    )

                    events_rows.append({
                        "medication_event_id": f"ME{event_counter:07d}",
                        "senior_id": senior_id,
                        "medication_id": med_id,
                        "scheduled_timestamp": sched_ts,
                        "status": status,
                        "actual_timestamp": actual_ts,
                        "record_source": source,
                        "verification_status": verif,
                    })
                    event_counter += 1

    schedules_df = pd.DataFrame(schedules_rows)
    events_df = pd.DataFrame(events_rows)

    logger.info(f"Generated {len(schedules_df)} schedules and {len(events_df)} medication events.")
    return schedules_df, events_df


def save_medications(schedules_df: pd.DataFrame, events_df: pd.DataFrame, output_dir: Path) -> Tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    p1 = output_dir / "medication_schedules.csv"
    p2 = output_dir / "medication_events.csv"
    schedules_df.to_csv(p1, index=False)
    events_df.to_csv(p2, index=False)
    logger.info(f"Saved medication schedules to {p1} and events to {p2}")
    return p1, p2


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    b_df = pd.read_csv(cfg.raw_data_dir / "senior_baselines.csv")
    from src.generate_episodes import allocate_scenarios
    allocs = allocate_scenarios(p_df, cfg)
    s_df, e_df = generate_medication_data(p_df, b_df, allocs, cfg)
    save_medications(s_df, e_df, cfg.raw_data_dir)
