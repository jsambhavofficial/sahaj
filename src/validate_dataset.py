"""Comprehensive dataset validation suite for SamarthCare AI Phase 1."""

import argparse
from datetime import datetime
import logging
from pathlib import Path
import sys
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("validate_dataset")


class DatasetValidator:
    """Validates structural, referential, temporal, and clinical invariants of generated data."""

    def __init__(self, config: DatasetConfig):
        self.config = config
        self.errors: List[str] = []
        self.warnings: List[str] = []

        self.profiles: pd.DataFrame = pd.DataFrame()
        self.baselines: pd.DataFrame = pd.DataFrame()
        self.episodes: pd.DataFrame = pd.DataFrame()
        self.activity: pd.DataFrame = pd.DataFrame()
        self.vitals: pd.DataFrame = pd.DataFrame()
        self.med_schedules: pd.DataFrame = pd.DataFrame()
        self.med_events: pd.DataFrame = pd.DataFrame()
        self.checkins: pd.DataFrame = pd.DataFrame()
        self.annotations: pd.DataFrame = pd.DataFrame()
        self.family: pd.DataFrame = pd.DataFrame()
        self.daily_master: pd.DataFrame = pd.DataFrame()

    def load_tables(self) -> bool:
        """Loads all generated CSV datasets."""
        table_paths = {
            "profiles": self.config.raw_data_dir / "senior_profiles.csv",
            "baselines": self.config.raw_data_dir / "senior_baselines.csv",
            "episodes": self.config.evaluation_data_dir / "decline_episodes.csv",
            "activity": self.config.raw_data_dir / "daily_activity.csv",
            "vitals": self.config.raw_data_dir / "vitals.csv",
            "med_schedules": self.config.raw_data_dir / "medication_schedules.csv",
            "med_events": self.config.raw_data_dir / "medication_events.csv",
            "checkins": self.config.raw_data_dir / "checkins.csv",
            "annotations": self.config.processed_data_dir / "nlp_annotations.csv",
            "family": self.config.raw_data_dir / "family_observations.csv",
            "daily_master": self.config.processed_data_dir / "daily_master.csv",
        }

        missing_files = []
        for name, path in table_paths.items():
            if not path.exists():
                missing_files.append(str(path))
            else:
                setattr(self, name, pd.read_csv(path))

        if missing_files:
            self.errors.append(f"Missing required dataset files: {', '.join(missing_files)}")
            return False
        return True

    def validate_cohort_and_dates(self):
        """Validates cohort size, unique seniors, and date range in master table."""
        n_profiles = len(self.profiles)
        n_unique_seniors = self.profiles["senior_id"].nunique()
        if n_profiles < self.config.cohort_size:
            self.errors.append(f"Cohort size in profiles ({n_profiles}) is less than expected ({self.config.cohort_size}).")
        if n_profiles != n_unique_seniors:
            self.errors.append(f"Non-unique senior IDs detected in senior_profiles.csv: {n_profiles} rows vs {n_unique_seniors} unique.")

        # Master table count and duplicate checks
        expected_rows = self.config.cohort_size * self.config.observation_days
        if len(self.daily_master) != expected_rows:
            self.errors.append(f"daily_master.csv has {len(self.daily_master)} rows, expected exactly {expected_rows}.")

        dup_master = self.daily_master.duplicated(subset=["senior_id", "date"]).sum()
        if dup_master > 0:
            self.errors.append(f"Found {dup_master} duplicate senior_id + date pairs in daily_master.csv.")

        # Check exactly 90 days per senior
        dates_per_senior = self.daily_master.groupby("senior_id")["date"].nunique()
        bad_dates_count = (dates_per_senior != self.config.observation_days).sum()
        if bad_dates_count > 0:
            self.errors.append(f"{bad_dates_count} seniors do not have exactly {self.config.observation_days} dates.")

    def validate_referential_integrity(self):
        """Validates foreign key relationships across all tables."""
        valid_seniors = set(self.profiles["senior_id"].unique())

        tables_with_senior_id = {
            "senior_baselines": self.baselines,
            "decline_episodes": self.episodes,
            "daily_activity": self.activity,
            "vitals": self.vitals,
            "medication_schedules": self.med_schedules,
            "medication_events": self.med_events,
            "checkins": self.checkins,
            "family_observations": self.family,
            "daily_master": self.daily_master,
        }

        for tbl_name, df in tables_with_senior_id.items():
            if df.empty:
                continue
            unmatched = set(df["senior_id"].unique()) - valid_seniors
            if unmatched:
                self.errors.append(f"Table {tbl_name} contains unknown senior_ids: {list(unmatched)[:5]}")

        # Check medication_id FK in medication_events
        valid_meds = set(self.med_schedules["medication_id"].unique())
        unmatched_meds = set(self.med_events["medication_id"].unique()) - valid_meds
        if unmatched_meds:
            self.errors.append(f"medication_events contains unknown medication_ids: {list(unmatched_meds)[:5]}")

        # Check checkin_id FK in nlp_annotations
        valid_checkins = set(self.checkins["checkin_id"].unique())
        unmatched_checkins = set(self.annotations["checkin_id"].unique()) - valid_checkins
        if unmatched_checkins:
            self.errors.append(f"nlp_annotations contains unknown checkin_ids: {list(unmatched_checkins)[:5]}")

    def validate_temporal_bounds(self):
        """Verifies all observation dates and timestamps fall within the configured window."""
        start_str = self.config.observation_start_date
        start_date = self.config.start_date
        end_date = start_date + pd.Timedelta(days=self.config.observation_days - 1)
        end_str = end_date.strftime("%Y-%m-%d")

        # Master dates
        min_date = self.daily_master["date"].min()
        max_date = self.daily_master["date"].max()
        if min_date != start_str or max_date != end_str:
            self.errors.append(f"daily_master date range [{min_date}, {max_date}] != expected [{start_str}, {end_str}].")

        # Vitals timestamps
        if not self.vitals.empty:
            v_dates = self.vitals["timestamp"].str.slice(0, 10)
            if v_dates.min() < start_str or v_dates.max() > end_str:
                self.errors.append(f"Vitals timestamp range outside cohort window: [{v_dates.min()}, {v_dates.max()}].")

        # Checkins timestamps
        if not self.checkins.empty:
            c_dates = self.checkins["timestamp"].str.slice(0, 10)
            if c_dates.min() < start_str or c_dates.max() > end_str:
                self.errors.append(f"Checkins timestamp range outside cohort window: [{c_dates.min()}, {c_dates.max()}].")

        # Episode dates
        for _, ep in self.episodes.iterrows():
            if ep["onset_date"] > ep["end_date"]:
                self.errors.append(f"Episode {ep['episode_id']} has onset {ep['onset_date']} > end {ep['end_date']}.")
            if ep["onset_date"] < start_str or ep["end_date"] > end_str:
                self.errors.append(f"Episode {ep['episode_id']} dates [{ep['onset_date']}, {ep['end_date']}] out of window.")

    def validate_family_consent(self):
        """Validates that family observations are only present when senior gave family_consent."""
        consent_map = dict(zip(self.profiles["senior_id"], self.profiles["family_consent"]))
        for s_id in self.family["senior_id"].unique():
            if not consent_map.get(s_id, False):
                self.errors.append(f"Senior {s_id} has family observations but family_consent is False!")

        if not self.family.empty:
            invalid_consent_flags = (~self.family["consent_valid"]).sum()
            if invalid_consent_flags > 0:
                self.errors.append(f"Found {invalid_consent_flags} family observations where consent_valid is False.")

    def validate_scenario_distribution(self):
        """Verifies scenario allocation proportions match config within documented limits."""
        # Join profiles with episodes
        ep_types = self.episodes.set_index("senior_id")["episode_type"]
        type_counts = ep_types.value_counts(normalize=True)

        # Expected: stable ~50%, intermittent ~20%, gradual + recovery ~20%, acute ~10%
        stable_pct = type_counts.get("stable_baseline", 0.0)
        if not (0.45 <= stable_pct <= 0.55):
            self.errors.append(f"Stable scenario proportion {stable_pct:.2f} deviated from expected 0.50.")

        gradual_pct = type_counts.get("gradual_decline", 0.0) + type_counts.get("recovery_trajectory", 0.0)
        if not (0.15 <= gradual_pct <= 0.25):
            self.errors.append(f"Gradual decline proportion {gradual_pct:.2f} deviated from expected 0.20.")

        intermittent_pct = type_counts.get("intermittent_concern", 0.0)
        if not (0.15 <= intermittent_pct <= 0.25):
            self.errors.append(f"Intermittent concern proportion {intermittent_pct:.2f} deviated from expected 0.20.")

        acute_pct = type_counts.get("acute_event", 0.0)
        if not (0.05 <= acute_pct <= 0.15):
            self.errors.append(f"Acute scenario proportion {acute_pct:.2f} deviated from expected 0.10.")

    def validate_nlp_annotations(self):
        """Validates NLP annotation integrity, negation handling, and vocabulary."""
        valid_cues = {
            "weakness", "pain", "low_appetite", "poor_sleep", "low_mood",
            "loneliness", "confusion", "dizziness", "fall", "medication_issue", "no_new_concern"
        }
        unknown_cues = set(self.annotations["cue_type"].unique()) - valid_cues
        if unknown_cues:
            self.errors.append(f"Unknown cue_types in nlp_annotations: {unknown_cues}")

        valid_values = {"present", "absent", "uncertain"}
        unknown_vals = set(self.annotations["cue_value"].unique()) - valid_values
        if unknown_vals:
            self.errors.append(f"Unknown cue_values in nlp_annotations: {unknown_vals}")

        # Check that negations are present in the dataset
        negated_count = (self.annotations["negation_status"] == True).sum()
        if negated_count == 0:
            self.errors.append("No negated annotations found in nlp_annotations.csv.")

        # Check historical contexts are present
        historical_count = (self.annotations["temporal_context"] == "historical").sum()
        if historical_count == 0:
            self.errors.append("No historical annotations found in nlp_annotations.csv.")

    def validate_target_leakage(self):
        """Confirms that model input files contain no future ground-truth labels."""
        forbidden_input_cols = {"planted", "severity_category", "expected_escalation", "scenario_id", "scenario_description"}
        input_tables = {
            "daily_master": self.daily_master,
            "vitals": self.vitals,
            "daily_activity": self.activity,
            "checkins": self.checkins,
            "medication_events": self.med_events,
            "family_observations": self.family,
            "senior_profiles": self.profiles,
            "senior_baselines": self.baselines,
        }

        for name, df in input_tables.items():
            leaked = set(df.columns) & forbidden_input_cols
            if leaked:
                self.errors.append(f"CRITICAL TARGET LEAKAGE: Table {name} contains ground-truth labels: {leaked}")

    def validate_trajectory_diversity(self):
        """Verifies individual diversity and checks for accidental identical senior trajectories."""
        # Group by senior and hash or summarize steps trajectory
        steps_matrix = self.daily_master.pivot(index="senior_id", columns="date", values="steps")
        # Check no two seniors have identical step series
        n_seniors = len(steps_matrix)
        unique_trajectories = steps_matrix.drop_duplicates().shape[0]
        if unique_trajectories != n_seniors:
            self.errors.append(f"Duplicate step trajectories detected: {unique_trajectories} unique vs {n_seniors} seniors.")

    def run_all(self) -> Tuple[bool, List[str], List[str]]:
        """Runs all validations and returns status, errors, and warnings."""
        if not self.load_tables():
            return False, self.errors, self.warnings

        self.validate_cohort_and_dates()
        self.validate_referential_integrity()
        self.validate_temporal_bounds()
        self.validate_family_consent()
        self.validate_scenario_distribution()
        self.validate_nlp_annotations()
        self.validate_target_leakage()
        self.validate_trajectory_diversity()

        success = len(self.errors) == 0
        return success, self.errors, self.warnings


def main():
    cfg = load_config()
    validator = DatasetValidator(cfg)
    success, errors, warnings = validator.run_all()

    if warnings:
        for w in warnings:
            logger.warning(w)

    if not success:
        logger.error(f"Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            logger.error(f"  - {err}")
        sys.exit(1)
    else:
        logger.info("Dataset validation PASSED successfully! All invariants satisfied.")
        sys.exit(0)


if __name__ == "__main__":
    main()

