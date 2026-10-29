"""Generate synthetic measurement-level vital signs observations."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def generate_vitals(
    profiles_df: pd.DataFrame,
    baselines_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> pd.DataFrame:
    """
    Generates measurement-level vital signs with realistic frequencies,
    timestamps, contexts, and scenario-induced clinical trajectories.
    """
    logger.info("Generating measurement-level vital signs...")
    rows: List[Dict[str, Any]] = []
    measurement_counter = 1

    baselines_by_id = baselines_df.set_index("senior_id").to_dict(orient="index")
    start_dt = config.start_date
    total_days = config.observation_days

    bp_rate = config.missingness_settings.get("bp_measurement_rate", 0.68)
    glu_rate = config.missingness_settings.get("glucose_measurement_rate", 0.42)
    spo2_rate = config.missingness_settings.get("spo2_measurement_rate", 0.60)
    wt_rate = config.missingness_settings.get("weight_measurement_rate", 0.22)
    device_fail_rate = config.missingness_settings.get("vitals_device_failure_rate", 0.04)

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        base = baselines_by_id[senior_id]
        alloc = allocations[senior_id]

        rng = np.random.default_rng(senior_seed + 404)

        base_sbp = base["baseline_bp_systolic"]
        base_dbp = base["baseline_bp_diastolic"]
        base_glu = base["baseline_blood_glucose"]
        base_spo2 = base["baseline_spo2"]
        base_wt = base["baseline_weight"]

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

            # Scenario deltas
            sub_type = alloc["sub_type"]
            sbp_delta = 0.0
            dbp_delta = 0.0
            glu_delta = 0.0
            spo2_delta = 0.0
            wt_delta = 0.0

            if progression > 0:
                if sub_type == "SCEN_ACUTE_HYPERTENSIVE_CRISIS":
                    sbp_delta = progression * 42.0
                    dbp_delta = progression * 24.0
                elif sub_type == "SCEN_ACUTE_DIZZINESS_ORTHOSTATIC":
                    sbp_delta = -progression * 28.0
                    dbp_delta = -progression * 14.0
                elif sub_type == "SCEN_GRADUAL_RESPIRATORY_DECONDITIONING":
                    spo2_delta = -progression * 4.8
                    sbp_delta = progression * 8.0
                elif sub_type == "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS":
                    wt_delta = -progression * 5.2
                    glu_delta = -progression * 15.0
                elif sub_type == "SCEN_INTERMITTENT_MILD_PAIN_FLARE":
                    sbp_delta = progression * 9.0  # slight reactive BP elevation

            # 1. Blood Pressure measurements (typically morning and/or evening)
            if rng.random() < bp_rate:
                # 1 or 2 readings
                n_bp = 2 if rng.random() < 0.35 else 1
                for bp_idx in range(n_bp):
                    hour = rng.integers(7, 10) if bp_idx == 0 else rng.integers(18, 21)
                    minute = rng.integers(0, 60)
                    second = rng.integers(0, 60)
                    ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

                    is_artifact = rng.random() < device_fail_rate
                    status = "device_artifact" if is_artifact else ("questionable" if rng.random() < 0.03 else "valid")

                    val_sbp = round(float(np.clip(base_sbp + sbp_delta + rng.normal(0, 5.5), 80.0, 220.0)), 1)
                    val_dbp = round(float(np.clip(base_dbp + dbp_delta + rng.normal(0, 3.5), 50.0, 130.0)), 1)

                    if is_artifact:
                        val_sbp = 235.0 if rng.random() < 0.5 else 65.0

                    # Systolic row
                    rows.append({
                        "measurement_id": f"M{measurement_counter:07d}",
                        "senior_id": senior_id,
                        "timestamp": ts,
                        "measurement_type": "blood_pressure_systolic",
                        "measurement_value": val_sbp,
                        "unit": "mmHg",
                        "measurement_context": "resting",
                        "measurement_source": "home_bp_monitor",
                        "quality_status": status,
                    })
                    measurement_counter += 1

                    # Diastolic row (paired timestamp)
                    rows.append({
                        "measurement_id": f"M{measurement_counter:07d}",
                        "senior_id": senior_id,
                        "timestamp": ts,
                        "measurement_type": "blood_pressure_diastolic",
                        "measurement_value": val_dbp,
                        "unit": "mmHg",
                        "measurement_context": "resting",
                        "measurement_source": "home_bp_monitor",
                        "quality_status": status,
                    })
                    measurement_counter += 1

            # 2. Blood Glucose measurements
            if rng.random() < glu_rate:
                # Decide fasting vs post_meal
                is_fasting = rng.random() < 0.60
                if is_fasting:
                    hour = rng.integers(7, 9)
                    ctx = "fasting"
                    g_base = base_glu if base["baseline_glucose_context"] == "fasting" else base_glu - 30.0
                else:
                    hour = rng.integers(13, 16) if rng.random() < 0.5 else rng.integers(20, 22)
                    ctx = "post_meal"
                    g_base = base_glu if base["baseline_glucose_context"] == "post_meal" else base_glu + 32.0

                minute = rng.integers(0, 60)
                second = rng.integers(0, 60)
                ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

                is_artifact = rng.random() < device_fail_rate
                status = "device_artifact" if is_artifact else ("questionable" if rng.random() < 0.02 else "valid")
                val_glu = round(float(np.clip(g_base + glu_delta + rng.normal(0, 11.0), 60.0, 380.0)), 1)
                if is_artifact:
                    val_glu = 25.0 if rng.random() < 0.5 else 480.0

                rows.append({
                    "measurement_id": f"M{measurement_counter:07d}",
                    "senior_id": senior_id,
                    "timestamp": ts,
                    "measurement_type": "blood_glucose",
                    "measurement_value": val_glu,
                    "unit": "mg/dL",
                    "measurement_context": ctx,
                    "measurement_source": "glucometer",
                    "quality_status": status,
                })
                measurement_counter += 1

            # 3. SpO2 measurements
            if rng.random() < spo2_rate:
                hour = rng.integers(9, 18)
                minute = rng.integers(0, 60)
                second = rng.integers(0, 60)
                ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

                is_artifact = rng.random() < (device_fail_rate * 0.7)
                status = "device_artifact" if is_artifact else ("questionable" if rng.random() < 0.02 else "valid")
                val_spo2 = round(float(np.clip(base_spo2 + spo2_delta + rng.normal(0, 0.6), 84.0, 100.0)), 1)
                if is_artifact:
                    val_spo2 = 68.0

                rows.append({
                    "measurement_id": f"M{measurement_counter:07d}",
                    "senior_id": senior_id,
                    "timestamp": ts,
                    "measurement_type": "spo2",
                    "measurement_value": val_spo2,
                    "unit": "%",
                    "measurement_context": "resting",
                    "measurement_source": "pulse_oximeter",
                    "quality_status": status,
                })
                measurement_counter += 1

            # 4. Weight measurements
            if rng.random() < wt_rate:
                hour = rng.integers(7, 9)
                minute = rng.integers(0, 60)
                second = rng.integers(0, 60)
                ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

                status = "valid" if rng.random() > 0.01 else "questionable"
                val_wt = round(float(np.clip(base_wt + wt_delta + rng.normal(0, 0.3), 35.0, 140.0)), 1)

                rows.append({
                    "measurement_id": f"M{measurement_counter:07d}",
                    "senior_id": senior_id,
                    "timestamp": ts,
                    "measurement_type": "weight",
                    "measurement_value": val_wt,
                    "unit": "kg",
                    "measurement_context": "fasting",
                    "measurement_source": "smart_scale",
                    "quality_status": status,
                })
                measurement_counter += 1

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} vital measurements.")
    return df


def save_vitals(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "vitals.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved vitals to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    b_df = pd.read_csv(cfg.raw_data_dir / "senior_baselines.csv")
    from src.generate_episodes import allocate_scenarios
    allocs = allocate_scenarios(p_df, cfg)
    v_df = generate_vitals(p_df, b_df, allocs, cfg)
    save_vitals(v_df, cfg.raw_data_dir)

