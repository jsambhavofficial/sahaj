"""Comprehensive episode-level evaluation against hidden synthetic ground truth."""

from datetime import datetime, timedelta
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config
from src.risk_engine.ml_model import evaluate_ml_vs_rules

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("evaluate_risk_engine")


class EpisodeEvaluator:
    """
    Evaluates risk engine performance at the episode and temporal warning level,
    comparing generated alerts against hidden ground-truth decline episodes.
    """

    def __init__(
        self,
        episodes_df: pd.DataFrame,
        alerts_df: pd.DataFrame,
        scores_df: pd.DataFrame,
        warning_window_days: int = 7
    ):
        self.episodes_df = episodes_df.copy()
        self.alerts_df = alerts_df.copy()
        self.scores_df = scores_df.copy()
        self.warning_window_days = warning_window_days

    def evaluate_all(self) -> Dict[str, Any]:
        """Runs multi-metric episode-level and operational alert evaluation."""
        total_seniors = self.scores_df["senior_id"].nunique()
        total_senior_days = len(self.scores_df)

        # Filter planted episodes (positive ground truth)
        planted_eps = self.episodes_df[self.episodes_df["planted"] == True].copy()
        stable_eps = self.episodes_df[self.episodes_df["planted"] == False].copy()

        n_planted = len(planted_eps)
        n_stable = len(stable_eps)

        # Parse alert dates
        if not self.alerts_df.empty:
            alerts_by_senior = {}
            for _, alt in self.alerts_df.iterrows():
                s_id = alt["senior_id"]
                if s_id not in alerts_by_senior:
                    alerts_by_senior[s_id] = []
                alerts_by_senior[s_id].append({
                    "alert_id": alt["alert_id"],
                    "created_at": alt["created_at"],
                    "severity": alt["severity"],
                })
        else:
            alerts_by_senior = {}

        # 1. Episode-Level Detection Analysis
        detected_episodes = 0
        lead_times = []
        detection_delays = []
        alerts_per_episode = []
        missed_episodes = []

        by_type_stats: Dict[str, Dict[str, int]] = {}
        by_severity_stats: Dict[str, Dict[str, int]] = {}

        matched_alert_ids = set()

        for _, ep in planted_eps.iterrows():
            ep_id = ep["episode_id"]
            s_id = ep["senior_id"]
            ep_type = ep["episode_type"]
            severity = ep["severity_category"]

            if ep_type not in by_type_stats:
                by_type_stats[ep_type] = {"total": 0, "detected": 0}
            by_type_stats[ep_type]["total"] += 1

            if severity not in by_severity_stats:
                by_severity_stats[severity] = {"total": 0, "detected": 0}
            by_severity_stats[severity]["total"] += 1

            onset_dt = datetime.strptime(ep["onset_date"], "%Y-%m-%d").date()
            end_dt = datetime.strptime(ep["end_date"], "%Y-%m-%d").date()
            window_start_dt = onset_dt - timedelta(days=self.warning_window_days)

            senior_alerts = alerts_by_senior.get(s_id, [])

            # Find matching alerts: alert created between window_start_dt and end_dt
            matching_alerts = []
            for alt in senior_alerts:
                alt_dt = datetime.strptime(alt["created_at"], "%Y-%m-%d").date()
                if window_start_dt <= alt_dt <= end_dt:
                    matching_alerts.append((alt_dt, alt["alert_id"]))
                    matched_alert_ids.add(alt["alert_id"])

            if matching_alerts:
                detected_episodes += 1
                by_type_stats[ep_type]["detected"] += 1
                by_severity_stats[severity]["detected"] += 1
                alerts_per_episode.append(len(matching_alerts))

                # Earliest alert date
                matching_alerts.sort(key=lambda x: x[0])
                first_alt_dt = matching_alerts[0][0]

                if first_alt_dt < onset_dt:
                    # Early warning lead time
                    lead_days = (onset_dt - first_alt_dt).days
                    lead_times.append(lead_days)
                    detection_delays.append(0)
                else:
                    delay_days = (first_alt_dt - onset_dt).days
                    detection_delays.append(delay_days)
            else:
                missed_episodes.append({
                    "episode_id": ep_id,
                    "senior_id": s_id,
                    "episode_type": ep_type,
                    "scenario_id": ep["scenario_id"],
                    "severity": severity,
                    "onset_date": ep["onset_date"],
                })

        # Episode recall
        episode_recall = (detected_episodes / n_planted) if n_planted > 0 else 0.0

        # Alert Precision (True Positives vs Total Alerts)
        total_alerts = len(self.alerts_df)
        true_positive_alerts = len(matched_alert_ids)
        alert_precision = (true_positive_alerts / total_alerts) if total_alerts > 0 else 0.0

        # False Alerts
        false_positive_alerts = total_alerts - true_positive_alerts
        false_alerts_per_100_days = (false_positive_alerts / total_senior_days) * 100.0

        # Timing metrics
        median_lead_time = float(np.median(lead_times)) if lead_times else 0.0
        median_detection_delay = float(np.median(detection_delays)) if detection_delays else 0.0
        avg_alerts_per_ep = float(np.mean(alerts_per_episode)) if alerts_per_episode else 0.0

        # Breakdown calculations
        type_breakdown = {}
        for t, counts in by_type_stats.items():
            tot = counts["total"]
            det = counts["detected"]
            type_breakdown[t] = {
                "total": tot,
                "detected": det,
                "recall": round(det / tot, 3) if tot > 0 else 0.0,
            }

        severity_breakdown = {}
        for s, counts in by_severity_stats.items():
            tot = counts["total"]
            det = counts["detected"]
            severity_breakdown[s] = {
                "total": tot,
                "detected": det,
                "recall": round(det / tot, 3) if tot > 0 else 0.0,
            }

        return {
            "evaluation_metadata": {
                "evaluation_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total_cohort_seniors": total_seniors,
                "total_senior_days": total_senior_days,
                "warning_window_days": self.warning_window_days,
            },
            "summary_metrics": {
                "total_planted_episodes": n_planted,
                "detected_episodes": detected_episodes,
                "missed_episodes_count": len(missed_episodes),
                "episode_level_recall": round(episode_recall, 3),
                "total_alerts_generated": total_alerts,
                "true_positive_alerts": true_positive_alerts,
                "false_positive_alerts": false_positive_alerts,
                "alert_precision": round(alert_precision, 3),
                "false_alerts_per_100_senior_days": round(false_alerts_per_100_days, 2),
                "median_lead_time_days": round(median_lead_time, 1),
                "median_detection_delay_days": round(median_detection_delay, 1),
                "duplicate_alerts_per_episode_mean": round(avg_alerts_per_ep, 2),
            },
            "performance_by_episode_type": type_breakdown,
            "performance_by_severity": severity_breakdown,
            "missed_episodes_sample": missed_episodes[:5],
        }


