"""Master pipeline execution script for SamarthCare AI Phase 1 dataset generation."""

from datetime import datetime
import logging
from pathlib import Path
import sys
import time

from src.config_loader import load_config
from src.generate_profiles import generate_senior_profiles, save_profiles
from src.generate_baselines import generate_senior_baselines, save_baselines
from src.generate_episodes import allocate_scenarios, generate_decline_episodes, save_episodes
from src.generate_activity import generate_daily_activity, save_daily_activity
from src.generate_vitals import generate_vitals, save_vitals
from src.generate_medications import generate_medication_data, save_medications
from src.generate_checkins import generate_checkin_data, save_checkins_and_annotations
from src.generate_family_observations import generate_family_observations, save_family_observations
from src.derive_daily_master import build_daily_master, save_daily_master
from src.validate_dataset import DatasetValidator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("run_pipeline")


def run_pipeline(config_path: str = "config/dataset_config.yaml") -> bool:
    """Executes the complete generation and derivation pipeline."""
    start_time = time.time()
    logger.info("=" * 70)
    logger.info("Starting SamarthCare AI Phase 1 Dataset Generation Pipeline")
    logger.info("=" * 70)

    # 1. Load and validate configuration
    config = load_config(config_path)
    logger.info(f"Loaded configuration: Cohort={config.cohort_size}, Days={config.observation_days}, Seed={config.random_seed}")

    # Ensure output directories exist
    config.raw_data_dir.mkdir(parents=True, exist_ok=True)
    config.processed_data_dir.mkdir(parents=True, exist_ok=True)
    config.evaluation_data_dir.mkdir(parents=True, exist_ok=True)

    # 2. Profiles
    t0 = time.time()
    profiles_df = generate_senior_profiles(config)
    save_profiles(profiles_df, config.raw_data_dir)
    logger.info(f"Profiles complete in {time.time() - t0:.2f}s ({len(profiles_df)} seniors)")

    # 3. Individual Baselines
    t0 = time.time()
    baselines_df = generate_senior_baselines(profiles_df, config)
    save_baselines(baselines_df, config.raw_data_dir)
    logger.info(f"Baselines complete in {time.time() - t0:.2f}s ({len(baselines_df)} seniors)")

    # 4. Scenarios & Decline Episodes Ground Truth
    t0 = time.time()
    allocations = allocate_scenarios(profiles_df, config)
    episodes_df = generate_decline_episodes(profiles_df, allocations, config)
    save_episodes(episodes_df, config.evaluation_data_dir)
    logger.info(f"Episodes complete in {time.time() - t0:.2f}s ({len(episodes_df)} episodes)")

    # 5. Daily Activity
    t0 = time.time()
    activity_df = generate_daily_activity(profiles_df, baselines_df, allocations, config)
    save_daily_activity(activity_df, config.raw_data_dir)
    logger.info(f"Activity complete in {time.time() - t0:.2f}s ({len(activity_df)} rows)")

    # 6. Vital Signs
    t0 = time.time()
    vitals_df = generate_vitals(profiles_df, baselines_df, allocations, config)
    save_vitals(vitals_df, config.raw_data_dir)
    logger.info(f"Vitals complete in {time.time() - t0:.2f}s ({len(vitals_df)} measurements)")

    # 7. Medications
    t0 = time.time()
    schedules_df, med_events_df = generate_medication_data(profiles_df, baselines_df, allocations, config)
    save_medications(schedules_df, med_events_df, config.raw_data_dir)
    logger.info(f"Medications complete in {time.time() - t0:.2f}s ({len(schedules_df)} schedules, {len(med_events_df)} events)")

    # 8. Check-ins and NLP Annotations
    t0 = time.time()
    checkins_df, annotations_df = generate_checkin_data(profiles_df, baselines_df, allocations, config)
    save_checkins_and_annotations(checkins_df, annotations_df, config.raw_data_dir, config.processed_data_dir)
    logger.info(f"Check-ins complete in {time.time() - t0:.2f}s ({len(checkins_df)} notes, {len(annotations_df)} annotations)")

    # 9. Family Observations
    t0 = time.time()
    family_df = generate_family_observations(profiles_df, allocations, config)
    save_family_observations(family_df, config.raw_data_dir)
    logger.info(f"Family observations complete in {time.time() - t0:.2f}s ({len(family_df)} observations)")

    # 10. Derive Processed Daily Master
    t0 = time.time()
    daily_master_df = build_daily_master(
        profiles_df, activity_df, vitals_df, med_events_df, checkins_df, family_df, config
    )
    save_daily_master(daily_master_df, config.processed_data_dir)
    logger.info(f"Daily master complete in {time.time() - t0:.2f}s ({len(daily_master_df)} rows)")

    # 11. Run Validation
    logger.info("-" * 70)
    logger.info("Executing dataset validation...")
    validator = DatasetValidator(config)
    success, errors, warnings = validator.run_all()

    if not success:
        logger.error(f"Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            logger.error(f"  - {err}")
        return False

    elapsed = time.time() - start_time
    logger.info("=" * 70)
    logger.info(f"SamarthCare AI Phase 1 Pipeline FINISHED SUCCESSFULLY in {elapsed:.2f}s")
    logger.info("=" * 70)
    return True


if __name__ == "__main__":
    success = run_pipeline()
    if not success:
        sys.exit(1)

