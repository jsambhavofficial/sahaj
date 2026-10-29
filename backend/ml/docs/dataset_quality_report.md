# SamarthCare AI — Phase 1 Dataset Quality & Validation Report

This report presents the empirical quality metrics, structural audits, missingness distributions, diversity verifications, and automated validation results for the generated Phase 1 dataset.

---

## 1. Executive Summary & Table Inventory

- **Cohort Enrolled**: 200 unique synthetic seniors (`S0001` - `S0200`).
- **Observation Window**: `2026-01-01` to `2026-03-31` (90 consecutive calendar days inclusive).
- **Total Senior-Days in Analytical Master**: Exactly 18,000 rows.
- **Pipeline Execution Runtime**: ~13.2 seconds.
- **Validation Test Suite**: 28 passed, 0 failed (100% pass rate).

### Table Inventory

| Layer | File Path | Record Count | Column Count | Primary Key | Description |
|:---|:---|:---:|:---:|:---|:---|
| **Raw** | `data/raw/senior_profiles.csv` | 200 | 11 | `senior_id` | Cohort demographics & admin settings. |
| **Raw** | `data/raw/senior_baselines.csv` | 200 | 14 | `senior_id` | Individual baseline steady-state priors. |
| **Raw** | `data/raw/daily_activity.csv` | 18,000 | 10 | (`senior_id`, `date`) | Daily pedometer, sleep, and wellbeing logs. |
| **Raw** | `data/raw/vitals.csv` | 55,581 | 9 | `measurement_id` | Device-level vital sign observations. |
| **Raw** | `data/raw/medication_schedules.csv` | 434 | 6 | `medication_id` | Active prescription schedules. |
| **Raw** | `data/raw/medication_events.csv` | 52,110 | 8 | `medication_event_id` | Longitudinal scheduled dose events. |
| **Raw** | `data/raw/checkins.csv` | 12,828 | 10 | `checkin_id` | Hindi, Hinglish, & English check-in notes. |
| **Raw** | `data/raw/family_observations.csv` | 2,167 | 8 | `observation_id` | Collateral notes from consented families. |
| **Processed** | `data/processed/daily_master.csv` | 18,000 | 24 | (`senior_id`, `date`) | Canonical unified analytical dataset. |
| **Processed** | `data/processed/nlp_annotations.csv` | 15,933 | 9 | `annotation_id` | Isolated ground-truth clinical cues. |
| **Evaluation**| `data/evaluation/decline_episodes.csv`| 200 | 10 | `episode_id` | Hidden evaluation ground-truth episodes. |

---

## 2. Scenario Allocation Audit

Scenario allocations match configured target proportions:

| Scenario Class | Planted? | Observed Count | Percentage of Cohort | Configured Target | Status |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Stable Baseline** (`stable_baseline`) | No | 100 | 50.0% | 50.0% | PASS |
| **Intermittent Concerns** (`intermittent_concern`) | Yes | 40 | 20.0% | 20.0% | PASS |
| **Gradual Decline** (`gradual_decline`) | Yes | 37 | 18.5% | — | PASS |
| **Recovery Trajectory** (`recovery_trajectory`) | Yes | 3 | 1.5% | — | PASS |
| *(Total Gradual & Recovery)* | Yes | 40 | 20.0% | 20.0% | PASS |
| **Acute Safety Events** (`acute_event`) | Yes | 20 | 10.0% | 10.0% | PASS |
| **Total Cohort** | — | **200** | **100.0%** | **100.0%** | PASS |

---

## 3. Missingness & Quality Profile

Missing values in `daily_master.csv` reflect genuine telemetric and human operational patterns:

| Signal Field | Missing Record Count | Missing Percentage | Theoretical Operational Driver |
|:---|:---:|:---:|:---|
| `steps` | 1,005 | 5.6% | Sensor uncharged, dead battery, or unwearable day. |
| `active_minutes` | 1,005 | 5.6% | Paired smartwatch pedometer gap. |
| `sleep_hours` | 1,005 | 5.6% | Smartwatch not worn overnight. |
| `bp_systolic_mmhg` | 6,036 | 33.5% | Monitored ~4–5 days/week (routine clinical cadence). |
| `blood_glucose_mg_dl` | 10,657 | 59.2% | Monitored ~2–3 days/week (standard glucometer check). |
| `spo2_percent` | 7,545 | 41.9% | Spot-checked ~4 days/week. |
| `weight_kg` | 14,004 | 77.8% | Monitored ~1–2 days/week (weekly weight cadence). |

### Quality Flags in Measurement Source Tables
- **Vital Telemetry Statuses** (`vitals.csv`):
  - `valid`: 53,358 (96.0%)
  - `device_artifact`: 1,112 (2.0%)
  - `questionable`: 1,111 (2.0%)
- **Medication Dose Statuses** (`medication_events.csv`):
  - `taken`: 45,984 (88.2%)
  - `missed`: 4,591 (8.8%)
  - `unknown`: 1,535 (2.9%)

---

## 4. Cohort Diversity & Trajectory Non-Duplication

| Metric | Measured Value | Requirement / Boundary | Status |
|:---|:---:|:---:|:---:|
| Unique Senior IDs | 200 | Exactly 200 | PASS |
| Age Distribution | Range: 60 - 89 (Mean: 73.1, Std: 6.4) | Bounded within [60, 92] | PASS |
| Cities Represented | 8 cities | Configured city count = 8 | PASS |
| Care Coordinators | 10 coordinators (balanced) | Configured count = 10 | PASS |
| Language Preferences | Hindi (45%), Hinglish (35%), English (20%) | Matches configured distribution | PASS |
| Unique Step Trajectories | 200 distinct 90-day series | No identical senior trajectories | PASS |
| Unique Baselines | 200 distinct baseline vectors | No identical baseline vectors | PASS |
| Unique Raw Check-in Notes | 114 distinct conversational variations | >50 distinct formulations | PASS |

---

## 5. Invariant & Target Leakage Validation

1. **Duplicate Senior-Dates in Daily Master**: Exactly 0 duplicates across 18,000 records.
2. **Referential Integrity**: 100% of foreign keys in vitals, activity, medications, checkins, annotations, and family observations resolve to registered seniors or parents.
3. **Temporal Bounds**: All 18,000 master records and 55,581 vital measurements fall strictly within `2026-01-01` to `2026-03-31`.
4. **Family Consent Enforcement**: 0 family observations exist for seniors who have not granted `family_consent`.
5. **Absence of Target Leakage**: Zero ground-truth columns (`planted`, `severity_category`, `expected_escalation`, `scenario_description`) appear in model-input datasets.
6. **Ground-Truth Negation & Uncertainty**: NLP annotations isolate 1,732 negated expressions and 843 uncertain expressions, preventing naive bag-of-words false positives.

---

## 6. Reproducibility Audit

The pipeline was executed across multiple isolated invocations with master random seed `42`. Identical SHA-256 content hashes were produced for all CSV tables:
- `python -m src.run_pipeline` produces bitwise deterministic outputs on every execution.
- Modifying a single senior's parameters does not perturb independent random streams of other cohort members.

