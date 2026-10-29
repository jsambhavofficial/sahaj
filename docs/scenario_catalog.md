# SamarthCare AI — Scenario Catalog

This catalog documents the synthetic clinical scenarios, temporal progression rules, multi-signal indicators, recovery behaviors, and expected Care Coordinator triage escalations implemented in Phase 1.

---

## Scenario Distribution Overview

| Category | Cohort Proportion | Target Count (Cohort 200) | Primary Triage Objective |
|:---|:---:|:---:|:---|
| **Stable Baseline** | 50% | 100 seniors | Benchmarking normal longitudinal variation and false-positive suppression. |
| **Intermittent Concerns** | 20% | 40 seniors | Evaluating self-limiting flare detection without unnecessary panic escalation. |
| **Gradual Decline** | 20% | 40 seniors | Evaluating early-warning sensitivity to multi-week, cross-modal subtle decline. |
| **Acute Safety Events** | 10% | 20 seniors | Validating urgent tripwire escalation for critical elder emergencies. |

---

## 1. Stable Baseline Scenarios (`planted = False`)

### 1.1 `SCEN_STABLE_ACTIVE` & `SCEN_STABLE_SEDENTARY`
- **Onset & Duration**: Spans the entire 90-day observation window (`2026-01-01` to `2026-03-31`).
- **Generation Rules**: Signal values fluctuate around individual baselines with $\text{AR}(1)$ noise. Zero sustained drift.
- **Observed Signals**:
  - Daily steps within $\pm 15\%$ of baseline.
  - Vitals within personal physiological boundaries.
  - Check-in dialogues express normal daily activities and positive wellbeing (e.g., *"Aaj sab theek hai, subah walk par gaye the."*).
  - Occasional negated complaints (e.g., *"Mujhe koi dard nahi hai"*).
- **Expected Escalation**: `routine_monitoring`

### 1.2 `SCEN_STABLE_MILD_FLUCTUATION`
- **Onset & Duration**: Random isolated single-day deviations.
- **Generation Rules**: Isolated high-stress days (e.g. minor sleep disruption or missed step goal) that immediately revert within 24 hours.
- **Observed Signals**: A single low-step or poor-sleep day with normal check-in dialogue.
- **Expected Escalation**: `routine_monitoring`

---

## 2. Intermittent Concern Scenarios (`planted = True`, `severity = mild`)

### 2.1 `SCEN_INTERMITTENT_SLEEP_DISRUPTION`
- **Onset & Duration**: Onset day between 20 and 65; duration 3 to 6 days.
- **Generation Rules**: Sleep drops by 2.0–3.0 hours/night during episode window; mild secondary mood depression ($\Delta \approx -0.7$).
- **Observed Signals**: Check-in logs cite restlessness (*"Kal raat neend nahi aayi, bechaini rahi"*). Steps drop mildly ($\approx 15\%$). Completely self-resolves after 4–5 days.
- **Expected Escalation**: `care_coordinator_followup`

### 2.2 `SCEN_INTERMITTENT_MILD_PAIN_FLARE`
- **Onset & Duration**: Onset day 25–60; duration 3 to 7 days.
- **Generation Rules**: Steps decrease by $35\%$; mild reactive systolic BP elevation ($+8\text{ to }12\text{ mmHg}$).
- **Observed Signals**: Check-in notes document localized musculoskeletal discomfort (*"Ghutno me thoda dard badh gaya hai"*).
- **Expected Escalation**: `care_coordinator_followup`

### 2.3 `SCEN_ISOLATED_MEDICATION_OMISSION`
- **Onset & Duration**: Onset day 30–55; duration 2 to 4 days.
- **Generation Rules**: Adherence probability drops from $\approx 95\%$ to $30\%$ for 48–72 hours, then returns to baseline.
- **Observed Signals**: Medication events record `missed` status for multiple doses; check-in notes mention confusion over blister strips.
- **Expected Escalation**: `care_coordinator_followup`

---

## 3. Gradual Multi-Signal Decline Scenarios (`planted = True`, `severity = moderate` to `severe`)

### 3.1 `SCEN_GRADUAL_MOBILITY_DECLINE`
- **Onset & Duration**: Onset day 20–45; persists through day 90.
- **Generation Rules**: Progressive, irreversible reduction in physical steps (dropping $50\%\text{–}70\%$ below baseline) and active exercise duration.
- **Observed Signals**:
  - Pedometer steps exhibit steady downward trajectory.
  - Progressive check-in complaints starting with tiredness, evolving into weakness and joint stiffness.
  - Family observations confirm unsteadiness and holding onto walls.
- **Expected Escalation**: `urgent_family_notification`

