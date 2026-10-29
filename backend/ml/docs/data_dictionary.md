# SamarthCare AI — Data Dictionary (Phase 1)

This document provides the formal data dictionary for all synthetic datasets generated in Phase 1 of SamarthCare AI.
It defines schemas, data types, units, permitted value domains, null semantics, and referential constraints across raw, processed, and evaluation tables.

---

## 1. Raw Layer (`data/raw/`)

### 1.1 `senior_profiles.csv`
- **Description**: Master demographic and administrative registration table. Exactly one record per enrolled senior citizen.
- **Primary Key**: `senior_id`
- **Foreign Keys**: None

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `senior_id` | String | Format `S\d{4}` | No | `S0001` - `S0200` | Unique cohort identifier. |
| `age` | Integer | Years | No | Bounded `[60, 92]` | Synthetic demographic age. |
| `preferred_language` | String | Categorical | No | `"hindi"`, `"hinglish"`, `"english"` | Primary communication language. |
| `city_id` | String | Categorical | No | `"CITY_DELHI"`, `"CITY_GURUGRAM"`, `"CITY_NOIDA"`, etc. | Metro city administrative jurisdiction. |
| `living_arrangement` | String | Categorical | No | `"alone"`, `"with_spouse"`, `"with_family"` | Senior household composition. |
| `coordinator_id` | String | Format `COORD_\d{3}` | No | `COORD_001` - `COORD_010` | Assigned Care Coordinator. |
| `expected_checkin_frequency`| String | Categorical | No | `"daily"`, `"alternate_days"`, `"weekly_3x"` | Agreed communication cadence. |
| `family_consent` | Boolean | True / False | No | `True`, `False` | Caregiver data-sharing consent. |
| `cohort_start_date` | Date | `YYYY-MM-DD` | No | Default `"2026-01-01"` | Enrollment start date. |
| `cohort_end_date` | Date | `YYYY-MM-DD` | No | Default `"2026-03-31"` | Enrollment end date (90 days). |
| `synthetic_profile_seed` | Integer | 31-bit Integer | No | Derived deterministic hash | Per-senior random stream seed. |

---

### 1.2 `senior_baselines.csv`
- **Description**: Synthetic individual baseline reference parameters established prior to the longitudinal observation window.
- **Primary Key**: `senior_id`
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `senior_id` | String | Format `S\d{4}` | No | Matches `senior_profiles.senior_id` | Senior identifier. |
| `baseline_bp_systolic` | Float | mmHg | No | Simulated range `[110.0, 155.0]` | Habitual systolic blood pressure. |
| `baseline_bp_diastolic` | Float | mmHg | No | Simulated range `[64.0, 92.0]` | Habitual diastolic blood pressure. |
| `baseline_blood_glucose` | Float | mg/dL | No | Simulated range `[82.0, 195.0]` | Habitual blood glucose. |
| `baseline_glucose_context`| String | Categorical | No | `"fasting"`, `"post_meal"` | Context of baseline glucose value. |
| `baseline_spo2` | Float | % | No | Simulated range `[94.0, 99.0]` | Habitual blood oxygen saturation. |
| `baseline_weight` | Float | kg | No | Simulated range `[48.0, 96.0]` | Habitual body weight. |
| `baseline_steps` | Integer | Steps / day | No | Simulated range `[1100, 7500]` | Typical daily physical activity. |
| `baseline_active_minutes` | Integer | Minutes / day | No | Simulated range `[15, 90]` | Typical active exercise duration. |
| `baseline_sleep_hours` | Float | Hours / day | No | Simulated range `[5.2, 8.8]` | Habitual nightly sleep duration. |
| `baseline_appetite_level` | Float | 1 - 5 Scale | No | `[1.0, 5.0]`, typical `[3.2, 5.0]` | 1=Very poor, 5=Excellent appetite. |
| `baseline_mood_level` | Float | 1 - 5 Scale | No | `[1.0, 5.0]`, typical `[3.2, 5.0]` | 1=Severe distress, 5=Calm/positive. |
| `baseline_med_adherence_tendency` | Float | Ratio | No | `[0.78, 0.99]` | Habitual medication compliance. |
| `baseline_checkin_participation_tendency`| Float | Ratio | No | `[0.75, 0.99]` | Habitual check-in response rate. |

---

