"""
Feature Builder for the Vitals Risk Engine (Model 1)
=====================================================
Transforms raw `vitals.csv` + `senior_baselines.csv` into a tabular
feature matrix ready for training and inference.

Pipeline
--------
1. Load & filter vitals  (drop device_artifact, flag questionable)
2. Pivot long → wide     (one row per senior per day)
3. Merge condition flags from baselines
4. For each senior × vital, run the Damped Holt Filter (Stage 1)
5. Build lag / rolling / CUSUM features
6. Build cross-vital syndrome interactions
7. Build target columns  y_{h=1,3,5} for each vital

Output columns (sampled)
------------------------
- <vital>_delta      : Δ from personal baseline (deviation)
- <vital>_lag_{1-7} : lagged deviations
- <vital>_roll7_{mean,std,max,slope}
- <vital>_days_since : days since last valid reading
- <vital>_L, _B, _dB : Holt level, trend, momentum
- <vital>_yhat_h{1,3,5} : Holt point forecasts
- <vital>_cusum      : cumulative sum of baseline exceedances
- <vital>_consec_out : consecutive days outside ±2σ band
- cross_* syndrome interaction flags
- cond_* condition flags
- y_<vital>_h{1,3,5} : target (actual Δ at h days ahead)
"""

from __future__ import annotations

import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys

import numpy as np
import pandas as pd

# Make the import work whether run as __main__ or as a module
_HERE = Path(__file__).resolve().parent
if str(_HERE.parent.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent.parent))   # → backend/ml

from models.vitals.holt_filter import run_holt_over_series

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

# ── Column name maps ───────────────────────────────────────────────────────────

# Mapping from vitals.csv measurement_type → short name used in features
VITAL_SHORT = {
    "blood_pressure_systolic"  : "sbp",
    "blood_pressure_diastolic" : "dbp",
    "heart_rate"               : "hr",
    "spo2"                     : "spo2",
    "weight"                   : "wt",
    "blood_glucose"            : "gluc",
    "temperature"              : "temp",
}

# Baseline median column in senior_baselines.csv → vital short name
BASELINE_COL = {
    "sbp"  : "baseline_sbp_median",
    "dbp"  : "baseline_dbp_median",
    "hr"   : "baseline_hr_median",
    "spo2" : "baseline_spo2_median",
    "wt"   : "baseline_weight_kg_median",
    "gluc" : "baseline_glucose_fasting_median",
    "temp" : "baseline_temp_f_median",
}

# Vitals we actually model (exclude temperature — too sparse)
MODELED_VITALS = ["sbp", "dbp", "hr", "spo2", "wt", "gluc"]

# Forecast horizons (days)
HORIZONS = [1, 3, 5]

# Condition flag keywords searched in physical_conditions string
CONDITION_KEYWORDS = {
    "has_hypertension" : "hypertension",
    "has_chf"          : "heart failure",
    "has_copd"         : "copd",
    "has_diabetes"     : "diabetes",
    "has_ckd"          : "kidney",
    "has_arrhythmia"   : "arrhythmia",
}

# Upper/lower hard thresholds for each vital (objective medical limits)
# Used for CUSUM and breach features
HARD_THRESHOLDS = {
    "sbp"  : {"lo": 90,  "hi": 160},
    "dbp"  : {"lo": 60,  "hi": 100},
    "hr"   : {"lo": 50,  "hi": 110},
    "spo2" : {"lo": 92,  "hi": 100},
    "wt"   : {"lo": None, "hi": None},   # weight: only trend matters
    "gluc" : {"lo": 70,  "hi": 180},
    "temp" : {"lo": 96,  "hi": 100.4},
}


# ── Main builder ───────────────────────────────────────────────────────────────

