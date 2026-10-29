"""Generate synthetic individual baseline parameters for each senior."""

import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def generate_senior_baselines(profiles_df: pd.DataFrame, config: DatasetConfig) -> pd.DataFrame:
    """
    Generates synthetic individual baseline parameters.
    Baselines are generative prior parameters representing the senior's habitual
    or steady-state level, established prior to the 90-day observation window.
    """
    logger.info("Generating individual baselines for each senior...")
    rows: List[Dict[str, Any]] = []

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        # Use a distinct stream for baseline generation
        rng = np.random.default_rng(senior_seed + 101)

        age = profile["age"]

        # Systolic BP: older adults typically vary between 115 and 150 mmHg
        # Slightly correlated with age
        base_sbp = rng.normal(128.0 + (age - 70) * 0.4, 8.5)
        base_sbp = float(np.clip(base_sbp, 110.0, 155.0))

        # Diastolic BP: typically 68 to 88 mmHg
        base_dbp = rng.normal(76.0 + (base_sbp - 128.0) * 0.25, 5.0)
        base_dbp = float(np.clip(base_dbp, 64.0, 92.0))

        # Blood glucose: 70% fasting baseline (90-125), 30% post_meal baseline (125-165)
        glucose_context = "fasting" if rng.random() < 0.70 else "post_meal"
        if glucose_context == "fasting":
            base_glucose = float(np.clip(rng.normal(108.0, 14.0), 82.0, 150.0))
        else:
            base_glucose = float(np.clip(rng.normal(142.0, 18.0), 115.0, 195.0))

        # SpO2: healthy/elderly baseline typically 95.0% - 98.5%
        base_spo2 = float(np.clip(rng.normal(96.8, 0.9), 94.0, 99.0))

        # Weight: typically 50 - 90 kg
        base_weight = float(np.clip(rng.normal(68.0, 9.5), 48.0, 96.0))

        # Activity levels: steps vary by mobility/fitness (e.g. 1500 to 6500)
        base_steps = int(np.clip(rng.normal(3200, 1100), 1100, 7500))
        base_active_minutes = int(np.clip(base_steps / 65.0 + rng.normal(0, 5), 15, 90))

        # Sleep duration: typically 6.0 to 8.2 hours
        base_sleep = float(np.clip(rng.normal(7.1, 0.7), 5.2, 8.8))

        # Appetite: 1 to 5 scale (habitual baseline is usually good/fair: 3.6 to 4.9)
        base_appetite = float(np.clip(rng.normal(4.3, 0.35), 3.2, 5.0))

        # Mood: 1 to 5 scale (habitual baseline: 3.5 to 4.9)
        base_mood = float(np.clip(rng.normal(4.2, 0.4), 3.2, 5.0))

        # Adherence tendency: probability of taking scheduled medication on a normal day
        base_adherence = float(np.clip(rng.beta(24, 2), 0.78, 0.99))

        # Check-in participation tendency: probability of completing scheduled check-in
        base_checkin_tendency = float(np.clip(rng.beta(20, 3), 0.75, 0.99))

        rows.append({
            "senior_id": senior_id,
            "baseline_bp_systolic": round(base_sbp, 1),
            "baseline_bp_diastolic": round(base_dbp, 1),
            "baseline_blood_glucose": round(base_glucose, 1),
            "baseline_glucose_context": glucose_context,
            "baseline_spo2": round(base_spo2, 1),
            "baseline_weight": round(base_weight, 1),
            "baseline_steps": base_steps,
            "baseline_active_minutes": base_active_minutes,
            "baseline_sleep_hours": round(base_sleep, 2),
            "baseline_appetite_level": round(base_appetite, 2),
            "baseline_mood_level": round(base_mood, 2),
            "baseline_med_adherence_tendency": round(base_adherence, 3),
            "baseline_checkin_participation_tendency": round(base_checkin_tendency, 3),
        })

    df = pd.DataFrame(rows)
    logger.info(f"Generated baselines for {len(df)} seniors.")
    return df


def save_baselines(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "senior_baselines.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved senior baselines to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    b_df = generate_senior_baselines(p_df, cfg)
    save_baselines(b_df, cfg.raw_data_dir)

