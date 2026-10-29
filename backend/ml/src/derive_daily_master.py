"""Derive the daily master consolidated analytical table from source tables."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config

logger = logging.getLogger(__name__)


def build_daily_master(
    profiles_df: pd.DataFrame,
    activity_df: pd.DataFrame,
    vitals_df: pd.DataFrame,
    med_events_df: pd.DataFrame,
    checkins_df: pd.DataFrame,
    family_df: pd.DataFrame,
    config: DatasetConfig
) -> pd.DataFrame:
    """
    Constructs the canonical processed/daily_master.csv.
    Guarantees exactly one record per senior per calendar date in the cohort window.
    Applies documented aggregation rules and preserves source-truth fidelity.
    """
    logger.info("Building processed daily master table...")

    start_dt = config.start_date
    total_days = config.observation_days

    # 1. Create Cartesian product grid of senior_id x date
    senior_ids = profiles_df["senior_id"].unique()
    dates = [(start_dt + timedelta(days=d)).strftime("%Y-%m-%d") for d in range(total_days)]

    grid_records = [{"senior_id": s_id, "date": dt} for s_id in senior_ids for dt in dates]
    master_df = pd.DataFrame(grid_records)

    # 2. Merge daily activity
    # Ensure activity_df only matches on senior_id and date
    act_cols = [
        "senior_id", "date", "steps", "active_minutes", "sleep_hours",
        "appetite_level", "mood_level", "social_contact_count"
    ]
    act_sub = activity_df[act_cols].copy()
    master_df = pd.merge(master_df, act_sub, on=["senior_id", "date"], how="left")

    # 3. Aggregate vitals
    # Filter to valid or questionable measurements (exclude pure device_artifact from analytical averages)
    vitals_clean = vitals_df[vitals_df["quality_status"] != "device_artifact"].copy()
    if not vitals_clean.empty:
        vitals_clean["date"] = vitals_clean["timestamp"].str.slice(0, 10)

        # Pivot/aggregate by type
        # Systolic BP
        sbp = vitals_clean[vitals_clean["measurement_type"] == "blood_pressure_systolic"]
        sbp_agg = sbp.groupby(["senior_id", "date"])["measurement_value"].mean().reset_index()
        sbp_agg.rename(columns={"measurement_value": "bp_systolic_mmhg"}, inplace=True)
        sbp_agg["bp_systolic_mmhg"] = sbp_agg["bp_systolic_mmhg"].round(1)

        # Diastolic BP
        dbp = vitals_clean[vitals_clean["measurement_type"] == "blood_pressure_diastolic"]
        dbp_agg = dbp.groupby(["senior_id", "date"])["measurement_value"].mean().reset_index()
        dbp_agg.rename(columns={"measurement_value": "bp_diastolic_mmhg"}, inplace=True)
        dbp_agg["bp_diastolic_mmhg"] = dbp_agg["bp_diastolic_mmhg"].round(1)

        # Glucose
        glu = vitals_clean[vitals_clean["measurement_type"] == "blood_glucose"]
        glu_agg = glu.groupby(["senior_id", "date"]).agg(
            blood_glucose_mg_dl=("measurement_value", "mean"),
            glucose_context=("measurement_context", "first")
        ).reset_index()
        glu_agg["blood_glucose_mg_dl"] = glu_agg["blood_glucose_mg_dl"].round(1)

        # SpO2
        spo2 = vitals_clean[vitals_clean["measurement_type"] == "spo2"]
        spo2_agg = spo2.groupby(["senior_id", "date"])["measurement_value"].mean().reset_index()
        spo2_agg.rename(columns={"measurement_value": "spo2_percent"}, inplace=True)
        spo2_agg["spo2_percent"] = spo2_agg["spo2_percent"].round(1)

        # Weight
        wt = vitals_clean[vitals_clean["measurement_type"] == "weight"]
        wt_agg = wt.groupby(["senior_id", "date"])["measurement_value"].mean().reset_index()
        wt_agg.rename(columns={"measurement_value": "weight_kg"}, inplace=True)
        wt_agg["weight_kg"] = wt_agg["weight_kg"].round(1)

        # Merge vitals aggregations
        master_df = pd.merge(master_df, sbp_agg, on=["senior_id", "date"], how="left")
        master_df = pd.merge(master_df, dbp_agg, on=["senior_id", "date"], how="left")
        master_df = pd.merge(master_df, glu_agg, on=["senior_id", "date"], how="left")
        master_df = pd.merge(master_df, spo2_agg, on=["senior_id", "date"], how="left")
        master_df = pd.merge(master_df, wt_agg, on=["senior_id", "date"], how="left")
    else:
        master_df["bp_systolic_mmhg"] = np.nan
        master_df["bp_diastolic_mmhg"] = np.nan
        master_df["blood_glucose_mg_dl"] = np.nan
        master_df["glucose_context"] = None
        master_df["spo2_percent"] = np.nan
        master_df["weight_kg"] = np.nan

    # 4. Medication event aggregations
    med_events_df = med_events_df.copy()
    med_events_df["date"] = med_events_df["scheduled_timestamp"].str.slice(0, 10)

    med_agg = med_events_df.groupby(["senior_id", "date"]).agg(
        scheduled_doses=("medication_event_id", "count"),
        taken_doses=("status", lambda s: (s == "taken").sum()),
        missed_doses=("status", lambda s: (s == "missed").sum()),
        unknown_doses=("status", lambda s: (s == "unknown").sum()),
    ).reset_index()

    master_df = pd.merge(master_df, med_agg, on=["senior_id", "date"], how="left")
    master_df["scheduled_doses"] = master_df["scheduled_doses"].fillna(0).astype(int)
    master_df["taken_doses"] = master_df["taken_doses"].fillna(0).astype(int)
    master_df["missed_doses"] = master_df["missed_doses"].fillna(0).astype(int)
    master_df["unknown_doses"] = master_df["unknown_doses"].fillna(0).astype(int)

    # 5. Check-in flags
    if not checkins_df.empty:
        checkins_df = checkins_df.copy()
        checkins_df["date"] = checkins_df["timestamp"].str.slice(0, 10)
        chk_days = checkins_df.groupby(["senior_id", "date"]).size().reset_index(name="chk_cnt")
        chk_days["checkin_completed"] = True
        master_df = pd.merge(master_df, chk_days[["senior_id", "date", "checkin_completed"]], on=["senior_id", "date"], how="left")
        master_df["checkin_completed"] = master_df["checkin_completed"] == True
    else:
        master_df["checkin_completed"] = False

    # 6. Family observation flags
    if not family_df.empty:
        family_df = family_df.copy()
        family_df["date"] = family_df["timestamp"].str.slice(0, 10)
        fam_days = family_df.groupby(["senior_id", "date"]).size().reset_index(name="fam_cnt")
        fam_days["family_observation_available"] = True
        master_df = pd.merge(master_df, fam_days[["senior_id", "date", "family_observation_available"]], on=["senior_id", "date"], how="left")
        master_df["family_observation_available"] = master_df["family_observation_available"] == True
    else:
        master_df["family_observation_available"] = False

    # 7. Quality & completeness metadata indicators
    # missing_vitals_count: count of nulls among [bp_systolic_mmhg, blood_glucose_mg_dl, spo2_percent, weight_kg]
    vital_cols = ["bp_systolic_mmhg", "blood_glucose_mg_dl", "spo2_percent", "weight_kg"]
    master_df["missing_vitals_count"] = master_df[vital_cols].isna().sum(axis=1)

    master_df["missing_activity_flag"] = master_df["steps"].isna() | master_df["active_minutes"].isna()
    master_df["missing_checkin_flag"] = ~master_df["checkin_completed"]

    def compute_completeness(row):
        if row["missing_vitals_count"] == 0 and not row["missing_activity_flag"] and row["checkin_completed"]:
            return "complete"
        elif row["missing_vitals_count"] < 4 or not row["missing_activity_flag"] or row["checkin_completed"]:
            return "partial"
        else:
            return "sparse"

    master_df["data_completeness_flag"] = master_df.apply(compute_completeness, axis=1)

    # Ensure clean column order conforming to Section 8 schema
    ordered_cols = [
        "senior_id",
        "date",
        "steps",
        "active_minutes",
        "sleep_hours",
        "appetite_level",
        "mood_level",
        "social_contact_count",
        "bp_systolic_mmhg",
        "bp_diastolic_mmhg",
        "blood_glucose_mg_dl",
        "glucose_context",
        "spo2_percent",
        "weight_kg",
        "scheduled_doses",
        "taken_doses",
        "missed_doses",
        "unknown_doses",
        "checkin_completed",
        "family_observation_available",
        "missing_vitals_count",
        "missing_activity_flag",
        "missing_checkin_flag",
        "data_completeness_flag",
    ]

    master_df = master_df[ordered_cols]
    logger.info(f"Derived master dataset with {len(master_df)} senior-day records.")
    return master_df


def save_daily_master(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "daily_master.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved daily master to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    act_df = pd.read_csv(cfg.raw_data_dir / "daily_activity.csv")
    vit_df = pd.read_csv(cfg.raw_data_dir / "vitals.csv")
    med_events = pd.read_csv(cfg.raw_data_dir / "medication_events.csv")
    chk_df = pd.read_csv(cfg.raw_data_dir / "checkins.csv")
    fam_df = pd.read_csv(cfg.raw_data_dir / "family_observations.csv")

    dm_df = build_daily_master(p_df, act_df, vit_df, med_events, chk_df, fam_df, cfg)
    save_daily_master(dm_df, cfg.processed_data_dir)
