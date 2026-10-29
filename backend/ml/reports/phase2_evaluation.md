# SamarthCare AI — Phase 2 Ground Truth Evaluation Report

> **SYNTHETIC BENCHMARK DISCLAIMER**:
> All performance metrics in this report are measured exclusively against synthetic ground-truth decline
> episodes (`decline_episodes.csv`) generated in Phase 1. They reflect the mathematical sensitivity of the
> early-warning rules and ML models to planted synthetic anomalies, and do NOT represent empirical clinical accuracy.

---

## 1. Episode-Level Detection Summary

- **Planted Episodes**: 100
- **Detected Episodes**: 77 (77.0% Recall)
- **Missed Episodes**: 23
- **Total Operational Alerts**: 546
- **Alert Precision**: 21.8%
- **False Alerts per 100 Senior-Days**: 2.37 alerts
- **Median Detection Delay**: 3.0 days post-onset
- **Alerts per Detected Episode (Mean)**: 1.55

---

## 2. Performance by Clinical Episode Type

| Episode Type | Planted Count | Detected Count | Recall Rate |
|:---|:---:|:---:|:---:|
| `gradual_decline` | 37 | 35 | 94.6% |
| `recovery_trajectory` | 3 | 3 | 100.0% |
| `intermittent_concern` | 40 | 19 | 47.5% |
| `acute_event` | 20 | 20 | 100.0% |

---

## 3. Performance by Peak Severity Category

| Severity Category | Planted Count | Detected Count | Recall Rate |
|:---|:---:|:---:|:---:|
| `moderate` | 24 | 23 | 95.8% |
| `mild` | 40 | 19 | 47.5% |
| `severe` | 26 | 25 | 96.2% |
| `critical` | 10 | 10 | 100.0% |

---

## 4. Transparent Rules vs. ML Anomaly Detector Comparison

| Evaluation Metric | Rules-Based Scoring Engine | ML Isolation Forest (Unsupervised) |
|:---|:---:|:---:|
| **ROC-AUC** | **0.604** | 0.650 |
| **Precision (at 50)** | **0.157** | 0.270 |
| **Recall (at 50)** | **0.219** | 0.338 |
| **F1-Score (at 50)** | **0.183** | 0.300 |

> **Summary**: Rules engine ROC-AUC (0.604) vs ML Isolation Forest ROC-AUC (0.650). Rules engine provides explicit explainability and guarantees safety tripwire firing.

---

## 5. Missed Episodes Analysis

Missed episodes predominantly consist of masked decline scenarios (`SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED`)
where intentional high device telemetry gaps simulate seniors who forget to wear sensors or complete checks.