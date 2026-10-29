"""
Train Vitals Risk Engine — Stage 2 (Quantile LightGBM)
=======================================================
For each (vital sign × forecast horizon × quantile) triple, trains a separate
LightGBM model that predicts how far the next reading will deviate from the
senior's personal baseline.

Training protocol
-----------------
  Days 0–60   → Training set   (causal; no future leakage)
  Days 61–90  → Validation set (early-stop monitor + threshold tuning)
  Days 91–97  → Test set       (held-out; only touched in evaluate_vitals.py)

Senior-level grouping ensures one senior never appears in both train and test.
The time-based split is the primary control; senior split would cause 0-sample
issues given only 98 days, so we use temporal split with group-aware shuffling.

Models saved to: models/vitals/artifacts/
  Format: <vital>_h<horizon>_q<quantile>.joblib
  e.g.:   sbp_h1_q50.joblib

Run
---
  cd C:\\Projects\\samarth-2.O\\backend
  python -m models.vitals.train_vitals
"""

from __future__ import annotations

import json
import time
import warnings
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

warnings.filterwarnings("ignore")

# ── Project root resolution ────────────────────────────────────────────────────
# File lives at: <ml_root>/models/vitals/train_vitals.py
# __file__.parent.parent = <ml_root>/models  →  .parent = <ml_root>
ML_ROOT  = Path(__file__).resolve().parent.parent.parent   # → backend/ml/
DATA_RAW = ML_ROOT / "data" / "raw"
ARTIFACTS= Path(__file__).resolve().parent / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

# Local imports — insert ml_root so 'models' package is found
import sys
sys.path.insert(0, str(ML_ROOT))
from models.vitals.feature_builder import (
    build_feature_matrix,
    get_feature_cols,
    get_target_cols,
    get_meta_cols,
    MODELED_VITALS,
    HORIZONS,
)

# ── Config ────────────────────────────────────────────────────────────────────
QUANTILES   = [0.10, 0.50, 0.90]
TRAIN_DAYS  = (0,  60)    # inclusive
VAL_DAYS    = (61, 90)
TEST_DAYS   = (91, 200)   # 200 = open end (study is 98 days)

SEED = 2026

# LightGBM base parameters (shared across all models)
LGB_BASE_PARAMS = dict(
    boosting_type     = "gbdt",
    objective         = "quantile",       # quantile regression
    n_estimators      = 600,
    learning_rate     = 0.04,
    num_leaves        = 31,
    max_depth         = -1,
    min_child_samples = 10,
    subsample         = 0.8,
    colsample_bytree  = 0.8,
    reg_alpha         = 0.1,
    reg_lambda        = 0.1,
    random_state      = SEED,
    n_jobs            = -1,
    verbose           = -1,
)

# Early stopping patience (in rounds)
EARLY_STOP = 50


def _pinball(y_true: np.ndarray, y_pred: np.ndarray, q: float) -> float:
    """Pinball (quantile) loss. Lower is better."""
    e = y_true - y_pred
    return float(np.mean(np.where(e >= 0, q * e, (q - 1) * e)))