def build_feature_matrix(
    vitals_path    : Path,
    baselines_path : Path,
    profiles_path  : Optional[Path] = None,
    start_day_idx  : int = 0,
    end_day_idx    : Optional[int] = None,
) -> pd.DataFrame:
    """
    Build the full feature matrix.

    Parameters
    ----------
    vitals_path     : Path to raw/vitals.csv
    baselines_path  : Path to raw/senior_baselines.csv
    profiles_path   : Path to raw/senior_profiles.csv (optional; for age)
    start_day_idx   : First day index to include (0 = study day 0)
    end_day_idx     : Last day index (inclusive). None = all days.

    Returns
    -------
    DataFrame indexed by (senior_id, date) with all features + targets.
    """
    vitals_df    = _load_vitals(vitals_path)
    baselines_df = _load_baselines(baselines_path)
    profiles_df  = _load_profiles(profiles_path) if profiles_path else None

    # Pivot long → wide (senior × date × vital)
    daily_wide = _pivot_to_daily(vitals_df)

    # Day-index: count from earliest date in the dataset
    study_start = daily_wide["date"].min()
    daily_wide["day_idx"] = (daily_wide["date"] - study_start).dt.days

    # Filter to requested day window
    if end_day_idx is not None:
        daily_wide = daily_wide[daily_wide["day_idx"] <= end_day_idx]
    daily_wide = daily_wide[daily_wide["day_idx"] >= start_day_idx]

    # Attach baselines
    daily_wide = daily_wide.merge(baselines_df, on="senior_id", how="left")

    # Attach age from profiles if available
    if profiles_df is not None:
        prof_cols = [c for c in ["senior_id", "age", "gender"] if c in profiles_df.columns]
        daily_wide = daily_wide.merge(
            profiles_df[prof_cols],
            on="senior_id", how="left"
        )
    else:
        daily_wide["age"] = np.nan
        daily_wide["gender"] = "unknown"

    # Baseline-centre each vital: delta = observed - personal median
    for vit in MODELED_VITALS:
        raw_col  = vit
        base_col = BASELINE_COL[vit]
        if raw_col in daily_wide.columns and base_col in daily_wide.columns:
            daily_wide[f"{vit}_delta"] = daily_wide[raw_col] - daily_wide[base_col]
        else:
            daily_wide[f"{vit}_delta"] = np.nan

    # Condition flags
    for flag, keyword in CONDITION_KEYWORDS.items():
        if "physical_conditions" in daily_wide.columns:
            daily_wide[flag] = (
                daily_wide["physical_conditions"]
                .fillna("")
                .str.lower()
                .str.contains(keyword)
                .astype(float)
            )
        else:
            daily_wide[flag] = 0.0

    # Per-senior feature engineering
    all_rows = []
    for senior_id, grp in daily_wide.sort_values("date").groupby("senior_id"):
        rows = _engineer_senior_features(grp.copy())
        all_rows.append(rows)

    result = pd.concat(all_rows, ignore_index=True)
    return result


# ── Private helpers ────────────────────────────────────────────────────────────

def _load_vitals(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["timestamp"])
    # Map to short vital names
    df["vit"] = df["measurement_type"].map(VITAL_SHORT)
    df = df[df["vit"].notna()].copy()
    # Drop hard device artifacts; keep questionable (downweight later)
    df = df[df["quality_status"] != "device_artifact"].copy()
    df["date"] = df["timestamp"].dt.normalize()
    return df


