"""Generate synthetic senior demographic profiles."""

from datetime import timedelta
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def derive_senior_seed(master_seed: int, senior_id: str) -> int:
    """Derives a deterministic, isolated 31-bit integer seed for a senior."""
    hash_bytes = hashlib.sha256(f"{master_seed}:{senior_id}".encode("utf-8")).digest()
    return int.from_bytes(hash_bytes[:4], byteorder="big") & 0x7FFFFFFF


def generate_senior_profiles(config: DatasetConfig) -> pd.DataFrame:
    """Generates the senior demographic profile table."""
    logger.info(f"Generating profiles for cohort of size {config.cohort_size}...")

    master_rng = np.random.default_rng(config.random_seed)
    
    start_dt = config.start_date
    end_dt = start_dt + timedelta(days=config.observation_days - 1)
    cohort_start_str = start_dt.strftime("%Y-%m-%d")
    cohort_end_str = end_dt.strftime("%Y-%m-%d")

    languages = list(config.language_distribution.keys())
    lang_weights = list(config.language_distribution.values())

    living_arrangements = ["alone", "with_spouse", "with_family"]
    living_weights = [0.35, 0.40, 0.25]

    checkin_frequencies = ["daily", "alternate_days", "weekly_3x"]
    checkin_freq_weights = [0.70, 0.20, 0.10]

    coordinators = [f"COORD_{i+1:03d}" for i in range(config.coordinator_count)]

    rows: List[Dict[str, Any]] = []

    for idx in range(1, config.cohort_size + 1):
        senior_id = f"S{idx:04d}"
        senior_seed = derive_senior_seed(config.random_seed, senior_id)
        senior_rng = np.random.default_rng(senior_seed)

        # Plausible senior age distribution (mean ~73, std 7, bounded [60, 92])
        raw_age = int(np.clip(senior_rng.normal(73.5, 6.8), 60, 92))

        preferred_language = senior_rng.choice(languages, p=lang_weights)
        city_id = senior_rng.choice(config.cities)
        living_arrangement = senior_rng.choice(living_arrangements, p=living_weights)
        coordinator_id = coordinators[(idx - 1) % len(coordinators)]  # balanced assignment
        expected_checkin_frequency = senior_rng.choice(checkin_frequencies, p=checkin_freq_weights)
        
        # Family consent: 65% consented, 35% not consented
        family_consent = bool(senior_rng.random() < 0.65)

        rows.append({
            "senior_id": senior_id,
            "age": raw_age,
            "preferred_language": preferred_language,
            "city_id": city_id,
            "living_arrangement": living_arrangement,
            "coordinator_id": coordinator_id,
            "expected_checkin_frequency": expected_checkin_frequency,
            "family_consent": family_consent,
            "cohort_start_date": cohort_start_str,
            "cohort_end_date": cohort_end_str,
            "synthetic_profile_seed": senior_seed,
        })

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} senior profiles.")
    return df


def save_profiles(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "senior_profiles.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved senior profiles to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    profiles_df = generate_senior_profiles(cfg)
    save_profiles(profiles_df, cfg.raw_data_dir)

