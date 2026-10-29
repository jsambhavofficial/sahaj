"""
Evaluate Vitals Risk Engine — Test Set Metrics
===============================================
Loads the held-out test set (days 91–97) and produces:

  1. Forecast Accuracy  — MAE, RMSE, Pinball loss per vital × horizon × quantile
  2. Calibration Check  — % of actuals inside the [Q10, Q90] prediction interval
  3. Threshold Breach Detection — Early warning precision/recall vs ground truth
  4. R_vitals Score     — Demonstrates the scoring function on a sample of seniors
  5. Per-senior breakdown for the highest-risk seniors on the last test day

Run
---
  cd C:\\Projects\\samarth-2.O\\backend
  python -m models.vitals.evaluate_vitals
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
ML_ROOT   = Path(__file__).resolve().parent.parent.parent   # → backend/ml/
DATA_RAW  = ML_ROOT / "data" / "raw"
DATA_EVAL = ML_ROOT / "data" / "evaluation"
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
REPORTS   = ML_ROOT / "reports"
REPORTS.mkdir(parents=True, exist_ok=True)

import sys
sys.path.insert(0, str(ML_ROOT))

from models.vitals.feature_builder import (
    build_feature_matrix,
    get_feature_cols,
    MODELED_VITALS,
    HORIZONS,
    HARD_THRESHOLDS,
    BASELINE_COL,
)

# ── Constants ─────────────────────────────────────────────────────────────────
QUANTILES  = [0.10, 0.50, 0.90]
TEST_DAYS  = (91, 200)

# Hard vital alarm thresholds (in raw units)
BREACH_THRESHOLDS = {
    "sbp"  : {"hi": 160, "lo": 90},
    "dbp"  : {"hi": 100, "lo": 60},
    "hr"   : {"hi": 110, "lo": 50},
    "spo2" : {"lo": 92},                  # only low-side matters
    "gluc" : {"hi": 200, "lo": 70},
}

UNIT_MAP = {
    "sbp": "mmHg", "dbp": "mmHg", "hr": "bpm",
    "spo2": "%", "wt": "kg", "gluc": "mg/dL"
}


import functools

# ── Load models ───────────────────────────────────────────────────────────────

@functools.lru_cache(maxsize=128)
def load_model(vit: str, h: int, q: float) -> Optional[Dict]:
    tag  = f"{vit}_h{h}_q{int(q*100):02d}"
    path = ARTIFACTS / f"{tag}.joblib"
    if not path.exists():
        return None
    return joblib.load(path)


def predict(artifact: Dict, X: pd.DataFrame) -> np.ndarray:
    """Apply stored imputation then model predict."""
    feat_cols   = artifact["feat_cols"]
    col_medians = artifact["col_medians"]
    model       = artifact["model"]

    X_sub = X[[c for c in feat_cols if c in X.columns]].copy().astype(float)
    # Fill any columns that exist in artifact but not in X
    for c in feat_cols:
        if c not in X_sub.columns:
            X_sub[c] = np.nan
    X_sub = X_sub[feat_cols]
    for c, med in col_medians.items():
        X_sub[c] = X_sub[c].fillna(med)
    return model.predict(X_sub)


# ── Accuracy metrics ──────────────────────────────────────────────────────────

def _pinball(y_true: np.ndarray, y_pred: np.ndarray, q: float) -> float:
    e = y_true - y_pred
    return float(np.mean(np.where(e >= 0, q * e, (q - 1) * e)))


def evaluate_accuracy(
    test_df   : pd.DataFrame,
    verbose   : bool = True,
) -> Dict:
    """
    Compute MAE, RMSE, Pinball for every trained (vital × horizon × quantile).
    Also computes [Q10, Q90] interval calibration for each vital × horizon.
    """
    feat_cols = get_feature_cols()
    feat_cols = [c for c in feat_cols if c in test_df.columns]
    X_test    = test_df[feat_cols].astype(float)

    results = {}

    if verbose:
        print(f"\n{'='*72}")
        print("  SECTION 1 — FORECAST ACCURACY  (test days 91–97)")
        print(f"{'='*72}")
        print(f"  {'Vital':6} {'H':>3} {'Q':>5}  {'N':>6}  {'MAE':>8}  {'RMSE':>8}  {'Pinball':>9}  {'Unit'}")
        print(f"  {'-'*6} {'-'*3} {'-'*5}  {'-'*6}  {'-'*8}  {'-'*8}  {'-'*9}  {'-'*6}")

    for vit in MODELED_VITALS:
        results[vit] = {}
        for h in HORIZONS:
            target_col = f"y_{vit}_h{h}"
            if target_col not in test_df.columns:
                continue

            y_raw  = test_df[target_col].values.astype(float)
            mask   = np.isfinite(y_raw)
            if mask.sum() < 5:
                continue

            y_true = y_raw[mask]
            X_sub  = X_test[mask]

            results[vit][h] = {}
            preds_q10 = preds_q90 = None

            for q in QUANTILES:
                art = load_model(vit, h, q)
                if art is None:
                    continue

                y_pred = predict(art, X_sub)

                mae     = mean_absolute_error(y_true, y_pred)
                rmse    = float(np.sqrt(mean_squared_error(y_true, y_pred)))
                pinball = _pinball(y_true, y_pred, q)

                results[vit][h][q] = {
                    "mae"     : round(mae, 4),
                    "rmse"    : round(rmse, 4),
                    "pinball" : round(pinball, 4),
                    "n"       : int(mask.sum()),
                }

                if q == 0.10:
                    preds_q10 = y_pred
                elif q == 0.90:
                    preds_q90 = y_pred

                if verbose:
                    print(
                        f"  {vit:6} h={h} q={int(q*100):>3}  "
                        f"{mask.sum():>6,}  {mae:8.3f}  {rmse:8.3f}  {pinball:9.4f}  "
                        f"{UNIT_MAP.get(vit,'?')}"
                    )

            # Calibration: % of actuals inside [Q10, Q90]
            if preds_q10 is not None and preds_q90 is not None:
                inside  = np.sum((y_true >= preds_q10) & (y_true <= preds_q90))
                calib   = inside / len(y_true)
                results[vit][h]["calibration_80pct_interval"] = round(float(calib), 4)
                if verbose:
                    flag = "✓" if calib >= 0.70 else "✗"
                    print(
                        f"  {vit:6} h={h} {'calib':>5}  "
                        f"{mask.sum():>6,}  {'—':>8}  {'—':>8}  "
                        f"  {calib*100:5.1f}% in [Q10,Q90]  {flag}"
                    )

    return results


# ── Threshold breach detection ────────────────────────────────────────────────

def evaluate_breach_detection(
    feature_df    : pd.DataFrame,
    ground_truth  : pd.DataFrame,
    decline_eps   : pd.DataFrame,
    verbose       : bool = True,
) -> Dict:
    """
    For each vital sign, check if the h=1 Q90 (upper) or Q10 (lower) forecast
    crosses the hard medical threshold.  Compare against ground_truth_tier >= 2
    (moderate/severe) days as the positive label.

    Metrics: Precision, Recall, F1, and Early Warning Lead Time (days before
    the actual breach that the model flagged it).
    """
    if verbose:
        print(f"\n{'='*72}")
        print("  SECTION 2 — THRESHOLD BREACH EARLY WARNING")
        print(f"  (Does forecasting flag the risk BEFORE the vital actually breaches?)")
        print(f"{'='*72}")

    # Merge ground truth tiers into the feature df
    gt = ground_truth[["senior_id", "date", "ground_truth_tier", "progression"]].copy()
    gt["date"] = pd.to_datetime(gt["date"]).dt.normalize()

    feat = feature_df.copy()
    feat["date"] = pd.to_datetime(feat["date"]).dt.normalize()
    merged = feat.merge(gt, on=["senior_id", "date"], how="left")
    merged["ground_truth_tier"] = merged["ground_truth_tier"].fillna(0)

    # Restrict to vital-monitored seniors (those with any vitals readings)
    vitals_raw = pd.read_csv(ML_ROOT / "data" / "raw" / "vitals.csv")
    monitored  = set(vitals_raw["senior_id"].unique())
    merged = merged[merged["senior_id"].isin(monitored)].copy()

    # Positive label: tier >= 2 (moderate or severe) AND vital-monitored episode
    # Specifically look at vital-driven decline episodes
    vital_driven_scenarios = {
        "SCEN_ACUTE_HYPERTENSIVE_CRISIS",
        "SCEN_ACUTE_HYPOGLYCEMIA_EPISODES",
        "SCEN_GRADUAL_CHF_FLUID_RETENTION",
        "SCEN_GRADUAL_RESPIRATORY_DECONDITIONING",
        "SCEN_ACUTE_ORTHOSTATIC_DIZZINESS",
        "SCEN_ACUTE_CHEST_PAIN_ARRHYTHMIA",
    }

    # Get seniors in vital-driven scenarios
    vital_eps = decline_eps[
        (decline_eps["planted"] == True) &
        (decline_eps["scenario_id"].isin(vital_driven_scenarios)) &
        (decline_eps["vital_monitoring_enrolled"] == True)
    ]

    if verbose:
        print(f"\n  Vital-driven planted episodes: {len(vital_eps)}")
        print(f"  Enrolled vital-monitored seniors: {len(monitored)}")

    feat_cols = get_feature_cols()
    feat_cols = [c for c in feat_cols if c in merged.columns]
    X_all     = merged[feat_cols].astype(float)

    breach_results = {}

    for vit, thr in BREACH_THRESHOLDS.items():
        if vit not in MODELED_VITALS:
            continue

        base_col  = BASELINE_COL.get(vit)
        if base_col not in merged.columns:
            continue

        breach_results[vit] = {}

        # For each threshold direction
        for direction, threshold in thr.items():
            if direction == "hi":
                # Q90 forecast breaches upper threshold → high flag
                art = load_model(vit, 1, 0.90)
                if art is None:
                    continue
                y_pred_q90  = predict(art, X_all)
                # Convert: pred is delta from baseline; raw ≈ delta + baseline
                raw_forecast = y_pred_q90 + merged[base_col].values
                flag = (raw_forecast >= threshold).astype(int)

            elif direction == "lo":
                # Q10 forecast breaches lower threshold → low flag
                art = load_model(vit, 1, 0.10)
                if art is None:
                    continue
                y_pred_q10  = predict(art, X_all)
                raw_forecast = y_pred_q10 + merged[base_col].values
                flag = (raw_forecast <= threshold).astype(int)
            else:
                continue

            # Ground truth: the next day is in a moderate/severe episode
            y_true = (merged["ground_truth_tier"] >= 2).astype(int).values

            # Mask: only rows with actual vital readings or nearby
            # (otherwise model can't meaningfully predict)
            raw_vit_col = vit
            has_reading = merged[raw_vit_col].notna().values if raw_vit_col in merged.columns else np.ones(len(merged), bool)

            mask = has_reading
            if mask.sum() < 10:
                continue

            flag_m   = flag[mask]
            y_true_m = y_true[mask]

            tp = int(np.sum((flag_m == 1) & (y_true_m == 1)))
            fp = int(np.sum((flag_m == 1) & (y_true_m == 0)))
            fn = int(np.sum((flag_m == 0) & (y_true_m == 1)))

            prec   = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            rec    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1     = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0

            breach_results[vit][direction] = {
                "threshold"  : threshold,
                "precision"  : round(prec, 3),
                "recall"     : round(rec, 3),
                "f1"         : round(f1, 3),
                "TP"         : tp, "FP": fp, "FN": fn,
                "flag_rate"  : round(float(flag_m.mean()), 4),
            }

            if verbose:
                print(
                    f"  {vit:6} {direction:>3} thr={threshold:>5}  "
                    f"Prec={prec:.3f}  Rec={rec:.3f}  F1={f1:.3f}  "
                    f"TP={tp} FP={fp} FN={fn}"
                )

    return breach_results


# ── R_vitals score demo ───────────────────────────────────────────────────────

def compute_r_vitals(
    row          : pd.Series,
    base_row     : pd.Series,
) -> Dict:
    """
    Convert model outputs for a single senior-day into R_vitals ∈ [0, 100].

    Scoring logic:
    - Deviation component: how far Q50 forecast is from 0 (= personal baseline)
    - Trend component: Holt B_t signal (persistent directional drift)
    - CUSUM component: accumulated exceedance pressure
    - Interval width: wide [Q10, Q90] band → more uncertainty → slight boost
    - Weights are summed and clipped to [0, 100]
    """
    score = 0.0
    contributions = {}

    vit_weights = {
        "sbp"  : 1.4,   # highest weight — hypertension is primary risk
        "dbp"  : 0.8,
        "hr"   : 0.9,
        "spo2" : 1.6,   # oxygen is critical; small drops are dangerous
        "wt"   : 0.6,
        "gluc" : 1.1,
    }

    for vit, wt in vit_weights.items():
        base_col = BASELINE_COL.get(vit)
        if base_col not in base_row.index:
            continue
        baseline = base_row[base_col]
        if pd.isna(baseline):
            continue

        # ── Forecast deviation (Q50, h=1) ─────────────────────────────────────
        art_q50 = load_model(vit, 1, 0.50)
        art_q10 = load_model(vit, 1, 0.10)
        art_q90 = load_model(vit, 1, 0.90)
        if art_q50 is None:
            continue

        X_row = pd.DataFrame([row])
        pred_q50 = float(predict(art_q50, X_row)[0])
        dev_points = 0.0

        # Normalize deviation by vital-specific typical range
        typical_range = {"sbp": 40, "dbp": 25, "hr": 40, "spo2": 8, "wt": 10, "gluc": 80}
        rng = typical_range.get(vit, 30)
        dev_norm = abs(pred_q50) / rng     # 0 → normal, 1 → full range shift

        # Extra penalty if forecast pushes past hard threshold
        if art_q90 is not None:
            pred_q90 = float(predict(art_q90, X_row)[0])
            raw_q90  = pred_q90 + baseline
            thr      = BREACH_THRESHOLDS.get(vit, {})
            if thr.get("hi") and raw_q90 >= thr["hi"]:
                dev_norm = max(dev_norm, 1.2)
        if art_q10 is not None:
            pred_q10 = float(predict(art_q10, X_row)[0])
            raw_q10  = pred_q10 + baseline
            thr      = BREACH_THRESHOLDS.get(vit, {})
            if thr.get("lo") and raw_q10 <= thr["lo"]:
                dev_norm = max(dev_norm, 1.2)

        dev_points = min(dev_norm * 30, 30) * wt   # up to 30 pts per vital, weighted

        # ── Trend component (Holt B_t) ─────────────────────────────────────────
        B_t_col    = f"{vit}_B_t"
        trend_pts  = 0.0
        if B_t_col in row.index and pd.notna(row[B_t_col]):
            B_t = float(row[B_t_col])
            # Normalize by 1/10 of typical range per day
            trend_norm = abs(B_t) / (rng * 0.1)
            trend_pts  = min(trend_norm * 15, 15) * wt

        # ── CUSUM component ────────────────────────────────────────────────────
        cusum_col = f"{vit}_cusum"
        cusum_pts = 0.0
        if cusum_col in row.index and pd.notna(row[cusum_col]):
            cusum_pts = min(float(row[cusum_col]) / 200 * 10, 10) * wt

        vit_total = dev_points + trend_pts + cusum_pts
        contributions[vit] = round(vit_total, 2)
        score += vit_total

    # Normalize to [0, 100]
    r_vitals = float(np.clip(score, 0, 100))

    # Hard tripwires: check CUSUM on SBP/SpO2
    if row.get("sbp_cusum", 0) > 100:
        r_vitals = max(r_vitals, 75)
    if row.get("spo2_cusum", 0) > 80:
        r_vitals = max(r_vitals, 75)

    return {
        "R_vitals"      : round(r_vitals, 1),
        "contributions" : contributions,
    }


def evaluate_r_vitals_on_ground_truth(
    feature_df   : pd.DataFrame,
    ground_truth : pd.DataFrame,
    baselines_df : pd.DataFrame,
    n_sample     : int = 500,
    verbose      : bool = True,
) -> Dict:
    """
    Score R_vitals on a sample of test rows and compare to ground_truth_tier.
    Computes AUC-like ordering quality (rank correlation).
    """
    if verbose:
        print(f"\n{'='*72}")
        print("  SECTION 3 — R_vitals vs Ground Truth Tier  (sample evaluation)")
        print(f"{'='*72}")

    gt = ground_truth[["senior_id", "date", "ground_truth_tier"]].copy()
    gt["date"] = pd.to_datetime(gt["date"]).dt.normalize()

    feat = feature_df.copy()
    feat["date"] = pd.to_datetime(feat["date"]).dt.normalize()

    # Use test days
    study_start = feat["date"].min()
    feat["day_idx"] = (feat["date"] - study_start).dt.days
    test_feat = feat[(feat["day_idx"] >= 91)].copy()

    if len(test_feat) == 0:
        # Fall back to last 10 days
        max_day = int(feat["day_idx"].max())
        test_feat = feat[(feat["day_idx"] >= max_day - 10)].copy()

    if verbose:
        print(f"  Test-set rows available: {len(test_feat):,}")

    # Sample rows for scoring (computing R_vitals row-by-row is slow)
    rng = np.random.default_rng(2026)
    sample_idx = rng.choice(len(test_feat), size=min(n_sample, len(test_feat)), replace=False)
    sample_df  = test_feat.iloc[sample_idx].copy()

    # Merge ground truth
    sample_df  = sample_df.merge(gt, on=["senior_id", "date"], how="left")
    sample_df["ground_truth_tier"] = sample_df["ground_truth_tier"].fillna(0).astype(int)

    # Merge baselines
    baselines_df = baselines_df.copy()
    sample_df    = sample_df.merge(baselines_df, on="senior_id", how="left", suffixes=("", "_base"))

    # Vectorized scoring across all sample rows
    vit_weights = {"sbp": 1.4, "dbp": 0.8, "hr": 0.9, "spo2": 1.6, "wt": 0.6, "gluc": 1.1}
    typical_range = {"sbp": 40, "dbp": 25, "hr": 40, "spo2": 8, "wt": 10, "gluc": 80}
    scores = np.zeros(len(sample_df))

    for vit, wt in vit_weights.items():
        base_col = BASELINE_COL.get(vit)
        if base_col not in sample_df.columns:
            continue
        art_q50 = load_model(vit, 1, 0.50)
        art_q10 = load_model(vit, 1, 0.10)
        art_q90 = load_model(vit, 1, 0.90)
        if art_q50 is None:
            continue

        pred_q50 = predict(art_q50, sample_df)
        rng = typical_range.get(vit, 30)
        dev_norm = np.abs(pred_q50) / rng

        if art_q90 is not None:
            pred_q90 = predict(art_q90, sample_df)
            raw_q90  = pred_q90 + sample_df[base_col].fillna(0).values
            thr      = BREACH_THRESHOLDS.get(vit, {})
            if thr.get("hi"):
                dev_norm = np.where(raw_q90 >= thr["hi"], np.maximum(dev_norm, 1.2), dev_norm)

        if art_q10 is not None:
            pred_q10 = predict(art_q10, sample_df)
            raw_q10  = pred_q10 + sample_df[base_col].fillna(0).values
            thr      = BREACH_THRESHOLDS.get(vit, {})
            if thr.get("lo"):
                dev_norm = np.where(raw_q10 <= thr["lo"], np.maximum(dev_norm, 1.2), dev_norm)

        dev_pts = np.minimum(dev_norm * 30, 30) * wt

        # Trend component
        B_t_col = f"{vit}_B_t"
        if B_t_col in sample_df.columns:
            B_t = sample_df[B_t_col].fillna(0).values
            trend_norm = np.abs(B_t) / (rng * 0.1)
            trend_pts = np.minimum(trend_norm * 15, 15) * wt
        else:
            trend_pts = 0.0

        # CUSUM component
        cusum_col = f"{vit}_cusum"
        if cusum_col in sample_df.columns:
            cusum_pts = np.minimum(sample_df[cusum_col].fillna(0).values / 200 * 10, 10) * wt
        else:
            cusum_pts = 0.0

        vit_total = dev_pts + trend_pts + cusum_pts
        has_baseline = sample_df[base_col].notna().values
        scores += np.where(has_baseline, vit_total, 0.0)

    # Hard tripwires: check CUSUM on SBP/SpO2
    if "sbp_cusum" in sample_df.columns:
        scores = np.where(sample_df["sbp_cusum"].fillna(0) > 100, np.maximum(scores, 75), scores)
    if "spo2_cusum" in sample_df.columns:
        scores = np.where(sample_df["spo2_cusum"].fillna(0) > 80, np.maximum(scores, 75), scores)

    r_arr = np.clip(scores, 0, 100)
    t_arr = sample_df["ground_truth_tier"].values

    # Spearman rank correlation (how well R_vitals ranks risk)
    from scipy.stats import spearmanr
    corr, pval = spearmanr(r_arr, t_arr)

    # Mean R_vitals per tier (sanity check: should increase with tier)
    tier_means = {}
    for tier in sorted(set(t_arr)):
        mask = t_arr == tier
        tier_means[int(tier)] = round(float(r_arr[mask].mean()), 2)

    if verbose:
        print(f"\n  Spearman rank correlation (R_vitals vs tier): {corr:.3f}  (p={pval:.4f})")
        print(f"\n  Mean R_vitals by ground-truth tier:")
        tier_labels_str = {0: "Stable", 1: "Mild", 2: "Moderate", 3: "Severe"}
        for tier, mean_val in tier_means.items():
            bar = "█" * int(mean_val / 3)
            print(f"    Tier {tier} ({tier_labels_str.get(tier,'?'):>8}): {mean_val:5.1f}  {bar}")

    return {
        "spearman_r"       : round(float(corr), 4),
        "spearman_p"       : round(float(pval), 5),
        "tier_mean_r_vitals" : tier_means,
        "n_scored"         : int(len(r_arr)),
    }


# ── Master report ─────────────────────────────────────────────────────────────

def run_evaluation(verbose: bool = True) -> Dict:
    vitals_path    = ML_ROOT / "data" / "raw" / "vitals.csv"
    baselines_path = ML_ROOT / "data" / "raw" / "senior_baselines.csv"
    profiles_path  = ML_ROOT / "data" / "raw" / "senior_profiles.csv"
    gt_path        = ML_ROOT / "data" / "evaluation" / "daily_ground_truth.csv"
    eps_path       = ML_ROOT / "data" / "evaluation" / "decline_episodes.csv"

    # Load or rebuild feature matrix
    feat_cache = ARTIFACTS / "feature_matrix.parquet"
    if feat_cache.exists():
        if verbose:
            print("Loading cached feature matrix ...")
        feature_df = pd.read_parquet(feat_cache)
    else:
        if verbose:
            print("Building feature matrix (no cache found) ...")
        feature_df = build_feature_matrix(vitals_path, baselines_path, profiles_path)

    ground_truth = pd.read_csv(gt_path)
    ground_truth["date"] = pd.to_datetime(ground_truth["date"]).dt.normalize()

    decline_eps  = pd.read_csv(eps_path)

    # Compute study-relative day indices if not present
    if "day_idx" not in feature_df.columns:
        feature_df["date"] = pd.to_datetime(feature_df["date"]).dt.normalize()
        study_start = feature_df["date"].min()
        feature_df["day_idx"] = (feature_df["date"] - study_start).dt.days

    # Test-set rows only for accuracy evaluation
    test_mask = feature_df["day_idx"] >= 91
    test_df   = feature_df[test_mask].copy()

    if verbose:
        total_rows = len(feature_df)
        test_rows  = len(test_df)
        seniors    = feature_df["senior_id"].nunique()
        print(f"\n  Dataset: {total_rows:,} senior-days, {seniors} seniors")
        print(f"  Test set: {test_rows:,} rows (day ≥ 91)\n")

    # Section 1: Accuracy
    accuracy_res  = evaluate_accuracy(test_df, verbose=verbose)

    # Section 2: Breach detection
    baselines_df  = pd.read_csv(baselines_path)
    breach_res    = evaluate_breach_detection(
        feature_df, ground_truth, decline_eps, verbose=verbose
    )

    # Section 3: R_vitals vs ground truth
    r_vitals_res  = evaluate_r_vitals_on_ground_truth(
        feature_df, ground_truth, baselines_df, verbose=verbose
    )

    full_results = {
        "accuracy"       : accuracy_res,
        "breach_detection": breach_res,
        "r_vitals_ground_truth": r_vitals_res,
    }

    # Save JSON report
    report_path = REPORTS / "vitals_evaluation.json"
    with open(report_path, "w") as f:
        json.dump(full_results, f, indent=2, default=str)

    if verbose:
        print(f"\n  Full results saved → {report_path}")

    _print_final_summary(accuracy_res, breach_res, r_vitals_res)
    return full_results


def _print_final_summary(accuracy: Dict, breach: Dict, r_vitals: Dict):
    print(f"\n{'='*72}")
    print("  FINAL SUMMARY")
    print(f"{'='*72}")

    print("\n  Forecast Accuracy — Median Q50 MAE across vitals × horizons:")
    all_maes = []
    for vit in MODELED_VITALS:
        if vit not in accuracy:
            continue
        for h in HORIZONS:
            q50 = accuracy[vit].get(h, {}).get(0.50, {})
            if "mae" in q50:
                all_maes.append((vit, h, q50["mae"]))
                print(f"    {vit:6} h={h}: MAE={q50['mae']:.3f} {UNIT_MAP.get(vit,'')}")
    if all_maes:
        overall = np.mean([x[2] for x in all_maes])
        print(f"  → Overall mean MAE (Q50): {overall:.3f}")

    print("\n  Calibration — % actuals inside [Q10,Q90] (target ≥ 80%):")
    calib_vals = []
    for vit in MODELED_VITALS:
        for h in HORIZONS:
            c = accuracy.get(vit, {}).get(h, {}).get("calibration_80pct_interval")
            if c is not None:
                calib_vals.append(c)
                status = "✓" if c >= 0.80 else "✗"
                print(f"    {vit:6} h={h}: {c*100:.1f}%  {status}")
    if calib_vals:
        print(f"  → Mean calibration: {np.mean(calib_vals)*100:.1f}%")

    print("\n  R_vitals vs Ground Truth:")
    corr = r_vitals.get("spearman_r", 0)
    print(f"    Spearman ρ = {corr:.3f}  (p={r_vitals.get('spearman_p', '?')})")
    for tier, mean_val in r_vitals.get("tier_mean_r_vitals", {}).items():
        print(f"    Tier {tier}: mean R_vitals = {mean_val:.1f}")

    print(f"\n{'='*72}\n")


if __name__ == "__main__":
    run_evaluation(verbose=True)