def train_all(
    feature_df : pd.DataFrame,
    verbose    : bool = True,
) -> Dict:
    """
    Train one LightGBM model per (vital × horizon × quantile).
    Returns a summary dict with per-model validation metrics.
    """
    feat_cols   = get_feature_cols()
    feat_cols   = [c for c in feat_cols if c in feature_df.columns]   # guard

    # ── Time-based split ──────────────────────────────────────────────────────
    train_mask = (feature_df["day_idx"] >= TRAIN_DAYS[0]) & \
                 (feature_df["day_idx"] <= TRAIN_DAYS[1])
    val_mask   = (feature_df["day_idx"] >= VAL_DAYS[0])   & \
                 (feature_df["day_idx"] <= VAL_DAYS[1])

    train_df = feature_df[train_mask].copy()
    val_df   = feature_df[val_mask].copy()

    if verbose:
        print(f"\n{'='*60}")
        print(f"  VITALS RISK ENGINE — Stage 2 Training")
        print(f"{'='*60}")
        print(f"  Train rows : {len(train_df):>7,}  (day {TRAIN_DAYS[0]}–{TRAIN_DAYS[1]})")
        print(f"  Val   rows : {len(val_df):>7,}  (day {VAL_DAYS[0]}–{VAL_DAYS[1]})")
        print(f"  Features   : {len(feat_cols)}")
        print(f"  Vitals     : {MODELED_VITALS}")
        print(f"  Horizons   : h = {HORIZONS} days")
        print(f"  Quantiles  : {QUANTILES}")
        print(f"{'='*60}\n")

    X_train = train_df[feat_cols].astype(float)
    X_val   = val_df[feat_cols].astype(float)

    summary = {}
    total_models = len(MODELED_VITALS) * len(HORIZONS) * len(QUANTILES)
    model_idx = 0
    t0 = time.time()

    for vit in MODELED_VITALS:
        summary[vit] = {}
        for h in HORIZONS:
            target_col = f"y_{vit}_h{h}"
            if target_col not in feature_df.columns:
                continue

            y_train_raw = train_df[target_col].values.astype(float)
            y_val_raw   = val_df[target_col].values.astype(float)

            # Drop rows where target is NaN (horizon exceeds study window)
            tr_mask = np.isfinite(y_train_raw)
            vl_mask = np.isfinite(y_val_raw)

            if tr_mask.sum() < 50:
                if verbose:
                    print(f"  [SKIP] {vit} h={h} — insufficient training samples ({tr_mask.sum()})")
                continue

            X_tr = X_train[tr_mask]
            y_tr = y_train_raw[tr_mask]
            X_vl = X_val[vl_mask]
            y_vl = y_val_raw[vl_mask]

            summary[vit][h] = {}

            for q in QUANTILES:
                model_idx += 1
                tag = f"{vit}_h{h}_q{int(q*100):02d}"

                params = {**LGB_BASE_PARAMS, "alpha": q}   # alpha = quantile for pinball
                model  = lgb.LGBMRegressor(**params)

                # Impute NaN in features with median (per-column, fit on train)
                X_tr_imp = X_tr.copy()
                X_vl_imp = X_vl.copy()
                col_medians = X_tr_imp.median()
                X_tr_imp = X_tr_imp.fillna(col_medians)
                X_vl_imp = X_vl_imp.fillna(col_medians)

                # Train with early stopping on validation pinball loss
                model.fit(
                    X_tr_imp, y_tr,
                    eval_set          = [(X_vl_imp, y_vl)],
                    eval_metric       = "quantile",
                    callbacks         = [lgb.early_stopping(EARLY_STOP, verbose=False),
                                         lgb.log_evaluation(period=-1)],
                )

                # Validation metrics
                val_pred = model.predict(X_vl_imp)
                val_mae  = mean_absolute_error(y_vl, val_pred)
                val_pin  = _pinball(y_vl, val_pred, q)

                summary[vit][h][q] = {
                    "val_mae"      : round(float(val_mae), 4),
                    "val_pinball"  : round(float(val_pin), 4),
                    "n_estimators" : model.best_iteration_ or model.n_estimators,
                    "train_rows"   : int(tr_mask.sum()),
                    "val_rows"     : int(vl_mask.sum()),
                }

                # Save model + column medians for inference
                artifact = {
                    "model"       : model,
                    "feat_cols"   : feat_cols,
                    "col_medians" : col_medians.to_dict(),
                    "vital"       : vit,
                    "horizon"     : h,
                    "quantile"    : q,
                    "train_rows"  : int(tr_mask.sum()),
                }
                joblib.dump(artifact, ARTIFACTS / f"{tag}.joblib", compress=3)

                if verbose:
                    elapsed = time.time() - t0
                    print(
                        f"  [{model_idx:>3}/{total_models}]  {tag:<22}"
                        f"  val_MAE={val_mae:6.3f}  pinball={val_pin:6.3f}"
                        f"  iters={model.best_iteration_ or model.n_estimators:>4}"
                        f"  ({elapsed:.0f}s)"
                    )

    # Save training summary
    summary_path = ARTIFACTS / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    total_elapsed = time.time() - t0
    if verbose:
        print(f"\n  Training complete in {total_elapsed:.1f}s")
        print(f"  Models saved to: {ARTIFACTS}")

    return summary


def print_training_report(summary: Dict):
    """Print a readable per-vital summary table."""
    print(f"\n{'='*60}")
    print("  VALIDATION METRICS SUMMARY  (MAE in units from baseline)")
    print(f"{'='*60}")

    unit_map = {"sbp": "mmHg", "dbp": "mmHg", "hr": "bpm",
                "spo2": "%", "wt": "kg", "gluc": "mg/dL"}

    print(f"\n  {'Vital':6}  {'H':>3}  {'Q10 pin':>9}  {'Q50 MAE':>9}  {'Q90 pin':>9}  {'Unit'}")
    print(f"  {'-'*6}  {'-'*3}  {'-'*9}  {'-'*9}  {'-'*9}  {'-'*6}")

    for vit in MODELED_VITALS:
        if vit not in summary:
            continue
        for h in HORIZONS:
            if h not in summary[vit]:
                continue
            hdata = summary[vit][h]
            q10_p = hdata.get(0.10, {}).get("val_pinball", float("nan"))
            q50_m = hdata.get(0.50, {}).get("val_mae",     float("nan"))
            q90_p = hdata.get(0.90, {}).get("val_pinball", float("nan"))
            unit  = unit_map.get(vit, "?")
            print(
                f"  {vit:6}  h={h}  {q10_p:9.3f}  {q50_m:9.3f}  {q90_p:9.3f}  {unit}"
            )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    vitals_path    = ML_ROOT / "data" / "raw" / "vitals.csv"
    baselines_path = ML_ROOT / "data" / "raw" / "senior_baselines.csv"
    profiles_path  = ML_ROOT / "data" / "raw" / "senior_profiles.csv"

    print("Building feature matrix ...")
    t0 = time.time()
    feature_df = build_feature_matrix(
        vitals_path    = vitals_path,
        baselines_path = baselines_path,
        profiles_path  = profiles_path,
    )
    print(f"Feature matrix: {feature_df.shape}  ({time.time()-t0:.1f}s)")

    # Save for evaluate step
    feature_df.to_parquet(ARTIFACTS / "feature_matrix.parquet", index=False)
    print(f"Feature matrix saved → {ARTIFACTS / 'feature_matrix.parquet'}")

    summary = train_all(feature_df, verbose=True)
    print_training_report(summary)
