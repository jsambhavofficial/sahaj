# SamarthCare AI — Master Dataset Dictionary (`master_dataset.csv`)

This document provides the formal data dictionary for the consolidated, self-contained master file:

`data/processed/master_dataset.csv`

---

## 1. Grain and Primary Key

- **Entity Level**: Senior-Day. Exactly one row per enrolled senior citizen on each consecutive calendar date.
- **Primary Key**: Composite `(senior_id, date)`.
- **Row Count**: Exactly 18,000 rows (200 seniors $\times$ 90 days from `2026-01-01` to `2026-03-31`).
- **Ordering**: Deterministic sort by `senior_id ASC, date ASC`.
- **Target Leakage Status**: **ZERO LEAKAGE**. All future decline ground-truth labels are strictly quarantined in `data/evaluation/master_dataset_with_ground_truth.csv`.

---

## 2. Master CSV Column Specifications

| Column Name | Data Type | Units / Encoding | Nullable | Field Category | Description |
|:---|:---|:---:|:---:|:---:|:---|
| `senior_id` | String | Format `S\d{4}` | No | Core Spine Key | Unique senior cohort identifier (`S0001` - `S0200`). |
| `date` | Date | `YYYY-MM-DD` | No | Core Spine Key | Calendar date (`2026-01-01` to `2026-03-31`). |
| `age` | Integer | Years | No | Demographic | Synthetic age of the senior. |
| `preferred_language` | String | Categorical | No | Demographic | Primary language (`hindi`, `hinglish`, `english`). |
| `city` | String | Categorical | No | Operational | Metro jurisdiction (`CITY_DELHI`, `CITY_GURUGRAM`, etc.). |
| `living_arrangement` | String | Categorical | No | Demographic | Household setup (`alone`, `with_spouse`, `with_family`). |
| `coordinator_id` | String | Format `COORD_\d{3}` | No | Operational | Assigned Care Coordinator. |
| `checkin_frequency` | String | Categorical | No | Operational | Scheduled communication frequency (`daily`, `alternate_days`, `weekly_3x`). |
| `consent_status` | Boolean | True / False | No | Governance | Caregiver observation consent indicator (`family_consent`). |
| `cohort_start_date` | Date | `YYYY-MM-DD` | No | Operational | Enrollment observation start date (`2026-01-01`). |
| `cohort_end_date` | Date | `YYYY-MM-DD` | No | Operational | Enrollment observation end date (`2026-03-31`). |
| `steps` | Integer / Float | Steps / day | Yes | Activity (Scalar) | Pedometer steps on date (null if uncharged/missing). |
| `sleep_hours` | Float | Hours / day | Yes | Activity (Scalar) | Nocturnal rest duration on date (null if unworn). |
| `appetite_level` | Float | 1 - 5 Scale | Yes | Activity (Scalar) | Subjective daily appetite (1=very poor, 5=excellent). |
| `mood_level` | Float | 1 - 5 Scale | Yes | Activity (Scalar) | Subjective daily mood (1=distressed, 5=calm/happy). |
| `baseline_json` | JSON Object | UTF-8 String | No | Model Input (Baseline) | Complete steady-state baseline reference priors. |
| `vitals_json` | JSON Array | UTF-8 String | No | Model Input (Raw Vitals) | Array of all vital measurement readings for date. |
| `medication_json` | JSON Array | UTF-8 String | No | Model Input (Medications)| Array of all scheduled dose events & prescription metadata for date. |
| `checkins_json` | JSON Array | UTF-8 String | No | Model Input (Dialogues) | Array of conversational check-in notes & ground-truth NLP cues. |
| `activity_json` | JSON Object | UTF-8 String | No | Model Input (Activity) | Complete daily pedometer, sleep, and telemetry capture status. |
| `family_observations_json` | JSON Array | UTF-8 String | No | Model Input (Caregiver) | Array of collateral caregiver notes (consent-governed). |
| `risk_score` | Integer | 0 - 100 Scale | No | Model Prediction | Phase 2 calculated daily early warning risk score. |
| `risk_level` | String | Categorical | No | Model Prediction | `LOW`, `MODERATE`, `HIGH`, `URGENT_REVIEW`. |
| `risk_confidence` | String | Categorical | No | Model Prediction | Telemetry confidence (`HIGH`, `MEDIUM`, `LOW`). |
| `baseline_confidence` | String | Categorical | No | Model Prediction | Personal baseline reliability (`HIGH`, `MEDIUM`, `LOW`). |
| `top_contributing_factors_json` | JSON Array | UTF-8 String | No | Model Explanation | Ranked contributing clinical rules, evidence, & points. |
| `recommended_action` | String | Free Text | No | Operational Advice | Proportionate triage next-step for human coordinator. |
| `data_quality_flags_json` | JSON Array | UTF-8 String | No | Model Explanation | Telemetry freshness & missingness advisory warnings. |
| `active_alerts_json` | JSON Array | UTF-8 String | No | Operational Alerts | Array of active deduplicated alert objects on this date. |
| `scoring_version` | String | SemVer | No | Governance | Risk scoring engine version (`2.0.0`). |

---

