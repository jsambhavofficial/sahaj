# Phase 2 Data Mapping & Lineage Specification

This document maps all Phase 1 data sources to the Phase 2 Early Warning & Risk Scoring Engine. It defines the transformation logic, feature boundaries, input vs. ground-truth isolation, missing data semantics, and safety invariants.

---

## 1. Data Source Inventory & Role Classification

| File Path | Entity Level | Role in Phase 2 | Description |
|:---|:---|:---|:---|
| `data/raw/senior_profiles.csv` | Senior | Model Input | Demographic and operational attributes (age, language, living arrangement, coordinator). |
| `data/raw/senior_baselines.csv` | Senior | Model Input | Individual steady-state physiological and behavioral priors established before day 0. |
| `data/raw/daily_activity.csv` | Senior-Day | Model Input | Raw pedometer, sleep, appetite, mood, and social contact logs. |
| `data/raw/vitals.csv` | Measurement | Model Input | Time-stamped physiological readings (BP, Glucose, SpO2, Weight) with quality flags. |
| `data/raw/medication_schedules.csv` | Schedule | Model Input | Prescribed regimens, daily dosage frequencies, active dates. |
| `data/raw/medication_events.csv` | Event | Model Input | Longitudinal scheduled dose events (`taken`, `missed`, `unknown`). |
| `data/raw/checkins.csv` | Interaction | Model Input | Raw unstructured conversational notes in Hindi, Hinglish, and English. |
| `data/raw/family_observations.csv` | Observation | Model Input | Caregiver collateral observations (strictly gated by `family_consent`). |
| `data/processed/daily_master.csv` | Senior-Day | Primary Input Table | Canonical 18,000 senior-day pre-aggregated table (1 row per senior per date). |
| `data/processed/nlp_annotations.csv` | Annotation | NLP Evaluation / Benchmark Only | Synthetic ground-truth linguistic labels. **Not used as production feature input** to avoid target leakage into text inference. |
| `data/evaluation/decline_episodes.csv` | Episode | Evaluation Ground Truth ONLY | Hidden clinical decline onset, severity, and planted anomaly ground truth. **Strictly quarantined from features and API.** |

---

## 2. Table-by-Table Field Mapping

### 2.1 `data/raw/senior_profiles.csv`
- **Fields Used**:
  - `senior_id` (Identifier, Key)
  - `age` (Input Feature: demographic risk conditioning)
  - `living_arrangement` (Input Feature: isolation flag if `alone`)
  - `coordinator_id` (Operational routing)
  - `preferred_language` (Operational routing & NLP parser configuration)
  - `family_consent` (Governance invariant: family features only processed if `True`)
- **Fields Ignored**: `synthetic_profile_seed`, `cohort_start_date`, `cohort_end_date`.

### 2.2 `data/raw/senior_baselines.csv`
- **Fields Used**:
  - `senior_id` (Key)
  - `baseline_bp_systolic`, `baseline_bp_diastolic` (Baseline Reference)
  - `baseline_blood_glucose`, `baseline_glucose_context` (Baseline Reference)
  - `baseline_spo2` (Baseline Reference)
  - `baseline_weight` (Baseline Reference)
  - `baseline_steps`, `baseline_active_minutes`, `baseline_sleep_hours` (Baseline Reference)
  - `baseline_appetite_level`, `baseline_mood_level` (Baseline Reference)
  - `baseline_med_adherence_tendency` (Baseline Reference)
  - `baseline_checkin_participation_tendency` (Baseline Reference)
- **Role**: Provides the personal normal comparator for all relative deviation features ($z$-score, ratio to baseline, delta).