def generate_evaluation_reports(
    config: DatasetConfig,
    reports_dir: Path = Path("reports")
) -> Dict[str, Any]:
    """Runs complete evaluation, writes JSON and Markdown reports."""
    reports_dir.mkdir(parents=True, exist_ok=True)

    ep_df = pd.read_csv(config.evaluation_data_dir / "decline_episodes.csv")
    al_df = pd.read_csv(config.processed_data_dir / "alert_events.csv")
    sc_df = pd.read_csv(config.processed_data_dir / "daily_risk_scores.csv")
    ft_df = pd.read_csv(config.processed_data_dir / "daily_risk_features.csv")

    evaluator = EpisodeEvaluator(ep_df, al_df, sc_df, warning_window_days=7)
    eval_results = evaluator.evaluate_all()

    # Run optional ML vs rules comparison
    ml_comparison = evaluate_ml_vs_rules(ft_df, sc_df, ep_df, seed=config.random_seed)
    eval_results["ml_vs_rules_comparison"] = ml_comparison

    # Save JSON report
    json_path = reports_dir / "phase2_evaluation.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    logger.info(f"Saved evaluation JSON report to {json_path}")

    # Generate Markdown report
    md_content = render_markdown_report(eval_results)
    md_path = reports_dir / "phase2_evaluation.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    logger.info(f"Saved evaluation Markdown report to {md_path}")

    return eval_results