## 3. JSON Structures & Schemas

### 3.1 `baseline_json` (Object)
Stored once per senior-day representing the senior's habitual pre-observation priors:
```json
{
  "baseline_bp_systolic": 128.0,
  "baseline_bp_diastolic": 76.0,
  "baseline_blood_glucose": 108.0,
  "baseline_glucose_context": "fasting",
  "baseline_spo2": 96.8,
  "baseline_weight": 68.0,
  "baseline_steps": 3200,
  "baseline_active_minutes": 45,
  "baseline_sleep_hours": 7.1,
  "baseline_appetite_level": 4.3,
  "baseline_mood_level": 4.2,
  "baseline_med_adherence_tendency": 0.92,
  "baseline_checkin_participation_tendency": 0.88,
  "baseline_confidence": "HIGH"
}
```

### 3.2 `vitals_json` (Array)
Preserves all individual measurement readings recorded on that calendar date:
```json
[
  {
    "measurement_id": "M0000001",
    "timestamp": "2026-01-01 08:14:22",
    "measurement_type": "blood_pressure_systolic",
    "measurement_value": 126.5,
    "unit": "mmHg",
    "measurement_context": "resting",
    "measurement_source": "home_bp_monitor",
    "quality_status": "valid"
  },
  {
    "measurement_id": "M0000002",
    "timestamp": "2026-01-01 08:14:22",
    "measurement_type": "blood_pressure_diastolic",
    "measurement_value": 78.0,
    "unit": "mmHg",
    "measurement_context": "resting",
    "measurement_source": "home_bp_monitor",
    "quality_status": "valid"
  }
]
```
*(Empty array `[]` if no readings recorded on date).*

### 3.3 `medication_json` (Array)
Preserves all scheduled dose administrations and status outcomes:
```json
[
  {
    "medication_event_id": "ME0000001",
    "medication_id": "MED_S0001_01",
    "scheduled_timestamp": "2026-01-01 08:00:00",
    "status": "taken",
    "actual_timestamp": "2026-01-01 08:12:30",
    "record_source": "smart_pillbox",
    "verification_status": "verified",
    "scheduled_times_per_day": 1
  }
]
```

### 3.4 `checkins_json` (Array)
Preserves conversational text in Hindi, Hinglish, and English along with linked ground-truth NLP annotations:
```json
[
  {
    "checkin_id": "CHK_000001",
    "timestamp": "2026-01-01 10:24:00",
    "channel": "phone_call",
    "language": "hindi",
    "raw_note": "आज सब ठीक है, सुबह पार्क में टहलने गए थे।",
    "transcription_status": "verified",
    "consent_status": "consented",
    "source_role": "care_coordinator",
    "annotations": [
      {
        "annotation_id": "ANN_000001",
        "cue_type": "no_new_concern",
        "cue_value": "present",
        "temporal_context": "current",
        "negation_status": false,
        "confidence": 0.95,
        "source_role": "care_coordinator"
      }
    ]
  }
]
```

### 3.5 `family_observations_json` (Array)
Preserves caregiver collateral notes (strictly consent-governed):
```json
[
  {
    "observation_id": "FAM_000001",
    "timestamp": "2026-01-01 14:30:00",
    "observer_role": "daughter",
    "observation_type": "general_wellbeing",
    "note": "Overall looking healthy and energetic during our weekend visit.",
    "consent_valid": true,
    "verification_status": "coordinator_reviewed"
  }
]
```

---

## 4. How to Read and Filter with Python Pandas

```python
import pandas as pd
import json

# 1. Load the master dataset with UTF-8 encoding
df = pd.read_csv("data/processed/master_dataset.csv", encoding="utf-8")

# 2. Filter high-risk senior days
urgent_days = df[df["risk_level"] == "URGENT_REVIEW"]
print(f"Total Urgent Days: {len(urgent_days)}")

# 3. Parse JSON vitals for a specific senior and date
row = df[(df["senior_id"] == "S0015") & (df["date"] == "2026-02-15")].iloc[0]
vitals = json.loads(row["vitals_json"])
print("Vitals recorded on date:", vitals)

# 4. Extract raw check-in notes
checkins = json.loads(row["checkins_json"])
for note in checkins:
    print(f"[{note['language']}] {note['raw_note']}")
```

---

## 5. Column Safety & Governance Boundaries

- **Input Features (Safe for Model Input)**: `senior_id`, `date`, `age`, `preferred_language`, `city`, `living_arrangement`, `checkin_frequency`, `consent_status`, `steps`, `sleep_hours`, `appetite_level`, `mood_level`, `baseline_json`, `vitals_json`, `medication_json`, `checkins_json`, `activity_json`, `family_observations_json`.
- **Model Predictions (Derived Phase 2 Outputs)**: `risk_score`, `risk_level`, `risk_confidence`, `baseline_confidence`, `top_contributing_factors_json`, `recommended_action`, `data_quality_flags_json`, `active_alerts_json`, `scoring_version`.
- **Evaluation-Only Ground Truth (Quarantined)**: Available only in `data/evaluation/master_dataset_with_ground_truth.csv` and `data/evaluation/decline_episodes.csv`.

