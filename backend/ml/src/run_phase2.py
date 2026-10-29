"""Master execution script for SamarthCare AI Phase 2."""

import argparse
from datetime import datetime
import json
import logging
from pathlib import Path
import sys
import time
import pandas as pd

from src.config_loader import load_config
from src.features.build_daily_features import build_daily_features, save_daily_features
from src.risk_engine.scoring import score_all_features, RiskScoringEngine
from src.risk_engine.alert_policy import run_alert_policy_on_scores
from src.risk_engine.explanations import ExplanationFormatter
from src.evaluation.evaluate_risk_engine import generate_evaluation_reports

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("run_phase2")


def run_phase2_pipeline(config_path: str = "config/dataset_config.yaml") -> bool:
    """Executes feature engineering, scoring, alert management, and evaluation."""
    start_time = time.time()
    logger.info("=" * 70)
    logger.info("Starting SamarthCare AI Phase 2 Early Warning & Risk Engine Pipeline")
    logger.info("=" * 70)

    config = load_config(config_path)

    # 1. Load source tables
    logger.info("Loading Phase 1 source tables...")
    master_df = pd.read_csv(config.processed_data_dir / "daily_master.csv")
    baselines_df = pd.read_csv(config.raw_data_dir / "senior_baselines.csv")
    profiles_df = pd.read_csv(config.raw_data_dir / "senior_profiles.csv")
    checkins_df = pd.read_csv(config.raw_data_dir / "checkins.csv")
    family_df = pd.read_csv(config.raw_data_dir / "family_observations.csv")

    # 2. Build Daily Risk Features
    t0 = time.time()
    features_df = build_daily_features(master_df, baselines_df, profiles_df, checkins_df, family_df, config)
    save_daily_features(features_df, config.processed_data_dir)
    logger.info(f"Daily risk features completed in {time.time() - t0:.2f}s ({len(features_df)} records)")

    # 3. Score Daily Features
    t0 = time.time()
    scores_df = score_all_features(features_df)
    scores_path = config.processed_data_dir / "daily_risk_scores.csv"
    scores_df.to_csv(scores_path, index=False)
    logger.info(f"Daily risk scoring completed in {time.time() - t0:.2f}s ({len(scores_df)} scores)")

    # 4. Alert Lifecycle Policy & Deduplication
    t0 = time.time()
    alerts_df = run_alert_policy_on_scores(scores_df)
    alerts_path = config.processed_data_dir / "alert_events.csv"
    alerts_df.to_csv(alerts_path, index=False)
    logger.info(f"Alert lifecycle management completed in {time.time() - t0:.2f}s ({len(alerts_df)} alerts)")

    # 5. Evaluate Against Hidden Ground Truth & Generate Reports
    t0 = time.time()
    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    eval_results = generate_evaluation_reports(config, reports_dir=reports_dir)
    logger.info(f"Ground-truth evaluation completed in {time.time() - t0:.2f}s")

    # 6. Generate Explainability Report
    generate_explainability_report(scores_df, features_df, alerts_df, reports_dir / "phase2_explainability.md")

    # 7. Consolidate Master Dataset
    t0 = time.time()
    from src.consolidate_master_dataset import run_consolidation
    run_consolidation(config_path)
    logger.info(f"Master dataset consolidation completed in {time.time() - t0:.2f}s")

    elapsed = time.time() - start_time
    logger.info("=" * 70)
    logger.info(f"SamarthCare AI Phase 2 Pipeline FINISHED SUCCESSFULLY in {elapsed:.2f}s")
    logger.info("=" * 70)
    return True