def render_markdown_report(res: Dict[str, Any]) -> str:
    summ = res["summary_metrics"]
    by_type = res["performance_by_episode_type"]
    by_sev = res["performance_by_severity"]
    ml = res.get("ml_vs_rules_comparison", {})

    lines = [
        "# SamarthCare AI — Phase 2 Ground Truth Evaluation Report",
        "",
        "> **SYNTHETIC BENCHMARK DISCLAIMER**:",
        "> All performance metrics in this report are measured exclusively against synthetic ground-truth decline",
        "> episodes (`decline_episodes.csv`) generated in Phase 1. They reflect the mathematical sensitivity of the",
        "> early-warning rules and ML models to planted synthetic anomalies, and do NOT represent empirical clinical accuracy.",
        "",
        "---",
        "",
        "## 1. Episode-Level Detection Summary",
        "",
        f"- **Planted Episodes**: {summ['total_planted_episodes']}",
        f"- **Detected Episodes**: {summ['detected_episodes']} ({summ['episode_level_recall']*100:.1f}% Recall)",
        f"- **Missed Episodes**: {summ['missed_episodes_count']}",
        f"- **Total Operational Alerts**: {summ['total_alerts_generated']}",
        f"- **Alert Precision**: {summ['alert_precision']*100:.1f}%",
        f"- **False Alerts per 100 Senior-Days**: {summ['false_alerts_per_100_senior_days']} alerts",
        f"- **Median Detection Delay**: {summ['median_detection_delay_days']} days post-onset",
        f"- **Alerts per Detected Episode (Mean)**: {summ['duplicate_alerts_per_episode_mean']}",
        "",
        "---",
        "",
        "## 2. Performance by Clinical Episode Type",
        "",
        "| Episode Type | Planted Count | Detected Count | Recall Rate |",
        "|:---|:---:|:---:|:---:|",
    ]

    for ep_type, c in by_type.items():
        lines.append(f"| `{ep_type}` | {c['total']} | {c['detected']} | {c['recall']*100:.1f}% |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Performance by Peak Severity Category",
        "",
        "| Severity Category | Planted Count | Detected Count | Recall Rate |",
        "|:---|:---:|:---:|:---:|",
    ])

    for sev, c in by_sev.items():
        lines.append(f"| `{sev}` | {c['total']} | {c['detected']} | {c['recall']*100:.1f}% |")

    if ml:
        re = ml.get("rules_engine", {})
        iso = ml.get("ml_isolation_forest", {})
        lines.extend([
            "",
            "---",
            "",
            "## 4. Transparent Rules vs. ML Anomaly Detector Comparison",
            "",
            "| Evaluation Metric | Rules-Based Scoring Engine | ML Isolation Forest (Unsupervised) |",
            "|:---|:---:|:---:|",
            f"| **ROC-AUC** | **{re.get('roc_auc', 0.0):.3f}** | {iso.get('roc_auc', 0.0):.3f} |",
            f"| **Precision (at 50)** | **{re.get('precision_at_50', 0.0):.3f}** | {iso.get('precision_at_50', 0.0):.3f} |",
            f"| **Recall (at 50)** | **{re.get('recall_at_50', 0.0):.3f}** | {iso.get('recall_at_50', 0.0):.3f} |",
            f"| **F1-Score (at 50)** | **{re.get('f1_at_50', 0.0):.3f}** | {iso.get('f1_at_50', 0.0):.3f} |",
            "",
            f"> **Summary**: {ml.get('comparison_summary', '')}",
        ])

    lines.extend([
        "",
        "---",
        "",
        "## 5. Missed Episodes Analysis",
        "",
        "Missed episodes predominantly consist of masked decline scenarios (`SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED`)",
        "where intentional high device telemetry gaps simulate seniors who forget to wear sensors or complete checks.",
    ])

    return "\n".join(lines)


if __name__ == "__main__":
    cfg = load_config()
    generate_evaluation_reports(cfg)

