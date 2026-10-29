# SamarthCare AI — Source-to-Master Lineage & Lossless Reconciliation

This document details the exact mapping from every Phase 1 and Phase 2 source dataset to the consolidated `data/processed/master_dataset.csv`, providing record-level accounting and reconciliation audits.

---

## 1. Executive Reconciliation Summary

| Source Dataset | Source Entity | Source Record Count | Master Mapping Destination | Master Reconciled Count | Unmapped Records | Reconciliation Status |
|:---|:---|:---:|:---|:---:|:---:|:---:|
| `senior_profiles.csv` | Senior | 200 | Demographic Columns | 200 | 0 | 100% RECONCILED |
| `senior_baselines.csv` | Senior | 200 | `baseline_json` | 200 | 0 | 100% RECONCILED |
| `daily_activity.csv` | Senior-Day | 18,000 | `activity_json` & Scalar Cols | 18,000 | 0 | 100% RECONCILED |
| `vitals.csv` | Measurement | 55,581 | `vitals_json` | 55,581 | 0 | 100% RECONCILED |
| `medication_schedules.csv`| Schedule | 434 | Nested in `medication_json` | 434 | 0 | 100% RECONCILED |
| `medication_events.csv` | Event | 52,110 | `medication_json` | 52,110 | 0 | 100% RECONCILED |
| `checkins.csv` | Interaction | 12,828 | `checkins_json` | 12,828 | 0 | 100% RECONCILED |
| `nlp_annotations.csv` | Cue Label | 15,933 | Nested in `checkins_json` | 15,933 | 0 | 100% RECONCILED |
| `family_observations.csv`| Caregiver Note| 2,167 | `family_observations_json` | 2,167 | 0 | 100% RECONCILED |
| `daily_risk_scores.csv` | Prediction | 18,000 | Risk Prediction Columns | 18,000 | 0 | 100% RECONCILED |
| `alert_events.csv` | Alert Event | 546 | `active_alerts_json` | 546 | 0 | 100% RECONCILED |
| **Total Unmapped Exceptions** | — | — | — | — | **0** | **ZERO UNMAPPED** |

---

## 2. Table-by-Table Source Mapping Details

### 2.1 `data/raw/senior_profiles.csv` (200 records)
- `senior_id` $\rightarrow$ `master_dataset.senior_id` (Primary Key Component)
- `age` $\rightarrow$ `master_dataset.age`
- `preferred_language` $\rightarrow$ `master_dataset.preferred_language`
- `city_id` $\rightarrow$ `master_dataset.city`
- `living_arrangement` $\rightarrow$ `master_dataset.living_arrangement`
- `coordinator_id` $\rightarrow$ `master_dataset.coordinator_id`
- `expected_checkin_frequency` $\rightarrow$ `master_dataset.checkin_frequency`
- `family_consent` $\rightarrow$ `master_dataset.consent_status`
- `cohort_start_date` $\rightarrow$ `master_dataset.cohort_start_date`
- `cohort_end_date` $\rightarrow$ `master_dataset.cohort_end_date`

### 2.2 `data/raw/senior_baselines.csv` (200 records)
Serialized into `master_dataset.baseline_json` on every day for that senior, preserving:
`baseline_bp_systolic`, `baseline_bp_diastolic`, `baseline_blood_glucose`, `baseline_glucose_context`, `baseline_spo2`, `baseline_weight`, `baseline_steps`, `baseline_active_minutes`, `baseline_sleep_hours`, `baseline_appetite_level`, `baseline_mood_level`, `baseline_med_adherence_tendency`, `baseline_checkin_participation_tendency`, `baseline_confidence`.

### 2.3 `data/raw/vitals.csv` (55,581 records)
Grouped by `(senior_id, date)` where `date = timestamp[:10]`.
Each record is losslessly added as an object into `master_dataset.vitals_json` preserving:
`measurement_id`, `timestamp`, `measurement_type`, `measurement_value`, `unit`, `measurement_context`, `measurement_source`, `quality_status`.

### 2.4 `data/raw/medication_schedules.csv` & `medication_events.csv` (52,110 events)
Grouped by `(senior_id, date)` where `date = scheduled_timestamp[:10]`.
Enriched with prescription schedule metadata (`scheduled_times_per_day`, `active_status`) and stored as an array of objects in `master_dataset.medication_json`.
Preserves `medication_event_id`, `medication_id`, `scheduled_timestamp`, `status`, `actual_timestamp`, `record_source`, `verification_status`.
*Unknown dose status is strictly preserved as `unknown` and never converted to `missed`.*

### 2.5 `data/raw/checkins.csv` (12,828 records) & `nlp_annotations.csv` (15,933 records)
1. Annotations in `nlp_annotations.csv` are indexed by `checkin_id`.
2. Check-ins in `checkins.csv` are grouped by `(senior_id, date)` where `date = timestamp[:10]`.
3. Each check-in object includes its full text (`raw_note`), `channel`, `language`, `timestamp`, `source_role`, `transcription_status`, and a nested array `annotations` containing all corresponding ground-truth cues (`annotation_id`, `cue_type`, `cue_value`, `temporal_context`, `negation_status`, `confidence`).
*Devanagari Hindi and Hinglish strings are losslessly preserved via UTF-8 serialization.*

### 2.6 `data/raw/daily_activity.csv` (18,000 records)
Indexed by `(senior_id, date)`.
- Serialized into `master_dataset.activity_json`.
- Key metrics (`steps`, `sleep_hours`, `appetite_level`, `mood_level`) are also exposed as top-level scalar columns for rapid filtering.
- Null values representing uncharged/unworn devices are preserved as `null` and **never replaced with zero**.

### 2.7 `data/raw/family_observations.csv` (2,167 records)
Grouped by `(senior_id, date)` where `date = timestamp[:10]`.
Preserves `observation_id`, `timestamp`, `observer_role`, `observation_type`, `note`, `consent_valid`, `verification_status` in `master_dataset.family_observations_json`.
*Zero records generated or mapped for seniors with `family_consent = False`.*

### 2.8 Phase 2 Predictions (`daily_risk_scores.csv` & `alert_events.csv`)
- `risk_score`, `risk_level`, `confidence_level`, `recommended_action`, `scoring_version` $\rightarrow$ top-level columns.
- `top_contributing_factors` $\rightarrow$ `master_dataset.top_contributing_factors_json`.
- `data_quality_flags` $\rightarrow$ `master_dataset.data_quality_flags_json`.
- Active alerts spanning the calendar date $\rightarrow$ `master_dataset.active_alerts_json`.

---

## 3. Quarantined Ground Truth (`master_dataset_with_ground_truth.csv`)

The production master dataset (`master_dataset.csv`) contains **zero** ground-truth decline labels.
For research and evaluation benchmarking, a separate file:

`data/evaluation/master_dataset_with_ground_truth.csv`

is exported. It appends:
- `is_in_decline_episode` (Boolean)
- `ground_truth_episode_id`
- `ground_truth_episode_type`
- `ground_truth_severity`
- `ground_truth_planted`
- `ground_truth_scenario_id`
- `ground_truth_expected_escalation`
- `ground_truth_scenario_description`

> **WARNING**: `master_dataset_with_ground_truth.csv` is strictly for offline evaluation and benchmark analysis. It must **never** be used as training feature input or in production inference.