def generate_explainability_report(
    scores_df: pd.DataFrame,
    features_df: pd.DataFrame,
    alerts_df: pd.DataFrame,
    output_path: Path
):
    """Writes the comprehensive clinical explainability report."""
    logger.info("Generating phase2_explainability.md report...")

    # Find representative cases:
    # 1. Stable senior with ordinary fluctuations
    low_cases = scores_df[scores_df["risk_level"] == "LOW"]
    s_low = low_cases.iloc[10]["senior_id"]
    d_low = low_cases.iloc[10]["date"]
    f_low = features_df[(features_df["senior_id"] == s_low) & (features_df["date"] == d_low)].iloc[0].to_dict()
    res_low = RiskScoringEngine.score_row(f_low)
    txt_low = ExplanationFormatter.format_text_summary(res_low)

    # 2. Gradual decline senior
    mod_cases = scores_df[scores_df["risk_level"] == "HIGH"]
    s_high = mod_cases.iloc[15]["senior_id"]
    d_high = mod_cases.iloc[15]["date"]
    f_high = features_df[(features_df["senior_id"] == s_high) & (features_df["date"] == d_high)].iloc[0].to_dict()
    res_high = RiskScoringEngine.score_row(f_high)
    txt_high = ExplanationFormatter.format_text_summary(res_high)

    # 3. Urgent safety tripwire case (e.g. fall or crisis)
    urgent_cases = scores_df[scores_df["risk_level"] == "URGENT_REVIEW"]
    if not urgent_cases.empty:
        s_urg = urgent_cases.iloc[0]["senior_id"]
        d_urg = urgent_cases.iloc[0]["date"]
        f_urg = features_df[(features_df["senior_id"] == s_urg) & (features_df["date"] == d_urg)].iloc[0].to_dict()
        res_urg = RiskScoringEngine.score_row(f_urg)
        txt_urg = ExplanationFormatter.format_text_summary(res_urg)
    else:
        txt_urg = "No urgent cases in sample."

    content = f"""# SamarthCare AI — Phase 2 Explainability & Rationale Report

This report documents the scoring architecture, clinical rules, category saturation caps, confidence calculations, missing-data handling, and concrete case evaluations produced by the Phase 2 Early Warning Engine.

---

## 1. Scoring Architecture & Categorical Caps

To prevent unbounded score inflation from multiple correlated observations or repeated conversational complaints, the scoring engine uses sub-category saturation caps:

| Clinical Category | Maximum Capped Points | Governing Invariant |
|:---|:---:|:---|
| **Acute Safety Tripwires** | 85 pts | Dedicated independent pathway. If active, forces minimum score of 75 (`URGENT_REVIEW`). |
| **Sustained Trends** | 35 pts | Evaluates 3-day and 7-day rolling deteriorations (steps drop >40%, sustained BP elevation). |
| **Baseline Deviations** | 25 pts | Evaluates short-term deviations from senior's personal habitual steady state. |
| **Medication Adherence** | 30 pts | Evaluates confirmed consecutive missed doses (does NOT penalize unknown status). |
| **Unstructured NLP Cues**| 35 pts | Extracted from multilingual check-ins (negated and historical symptoms filtered). |
| **Cross-Modal Synergy** | 25 pts | Corroboration between objective sensor drops, check-in notes, and caregiver reports. |

### Final Score Mapping
- `LOW`: 0–24
- `MODERATE`: 25–49
- `HIGH`: 50–74
- `URGENT_REVIEW`: 75–100

---

## 2. Confidence & Missing Data Semantics

1. **Non-Inference Invariant**: Missing data is never treated as positive health or negative health.
2. **Confidence Downgrade**: If 2 or more days in the 3-day causal window lack valid activity or vitals telemetry, `confidence_level` is set to `LOW`.
3. **Data Quality Warnings**: Every missing vital or unverified medication dose is explicitly articulated in `data_quality_flags` for human coordinator review.

---

## 3. Representative Case Explanations

### Case A: Stable Senior (Normal Baseline Fluctuation)
```
{txt_low}
```

### Case B: Multi-Modal Gradual Decline (High Risk)
```
{txt_high}
```

### Case C: Acute Safety Tripwire (Urgent Review)
```
{txt_urg}
```
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info(f"Saved explainability report to {output_path}")


def demo_senior_date(senior_id: str, date_str: str):
    """Prints a compact explanation for a selected senior and date."""
    features_path = Path("data/processed/daily_risk_features.csv")
    if not features_path.exists():
        print("Please run phase 2 pipeline first to generate features.")
        return

    df = pd.read_csv(features_path)
    match = df[(df["senior_id"] == senior_id) & (df["date"] == date_str)]
    if match.empty:
        print(f"No records found for senior {senior_id} on {date_str}.")
        return

    row = match.iloc[0].to_dict()
    res = RiskScoringEngine.score_row(row)
    print(ExplanationFormatter.format_text_summary(res))


def demo_five_scenarios():
    """Demonstrates the five required clinical and operational demo scenarios."""
    scenarios = [
        ("1. Stable Senior with Ordinary Daily Fluctuations", "S0001", "2026-01-01"),
        ("2. Multi-Day Gradual Cross-Modal Decline", "S0001", "2026-03-23"),
        ("3. Isolated Noisy Reading (Sleep Disruption Without False High-Risk Alert)", "S0157", "2026-02-14"),
        ("4. Clinical Dialogue with Negated Symptoms (Zero Unwarranted False Alarms)", "S0001", "2026-01-05"),
        ("5. Missing Telemetry Gaps (Explicit Quality Warning & Low Confidence, Not Claim of Wellness)", "S0001", "2026-01-11"),
    ]

    print("=" * 80)
    print("SamarthCare AI Phase 2 — 5 Core Clinical Demo Scenarios")
    print("=" * 80)
    for title, s_id, dt in scenarios:
        print(f"\n>>> Scenario: {title}")
        demo_senior_date(s_id, dt)
        print("-" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SamarthCare AI Phase 2 Pipeline & Demo")
    parser.add_argument("--demo", action="store_true", help="Run interactive demo")
    parser.add_argument("--demo-all", action="store_true", help="Run all 5 required demo scenarios")
    parser.add_argument("--senior", type=str, default="S0015", help="Senior ID for demo")
    parser.add_argument("--date", type=str, default="2026-02-15", help="Date for demo (YYYY-MM-DD)")
    args = parser.parse_args()

    if args.demo_all:
        demo_five_scenarios()
    elif args.demo:
        demo_senior_date(args.senior, args.date)
    else:
        run_phase2_pipeline()