### 3.2 `SCEN_GRADUAL_COGNITIVE_FRAILTY`
- **Onset & Duration**: Onset day 25–48; unremitting progression.
- **Generation Rules**: Erratic sleep patterns (circadian inversion), progressive medication omission, and dropped check-in response rate.
- **Observed Signals**:
  - Increasing frequency of `missed` and `unknown` medication doses.
  - Check-in notes capture temporal disorientation (*"Aaj ka din aur date bhool gaye the"*).
  - Subjective mood drops; family logs report routine disruption.
- **Expected Escalation**: `urgent_family_notification`

### 3.3 `SCEN_GRADUAL_APPETITE_WEIGHT_LOSS`
- **Onset & Duration**: Onset day 22–45; persists through day 90.
- **Generation Rules**: Appetite drops from $4.5$ down to $1.8\text{–}2.2$; daily weight decreases by $3.5\text{–}6.0\text{ kg}$ over 6 weeks; secondary energy reduction.
- **Observed Signals**:
  - Decreased weekly weight measurements.
  - Check-ins report skipping meals and lack of hunger (*"Khaane ki bilkul iccha nahi ho rahi"*).
  - Family logs confirm barely eating half a meal.
- **Expected Escalation**: `urgent_family_notification`

### 3.4 `SCEN_GRADUAL_RESPIRATORY_DECONDITIONING`
- **Onset & Duration**: Onset day 25–50; progressive downward trend.
- **Generation Rules**: SpO2 decreases gradually from baseline $97\%$ down to $91\%\text{–}93\%$; mild reactive tachycardia and fatigue.
- **Observed Signals**: Pulse oximeter readings fall into low-90s; check-in notes mention shortness of breath and morning fatigue.
- **Expected Escalation**: `urgent_family_notification`

---

## 4. Recovery & Difficult Detection Scenarios

### 4.1 `SCEN_GRADUAL_DECLINE_WITH_RECOVERY`
- **Clinical Paradigm**: Progressive deterioration is halted by synthetic Care Coordinator intervention (home visit, medication adjustment, physical therapy), leading to rehabilitation.
- **Progression**: Progression increases to a peak severity at $40\%$ of episode duration, then linearly or exponentially recovers toward $90\%\text{–}95\%$ of original baseline.
- **Observed Signals**: Early weakness and low activity followed by documented coordinator visits, recovery check-in notes (*"Coordinator ke visit ke baad routine streamline ho gayi, feeling energetic"*), and rebounding steps.
- **Expected Escalation**: `care_coordinator_followup`

### 4.2 `SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED`
- **Clinical Paradigm**: Subtle decline masked by missing data and erratic device usage.
- **Progression**: The underlying mobility and appetite decline are genuine, but smartwatch sensor failure rates triple ($28\%$ missingness) and vitals logging is sparse.
- **Observed Signals**: Discontinuous telemetry requiring the early-warning model to fuse check-in NLP cues with sparse numerical measurements.
- **Expected Escalation**: `care_coordinator_followup`

---

## 5. Acute Safety Events (`planted = True`, `severity = severe` or `critical`)

### 5.1 `SCEN_ACUTE_FALL_INCIDENT`
- **Onset & Duration**: Sudden acute event occurring on a single calendar day (onset day 35–70); post-fall restricted mobility lasts 7–14 days.
- **Generation Rules**: Immediate step count collapse ($>85\%$ drop) representing bed rest; immediate severe pain and low mood.
- **Observed Signals**:
  - Urgent check-in note reporting mechanical fall (*"Kal bathroom ke paas slip ho gaye the"*).
  - NLP ground truth identifies `fall (present, current)` and `pain (present, current)`.
  - Immediate collapse in daily master step count.
- **Expected Escalation**: `immediate_clinical_escalation`

### 5.2 `SCEN_ACUTE_HYPERTENSIVE_CRISIS`
- **Onset & Duration**: Onset day 40–68; duration 4–8 days.
- **Generation Rules**: Systolic BP surges by $+35\text{ to }+50\text{ mmHg}$ (reaching $175\text{–}205\text{ mmHg}$); diastolic surges by $+20\text{ to }+28\text{ mmHg}$.
- **Observed Signals**: Home BP monitor logs critical readings; check-in notes cite occipital headache, dizziness, and visual blurring.
- **Expected Escalation**: `immediate_clinical_escalation`

### 5.3 `SCEN_ACUTE_DIZZINESS_ORTHOSTATIC`
- **Onset & Duration**: Onset day 35–65; duration 5–10 days.
- **Generation Rules**: Acute systolic drop of $25\text{–}32\text{ mmHg}$ (hypotensive trough); sharp dip in mobility due to fear of falling.
- **Observed Signals**: Vital logs show systolic BP dipping below $95\text{ mmHg}$; check-in notes emphasize lightheadedness upon standing (*"Khade hote hi chakkar sa aaya"*).
- **Expected Escalation**: `immediate_clinical_escalation`