### 1.3 `vitals.csv`
- **Description**: Measurement-level physiological observations captured from domestic medical devices.
- **Primary Key**: `measurement_id`
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `measurement_id` | String | Format `M\d{7}` | No | Sequential identifier | Primary key. |
| `senior_id` | String | Format `S\d{4}` | No | Valid senior ID | Senior identifier. |
| `timestamp` | Timestamp | `YYYY-MM-DD HH:MM:SS` | No | Within cohort date range | Exact recording timestamp. |
| `measurement_type` | String | Categorical | No | `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_glucose`, `spo2`, `weight` | Vital sign type. |
| `measurement_value` | Float | Respective units | No | Plausible physical bounds | Measured physiological value. |
| `unit` | String | Unit string | No | `mmHg`, `mg/dL`, `%`, `kg` | Unit of measure. |
| `measurement_context` | String | Categorical | No | `fasting`, `post_meal`, `resting`, `random`, `standing` | Context during acquisition. |
| `measurement_source` | String | Categorical | No | `home_bp_monitor`, `glucometer`, `pulse_oximeter`, `smart_scale`, `coordinator_device` | Device or acquisition modality. |
| `quality_status` | String | Categorical | No | `valid`, `questionable`, `device_artifact` | Telemetric quality flag. |

---

### 1.4 `daily_activity.csv`
- **Description**: Daily physical activity, mobility summary, and subjective wellbeing metrics.
- **Primary Key**: Composite (`senior_id`, `date`)
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `senior_id` | String | Format `S\d{4}` | No | Valid senior ID | Senior identifier. |
| `date` | Date | `YYYY-MM-DD` | No | Consecutive 90 days | Observation date. |
| `steps` | Integer / Float | Steps | Yes | `[0, 15000]` or Null (NaN) | Total daily steps (null if sensor dead). |
| `active_minutes` | Integer / Float | Minutes | Yes | `[0, 240]` or Null (NaN) | Moderate-to-vigorous activity time. |
| `sleep_hours` | Float | Hours | Yes | `[0.0, 14.0]` or Null (NaN) | Tracked nocturnal rest. |
| `appetite_level` | Float | 1 - 5 Scale | Yes | `[1.0, 5.0]` or Null | Subjective appetite score. |
| `mood_level` | Float | 1 - 5 Scale | Yes | `[1.0, 5.0]` or Null | Subjective mood score. |
| `social_contact_count`| Integer | Count | Yes | `[0, 6]` or Null | Discrete interpersonal interactions. |
| `activity_source` | String | Categorical | No | `smartwatch_pedometer`, `manual_coordinator_log`, `family_reported` | Telemetry origin. |
| `data_available` | Boolean | True / False | No | `True`, `False` | Sensor battery / capture indicator. |

---

### 1.5 `medication_schedules.csv` & `medication_events.csv`
- **Description**: Prescription regimen definitions and corresponding longitudinal dose administration events.
- **Primary Key (`schedules`)**: `medication_id`
- **Primary Key (`events`)**: `medication_event_id`
- **Foreign Keys**: `medication_events.medication_id` -> `medication_schedules.medication_id`

| Field Name | Table | Data Type | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `medication_id` | Both | String | No | Format `MED_S\d{4}_\d{2}` | Synthetic prescription identifier. |
| `scheduled_start_date`| Schedules | Date | No | `YYYY-MM-DD` | Treatment start date. |
| `scheduled_end_date` | Schedules | Date | No | `YYYY-MM-DD` | Regimen expiration date. |
| `scheduled_times_per_day`| Schedules | Integer | No | `1`, `2`, `3` | Prescribed daily administration frequency. |
| `active_status` | Schedules | Boolean | No | `True`, `False` | Active clinical schedule indicator. |
| `medication_event_id` | Events | String | No | Format `ME\d{7}` | Single dose event primary key. |
| `scheduled_timestamp` | Events | Timestamp | No | `YYYY-MM-DD HH:MM:SS` | Designated time of dose. |
| `status` | Events | String | No | `taken`, `missed`, `unknown`, `not_scheduled` | Dose administration outcome. |
| `actual_timestamp` | Events | Timestamp | Yes | `YYYY-MM-DD HH:MM:SS` or Null | Actual ingestion time (null if missed/unknown). |
| `record_source` | Events | String | No | `smart_pillbox`, `senior_app_confirmation`, `coordinator_call` | Logging device or medium. |
| `verification_status` | Events | String | No | `verified`, `self_reported`, `unverified` | Clinical confirmation level. |

