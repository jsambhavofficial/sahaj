"""Optional Machine Learning and Anomaly Detection Module for SamarthCare AI."""

from dataclasses import dataclass
import logging
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score

logger = logging.getLogger("ml_model")


FEATURE_COLUMNS = [
    "bp_systolic_latest",
    "bp_systolic_dev_baseline",
    "bp_systolic_rolling_3d",
    "bp_diastolic_latest",
    "spo2_latest",
    "spo2_dev_baseline",
    "spo2_rolling_3d",
    "blood_glucose_latest",
    "steps_latest",
    "steps_rolling_3d_ratio",
    "sleep_hours_latest",
    "sleep_dev_baseline",
    "appetite_latest",
    "appetite_dev_baseline",
    "mood_latest",
    "adherence_rate_3d",
    "consecutive_miss_flag",
    "cue_fall_current",
    "cue_weakness_current",
    "cue_dizziness_current",
    "cue_pain_current",
    "cue_distinct_concerns_count",
    "family_mobility_flag",
]


class AnomalyRiskDetector:
    """
    Unsupervised Isolation Forest anomaly detector trained on normal/early longitudinal features.
    Provides an ML-derived anomaly probability to compare against rules-only scoring.
    """

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("iso_forest", IsolationForest(
                n_estimators=100,
                contamination=0.15,
                random_state=random_state
            ))
        ])
        self.is_fitted = False

    def fit(self, X_train: pd.DataFrame):
        X_num = X_train[FEATURE_COLUMNS].copy()
        # Convert booleans to float
        for col in X_num.select_dtypes(include=["bool"]).columns:
            X_num[col] = X_num[col].astype(float)

        self.pipeline.fit(X_num)
        self.is_fitted = True
        logger.info(f"Fitted Isolation Forest on {len(X_num)} training records.")

    def predict_anomaly_scores(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("AnomalyRiskDetector must be fitted before scoring.")
        X_num = X[FEATURE_COLUMNS].copy()
        for col in X_num.select_dtypes(include=["bool"]).columns:
            X_num[col] = X_num[col].astype(float)

        # Raw anomaly decision function (lower = more abnormal)
        raw_scores = self.pipeline.decision_function(X_num)
        # Invert and scale to 0-100 range
        # decision_function typically ranges from -0.3 to +0.3
        norm_scores = (0.3 - raw_scores) / 0.6
        return np.clip(norm_scores * 100.0, 0.0, 100.0)


def evaluate_ml_vs_rules(
    features_df: pd.DataFrame,
    scores_df: pd.DataFrame,
    episodes_df: pd.DataFrame,
    train_senior_ratio: float = 0.70,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Compares the transparent rules-based scoring engine with an unsupervised ML anomaly detector.
    Uses senior-grouped split (no senior in both train and test) to prevent leakage.
    Evaluation labels are derived strictly during evaluation without leaking into models.
    """
    logger.info("Evaluating ML anomaly detection vs rules-based baseline...")

    all_seniors = features_df["senior_id"].unique()
    rng = np.random.default_rng(seed)
    shuffled_seniors = rng.permutation(all_seniors)

    n_train = int(len(shuffled_seniors) * train_senior_ratio)
    train_seniors = set(shuffled_seniors[:n_train])
    test_seniors = set(shuffled_seniors[n_train:])

    # Prepare ground-truth binary label for evaluation:
    # A day is positive if it falls inside an active planted decline/acute/intermittent episode
    ep_lookup = {}
    for _, ep in episodes_df[episodes_df["planted"] == True].iterrows():
        s_id = ep["senior_id"]
        on = ep["onset_date"]
        en = ep["end_date"]
        if s_id not in ep_lookup:
            ep_lookup[s_id] = []
        ep_lookup[s_id].append((on, en))

    def is_in_planted_episode(s_id: str, dt: str) -> int:
        if s_id in ep_lookup:
            for on, en in ep_lookup[s_id]:
                if on <= dt <= en:
                    return 1
        return 0

    merged = pd.merge(features_df, scores_df[["senior_id", "date", "risk_score"]], on=["senior_id", "date"])
    merged["is_active_episode"] = [
        is_in_planted_episode(r["senior_id"], r["date"]) for r in merged.to_dict(orient="records")
    ]

    train_df = merged[merged["senior_id"].isin(train_seniors)].copy()
    test_df = merged[merged["senior_id"].isin(test_seniors)].copy()

    # Fit ML detector on training set
    detector = AnomalyRiskDetector(random_state=seed)
    detector.fit(train_df)

    # Score test set
    test_df["ml_score"] = detector.predict_anomaly_scores(test_df)

    y_test = test_df["is_active_episode"].values
    rules_scores = test_df["risk_score"].values
    ml_scores = test_df["ml_score"].values

    # Compute ROC-AUC
    rules_auc = float(roc_auc_score(y_test, rules_scores)) if len(np.unique(y_test)) > 1 else 0.0
    ml_auc = float(roc_auc_score(y_test, ml_scores)) if len(np.unique(y_test)) > 1 else 0.0

    # Binary metrics at threshold 50
    rules_pred = (rules_scores >= 50).astype(int)
    ml_pred = (ml_scores >= 50).astype(int)

    results = {
        "evaluation_split": {
            "total_seniors": len(all_seniors),
            "train_seniors": len(train_seniors),
            "test_seniors": len(test_seniors),
            "test_records": len(test_df),
            "positive_days_in_test": int(y_test.sum()),
        },
        "rules_engine": {
            "roc_auc": round(rules_auc, 3),
            "precision_at_50": round(float(precision_score(y_test, rules_pred, zero_division=0)), 3),
            "recall_at_50": round(float(recall_score(y_test, rules_pred, zero_division=0)), 3),
            "f1_at_50": round(float(f1_score(y_test, rules_pred, zero_division=0)), 3),
        },
        "ml_isolation_forest": {
            "roc_auc": round(ml_auc, 3),
            "precision_at_50": round(float(precision_score(y_test, ml_pred, zero_division=0)), 3),
            "recall_at_50": round(float(recall_score(y_test, ml_pred, zero_division=0)), 3),
            "f1_at_50": round(float(f1_score(y_test, ml_pred, zero_division=0)), 3),
        },
        "comparison_summary": (
            f"Rules engine ROC-AUC ({rules_auc:.3f}) vs ML Isolation Forest ROC-AUC ({ml_auc:.3f}). "
            "Rules engine provides explicit explainability and guarantees safety tripwire firing."
        )
    }

    logger.info(f"Comparison results: {results['comparison_summary']}")
    return results

