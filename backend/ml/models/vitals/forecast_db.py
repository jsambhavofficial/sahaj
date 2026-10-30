"""
Database-Backed Vitals Forecast Engine (Model 1)
=================================================
Reads vitals, personal baselines, conditions, and senior profiles directly from
PostgreSQL (via SQLAlchemy Session), runs Stage 1 (Damped Holt Filter) + Stage 2
(LightGBM Quantile Regression across horizons h=1,3,5 and quantiles q10,q50,q90),
computes slopes and R_vitals risk score, and writes the forecast outputs back to
the `vital_forecasts` table in the database.

Supports two execution modes:
1. Single individual at a time: `forecast_senior(db, senior_id, on_date)`
2. Full cohort at a time:       `forecast_cohort(db, on_date, senior_ids=None)`
"""

from __future__ import annotations

import functools
import logging
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

_HERE = Path(__file__).resolve().parent
_ML_ROOT = _HERE.parent.parent
if str(_ML_ROOT) not in sys.path:
    sys.path.insert(0, str(_ML_ROOT))

from models.vitals.feature_builder import (
    BASELINE_COL,
    CONDITION_KEYWORDS,
    HARD_THRESHOLDS,
    HORIZONS,
    MODELED_VITALS,
    VITAL_SHORT,
    _engineer_senior_features,
    _pivot_to_daily,
    get_feature_cols,
)

log = logging.getLogger(__name__)

ARTIFACTS_DIR = _HERE / "artifacts"
QUANTILES = [0.10, 0.50, 0.90]

BREACH_THRESHOLDS = {
    "sbp": {"hi": 160.0, "lo": 90.0},
    "dbp": {"hi": 100.0, "lo": 60.0},
    "hr": {"hi": 110.0, "lo": 50.0},
    "spo2": {"lo": 92.0},
    "gluc": {"hi": 200.0, "lo": 70.0},
}

DEFAULT_PHYSIOLOGICAL_BASELINES = {
    "sbp": 125.0,
    "dbp": 78.0,
    "hr": 74.0,
    "spo2": 97.0,
    "wt": 65.0,
    "gluc": 105.0,
    "temp": 98.4,
}

VITAL_WEIGHTS = {
    "sbp": 1.4,
    "dbp": 0.8,
    "hr": 0.9,
    "spo2": 1.6,
    "wt": 0.6,
    "gluc": 1.1,
}

TYPICAL_RANGE = {
    "sbp": 40.0,
    "dbp": 25.0,
    "hr": 40.0,
    "spo2": 8.0,
    "wt": 10.0,
    "gluc": 80.0,
}


@functools.lru_cache(maxsize=128)
def load_artifact(vit: str, h: int, q: float) -> Optional[Dict[str, Any]]:
    """Load a trained LightGBM quantile regression artifact if available."""
    tag = f"{vit}_h{h}_q{int(round(q * 100)):02d}"
    path = ARTIFACTS_DIR / f"{tag}.joblib"
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception as exc:
        log.debug("Falling back to Stage 1 Holt filter for %s (%s)", tag, exc)
        return None


def _predict_with_artifact(artifact: Dict[str, Any], X: pd.DataFrame) -> np.ndarray:
    """Run LightGBM artifact prediction with training median imputation."""
    feat_cols = artifact["feat_cols"]
    col_medians = artifact["col_medians"]
    model = artifact["model"]

    X_sub = pd.DataFrame(index=X.index)
    for col in feat_cols:
        if col in X.columns:
            X_sub[col] = pd.to_numeric(X[col], errors="coerce")
        else:
            X_sub[col] = np.nan
        med = col_medians.get(col, 0.0)
        X_sub[col] = X_sub[col].fillna(0.0 if pd.isna(med) else float(med))

    return np.asarray(model.predict(X_sub[feat_cols]), dtype=float)