---

### 1.6 `checkins.csv`
- **Description**: Raw transcriptions and unstructured interaction logs between seniors, Coordinators, and support staff.
- **Primary Key**: `checkin_id`
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `checkin_id` | String | Format `CHK_\d{6}` | No | Unique check-in identifier | Primary key. |
| `senior_id` | String | Format `S\d{4}` | No | Valid senior ID | Senior identifier. |
| `timestamp` | Timestamp | `YYYY-MM-DD HH:MM:SS` | No | Within cohort window | Interaction occurrence time. |
| `channel` | String | Categorical | No | `phone_call`, `coordinator_visit`, `whatsapp_voice`, `app_checkin` | Communication modality. |
| `language` | String | Categorical | No | `hindi`, `hinglish`, `english` | Spoken / typed language. |
| `raw_note` | String | Free text | No | Natural conversational text | Unstructured dialogue note. |
| `transcription_status` | String | Categorical | No | `verified`, `auto_transcribed`, `draft` | Speech-to-text status. |
| `consent_status` | String | Categorical | No | `consented`, `pending` | Check-in consent verification. |
| `source_role` | String | Categorical | No | `care_coordinator`, `senior_citizen`, `support_staff` | Author role. |
| `synthetic_scenario_id`| String | Categorical | No | Active scenario subtype ID | Generating scenario context. |

---

### 1.7 `family_observations.csv`
- **Description**: Collateral caregiver notes recorded by family members (governed strictly by `family_consent`).
- **Primary Key**: `observation_id`
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Format | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---|:---:|:---|:---|
| `observation_id` | String | Format `FAM_\d{6}` | No | Unique observation identifier | Primary key. |
| `senior_id` | String | Format `S\d{4}` | No | Valid senior ID with `family_consent=True` | Senior identifier. |
| `timestamp` | Timestamp | `YYYY-MM-DD HH:MM:SS` | No | Within cohort window | Timestamp of observation. |
| `observer_role` | String | Categorical | No | `son`, `daughter`, `daughter_in_law`, `spouse`, `grandchild` | Caregiver familial relationship. |
| `observation_type` | String | Categorical | No | `mobility_change`, `appetite_change`, `mood_change`, `sleep_pattern`, `routine_disruption`, `general_wellbeing` | Domain of observation. |
| `note` | String | Free text | No | Natural English caregiver note | Collateral narrative note. |
| `consent_valid` | Boolean | True / False | No | Must be `True` | Consent validation invariant. |
| `verification_status` | String | Categorical | No | `coordinator_reviewed`, `unverified_family_report`, `pending_review` | Staff review flag. |

---

## 2. Processed Layer (`data/processed/`)

### 2.1 `daily_master.csv`
- **Description**: Canonical, consolidated analytical longitudinal table containing exactly one row per senior per date (200 x 90 = 18,000 rows).
- **Primary Key**: Composite (`senior_id`, `date`)
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Units / Nullable | Description & Aggregation Semantics |
|:---|:---|:---:|:---|
| `senior_id` | String | No | Senior ID (`S0001` - `S0200`). |
| `date` | Date (`YYYY-MM-DD`) | No | Continuous calendar date (`2026-01-01` to `2026-03-31`). |
| `steps` | Float | Yes | Total daily pedometer steps (NaN if device uncharged/missing). |
| `active_minutes` | Float | Yes | Active exercise duration in minutes (NaN if missing). |
| `sleep_hours` | Float | Yes | Tracked nocturnal rest in hours (NaN if missing). |
| `appetite_level` | Float | Yes | 1 to 5 scale appetite score (NaN if unrecorded). |
| `mood_level` | Float | Yes | 1 to 5 scale mood score (NaN if unrecorded). |
| `social_contact_count`| Float / Int | Yes | Count of social contacts (NaN if unrecorded). |
| `bp_systolic_mmhg` | Float | Yes | Mean daily valid systolic BP in mmHg (NaN if unmeasured). |
| `bp_diastolic_mmhg` | Float | Yes | Mean daily valid diastolic BP in mmHg (NaN if unmeasured). |
| `blood_glucose_mg_dl`| Float | Yes | Mean daily valid blood glucose in mg/dL (NaN if unmeasured). |
| `glucose_context` | String | Yes | Primary daily glucose context (`fasting`, `post_meal`, or empty). |
| `spo2_percent` | Float | Yes | Mean daily valid oxygen saturation in % (NaN if unmeasured). |
| `weight_kg` | Float | Yes | Daily body weight in kg (NaN if unmeasured). |
| `scheduled_doses` | Integer | No | Count of medication doses scheduled for this calendar date. |
| `taken_doses` | Integer | No | Count of confirmed doses taken on this date. |
| `missed_doses` | Integer | No | Count of confirmed doses missed on this date. |
| `unknown_doses` | Integer | No | Count of unverified / indeterminate dose events on this date. |
| `checkin_completed` | Boolean | No | `True` if at least 1 check-in note was logged on this date; else `False`. |
| `family_observation_available` | Boolean | No | `True` if at least 1 caregiver observation logged on this date; else `False`. |
| `missing_vitals_count` | Integer | No | Count of null vitals on this date (0 to 4). |
| `missing_activity_flag`| Boolean | No | `True` if steps or active_minutes is NaN; else `False`. |
| `missing_checkin_flag` | Boolean | No | `True` if checkin_completed is False; else `False`. |
| `data_completeness_flag`| String | No | Categorical tier: `"complete"`, `"partial"`, `"sparse"`. |