### 2.3 `data/processed/daily_master.csv` (Primary Rolling Base)
- **Fields Used**:
  - `senior_id`, `date` (Composite Key)
  - `steps`, `active_minutes`, `sleep_hours` (Activity signals)
  - `appetite_level`, `mood_level`, `social_contact_count` (Wellbeing signals)
  - `bp_systolic_mmhg`, `bp_diastolic_mmhg`, `blood_glucose_mg_dl`, `spo2_percent`, `weight_kg` (Vitals signals)
  - `scheduled_doses`, `taken_doses`, `missed_doses`, `unknown_doses` (Medication signals)
  - `checkin_completed`, `family_observation_available` (Communication signals)
  - `missing_vitals_count`, `missing_activity_flag`, `missing_checkin_flag`, `data_completeness_flag` (Data quality indicators)

### 2.4 `data/raw/checkins.csv`
- **Fields Used**:
  - `checkin_id`, `senior_id`, `timestamp`, `raw_note`, `language`, `channel`
- **Transformation**: Extracted via `src/features/nlp_extractor.py` (a transparent, rule-based Hindi/English/Hinglish clinical extractor) to identify current, negated, and historical clinical cues.
- **Quarantine**: `synthetic_scenario_id` is stripped and **never** passed into feature engineering.

### 2.5 `data/raw/family_observations.csv`
- **Fields Used**:
  - `observation_id`, `senior_id`, `timestamp`, `observation_type`, `note`, `consent_valid`
- **Safety Invariant**: If `consent_valid` is not `True`, or if the senior's profile has `family_consent == False`, observations are skipped.

---

## 3. Feature Transformation Pipeline (`daily_risk_features.csv`)

