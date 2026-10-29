"""Feature engineering pipeline for SamarthCare AI Phase 2."""

from datetime import datetime, timedelta
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config
from src.features.nlp_extractor import ClinicalNLPExtractor, summarize_extracted_cues

logger = logging.getLogger("build_daily_features")


def build_daily_features(
    master_df: pd.DataFrame,
    baselines_df: pd.DataFrame,
    profiles_df: pd.DataFrame,
    checkins_df: pd.DataFrame,
    family_df: pd.DataFrame,
    config: DatasetConfig
) -> pd.DataFrame:
    """
    Constructs the causal feature table daily_risk_features.csv.
    Enforces causal rolling windows (no future leakage).
    """
    logger.info("Starting daily risk feature construction...")

    # Index baselines and profiles by senior_id
    base_dict = baselines_df.set_index("senior_id").to_dict(orient="index")
    prof_dict = profiles_df.set_index("senior_id").to_dict(orient="index")

    # Pre-parse checkins NLP cues
    nlp = ClinicalNLPExtractor()
    logger.info("Extracting clinical NLP cues from check-in notes...")
    checkins_df = checkins_df.copy()
    checkins_df["parsed_cues"] = checkins_df["raw_note"].apply(nlp.extract_cues)
    checkins_df["date"] = checkins_df["timestamp"].str.slice(0, 10)

    # Pre-parse family observations
    if not family_df.empty:
        family_df = family_df.copy()
        family_df["date"] = family_df["timestamp"].str.slice(0, 10)
    else:
        family_df = pd.DataFrame(columns=["senior_id", "date", "observation_type", "consent_valid"])

    # Group checkins and family by (senior_id, date)
    checkins_by_key = {}
    for (s_id, dt), grp in checkins_df.groupby(["senior_id", "date"]):
        all_cues = []
        for cue_list in grp["parsed_cues"]:
            all_cues.extend(cue_list)
        checkins_by_key[(s_id, dt)] = all_cues

    family_by_key = {}
    if not family_df.empty:
        for (s_id, dt), grp in family_df[family_df["consent_valid"] == True].groupby(["senior_id", "date"]):
            family_by_key[(s_id, dt)] = grp["observation_type"].tolist()

    # Sort master table by senior_id and date
    df = master_df.sort_values(["senior_id", "date"]).copy()

    feature_rows = []

    # Process senior by senior
    for senior_id, grp in df.groupby("senior_id", sort=False):
        senior_base = base_dict[senior_id]
        senior_prof = prof_dict[senior_id]
        records = grp.to_dict(orient="records")

        # History queues for causal windows
        window_history = []

        for idx, rec in enumerate(records):
            cur_date_str = rec["date"]
            cur_dt = datetime.strptime(cur_date_str, "%Y-%m-%d").date()

            # Append to history
            window_history.append(rec)
            # Retain up to 7 days
            if len(window_history) > 7:
                window_history.pop(0)

            # Causal 3-day history
            hist_3d = window_history[-3:]
            # Causal 7-day history
            hist_7d = window_history

            # 1. Vital Sign Features
            sbp = rec["bp_systolic_mmhg"]
            dbp = rec["bp_diastolic_mmhg"]
            glu = rec["blood_glucose_mg_dl"]
            spo2 = rec["spo2_percent"]
            wt = rec["weight_kg"]

            sbp_dev = sbp - senior_base["baseline_bp_systolic"] if pd.notna(sbp) else np.nan
            dbp_dev = dbp - senior_base["baseline_bp_diastolic"] if pd.notna(dbp) else np.nan
            glu_dev = glu - senior_base["baseline_blood_glucose"] if pd.notna(glu) else np.nan
            spo2_dev = spo2 - senior_base["baseline_spo2"] if pd.notna(spo2) else np.nan

            # Rolling 3-day & 7-day vitals
            sbp_3d_vals = [r["bp_systolic_mmhg"] for r in hist_3d if pd.notna(r["bp_systolic_mmhg"])]
            sbp_3d_mean = np.mean(sbp_3d_vals) if sbp_3d_vals else np.nan

            sbp_7d_vals = [r["bp_systolic_mmhg"] for r in hist_7d if pd.notna(r["bp_systolic_mmhg"])]
            sbp_7d_mean = np.mean(sbp_7d_vals) if sbp_7d_vals else np.nan

            spo2_3d_vals = [r["spo2_percent"] for r in hist_3d if pd.notna(r["spo2_percent"])]
            spo2_3d_mean = np.mean(spo2_3d_vals) if spo2_3d_vals else np.nan

            glu_3d_vals = [r["blood_glucose_mg_dl"] for r in hist_3d if pd.notna(r["blood_glucose_mg_dl"])]
            glu_3d_mean = np.mean(glu_3d_vals) if glu_3d_vals else np.nan

            # Weight change over 7 days
            wt_7d_vals = [r["weight_kg"] for r in hist_7d if pd.notna(r["weight_kg"])]
            if len(wt_7d_vals) >= 2:
                wt_change_7d = wt_7d_vals[-1] - wt_7d_vals[0]
            else:
                wt_change_7d = 0.0

            # Sustained abnormality flags
            bp_sustained_high = bool(
                (pd.notna(sbp_3d_mean) and sbp_3d_mean > 145.0) or
                (pd.notna(sbp_dev) and sbp_dev > 25.0)
            )
            bp_severe_spike = bool(pd.notna(sbp) and sbp >= 170.0)
            bp_hypotension = bool(pd.notna(sbp) and sbp <= 95.0)
            spo2_hypoxia = bool(
                (pd.notna(spo2) and spo2 <= 92.0) or
                (pd.notna(spo2_3d_mean) and spo2_3d_mean <= 92.5)
            )

            # 2. Activity & Sleep Features
            steps = rec["steps"]
            active_min = rec["active_minutes"]
            sleep = rec["sleep_hours"]
            appetite = rec["appetite_level"]
            mood = rec["mood_level"]

            base_steps = max(500, senior_base["baseline_steps"])
            steps_ratio = (steps / base_steps) if pd.notna(steps) else np.nan

            steps_3d_vals = [r["steps"] for r in hist_3d if pd.notna(r["steps"])]
            steps_3d_mean = np.mean(steps_3d_vals) if steps_3d_vals else np.nan
            steps_3d_ratio = (steps_3d_mean / base_steps) if pd.notna(steps_3d_mean) else np.nan

            steps_7d_vals = [r["steps"] for r in hist_7d if pd.notna(r["steps"])]
            steps_7d_mean = np.mean(steps_7d_vals) if steps_7d_vals else np.nan
            steps_7d_ratio = (steps_7d_mean / base_steps) if pd.notna(steps_7d_mean) else np.nan

            steps_sustained_drop = bool(pd.notna(steps_3d_ratio) and steps_3d_ratio < 0.60)
            steps_acute_drop = bool(pd.notna(steps_ratio) and steps_ratio < 0.25)

            sleep_dev = (sleep - senior_base["baseline_sleep_hours"]) if pd.notna(sleep) else np.nan
            sleep_disrupted = bool(
                pd.notna(sleep) and (sleep < 4.5 or abs(sleep_dev) >= 2.5)
            )

            appetite_dev = (appetite - senior_base["baseline_appetite_level"]) if pd.notna(appetite) else np.nan
            appetite_sustained_drop = bool(
                pd.notna(appetite_dev) and appetite_dev <= -1.5
            )

            mood_dev = (mood - senior_base["baseline_mood_level"]) if pd.notna(mood) else np.nan

            # 3. Medication Features (causal 3-day sum)
            sched_3d = sum(r["scheduled_doses"] for r in hist_3d)
            taken_3d = sum(r["taken_doses"] for r in hist_3d)
            missed_3d = sum(r["missed_doses"] for r in hist_3d)
            unknown_3d = sum(r["unknown_doses"] for r in hist_3d)

            adherence_3d = (taken_3d / sched_3d) if sched_3d > 0 else 1.0
            consecutive_miss_flag = bool(missed_3d >= 2)

            # 4. Multilingual Check-in NLP Features (causal 3-day window)
            cues_3d = []
            for r in hist_3d:
                key = (senior_id, r["date"])
                if key in checkins_by_key:
                    cues_3d.extend(checkins_by_key[key])

            nlp_summary = summarize_extracted_cues(cues_3d)

            # 5. Family Observations (causal 7-day window, consent-gated)
            fam_obs_7d = []
            if senior_prof["family_consent"]:
                for r in hist_7d:
                    key = (senior_id, r["date"])
                    if key in family_by_key:
                        fam_obs_7d.extend(family_by_key[key])

            fam_mobility_flag = "mobility_change" in fam_obs_7d
            fam_appetite_flag = "appetite_change" in fam_obs_7d
            fam_routine_flag = ("routine_disruption" in fam_obs_7d) or ("mood_change" in fam_obs_7d)

            # 6. Data Completeness & Quality Flags
            vitals_missing_3d = sum(1 for r in hist_3d if r["missing_vitals_count"] == 4)
            activity_missing_3d = sum(1 for r in hist_3d if r["missing_activity_flag"])
            checkin_missing_3d = sum(1 for r in hist_3d if r["missing_checkin_flag"])

            if activity_missing_3d >= 2 or vitals_missing_3d >= 2:
                data_confidence = "LOW"
            elif activity_missing_3d == 1 or vitals_missing_3d == 1:
                data_confidence = "MEDIUM"
            else:
                data_confidence = "HIGH"

            baseline_confidence = "HIGH"

            feature_rows.append({
                "senior_id": senior_id,
                "date": cur_date_str,
                # Vitals
                "bp_systolic_latest": sbp,
                "bp_systolic_dev_baseline": round(sbp_dev, 1) if pd.notna(sbp_dev) else np.nan,
                "bp_systolic_rolling_3d": round(sbp_3d_mean, 1) if pd.notna(sbp_3d_mean) else np.nan,
                "bp_systolic_rolling_7d": round(sbp_7d_mean, 1) if pd.notna(sbp_7d_mean) else np.nan,
                "bp_sustained_high_flag": bp_sustained_high,
                "bp_severe_spike_flag": bp_severe_spike,
                "bp_hypotension_flag": bp_hypotension,
                "bp_diastolic_latest": dbp,
                "bp_diastolic_dev_baseline": round(dbp_dev, 1) if pd.notna(dbp_dev) else np.nan,
                "spo2_latest": spo2,
                "spo2_dev_baseline": round(spo2_dev, 1) if pd.notna(spo2_dev) else np.nan,
                "spo2_rolling_3d": round(spo2_3d_mean, 1) if pd.notna(spo2_3d_mean) else np.nan,
                "spo2_hypoxia_flag": spo2_hypoxia,
                "blood_glucose_latest": glu,
                "blood_glucose_dev_baseline": round(glu_dev, 1) if pd.notna(glu_dev) else np.nan,
                "blood_glucose_rolling_3d": round(glu_3d_mean, 1) if pd.notna(glu_3d_mean) else np.nan,
                "weight_latest": wt,
                "weight_change_7d": round(wt_change_7d, 1),
                # Activity & Wellbeing
                "steps_latest": steps,
                "steps_ratio_baseline": round(steps_ratio, 2) if pd.notna(steps_ratio) else np.nan,
                "steps_rolling_3d_ratio": round(steps_3d_ratio, 2) if pd.notna(steps_3d_ratio) else np.nan,
                "steps_rolling_7d_ratio": round(steps_7d_ratio, 2) if pd.notna(steps_7d_ratio) else np.nan,
                "steps_sustained_drop_flag": steps_sustained_drop,
                "steps_acute_drop_flag": steps_acute_drop,
                "sleep_hours_latest": sleep,
                "sleep_dev_baseline": round(sleep_dev, 2) if pd.notna(sleep_dev) else np.nan,
                "sleep_disrupted_flag": sleep_disrupted,
                "appetite_latest": appetite,
                "appetite_dev_baseline": round(appetite_dev, 2) if pd.notna(appetite_dev) else np.nan,
                "appetite_sustained_drop_flag": appetite_sustained_drop,
                "mood_latest": mood,
                "mood_dev_baseline": round(mood_dev, 2) if pd.notna(mood_dev) else np.nan,
                # Medication
                "scheduled_doses_3d": sched_3d,
                "taken_doses_3d": taken_3d,
                "missed_doses_3d": missed_3d,
                "unknown_doses_3d": unknown_3d,
                "adherence_rate_3d": round(adherence_3d, 3),
                "consecutive_miss_flag": consecutive_miss_flag,
                # NLP Cues
                "cue_fall_current": nlp_summary["cue_fall_current"],
                "cue_fall_historical": nlp_summary["cue_fall_historical"],
                "cue_weakness_current": nlp_summary["cue_weakness_current"],
                "cue_dizziness_current": nlp_summary["cue_dizziness_current"],
                "cue_pain_current": nlp_summary["cue_pain_current"],
                "cue_low_appetite_current": nlp_summary["cue_low_appetite_current"],
                "cue_poor_sleep_current": nlp_summary["cue_poor_sleep_current"],
                "cue_confusion_current": nlp_summary["cue_confusion_current"],
                "cue_medication_issue_current": nlp_summary["cue_medication_issue_current"],
                "cue_low_mood_current": nlp_summary["cue_low_mood_current"],
                "cue_distinct_concerns_count": nlp_summary["distinct_concerns_count"],
                "cue_negated_count": nlp_summary["cue_negated_count"],
                "cue_uncertain_count": nlp_summary["cue_uncertain_count"],
                "cue_no_new_concern_count": nlp_summary["cue_no_new_concern_count"],
                "cue_recovery_count": nlp_summary["cue_recovery_count"],
                # Family Observations
                "family_mobility_flag": fam_mobility_flag,
                "family_appetite_flag": fam_appetite_flag,
                "family_routine_flag": fam_routine_flag,
                # Quality & Metadata
                "vitals_missing_3d": vitals_missing_3d,
                "activity_missing_3d": activity_missing_3d,
                "checkin_missing_3d": checkin_missing_3d,
                "data_confidence": data_confidence,
                "baseline_confidence": baseline_confidence,
            })

    features_df = pd.DataFrame(feature_rows)
    logger.info(f"Generated {len(features_df)} daily risk feature records.")
    return features_df


def save_daily_features(df: pd.DataFrame, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "daily_risk_features.csv"
    df.to_csv(out_path, index=False)
    logger.info(f"Saved daily risk features to {out_path}")
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    m_df = pd.read_csv(cfg.processed_data_dir / "daily_master.csv")
    b_df = pd.read_csv(cfg.raw_data_dir / "senior_baselines.csv")
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    c_df = pd.read_csv(cfg.raw_data_dir / "checkins.csv")
    f_df = pd.read_csv(cfg.raw_data_dir / "family_observations.csv")

    feat_df = build_daily_features(m_df, b_df, p_df, c_df, f_df, cfg)
    save_daily_features(feat_df, cfg.processed_data_dir)