def _load_baselines(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    keep_cols = ["senior_id", "physical_conditions", "vitals_baseline_confidence",
                 "baseline_window_days"] + list(BASELINE_COL.values())
    keep_cols = [c for c in keep_cols if c in df.columns]
    return df[keep_cols].copy()


def _load_profiles(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    # senior_profiles.csv has age and gender columns
    keep = [c for c in ["senior_id", "age", "gender"] if c in df.columns]
    return df[keep].copy()


def _pivot_to_daily(vitals_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate intra-day readings → one representative value per (senior, date, vital).
    Fast vectorized groupby.
    """
    if vitals_df.empty:
        return pd.DataFrame()

    vdf = vitals_df.copy()
    vdf["is_quest"] = (vdf["quality_status"] == "questionable").astype(int)
    agg_df = vdf.groupby(["senior_id", "date", "vit"], as_index=False).agg(
        val=("measurement_value", "median"),
        q_flag=("is_quest", "min")
    )

    val_pivot = agg_df.pivot(index=["senior_id", "date"], columns="vit", values="val")
    q_pivot = agg_df.pivot(index=["senior_id", "date"], columns="vit", values="q_flag")
    q_pivot.columns = [f"{c}_questionable" for c in q_pivot.columns]

    wide = pd.concat([val_pivot, q_pivot], axis=1).reset_index()
    return wide


def _engineer_senior_features(grp: pd.DataFrame) -> pd.DataFrame:
    """
    Build all time-series features for a single senior.
    Input `grp` is already sorted by date.
    """
    grp = grp.sort_values("date").reset_index(drop=True)
    n   = len(grp)

    for vit in MODELED_VITALS:
        delta_col = f"{vit}_delta"
        if delta_col not in grp.columns:
            grp[delta_col] = np.nan

        raw_vals  = grp[delta_col].values.astype(float)   # shape (n,)

        # ── 1. Lag features (baseline-centred) ────────────────────────────────
        for lag in [1, 2, 3, 7]:
            grp[f"{vit}_lag{lag}"] = grp[delta_col].shift(lag)

        # ── 2. Rolling statistics (past 7 days, no lookahead) ─────────────────
        grp[f"{vit}_roll7_mean"]  = grp[delta_col].shift(1).rolling(7, min_periods=1).mean()
        grp[f"{vit}_roll7_std"]   = grp[delta_col].shift(1).rolling(7, min_periods=2).std().fillna(0)
        grp[f"{vit}_roll7_max"]   = grp[delta_col].shift(1).rolling(7, min_periods=1).max()
        grp[f"{vit}_roll3_mean"]  = grp[delta_col].shift(1).rolling(3, min_periods=1).mean()

        # 7-day linear slope
        grp[f"{vit}_roll7_slope"] = (grp[delta_col].shift(1) - grp[delta_col].shift(7)) / 6.0

        # ── 3. Days since last valid reading ──────────────────────────────────
        grp[f"{vit}_days_since"] = _days_since_last_obs(grp[delta_col], grp["date"])

        # ── 4. Stage 1 — Damped Holt Filter ───────────────────────────────────
        delta_t_arr = grp[f"{vit}_days_since"].fillna(1.0).clip(1, 30).values
        holt_feats  = run_holt_over_series(
            delta_y_series = list(np.nan_to_num(raw_vals, nan=0.0)),
            delta_t_series = list(delta_t_arr),
        )
        holt_df = pd.DataFrame(holt_feats)
        for col in ["L_t", "B_t", "dB_t", "yhat_h1", "yhat_h3", "yhat_h5"]:
            grp[f"{vit}_{col}"] = holt_df[col].values

        # ── 5. CUSUM — cumulative baseline exceedance ──────────────────────────
        thresh = HARD_THRESHOLDS.get(vit, {})
        hi     = thresh.get("hi")
        lo     = thresh.get("lo")

        # Exceedance = how far above/below the hard threshold (zero if within)
        exceedance = np.zeros(n)
        if hi is not None:
            # We work in raw space: delta + baseline ≈ raw value
            # Since baseline is person-specific, we use delta directly:
            # exceedance above hi = delta - (hi - baseline)
            # But baseline varies by row; use the raw reading col if available
            raw_vit_col = vit
            if raw_vit_col in grp.columns:
                raw_vals_orig = grp[raw_vit_col].values.astype(float)
                if hi is not None:
                    exceedance += np.where(
                        np.isfinite(raw_vals_orig),
                        np.maximum(raw_vals_orig - hi, 0),
                        0,
                    )
                if lo is not None:
                    exceedance += np.where(
                        np.isfinite(raw_vals_orig),
                        np.maximum(lo - raw_vals_orig, 0),
                        0,
                    )

        # Clamp CUSUM to [0, 200]; reset when exceedance == 0 for 3+ days
        cusum = np.zeros(n)
        for i in range(1, n):
            new_val = cusum[i - 1] + exceedance[i]
            # Decay: if no exceedance, reduce by 5 (slow reset)
            if exceedance[i] == 0:
                new_val = max(cusum[i - 1] - 5.0, 0)
            cusum[i] = min(new_val, 200.0)
        grp[f"{vit}_cusum"] = cusum

        # ── 6. Consecutive days outside ±2σ band ──────────────────────────────
        # Use rolling std as the band width; mark exceedance in delta space
        roll_std = pd.Series(raw_vals).rolling(14, min_periods=5).std().fillna(2.0).values
        out_band = np.where(
            np.isfinite(raw_vals),
            (np.abs(raw_vals) > 2 * roll_std).astype(float),
            0,
        )
        consec = np.zeros(n)
        for i in range(1, n):
            if out_band[i]:
                consec[i] = consec[i - 1] + 1
            # else stays 0
        grp[f"{vit}_consec_out"] = consec

    # ── 7. Cross-vital syndrome interactions ──────────────────────────────────
    # CHF Triad: rising SBP + rising weight + low SpO2
    if all(c in grp.columns for c in ["sbp_delta", "wt_delta", "spo2_delta"]):
        grp["cross_chf_triad"] = (
            (grp["sbp_B_t"] > 0.5).astype(float)
            * (grp["wt_B_t"] > 0.05).astype(float)
            * (grp["spo2_delta"] < -2).astype(float)
        )
    else:
        grp["cross_chf_triad"] = 0.0

    # Postural/orthostatic drop: SBP dipping while HR rising
    if all(c in grp.columns for c in ["sbp_delta", "hr_delta"]):
        grp["cross_orthostatic"] = (
            (grp["sbp_delta"] < -10).astype(float)
            * (grp["hr_delta"] > 10).astype(float)
        )
    else:
        grp["cross_orthostatic"] = 0.0

    # UTI triad: rising temp + rising HR + rising glucose
    if all(c in grp.columns for c in ["temp_delta", "hr_delta", "gluc_delta"]):
        grp["cross_uti_triad"] = (
            (grp.get("temp_delta", pd.Series(0, index=grp.index)) > 1.0).astype(float)
            * (grp["hr_delta"] > 8).astype(float)
            * (grp["gluc_delta"] > 10).astype(float)
        )
    else:
        grp["cross_uti_triad"] = 0.0

    # SpO2-HR mismatch: hypoxia without tachycardia (potential SpO2 artifact)
    if all(c in grp.columns for c in ["spo2_delta", "hr_delta"]):
        grp["cross_spo2_hr_mismatch"] = (
            (grp["spo2_delta"] < -3).astype(float)
            * (grp["hr_delta"].abs() < 3).astype(float)
        )
    else:
        grp["cross_spo2_hr_mismatch"] = 0.0

    # ── 8. Build targets y_{vital}_{h} ────────────────────────────────────────
    for vit in MODELED_VITALS:
        delta_col = f"{vit}_delta"
        for h in HORIZONS:
            grp[f"y_{vit}_h{h}"] = grp[delta_col].shift(-h)

    return grp


def _rolling_slope(series: pd.Series, window: int = 7) -> pd.Series:
    """Fast linear slope over rolling window using closed-form analytical covariance/variance."""
    def slope_fn(y_vals: np.ndarray) -> float:
        valid = ~np.isnan(y_vals)
        n = valid.sum()
        if n < 3:
            return np.nan
        x = np.arange(len(y_vals), dtype=float)[valid]
        y = y_vals[valid]
        x_m = x.mean()
        denom = np.sum((x - x_m) ** 2)
        if denom < 1e-9:
            return 0.0
        return float(np.sum((x - x_m) * (y - y.mean())) / denom)

    return series.shift(1).rolling(window, min_periods=3).apply(slope_fn, raw=True)


def _days_since_last_obs(series: pd.Series, dates: pd.Series) -> pd.Series:
    """
    For each row, compute how many days have passed since the last non-NaN reading.
    Returns 1 for consecutive daily readings (the common case).
    """
    result = []
    last_date = None
    for i, (val, dt) in enumerate(zip(series, dates)):
        if pd.isna(val):
            # No reading today — gap extends
            gap = (dt - last_date).days if last_date is not None else 1
        else:
            gap = (dt - last_date).days if last_date is not None else 1
            last_date = dt
        result.append(float(min(gap, 30)))  # cap at 30 days
    return pd.Series(result, index=series.index)


# ── Feature column catalogue ───────────────────────────────────────────────────

def get_feature_cols(vitals: List[str] = MODELED_VITALS) -> List[str]:
    """Return the full list of feature column names (no targets, no meta)."""
    cols = []
    for vit in vitals:
        cols += [
            f"{vit}_delta",
            f"{vit}_lag1", f"{vit}_lag2", f"{vit}_lag3", f"{vit}_lag7",
            f"{vit}_roll7_mean", f"{vit}_roll7_std",
            f"{vit}_roll7_max", f"{vit}_roll3_mean", f"{vit}_roll7_slope",
            f"{vit}_days_since",
            f"{vit}_L_t", f"{vit}_B_t", f"{vit}_dB_t",
            f"{vit}_yhat_h1", f"{vit}_yhat_h3", f"{vit}_yhat_h5",
            f"{vit}_cusum", f"{vit}_consec_out",
        ]
    cols += [
        "cross_chf_triad", "cross_orthostatic", "cross_uti_triad", "cross_spo2_hr_mismatch",
    ]
    cols += list(CONDITION_KEYWORDS.keys())
    cols += ["age"]
    return cols


def get_target_cols(vitals: List[str] = MODELED_VITALS) -> List[str]:
    return [f"y_{vit}_h{h}" for vit in vitals for h in HORIZONS]


def get_meta_cols() -> List[str]:
    return ["senior_id", "date", "day_idx"]