For each senior $i$ on date $t$, features are constructed strictly using causal windows $[t - W + 1, t]$ where $W \in \{1, 3, 7\}$ days. Future observations ($t' > t$) are never accessed.

### 3.1 Vital Sign Features
- `bp_systolic_latest`: Most recent valid systolic BP on date $t$.
- `bp_systolic_dev_baseline`: Difference between current systolic BP and `baseline_bp_systolic`.
- `bp_systolic_rolling_3d_mean`: 3-day causal rolling mean of valid systolic BP readings.
- `bp_systolic_rolling_7d_mean`: 7-day causal rolling mean of valid systolic BP readings.
- `bp_systolic_sustained_high`: Boolean flag indicating systolic BP $> 140\text{ mmHg}$ or $\Delta_{baseline} > +20\text{ mmHg}$ across at least 2 readings in 3 days.
- `bp_diastolic_latest`, `bp_diastolic_dev_baseline`, `bp_diastolic_rolling_3d_mean`.
- `spo2_latest`: Most recent SpO2 reading on date $t$.
- `spo2_dev_baseline`: Difference between latest SpO2 and `baseline_spo2`.
- `spo2_rolling_3d_mean`: 3-day causal rolling mean.
- `spo2_hypoxia_flag`: Boolean flag if latest SpO2 $\le 92.0\%$.
- `blood_glucose_latest`, `glucose_dev_baseline`, `glucose_rolling_3d_mean`.
- `weight_latest`, `weight_change_7d`: Net change in body weight over the past 7 days.

### 3.2 Activity & Sleep Features
- `steps_latest`: Pedometer steps on date $t$.
- `steps_ratio_baseline`: $\text{steps} / \max(500, \text{baseline\_steps})$.
- `steps_rolling_3d_ratio`: 3-day causal average steps divided by baseline steps.
- `steps_rolling_7d_ratio`: 7-day causal average steps divided by baseline steps.
- `steps_sustained_drop`: Boolean flag if 3-day ratio $< 0.60$ (over 40% reduction from personal baseline).
- `sleep_hours_latest`: Nocturnal sleep duration on date $t$.
- `sleep_dev_baseline`: $\text{sleep\_hours} - \text{baseline\_sleep\_hours}$.
- `sleep_disruption_flag`: True if $|\Delta_{\text{sleep}}| \ge 2.5\text{ hours}$ or sleep $< 4.5\text{ hours}$.
- `appetite_latest`, `appetite_dev_baseline`: Change in 1–5 appetite score from personal baseline.
- `mood_latest`, `mood_dev_baseline`: Change in 1–5 mood score from personal baseline.

### 3.3 Medication Adherence Features
- `scheduled_doses_today`, `taken_doses_today`, `missed_doses_today`, `unknown_doses_today`.
- `adherence_rate_3d`: Confirmed taken doses divided by scheduled doses over the past 3 days (calculated only when $\sum \text{scheduled} > 0$).
- `consecutive_missed_doses_3d`: Count of confirmed missed doses in the 3-day window.
- `consecutive_miss_flag`: True if $\ge 2$ scheduled doses missed in 3 days.
- `unknown_med_count_3d`: Count of unverified dose events in the 3-day window.

### 3.4 Unstructured NLP Clinical Cue Features
Extracted using `src/features/nlp_extractor.py` from raw check-in notes within a 3-day sliding window:
- `cue_fall_current`: Confirmed current fall mention (`cue_value == "present"`, `negation_status == False`, `temporal_context == "current"`).
- `cue_fall_historical`: Historical fall mention (`temporal_context == "historical"`). **Does not trigger acute fall alert.**
- `cue_weakness_current`: Current weakness / unusual fatigue complaint.
- `cue_dizziness_current`: Current dizziness / unsteadiness complaint.
- `cue_chest_pain_or_severe_pain`: Acute pain mention.
- `cue_confusion_current`: Cognitive disorientation / memory lapse mention.
- `cue_low_appetite_current`: Stated loss of hunger / skipped meals.
- `cue_poor_sleep_current`: Insomnia / restless night mention.
- `cue_medication_issue_current`: Stated difficulty opening strips or forgotten tablets.
- `cue_loneliness_or_distress`: Low mood / social isolation mention.
- `cue_negated_count`: Count of explicit symptom denials (e.g., *"Mujhe koi dard nahi hai"*).
- `cue_uncertain_count`: Count of uncertain statements (e.g., *"Shayad chakkar aa rahe the"*).

### 3.5 Family Observation Features (Consent-Gated)
- `family_mobility_concern_3d`: Caregiver reported unsteadiness / gait slowing.
- `family_appetite_concern_3d`: Caregiver reported meal refusal / weight drop.
- `family_routine_disruption_3d`: Caregiver reported confusion / skipped routines.

### 3.6 Data Quality & Confidence Features
- `vitals_freshness_days`: Number of days elapsed since the last valid vital measurement.
- `activity_missing_3d`: Number of missing pedometer days in the past 3 days (0 to 3).
- `checkin_missing_3d`: Number of missed check-in calls in the past 3 days (0 to 3).
- `data_confidence`: Composite rating (`HIGH`, `MEDIUM`, `LOW`) based on telemetry completeness and freshness.
- `baseline_confidence`: Rating (`HIGH`, `MEDIUM`, `LOW`) indicating reliability of the individual baseline.

---

## 4. Missingness & Non-Inference Invariants

1. **Non-Inference Rule**: A missing vital reading or absent pedometer log is **never** interpreted as good health or bad health.
2. **Missing Numeric Representation**: Null readings are preserved as `NaN`. Imputing zero is strictly prohibited.
3. **Rolling Computations**: Rolling averages require at least one valid measurement within the lookback window. If all days in the window are null, the rolling feature is null, and the missingness indicator is incremented.
4. **Unknown vs. Missed Medication**: An `unknown` medication event is tracked under `unknown_doses` and is **never** counted as a confirmed `missed` dose.

---

## 5. Strict Quarantining of Evaluation Ground Truth

To avoid target leakage:
1. `data/evaluation/decline_episodes.csv` is accessed **only** by `src/evaluation/evaluate_risk_engine.py`.
2. Columns `planted`, `severity_category`, `expected_escalation`, `scenario_id`, and `scenario_description` are banned from all feature extraction modules, scoring algorithms, and API response models.
3. Automated unit tests ([`tests/test_ground_truth.py`](file:///c:/Users/user/Desktop/dev%20104/tests/test_ground_truth.py)) continuously verify that no feature dataset contains ground-truth columns.

