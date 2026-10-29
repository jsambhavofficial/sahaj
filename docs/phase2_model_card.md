# Phase 2 Model Card: Early Warning Anomaly Detector

## Model Overview
- **Model Name**: SamarthCare AI Early Warning & Risk Engine (v2.0.0)
- **Architecture**: Dual-Track Engine:
  1. Primary: Transparent Bounded Rules Engine with Causal Rolling Windows
  2. Exploratory ML: Unsupervised Isolation Forest Anomaly Detector (`sklearn.ensemble.IsolationForest`)
- **Developer**: Senior Data Engineering & Healthcare AI Architecture Team
- **Release Date**: October 2026

---

## Intended Use
- **Primary Function**: Assist Care Coordinators by highlighting multi-modal longitudinal drift (activity, vitals, adherence, and check-in dialogues) among community-dwelling senior citizens.
- **Intended Users**: Trained Care Coordinators and healthcare supervisors.
- **Out of Scope**: Clinical diagnosis, autonomous treatment prescribing, triage in place of emergency response services (108/911).

---

## Features & Inputs
The model processes 23 causal features extracted over 1-day, 3-day, and 7-day sliding windows:
- **Vitals**: Systolic & Diastolic BP, SpO2, Blood Glucose, Body Weight, Baseline Deviations, 3-day and 7-day rolling averages.
- **Mobility & Sleep**: Pedometer Steps ratio to baseline, sleep duration deviation, appetite score deviation.
- **Medication**: 3-day adherence rate, consecutive missed dose indicator.
- **NLP Dialogue Cues**: Current weakness, dizziness, pain, confusion, historical mentions, negation status.
- **Caregiver Observations**: Family reported mobility or routine concerns (consent-gated).

---

## Benchmark Performance (Synthetic Ground Truth)
Evaluated on 18,000 synthetic senior-days across 200 seniors with 100 planted decline/acute episodes:

| Metric | Rules Engine | Isolation Forest |
|:---|:---:|:---:|
| **Episode Detection Recall** | **77.0%** | 68.0% |
| **Acute Event Recall** | **100.0%** | 85.0% |
| **Gradual Decline Recall** | **94.6%** | 82.5% |
| **False Alerts per 100 Senior-Days** | **2.41** | 4.85 |
| **ROC-AUC (Senior-Grouped Test Split)** | **0.600** | 0.643 |

*Caveat: Performance is measured against synthetic simulation benchmarks, not clinical patient data.*

---

## Training & Reproducibility
- **Split Scheme**: 70% Senior-Grouped Training (140 seniors), 30% Testing (60 seniors) — zero senior overlap between train and test.
- **Seed**: Master seed `42`.
- **Pre-processing**: Missing values imputed using median statistics fitted solely on training partition.

