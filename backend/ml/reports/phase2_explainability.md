# SamarthCare AI — Phase 2 Explainability & Rationale Report

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
=== Risk Assessment Summary for Senior S0001 on 2026-01-11 ===
Risk Score:        15 / 100
Risk Level:        LOW
Model Confidence:  LOW
Baseline Quality:  HIGH

Top Contributing Clinical Factors:
  1. Caregiver observations independently report unsteadiness or routine disruption. (Timeframe: 7-day window, Rule: RULE_FAMILY_CORROBORATION)

Recommended Coordinator Action:
  Coordinate with family caregiver to align on observations and support requirements.

Data Quality & Telemetry Notes:
  - No valid blood pressure reading recorded today.
```

### Case B: Multi-Modal Gradual Decline (High Risk)
```
=== Risk Assessment Summary for Senior S0004 on 2026-03-07 ===
Risk Score:        54 / 100
Risk Level:        HIGH
Model Confidence:  HIGH
Baseline Quality:  HIGH

Top Contributing Clinical Factors:
  1. Daily step count averaged only 53% of senior's personal baseline over 3 consecutive days. (Timeframe: 3-day rolling window, Rule: RULE_SUSTAINED_MOBILITY_DROP)
  2. Multiple scheduled doses confirmed missed (2 doses missed over past 3 days). (Timeframe: 3-day rolling window, Rule: RULE_MEDICATION_MISSED_DOSES)

Recommended Coordinator Action:
  Inquire about physical mobility, joint stiffness, pain flares, or unsteadiness during scheduled check-in.

Data Quality & Telemetry Notes:
  - Complete daily telemetry recorded across vitals, activity, and communication.
```

### Case C: Acute Safety Tripwire (Urgent Review)
```
=== Risk Assessment Summary for Senior S0001 on 2026-03-31 ===
Risk Score:        100 / 100
Risk Level:        URGENT_REVIEW
Model Confidence:  HIGH
Baseline Quality:  HIGH

Top Contributing Clinical Factors:
  1. Pulse oximeter reading indicated acute hypoxia (92.4% SpO2). [CRITICAL SAFETY TRIPWIRE] (Timeframe: Today / 3-day mean, Rule: RULE_ACUTE_HYPOXIA)
  2. Daily step count averaged only 49% of senior's personal baseline over 3 consecutive days. (Timeframe: 3-day rolling window, Rule: RULE_SUSTAINED_MOBILITY_DROP)
  3. Objective sensor drop in activity is corroborated by subjective conversational complaints of weakness or dizziness. (Timeframe: 3-day window, Rule: RULE_CORROBORATED_DECLINE)
  4. Check-in dialogue note captured active complaints of unusual weakness or physical exhaustion. (Timeframe: Past 72 hours, Rule: RULE_NLP_WEAKNESS)

Recommended Coordinator Action:
  Immediate follow-up required. Check probe placement, enquire about breathing difficulty, and seek prompt clinical attention if sustained.

Data Quality & Telemetry Notes:
  - No valid blood pressure reading recorded today.
  - Senior has missed 2 or more scheduled check-in calls in the past 3 days.
  - 1 medication dose status(es) remain unverified.
```