def _predict_vital_horizon_quantile(
    df: pd.DataFrame,
    vit: str,
    h: int,
    q: float,
) -> tuple[np.ndarray, str]:
    """
    Predict baseline-centred delta for (vital, horizon, quantile) across rows of `df`.
    Uses Stage 2 LightGBM artifact when available, blended with Stage 1 DampedHoltFilter
    when history is sparse (e.g. a single newly entered reading), and falls back cleanly
    to Stage 1 DampedHoltFilter if LightGBM is not installed in the runtime environment.
    """
    holt_col = f"{vit}_yhat_h{h}"
    holt_pred = (
        pd.to_numeric(df[holt_col], errors="coerce").fillna(0.0).values.astype(float)
        if holt_col in df.columns
        else np.zeros(len(df), dtype=float)
    )

    std_col = f"{vit}_roll7_std"
    roll_std = (
        pd.to_numeric(df[std_col], errors="coerce").fillna(2.0).replace(0.0, 2.0).values.astype(float)
        if std_col in df.columns
        else np.full(len(df), 2.0, dtype=float)
    )

    artifact = load_artifact(vit, h, q)
    if artifact is not None:
        try:
            lgb_pred = _predict_with_artifact(artifact, df)
            # If a senior only has today's reading (lag1 is NaN) and today's reading
            # has a strong acute deviation, blend with Stage 1 Holt filter so single-reading
            # acute spikes entered from the frontend are not diluted by median lag imputation.
            lag1_col = f"{vit}_lag1"
            if lag1_col in df.columns:
                no_history = df[lag1_col].isna().values
                if np.any(no_history):
                    if abs(q - 0.50) < 1e-6:
                        holt_q = holt_pred
                    elif q < 0.50:
                        holt_q = holt_pred - 1.28 * roll_std * np.sqrt(h)
                    else:
                        holt_q = holt_pred + 1.28 * roll_std * np.sqrt(h)
                    lgb_pred = np.where(no_history, 0.4 * lgb_pred + 0.6 * holt_q, lgb_pred)
            return lgb_pred, "vitals_lgbm_holt_v1"
        except Exception as exc:
            log.debug("LightGBM predict failed for %s h=%s q=%s: %s", vit, h, q, exc)

    # Stage 1 Damped Holt Filter fallback
    if abs(q - 0.50) < 1e-6:
        return holt_pred, "vitals_holt_v1"
    elif q < 0.50:
        return holt_pred - 1.28 * roll_std * np.sqrt(h), "vitals_holt_v1"
    else:
        return holt_pred + 1.28 * roll_std * np.sqrt(h), "vitals_holt_v1"