---

### 2.2 `nlp_annotations.csv`
- **Description**: Isolated synthetic ground truth linguistic and clinical cues extracted from check-in notes.
- **Primary Key**: `annotation_id`
- **Foreign Keys**: `checkin_id` -> `checkins.checkin_id`

| Field Name | Data Type | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---:|:---|:---|
| `annotation_id` | String | No | Format `ANN_\d{6}` | Unique annotation identifier. |
| `checkin_id` | String | No | Valid `checkin_id` | Linked check-in note. |
| `cue_type` | String | No | `weakness`, `pain`, `low_appetite`, `poor_sleep`, `low_mood`, `loneliness`, `confusion`, `dizziness`, `fall`, `medication_issue`, `no_new_concern` | Controlled clinical cue type. |
| `cue_value` | String | No | `present`, `absent`, `uncertain` | Semantic manifestation value. |
| `temporal_context` | String | No | `current`, `historical`, `future_anticipated` | Temporal frame of reference. |
| `negation_status` | Boolean | No | `True`, `False` | Syntactic/semantic negation indicator. |
| `source_role` | String | No | `care_coordinator`, `senior_citizen`, `support_staff` | Perspective of speaker/author. |
| `annotation_confidence`| Float | No | `[0.0, 1.0]`, default `0.95` | Ground-truth confidence rating. |
| `annotation_source` | String | No | `"synthetic_ground_truth"` | Synthetic origin label. |

---

## 3. Evaluation Layer (`data/evaluation/`)

### 3.1 `decline_episodes.csv`
- **Description**: Hidden evaluation ground truth defining planted scenarios, clinical deterioration trajectories, and expected care escalation pathways.
- **Primary Key**: `episode_id`
- **Foreign Keys**: `senior_id` -> `senior_profiles.senior_id`

| Field Name | Data Type | Nullable | Permitted Values / Constraints | Description |
|:---|:---|:---:|:---|:---|
| `episode_id` | String | No | Format `EP_\d{5}` | Unique episode identifier. |
| `senior_id` | String | No | Valid senior ID | Senior identifier. |
| `episode_type` | String | No | `stable_baseline`, `intermittent_concern`, `gradual_decline`, `acute_event`, `recovery_trajectory` | High-level clinical trajectory category. |
| `onset_date` | Date | No | `YYYY-MM-DD` within cohort window | Synthetic onset date of process. |
| `end_date` | Date | No | `YYYY-MM-DD` >= `onset_date` | Synthetic conclusion date of episode. |
| `severity_category` | String | No | `none`, `mild`, `moderate`, `severe`, `critical` | Peak physiological or functional severity. |
| `planted` | Boolean | No | `True` for deterioration scenarios; `False` for stable baseline | Ground-truth anomaly flag. |
| `scenario_id` | String | No | Specific scenario subtype identifier (e.g. `SCEN_ACUTE_FALL_INCIDENT`) | Granular simulation scenario ID. |
| `expected_escalation`| String | No | `routine_monitoring`, `care_coordinator_followup`, `urgent_family_notification`, `immediate_clinical_escalation` | Recommended human-in-the-loop triage action. |
| `scenario_description`| String | No | Descriptive narrative | Clinical mechanism and simulation notes. |