def _load_db_frames(
    db: Session,
    senior_ids: Optional[List[str]],
    on_date: date,
    lookback_days: int = 45,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[str]]:
    """
    Fetch seniors, baselines, conditions, and vitals from PostgreSQL / SQLAlchemy DB
    and format them into DataFrames compatible with `feature_builder.py`.
    """
    from app.modules.seniors.models import Senior, SeniorBaseline, SeniorCondition
    from app.modules.vitals.models import Vital

    # 1. Seniors (profiles)
    senior_q = select(Senior.senior_id, Senior.age, Senior.gender)
    if senior_ids is not None:
        if not senior_ids:
            return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), []
        senior_q = senior_q.where(Senior.senior_id.in_(senior_ids))
    else:
        senior_q = senior_q.where(Senior.is_active.is_(True))

    senior_rows = db.execute(senior_q).all()
    target_ids = [r.senior_id for r in senior_rows]
    if not target_ids and senior_ids:
        target_ids = list(senior_ids)

    if not target_ids:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), []

    profiles_df = pd.DataFrame(
        [
            {
                "senior_id": r.senior_id,
                "age": float(r.age) if r.age is not None else 72.0,
                "gender": r.gender or "unknown",
            }
            for r in senior_rows
        ]
    )
    if profiles_df.empty:
        profiles_df = pd.DataFrame(
            [{"senior_id": sid, "age": 72.0, "gender": "unknown"} for sid in target_ids]
        )

    # 2. Conditions -> physical_conditions string per senior
    cond_rows = db.execute(
        select(SeniorCondition.senior_id, SeniorCondition.condition).where(
            SeniorCondition.senior_id.in_(target_ids),
            SeniorCondition.category == "physical",
        )
    ).all()
    cond_map: Dict[str, List[str]] = {}
    for sid, cond in cond_rows:
        if cond:
            cond_map.setdefault(sid, []).append(str(cond))

    # 3. Baselines
    base_rows = db.execute(
        select(SeniorBaseline).where(SeniorBaseline.senior_id.in_(target_ids))
    ).scalars().all()
    base_by_id = {b.senior_id: b for b in base_rows}

    baselines_records = []
    for sid in target_ids:
        b = base_by_id.get(sid)
        baselines_records.append(
            {
                "senior_id": sid,
                "physical_conditions": ", ".join(cond_map.get(sid, [])),
                "vitals_baseline_confidence": b.vitals_baseline_confidence if b else "low",
                "baseline_window_days": b.baseline_window_days if b else "14",
                "baseline_sbp_median": float(b.sbp_median) if (b and b.sbp_median is not None) else np.nan,
                "baseline_dbp_median": float(b.dbp_median) if (b and b.dbp_median is not None) else np.nan,
                "baseline_hr_median": float(b.hr_median) if (b and b.hr_median is not None) else np.nan,
                "baseline_spo2_median": float(b.spo2_median) if (b and b.spo2_median is not None) else np.nan,
                "baseline_weight_kg_median": float(b.weight_kg_median) if (b and b.weight_kg_median is not None) else np.nan,
                "baseline_glucose_fasting_median": float(b.glucose_fasting_median) if (b and b.glucose_fasting_median is not None) else np.nan,
                "baseline_temp_f_median": float(b.temp_f_median) if (b and b.temp_f_median is not None) else np.nan,
            }
        )
    baselines_df = pd.DataFrame(baselines_records)

    # 4. Vitals within lookback window up to end of `on_date`
    start_dt = datetime.combine(on_date - timedelta(days=lookback_days), time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(on_date, time.max, tzinfo=timezone.utc)

    vital_rows = db.execute(
        select(
            Vital.senior_id,
            Vital.measured_at,
            Vital.measurement_type,
            Vital.value,
            Vital.quality_status,
        ).where(
            Vital.senior_id.in_(target_ids),
            Vital.measured_at >= start_dt,
            Vital.measured_at <= end_dt,
            Vital.quality_status != "device_artifact",
        )
    ).all()

    if not vital_rows:
        return pd.DataFrame(), baselines_df, profiles_df, target_ids

    vitals_records = []
    for r in vital_rows:
        vit_short = VITAL_SHORT.get(r.measurement_type)
        if not vit_short or r.value is None:
            continue
        ts = pd.Timestamp(r.measured_at)
        if ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        vitals_records.append(
            {
                "senior_id": r.senior_id,
                "timestamp": ts,
                "date": ts.normalize(),
                "measurement_type": r.measurement_type,
                "vit": vit_short,
                "measurement_value": float(r.value),
                "quality_status": r.quality_status or "valid",
            }
        )

    vitals_df = pd.DataFrame(vitals_records)
    return vitals_df, baselines_df, profiles_df, target_ids


def _compute_recent_slope(series: pd.Series, dates: pd.Series, window_days: int = 3) -> Optional[float]:
    """Compute per-day linear slope over the most recent `window_days` up to the last row."""
    valid_mask = series.notna()
    if valid_mask.sum() < 2:
        return None
    s_valid = series[valid_mask].astype(float)
    d_valid = pd.to_datetime(dates[valid_mask])
    max_date = d_valid.iloc[-1]
    in_win = (max_date - d_valid).dt.days <= window_days
    if in_win.sum() >= 2:
        s_win = s_valid[in_win].values
        d_win = (d_valid[in_win] - d_valid[in_win].iloc[0]).dt.days.values.astype(float)
        if d_win[-1] > 0:
            denom = float(np.sum((d_win - d_win.mean()) ** 2))
            if denom > 1e-9:
                return float(np.sum((d_win - d_win.mean()) * (s_win - s_win.mean())) / denom)
    # Fallback to last two valid points within 7 days
    if len(s_valid) >= 2:
        days_diff = max(int((d_valid.iloc[-1] - d_valid.iloc[-2]).days), 1)
        if days_diff <= 7:
            return float((s_valid.iloc[-1] - s_valid.iloc[-2]) / days_diff)
    return None


def _compute_weight_delta_7d(series: pd.Series, dates: pd.Series) -> Optional[float]:
    """Compute 7-day weight change in kg (positive = weight gain / fluid retention)."""
    valid_mask = series.notna()
    if valid_mask.sum() < 2:
        return None
    s_valid = series[valid_mask].astype(float)
    d_valid = pd.to_datetime(dates[valid_mask])
    latest_val = float(s_valid.iloc[-1])
    latest_dt = d_valid.iloc[-1]

    # Look for readings between 1 and 7 days prior
    days_ago = (latest_dt - d_valid).dt.days
    win_mask = (days_ago >= 1) & (days_ago <= 7)
    if win_mask.any():
        baseline_7d = float(s_valid[win_mask].iloc[0])
        return round(latest_val - baseline_7d, 2)
    return None


def _run_forecast_pipeline(
    db: Session,
    senior_ids: Optional[List[str]],
    on_date: date,
    lookback_days: int = 45,
    commit: bool = True,
) -> Dict[str, Dict[str, Any]]:
    """
    Core execution pipeline for both single-senior and full-cohort forecasting:
    1. Reads vitals, baselines, conditions, and profiles from DB.
    2. Builds the engineered time-series feature matrix (Holt filter, lags, rolling stats, CUSUM).
    3. Runs quantile forecasts (h=1,3,5 x q10,q50,q90) and computes R_vitals + slopes.
    4. Writes all resulting `VitalForecast` rows to the `vital_forecasts` table in DB.
    """
    from app.db.base import utcnow
    from app.modules.vitals.models import VitalForecast

    # Ensure table exists in DB even if migrations haven't been run manually
    try:
        VitalForecast.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception as exc:
        log.debug("VitalForecast table check skipped: %s", exc)

    vitals_df, baselines_df, profiles_df, target_ids = _load_db_frames(
        db=db,
        senior_ids=senior_ids,
        on_date=on_date,
        lookback_days=lookback_days,
    )

    if not target_ids:
        return {}

    target_ts = pd.Timestamp(on_date).normalize()
    results_by_senior: Dict[str, Dict[str, Any]] = {}

    # Track which vitals each senior actually has readings for in the lookback window
    observed_vitals_by_senior: Dict[str, set[str]] = {sid: set() for sid in target_ids}
    recent_slopes_by_senior: Dict[str, Dict[str, Optional[float]]] = {
        sid: {"sbp_slope_3d": None, "spo2_slope_3d": None, "wt_delta_7d": None}
        for sid in target_ids
    }

    if not vitals_df.empty:
        daily_wide = _pivot_to_daily(vitals_df)
    else:
        daily_wide = pd.DataFrame(columns=["senior_id", "date"] + MODELED_VITALS)

    if not daily_wide.empty:
        # Ensure every senior with vitals has a row at `target_ts` so we forecast for `on_date`
        existing_pairs = set(zip(daily_wide["senior_id"], daily_wide["date"]))
        active_vital_seniors = daily_wide["senior_id"].unique().tolist()
        anchor_rows = []
        for sid in active_vital_seniors:
            if (sid, target_ts) not in existing_pairs:
                anchor_rows.append({"senior_id": sid, "date": target_ts})
        if anchor_rows:
            daily_wide = pd.concat([daily_wide, pd.DataFrame(anchor_rows)], ignore_index=True)

        daily_wide = daily_wide.sort_values(["senior_id", "date"]).reset_index(drop=True)
        study_start = daily_wide["date"].min()
        daily_wide["day_idx"] = (daily_wide["date"] - study_start).dt.days

        # Merge baselines & profiles
        daily_wide = daily_wide.merge(baselines_df, on="senior_id", how="left")
        daily_wide = daily_wide.merge(
            profiles_df[["senior_id", "age", "gender"]],
            on="senior_id",
            how="left",
        )

        # Fill missing DB baselines using the senior's own observed median (or physiological default)
        for vit in MODELED_VITALS:
            base_col = BASELINE_COL[vit]
            if vit not in daily_wide.columns:
                daily_wide[vit] = np.nan
            if base_col not in daily_wide.columns:
                daily_wide[base_col] = np.nan

            # Per-senior observed median fallback when SeniorBaseline is missing
            sen_medians = daily_wide.groupby("senior_id")[vit].transform("median")
            daily_wide[base_col] = (
                daily_wide[base_col]
                .fillna(sen_medians)
                .fillna(DEFAULT_PHYSIOLOGICAL_BASELINES[vit])
            )
            daily_wide[f"{vit}_delta"] = daily_wide[vit] - daily_wide[base_col]

        # Condition flags
        for flag, keyword in CONDITION_KEYWORDS.items():
            daily_wide[flag] = (
                daily_wide["physical_conditions"]
                .fillna("")
                .astype(str)
                .str.lower()
                .str.contains(keyword)
                .astype(float)
            )

        # Engineer features per senior & record recent slopes
        engineered_groups = []
        for sid, grp in daily_wide.groupby("senior_id", sort=False):
            grp_sorted = grp.sort_values("date").reset_index(drop=True)
            for vit in MODELED_VITALS:
                if vit in grp_sorted.columns and grp_sorted[vit].notna().any():
                    observed_vitals_by_senior.setdefault(sid, set()).add(vit)

            if "sbp" in grp_sorted.columns:
                recent_slopes_by_senior[sid]["sbp_slope_3d"] = _compute_recent_slope(
                    grp_sorted["sbp"], grp_sorted["date"], window_days=3
                )
            if "spo2" in grp_sorted.columns:
                recent_slopes_by_senior[sid]["spo2_slope_3d"] = _compute_recent_slope(
                    grp_sorted["spo2"], grp_sorted["date"], window_days=3
                )
            if "wt" in grp_sorted.columns:
                recent_slopes_by_senior[sid]["wt_delta_7d"] = _compute_weight_delta_7d(
                    grp_sorted["wt"], grp_sorted["date"]
                )

            eng = _engineer_senior_features(grp_sorted)
            # Keep the last row (which corresponds to `on_date`)
            engineered_groups.append(eng.iloc[[-1]])

        latest_df = pd.concat(engineered_groups, ignore_index=True)
    else:
        latest_df = pd.DataFrame()

    # Run batch predictions across `latest_df` for all (vital, horizon, quantile)
    pred_lookup: Dict[tuple[str, int, float], np.ndarray] = {}
    model_version_used = "vitals_holt_v1"

    if not latest_df.empty:
        for vit in MODELED_VITALS:
            for h in HORIZONS:
                for q in QUANTILES:
                    preds, ver = _predict_vital_horizon_quantile(latest_df, vit, h, q)
                    pred_lookup[(vit, h, q)] = preds
                    if ver == "vitals_lgbm_holt_v1":
                        model_version_used = ver

    latest_by_senior = {}
    if not latest_df.empty:
        for idx, row in latest_df.iterrows():
            latest_by_senior[str(row["senior_id"])] = (idx, row)

    # Assemble per-senior forecast outputs and upsert into `vital_forecasts`
    for sid in target_ids:
        obs_vitals = observed_vitals_by_senior.get(sid, set())
        slopes_info = recent_slopes_by_senior.get(sid, {})

        if sid in latest_by_senior and obs_vitals:
            row_idx, row = latest_by_senior[sid]
            forecasts_detail: Dict[str, Any] = {}
            contributions: Dict[str, float] = {}
            r_score_accum = 0.0

            raw_h1_q50: Dict[str, Optional[float]] = {vit: None for vit in MODELED_VITALS}

            for vit in MODELED_VITALS:
                if vit not in obs_vitals:
                    continue
                base_col = BASELINE_COL[vit]
                baseline_val = float(row[base_col]) if pd.notna(row.get(base_col)) else DEFAULT_PHYSIOLOGICAL_BASELINES[vit]

                vit_detail: Dict[str, Any] = {
                    "baseline": round(baseline_val, 2),
                    "latest_observed": round(float(row[vit]), 2) if pd.notna(row.get(vit)) else None,
                    "L_t": round(float(row.get(f"{vit}_L_t", 0.0) or 0.0), 3),
                    "B_t": round(float(row.get(f"{vit}_B_t", 0.0) or 0.0), 3),
                    "dB_t": round(float(row.get(f"{vit}_dB_t", 0.0) or 0.0), 3),
                    "cusum": round(float(row.get(f"{vit}_cusum", 0.0) or 0.0), 2),
                    "consec_out": int(float(row.get(f"{vit}_consec_out", 0.0) or 0.0)),
                    "horizons": {},
                }

                for h in HORIZONS:
                    d_q10 = float(pred_lookup[(vit, h, 0.10)][row_idx])
                    d_q50 = float(pred_lookup[(vit, h, 0.50)][row_idx])
                    d_q90 = float(pred_lookup[(vit, h, 0.90)][row_idx])
                    # Enforce quantile monotonicity (q10 <= q50 <= q90)
                    q_sorted = sorted([d_q10, d_q50, d_q90])
                    d_q10, d_q50, d_q90 = q_sorted[0], q_sorted[1], q_sorted[2]

                    r_q10 = round(baseline_val + d_q10, 2)
                    r_q50 = round(baseline_val + d_q50, 2)
                    r_q90 = round(baseline_val + d_q90, 2)

                    vit_detail["horizons"][f"h{h}"] = {
                        "q10": r_q10,
                        "q50": r_q50,
                        "q90": r_q90,
                        "delta_q50": round(d_q50, 3),
                    }
                    if h == 1:
                        raw_h1_q50[vit] = r_q50

                forecasts_detail[vit] = vit_detail

                # Compute R_vitals contribution for this vital (matching evaluate_vitals.py)
                wt = VITAL_WEIGHTS.get(vit, 1.0)
                rng = TYPICAL_RANGE.get(vit, 30.0)
                pred_q50_h1 = float(vit_detail["horizons"]["h1"]["delta_q50"])
                raw_q10_h1 = float(vit_detail["horizons"]["h1"]["q10"])
                raw_q90_h1 = float(vit_detail["horizons"]["h1"]["q90"])

                dev_norm = abs(pred_q50_h1) / rng
                thr = BREACH_THRESHOLDS.get(vit, {})
                if thr.get("hi") and raw_q90_h1 >= thr["hi"]:
                    dev_norm = max(dev_norm, 1.2)
                if thr.get("lo") and raw_q10_h1 <= thr["lo"]:
                    dev_norm = max(dev_norm, 1.2)

                dev_points = min(dev_norm * 30.0, 30.0) * wt

                B_t_val = float(row.get(f"{vit}_B_t", 0.0) or 0.0)
                trend_norm = abs(B_t_val) / (rng * 0.1)
                trend_points = min(trend_norm * 15.0, 15.0) * wt

                cusum_val = float(row.get(f"{vit}_cusum", 0.0) or 0.0)
                cusum_points = min(cusum_val / 200.0 * 10.0, 10.0) * wt

                vit_total = round(dev_points + trend_points + cusum_points, 2)
                contributions[vit] = vit_total
                r_score_accum += vit_total

            # Cross-vital syndrome flags
            forecasts_detail["syndrome_flags"] = {
                "cross_chf_triad": bool(float(row.get("cross_chf_triad", 0.0) or 0.0) > 0),
                "cross_orthostatic": bool(float(row.get("cross_orthostatic", 0.0) or 0.0) > 0),
                "cross_uti_triad": bool(float(row.get("cross_uti_triad", 0.0) or 0.0) > 0),
                "cross_spo2_hr_mismatch": bool(float(row.get("cross_spo2_hr_mismatch", 0.0) or 0.0) > 0),
            }

            r_vitals = float(np.clip(r_score_accum, 0.0, 100.0))
            if float(row.get("sbp_cusum", 0.0) or 0.0) > 100.0:
                r_vitals = max(r_vitals, 75.0)
            if float(row.get("spo2_cusum", 0.0) or 0.0) > 80.0:
                r_vitals = max(r_vitals, 75.0)
            r_vitals = round(r_vitals, 1)

            # Slopes: use empirical 3-day / 7-day slope when >=2 readings exist, else Holt B_t
            sbp_slope_3d = slopes_info.get("sbp_slope_3d")
            if sbp_slope_3d is None and "sbp" in obs_vitals:
                sbp_slope_3d = float(row.get("sbp_B_t", 0.0) or 0.0)
            sbp_slope_3d = round(float(sbp_slope_3d), 2) if sbp_slope_3d is not None else 0.0

            spo2_slope_3d = slopes_info.get("spo2_slope_3d")
            if spo2_slope_3d is None and "spo2" in obs_vitals:
                spo2_slope_3d = float(row.get("spo2_B_t", 0.0) or 0.0)
            spo2_slope_3d = round(float(spo2_slope_3d), 2) if spo2_slope_3d is not None else 0.0

            wt_slope_7d = slopes_info.get("wt_delta_7d")
            if wt_slope_7d is None and "wt" in obs_vitals:
                wt_slope_7d = float(row.get("wt_B_t", 0.0) or 0.0) * 6.0
            wt_slope_7d = round(float(wt_slope_7d), 2) if wt_slope_7d is not None else 0.0

            payload = {
                "senior_id": sid,
                "date": on_date.isoformat(),
                "bp_systolic_forecast": raw_h1_q50["sbp"],
                "bp_diastolic_forecast": raw_h1_q50["dbp"],
                "pulse_forecast": raw_h1_q50["hr"],
                "spo2_forecast": raw_h1_q50["spo2"],
                "weight_forecast": raw_h1_q50["wt"],
                "blood_glucose_forecast": raw_h1_q50["gluc"],
                "bp_systolic_slope_3d": sbp_slope_3d,
                "spo2_slope_3d": spo2_slope_3d,
                "weight_slope_7d": wt_slope_7d,
                "r_vitals_score": r_vitals,
                "contributions": contributions,
                "forecasts_detail": forecasts_detail,
                "model_version": model_version_used,
            }
        else:
            # Senior has no vitals in the lookback window
            payload = {
                "senior_id": sid,
                "date": on_date.isoformat(),
                "bp_systolic_forecast": None,
                "bp_diastolic_forecast": None,
                "pulse_forecast": None,
                "spo2_forecast": None,
                "weight_forecast": None,
                "blood_glucose_forecast": None,
                "bp_systolic_slope_3d": 0.0,
                "spo2_slope_3d": 0.0,
                "weight_slope_7d": 0.0,
                "r_vitals_score": 0.0,
                "contributions": {},
                "forecasts_detail": {"status": "no_vitals_in_window"},
                "model_version": model_version_used,
            }

        # Upsert into `vital_forecasts` table in DB
        existing = db.get(VitalForecast, (sid, on_date))
        if existing is None:
            existing = VitalForecast(senior_id=sid, date=on_date)
            db.add(existing)

        existing.bp_systolic_forecast = payload["bp_systolic_forecast"]
        existing.bp_diastolic_forecast = payload["bp_diastolic_forecast"]
        existing.pulse_forecast = payload["pulse_forecast"]
        existing.spo2_forecast = payload["spo2_forecast"]
        existing.weight_forecast = payload["weight_forecast"]
        existing.blood_glucose_forecast = payload["blood_glucose_forecast"]
        existing.bp_systolic_slope_3d = payload["bp_systolic_slope_3d"]
        existing.spo2_slope_3d = payload["spo2_slope_3d"]
        existing.weight_slope_7d = payload["weight_slope_7d"]
        existing.r_vitals_score = payload["r_vitals_score"]
        existing.contributions = payload["contributions"]
        existing.forecasts_detail = payload["forecasts_detail"]
        existing.model_version = payload["model_version"]
        existing.computed_at = utcnow()

        results_by_senior[sid] = payload

    if commit:
        db.commit()
    else:
        db.flush()

    return results_by_senior


def forecast_senior(
    db: Session,
    senior_id: str,
    on_date: Optional[date] = None,
    lookback_days: int = 45,
    commit: bool = True,
) -> Dict[str, Any]:
    """
    Process 1 individual at a time:
    Reads the senior's vitals, baseline, conditions, and profile from the DB,
    runs the Vitals Forecast Model (Holt + LightGBM quantiles), writes the
    forecast to `vital_forecasts` in the DB, and returns the forecast dictionary.
    """
    target_date = on_date or date.today()
    res = _run_forecast_pipeline(
        db=db,
        senior_ids=[senior_id],
        on_date=target_date,
        lookback_days=lookback_days,
        commit=commit,
    )
    return res.get(
        senior_id,
        {
            "senior_id": senior_id,
            "date": target_date.isoformat(),
            "bp_systolic_forecast": None,
            "bp_diastolic_forecast": None,
            "pulse_forecast": None,
            "spo2_forecast": None,
            "weight_forecast": None,
            "blood_glucose_forecast": None,
            "bp_systolic_slope_3d": 0.0,
            "spo2_slope_3d": 0.0,
            "weight_slope_7d": 0.0,
            "r_vitals_score": 0.0,
            "contributions": {},
            "forecasts_detail": {"status": "senior_not_found"},
            "model_version": "vitals_holt_v1",
        },
    )


def forecast_cohort(
    db: Session,
    on_date: Optional[date] = None,
    senior_ids: Optional[List[str]] = None,
    lookback_days: int = 45,
    commit: bool = True,
) -> Dict[str, Any]:
    """
    Process full cohort at a time:
    Batch-loads all active seniors' vitals, baselines, conditions, and profiles from DB,
    runs the Vitals Forecast Model across the entire cohort, upserts all rows into
    `vital_forecasts` in the DB, and returns the cohort summary + per-senior forecasts.
    """
    target_date = on_date or date.today()
    results_map = _run_forecast_pipeline(
        db=db,
        senior_ids=senior_ids,
        on_date=target_date,
        lookback_days=lookback_days,
        commit=commit,
    )
    with_vitals = sum(
        1 for v in results_map.values() if v.get("bp_systolic_forecast") is not None or v.get("spo2_forecast") is not None
    )
    return {
        "date": target_date.isoformat(),
        "total_seniors_processed": len(results_map),
        "seniors_with_vitals_forecasted": with_vitals,
        "results": results_map,
    }



if __name__ == "__main__":
    import argparse
    import json

    _backend_root = Path(__file__).resolve().parents[3]
    if str(_backend_root) not in sys.path:
        sys.path.insert(0, str(_backend_root))

    parser = argparse.ArgumentParser(description="Run Vitals Forecast Model (1 individual or full cohort)")
    parser.add_argument("--senior-id", type=str, default=None, help="Senior ID to forecast (omit for full cohort)")
    parser.add_argument("--cohort", action="store_true", help="Run for full cohort of active seniors")
    parser.add_argument("--date", type=str, default=None, help="Target date YYYY-MM-DD (default: demo today / today)")
    args = parser.parse_args()

    from app.core.config import today as get_today
    from app.core.database import SessionLocal

    target_date = date.fromisoformat(args.date) if args.date else get_today()
    with SessionLocal() as db:
        if args.senior_id and not args.cohort:
            res = forecast_senior(db, args.senior_id, target_date, commit=True)
            print(json.dumps(res, indent=2))
        else:
            summary = forecast_cohort(db, target_date, commit=True)
            out = {
                "date": summary["date"],
                "total_seniors_processed": summary["total_seniors_processed"],
                "seniors_with_vitals_forecasted": summary["seniors_with_vitals_forecasted"],
            }
            print(json.dumps(out, indent=2))
