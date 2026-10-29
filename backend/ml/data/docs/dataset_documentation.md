# Samarth Synthetic Dataset — Technical Specification & Generation Guide

**Location**: `C:\Projects\samarth-2.O\data\`  
**Generator Code**: `C:\Projects\samarth-2.O\data\scripts\`  
**Entrypoint**: `python -X utf8 C:\Projects\samarth-2.O\data\scripts\generate_all.py`  
**Master Seed**: `2026` (deterministic per-senior SHA-256 streams)  
**Cohort**: `250` seniors $\times$ `98` days (`2026-07-06` to `2026-10-11`, 14 weeks)

---

## 1. Design Goal & Core Architecture

This dataset models **both physical health decline and psychosocial/well-being decline** in home-living Indian seniors.

Instead of generating tables independently (which breaks cross-modal correlation), the generator uses a **top-down causal state-space pipeline**:

```
[1. Static Cohort & Priors]  (cohort.py)
   250 seniors, 14 chronic conditions, 11 hobbies, named medications,
   recent health events, 70%/30% vital-monitoring split
        │
        ▼
[2. Ground-Truth Scenario Assignment]  (config.py, cohort.py)
   22 trajectories (125 stable, 40 intermittent, 60 gradual, 25 acute)
   with onset day >= 30 so days 0..27 form a clean baseline window
        │
        ▼
[3. Daily Latent State Engine]  (latent.py)
   For each senior s and day t in [0..97]:
   • 18 continuous channel deltas: Δsbp, Δdbp, Δhr, Δspo2, Δtemp, Δwt, Δglu,
     Δsteps, Δsleep, Δappetite, Δmood, Δsocial, Δengage, Δmonitor, Δadherence, ...
   • 16 symptom/well-being cue probabilities in [0, 1]
   • Shared city-level rain days + day-of-week effects + random 1-day blips
        │
        ├──► [4a. Vitals Stream]            (vitals.py)      -> vitals.csv
        ├──► [4b. Activity & Engagement]    (activity.py)    -> daily_activity.csv
        ├──► [4c. 3-Axis Accelerometer]     (activity.py)    -> accelerometer_windows.npz / _meta.csv
        ├──► [4d. Medication Logs]          (activity.py)    -> medication_schedules.csv / _events.csv
        │
        ▼
[5. Observed Context & Empirical Baseline Layer]  (contexts.py)
   Computes personal medians/IQRs from days 0..27 ONLY, plus 2-day vital flags
   and 7-day rolling step/engagement/missed-dose ratios
        │
        ├──► [6a. Family Inputs & Replies]  (family_gen.py)  -> family_observations.csv
        ├──► [6b. Bi-Weekly Check-in Calls] (text_gen.py)    -> checkins.csv
        └──► [6c. Senior Voice Notes]       (text_gen.py)    -> senior_voice_notes.csv
```

### Key Architectural Guarantees
1. **Zero Target Leakage**: Raw tables in `data/raw/` contain only observable measurements and transcripts. Hidden scenario labels, onset dates, and true latent states are quarantined in `data/evaluation/`.
2. **Clean 28-Day Empirical Baseline Window**: Every planted scenario has `onset_day >= 30`. Days `0–27` reflect the senior's habitual baseline (plus any pre-enrollment recovery tail).
3. **100% Roman Script**: All Hindi and Hinglish conversations (`checkins.csv`, `senior_voice_notes.csv`, `family_observations.csv`) are written in Roman script with zero Devanagari characters.
4. **Per-Senior Reproducibility**: Each senior `S0001`–`S0250` and each modality derives its own RNG seed via `SHA-256(f"{MASTER_SEED}:{senior_id}:{stream}")`.

---

## 2. File Inventory

### 2.1 Model Input Tables (`data/raw/`)

| File | Rows / Shape | Cols | Primary Key | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `senior_profiles.csv` | `250` | `20` | `senior_id` | Demographics, living arrangement, vital-monitoring enrollment, devices, check-in schedule, consent level |
| `senior_baselines.csv` | `250` | `53` | `senior_id` | Unified rich baseline: chronic physical/mental conditions, recent events, hobbies, mobility aids, and 28-day empirical medians/IQRs |
| `vitals.csv` | `73,073` | `9` | `measurement_id` | Timestamped readings for 7 vital types with context (`resting`, `standing`, `fasting`, `post_meal`) and quality flags |
| `medication_schedules.csv` | `541` | `14` | `medication_id` | Condition-linked named prescriptions, dose, daily times, criticality tier (`high`, `medium`, `low`), SOS flag |
| `medication_events.csv` | `60,834` | `8` | `medication_event_id` | Dose-level administration records (`taken`, `missed`, `unknown`, `double_dose`, `sos_taken`) |
| `daily_activity.csv` | `24,500` | `18` | `(senior_id, date)` | Daily physical activity (`steps`, `active_minutes`, `sedentary_hours`, `max_inactive_block_hours`, `sleep_hours`) and social/hobby engagement |
| `accelerometer_windows.npz` | `(2189, 500, 3)` | — | `window_ids` | Raw 25 Hz, 20-second tri-axial acceleration waveforms in $g$ (`float32`) |
| `accelerometer_windows_meta.csv` | `2,189` | `17` | `window_id` | Labels (`non_fall`, `non_fall_near_fall`, `fall`), activity subtype, and 6 extracted biomechanical features |
| `checkins.csv` | `7,000` | `23` | `call_id` | Bi-weekly coordinator check-in calls (multi-turn Roman-Hindi transcripts, word counts, terse ratio, extracted cues JSON, clinical note) |
| `senior_voice_notes.csv` | `2,059` | `14` | `note_id` | Spontaneous senior voice note transcripts with simulated STT noise (`[unclear]`) and confidence scores |
| `family_observations.csv` | `3,059` | `18` | `interaction_id` | Family messages (Hinglish/English) paired with warm objective-first replies, counselor notes, and suggested actions |

### 2.2 Evaluation Ground-Truth Tables (`data/evaluation/`)

| File | Rows | Cols | Purpose |
| :--- | :---: | :---: | :--- |
| `decline_episodes.csv` | `250` | `16` | Assigned scenario, onset/crisis/end dates, severity, expected escalation tier, acceptable/prohibited actions |
| `senior_true_baselines.csv` | `250` | `23` | Hidden generative prior parameters per senior |
| `daily_ground_truth.csv` | `24,500` | `6` | Daily progression factor $\pi_s(t) \in [0, 1]$ and ground-truth risk tier (`0=stable`, `1=watch`, `2=concern`, `3=urgent`) |
| `nlp_annotations.csv` | `16,351` | `11` | Ground-truth cue extractions across calls and voice notes (`cue_type`, `cue_value`, `severity`, `negation_status`, `temporal_context`) |

---

## 3. Cohort, Baselines & Clinical Priors (`cohort.py`)

### 3.1 Demographics & Operations (`senior_profiles.csv`)
- **Age**: Sampled from $\text{Clip}(\mathcal{N}(73.0, 6.5), 62, 90)$.
- **Living Arrangement**: `with_spouse` (`150` seniors, 60.0%), `with_domestic_help_or_family` (`59` seniors, 23.6%), `alone` (`41` seniors, 16.4%).
- **Language Style**: `hindi` in Roman script (`133` seniors, 53.2%), `hinglish` with code-mixed English nouns (`117` seniors, 46.8%).
- **Vital Monitoring Split**:
  - **Enrolled (`175` seniors, 70%)**: Have a home BP monitor (`100%`), thermometer (`~80%`), pulse oximeter (`~65%`), smart weight scale (`~55%`), and glucometer (`~92%` of diabetics).
  - **Not Enrolled (`75` seniors, 30%)**: Have no home vital devices; vitals are only logged during coordinator home visits roughly once every 24–32 days.
- **Motion Sensor Source**: `wearable_watch` (`55%`) vs. `phone_accelerometer` (`45%`).
- **Coordinator Caseload & Cadence**: 2 families per coordinator (`125` coordinators across 9 cities: Delhi, Gurugram, Noida, Lucknow, Jaipur, Pune, Bengaluru, Chandigarh, Indore). Each senior has 2 scheduled check-in calls per week (`28` calls over 14 weeks).
- **Family Consent Tiers**: `full` (`70%`), `summary_and_urgent` (`22%`), `urgent_only` (`8%`).

### 3.2 Chronic Conditions & Named Medications (`senior_baselines.csv`, `medication_schedules.csv`)
- **Healthy Seniors**: `68` seniors (`27.2%`) have **zero** chronic conditions.
- **14 Chronic Conditions** (with age-adjusted prevalence for age $\ge 78$):
  - *Physical (12)*: `hypertension`, `type2_diabetes`, `dyslipidemia`, `osteoarthritis`, `hypothyroidism`, `copd_asthma`, `cataract_low_vision`, `osteoporosis`, `prior_stroke`, `chf` (heart failure), `ckd`, `old_ortho_surgery`.
  - *Mental / Cognitive (2)*: `depression_anxiety`, `mild_cognitive_impairment`.
- **Condition-Linked Prescriptions (`541` active schedules)**:
  - High criticality: `Amlodipine 5 mg`, `Telmisartan 40 mg`, `Glimepiride 1 mg`, `Ecosprin (Aspirin) 75 mg`, `Furosemide 20 mg`, `Carvedilol 3.125 mg`, `Budesonide+Formoterol inhaler`.
  - Medium criticality: `Metformin 500 mg`, `Thyroxine 50 mcg`, `Escitalopram 5 mg`, `Donepezil 5 mg`.
  - Low criticality / SOS: `Atorvastatin 10 mg`, `Calcium + Vitamin D3`, `Multivitamin`, `Paracetamol 650 mg (SOS)`.

### 3.3 Recent Pre-Window & In-Window Health Events
`70` acute historical or background events are planted across the cohort with exponential recovery decay $f(t) = \exp(-(t - t_0)/\tau)$:
- `fever` ($t_0 = -1$, $\tau = 1.5\text{ d}$), `cold_cough` ($t_0 \in [-6, -2]$, $\tau = 4\text{ d}$)
- `surgery` ($t_0 \in [-30, -7]$, $\tau = 20\text{ d}$: knee replacement, cataract, hernia, hip fixation, pacemaker)
- `minor_fall` ($t_0 \in [-10, -3]$ or in-window day $[35, 90]$, $\tau = 5\text{–}6\text{ d}$)
- `chest_pain_scare` ($t_0 \in [-9, -3]$, $\tau = 8\text{ d}$), `hospital_discharge` ($t_0 \in [-15, -5]$, $\tau = 12\text{ d}$)
- `bereavement` ($t_0 \in [-50, -10]$, $\tau = 40\text{ d}$: loss of spouse/sibling/close friend)

### 3.4 Individual Baseline Priors
Each senior's steady-state prior is conditioned on their age, gender, conditions, and hobbies:
- **Systolic BP**: $\mathcal{N}(122 + 0.35(\text{Age} - 70), 7^2) + 10 \cdot \mathbb{I}(\text{hypertension})$, clipped to $[105, 160]\text{ mmHg}$.
- **Diastolic BP**: $\mathcal{N}(74 + 0.30(\text{SBP}_{\text{base}} - 122), 4^2)$, clipped to $[60, 95]\text{ mmHg}$.
- **Heart Rate**: $\mathcal{N}(72, 6^2) + 4 \cdot \mathbb{I}(\text{chf})$, clipped to $[56, 92]\text{ bpm}$.
- **$\text{SpO}_2$**: $\mathcal{N}(93.8, 1.0^2)$ if `copd_asthma` else $\mathcal{N}(96.9, 0.8^2)$.
- **Fasting Glucose**: $\mathcal{N}(126, 20^2)$ if `type2_diabetes` else $\mathcal{N}(96, 8^2)\text{ mg/dL}$; post-meal adds $+48\text{ mg/dL}$ (diabetic) or $+24\text{ mg/dL}$ (non-diabetic).
- **Daily Steps**: $\mathcal{N}(3600, 1300^2) - 40\max(0, \text{Age}-70)$, minus penalties for osteoarthritis ($-800$), stroke ($-900$), CHF ($-700$), COPD ($-500$), plus $+800$ if `morning_walk` is a hobby.

---

## 4. Scenario Catalog & Latent Progression (`config.py`, `latent.py`)

Each senior is assigned to exactly one of **22 scenarios** across 4 categories (`onset_day >= 30`):

### 4.1 Progression Functions $\pi_s(t) \in [0, 1]$
1. **Stable (`shape = "none"`, 125 seniors)**: $\pi_s(t) = 0$ for all $t$.
2. **Intermittent Self-Limiting (`shape = "bell"`, 40 seniors)**: Gaussian flare centered at $t_{\text{crisis}}$ that resolves without escalation:
   $$\pi_s(t) = \exp\!\left(-\frac{(t - t_{\text{crisis}})^2}{2(\text{dur}/3)^2}\right), \quad t \in [t_{\text{onset}}, t_{\text{end}}]$$
3. **Gradual Ramp (`shape = "ramp"`, 60 seniors & hypertensive crisis)**: Linear ramp over $L_{\text{ramp}}$ days to peak $1.0$, held for $L_{\text{hold}}$ days, followed by optional recovery over $L_{\text{rec}}$ days:
   $$\pi_s(t) = \text{clip}\!\left(\frac{t - t_{\text{onset}}}{L_{\text{ramp}}}, 0, 1\right)$$
4. **Acute Step (`shape = "step"`, 25 seniors)**: Immediate jump to $\pi_s(t) = 1.0$ on $t_{\text{onset}}$, held for $L_{\text{hold}}$ days, then linear recovery over $L_{\text{rec}}$ days.

### 4.2 Complete Scenario Table

| Scenario ID | Cat. | Count | Vitals Req? | Peak Physiological & Behavioral Effects (at $\pi=1$) | Primary Cues | Expected Escalation |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| `SCEN_STABLE_ACTIVE` | Stable | 45 | No | Steps $\times 1.25$, normal noise | — | `routine_monitoring` |
| `SCEN_STABLE_SEDENTARY` | Stable | 45 | No | Steps $\times 0.55$, normal noise | — | `routine_monitoring` |
| `SCEN_STABLE_MILD_FLUCTUATION` | Stable | 35 | No | 4–7 isolated 1-day sleep/step blips | — | `routine_monitoring` |
| `SCEN_INTERMITTENT_SLEEP_DISRUPTION` | Interm. | 10 | No | Sleep $-2.5\text{h}$, mood $-0.6$, steps $-12\%$ (3–6d) | `poor_sleep`, `weakness` | `care_coordinator_followup` |
| `SCEN_INTERMITTENT_PAIN_FLARE` | Interm. | 10 | No | Steps $-35\%$, SBP $+9$, HR $+3$, sleep $-0.5\text{h}$ (3–7d) | `pain` | `care_coordinator_followup` |
| `SCEN_INTERMITTENT_MED_OMISSION` | Interm. | 8 | No | Adherence $-65\%$, SBP $+8$, glucose $+18$ (2–4d) | `medication_issue` | `care_coordinator_followup` |
| `SCEN_INTERMITTENT_VIRAL_FEVER` | Interm. | 6 | No | Temp $+2.0^\circ\text{F}$, HR $+10$, steps $-50\%$ (3–5d) | `fever`, `weakness` | `care_coordinator_followup` |
| `SCEN_INTERMITTENT_GI_UPSET` | Interm. | 6 | No | Appetite $-1.5$, weight $-0.8\text{kg}$, steps $-20\%$ (2–4d) | `low_appetite`, `weakness` | `care_coordinator_followup` |
| `SCEN_GRADUAL_CHF_FLUID_RETENTION` | Gradual | 8 | Yes | Weight $+2.8\text{kg}$, $\text{SpO}_2 -4.5\%$, HR $+12$, steps $-35\%$ | `breathlessness`, `swelling` | `immediate_clinical_escalation` |
| `SCEN_GRADUAL_SILENT_UTI_DRIFT` | Gradual | 8 | Yes | Temp $+1.8^\circ\text{F}$, HR $+14$, SBP $-10$, glucose $+20$ | `confusion`, `weakness`, `urinary` | `immediate_clinical_escalation` |
| `SCEN_GRADUAL_POSTFALL_FEAR_SPIRAL` | Gradual | 6 | No | Fall at onset $\rightarrow$ steps $-65\%$, engage $-60\%$, sed $+3\text{h}$ | `fall`, `pain`, `low_mood` | `urgent_family_notification` |
| `SCEN_GRADUAL_DEPRESSIVE_WITHDRAWAL` | Gradual | 10 | No | Mood $-1.8$, engage $-80\%$, social $-70\%$, words $-60\%$ | `low_mood`, `loneliness` | `urgent_family_notification` |
| `SCEN_GRADUAL_COGNITIVE_MED_CONFUSION` | Gradual | 8 | No | Adherence $-45\%$, call answer $-25\%$, engage $-40\%$ | `confusion`, `medication_issue` | `urgent_family_notification` |
| `SCEN_GRADUAL_MOBILITY_DECLINE` | Gradual | 4 | No | Steps $-60\%$, sedentary $+2\text{h}$, mood $-0.6$ | `weakness`, `pain` | `urgent_family_notification` |
| `SCEN_GRADUAL_APPETITE_WEIGHT_LOSS` | Gradual | 4 | No | Weight $-4.5\text{kg}$, appetite $-2.0$, steps $-25\%$ | `low_appetite`, `weakness` | `urgent_family_notification` |
| `SCEN_GRADUAL_RESPIRATORY_DECONDITIONING` | Gradual | 4 | Yes | $\text{SpO}_2 -4.5\%$, HR $+8$, steps $-30\%$ | `breathlessness`, `weakness` | `urgent_family_notification` |
| `SCEN_GRADUAL_DECLINE_WITH_RECOVERY` | Gradual | 4 | No | Ramp $12\text{–}16\text{d}$ (steps $-50\%$) then recovery $18\text{–}24\text{d}$ | `weakness`, `pain` | `care_coordinator_followup` |
| `SCEN_GRADUAL_MASKED_SPARSE_DECLINE` | Gradual | 4 | Yes | Stoic senior + device usage drops $-60\%$, weight $-3\text{kg}$ | `low_appetite`, `weakness` | `care_coordinator_followup` |
| `SCEN_ACUTE_FALL_INCIDENT` | Acute | 7 | No | Fall at onset, steps $-85\%$, sedentary $+3\text{h}$ | `fall`, `pain` | `immediate_clinical_escalation` |
| `SCEN_ACUTE_FALL_UNREPORTED_SILENT` | Acute | 3 | No | Sensor fall at onset, stoic senior does not report verbally | `fall` (sensor only) | `care_coordinator_followup` |
| `SCEN_ACUTE_HYPERTENSIVE_CRISIS` | Acute | 5 | Yes | SBP $+45\text{ mmHg}$, DBP $+24\text{ mmHg}$, HR $+8$ | `headache`, `dizziness` | `immediate_clinical_escalation` |
| `SCEN_ACUTE_ORTHOSTATIC_DIZZINESS` | Acute | 4 | Yes | SBP $-26$ (plus $-15$ standing drop), HR $+10$ | `dizziness`, `weakness` | `immediate_clinical_escalation` |
| `SCEN_ACUTE_HYPOGLYCEMIA_EPISODES` | Acute | 3 | Yes | Fasting glucose $-48\text{ mg/dL}$ | `dizziness`, `weakness` | `immediate_clinical_escalation` |
| `SCEN_ACUTE_CHEST_PAIN_ARRHYTHMIA` | Acute | 3 | Yes | HR $+25\text{ bpm}$ (high variance), $\text{SpO}_2 -2\%$ | `chest_discomfort` | `immediate_clinical_escalation` |

*Note: 15 of the non-vital-monitored seniors are explicitly allocated to gradual well-being/behavioral decline scenarios so models must detect decline without relying on vitals.*

---

## 5. Modality Generation Mechanics

### 5.1 Longitudinal Vitals (`vitals.py` $\rightarrow$ `vitals.csv`, `73,073` rows)
- **Autoregressive Day-to-Day Wander**: Each vital has an $\text{AR}(1)$ process $e_t = \rho e_{t-1} + \sqrt{1-\rho^2}\,\eta_t$:
  - SBP ($\rho=0.5, \sigma=4.5$), DBP ($\rho=0.5, \sigma=3.0$), HR ($\rho=0.5, \sigma=2.5$), Weight ($\rho=0.9, \sigma=0.5\text{ kg}$), Glucose ($\rho=0.4, \sigma=7\text{ mg/dL}$), Temp ($\rho=0.3, \sigma=0.15^\circ\text{F}$).
- **Circadian & Physiological Coupling**:
  - Morning BP is $+3\text{ mmHg}$ higher than evening BP; heart rate is coupled to systolic pressure ($+0.12\text{ bpm}$ per mmHg above baseline) plus $+8\text{ bpm}$ when standing.
  - Standing BP measurements (`measurement_context == "standing"`) apply a postural drop of $-3\text{ mmHg}$ normally and up to $-15\text{ mmHg}$ extra during `SCEN_ACUTE_ORTHOSTATIC_DIZZINESS`.
  - $\text{SpO}_2$ uses a half-normal downward skew so readings cluster naturally below $100\%$.
- **Symptom-Triggered Measurement**: Seniors measure BP/$\text{SpO}_2$ more frequently when dizzy/breathless, and measure temperature primarily when feverish ($75\%$ probability vs. $5\%$ baseline).
- **Device Dropouts & Artifacts**:
  - Multi-day battery/forgetting gaps (`2–5` consecutive days). During depressive withdrawal or masked decline, self-monitoring probability drops by $50\%\text{–}60\%$.
  - `quality_status`: `71,727` `valid` (`98.2%`), `1,169` `questionable` (`1.6%`, e.g., cuff movement adding $\pm 18\text{–}32\text{ mmHg}$), `177` `device_artifact` (`0.2%`, e.g., cold finger dropping $\text{SpO}_2$ by $4\%\text{–}9\%$).

### 5.2 Physical Activity & Behavioral Engagement (`activity.py` $\rightarrow$ `daily_activity.csv`, `24,500` rows)
- **Physical Metrics**:
  - `steps` and `active_minutes` follow log-normal $\text{AR}(1)$ dynamics around personal baseline, modulated by $\Delta\text{steps}(t)$, city rain days ($-18\%$ for outdoor walkers), and Sundays ($-5\%$).
  - `sedentary_hours` and `max_inactive_block_hours` (longest consecutive daytime hour block from 06:00–21:00 with $<20\text{ steps/hour}$) capture prolonged daytime stillness.
- **Behavioral & Social Engagement Metrics**:
  - `hobby_sessions`, `whatsapp_group_messages` (overdispersed Poisson-Gamma), `community_event_registered` vs. `community_event_attended` (Saturdays), and `calls_to_family`.
  - When $\Delta\text{engage}(t) < 0$ (depressive withdrawal, post-fall fear, cognitive decline), hobby participation, WhatsApp messages, and community attendance drop proportionally below the senior's 28-day baseline.

### 5.3 3-Axis Accelerometer Waveforms (`activity.py` $\rightarrow$ `accelerometer_windows.npz`, `2,189` windows)
Each window is a `20 s` $\times$ `25 Hz` $= 500 \times 3$ array $(a_x, a_y, a_z)$ in units of $g$:
- **Routine Activities (`1,999` windows)**: `walking` (`567`), `sitting` (`386`), `sit_to_stand` (`291`), `standing` (`245`), `lying` (`187`), `fast_walk` (`163`), `stairs` (`161`). Modeled with harmonic gait oscillations around a tilted gravity vector $\mathbf{g}_0$.
- **Hard Negatives (`163` windows)**:
  - `stumble` (`84` windows, labeled `non_fall_near_fall`): transient spike ($1.6\text{–}2.4g$) + recovery steps, **no** change to horizontal orientation.
  - `hard_sit` (`48` windows, labeled `non_fall`): impact spike ($1.8\text{–}2.7g$) settling into upright sitting orientation.
  - `device_drop` (`31` windows, labeled `non_fall`): very high impact ($3.5\text{–}8.0g$) + high-frequency ringing ($9\text{ Hz}$), preceded by zero gait variance (device was resting on a table).
- **True Falls (`26` sensor-captured windows out of `39` total falls)**:
  - 4-phase biomechanics: pre-fall gait/stance $\rightarrow$ $0.35\text{ s}$ free-fall trough ($\|\mathbf{a}\| \to 0.2\text{–}0.5g$) $\rightarrow$ impact spike ($1.8\text{–}6.0g$ depending on `forward`, `backward`, `lateral`, `slip`, `syncope`, `bed`) $\rightarrow$ $65^\circ\text{–}100^\circ$ rotation of gravity vector to horizontal + post-impact stillness ($2\text{–}12\text{ s}$).
- **Extracted Features in `accelerometer_windows_meta.csv`**: `peak_g`, `min_g_before_peak`, `pre_impact_std_g`, `orientation_change_deg`, `post_impact_still_s`, `max_jerk_g_per_s`.

### 5.4 Medication Events (`activity.py` $\rightarrow$ `medication_events.csv`, `60,834` rows)
- Each scheduled dose is evaluated against $p_{\text{take}}(t) = \text{clip}(\text{adherence}_{\text{base}} + \Delta\text{adherence}(t), 0.02, 0.995)$.
- Outcomes: `taken` (`53,013`, 87.1%), `missed` (`6,089`, 10.0%), `unknown` (`1,546`, 2.5% — unverified self-reports), `double_dose` (`112`, 0.2% — occurs during cognitive medication confusion), `sos_taken` (`74` — Paracetamol taken on high-pain days).

### 5.5 Bi-Weekly Check-in Calls (`text_gen.py` $\rightarrow$ `checkins.csv`, `7,000` rows)
- **Call Outcomes**: `5,295` `answered` (`75.6%`), `746` `answered_brief` (`10.7%`), `959` `no_answer` (`13.7%`, increasing during cognitive/depressive decline).
- **3-Step Context-Driven Conversation Pipeline**:
  1. **Objective Selection** (from observed flags only): `follow_up_acute` $\succ$ `post_event_followup` $\succ$ `medication_verification` $\succ$ `vitals_followup` $\succ$ `engagement_checkin` $\succ$ `address_family_concern` $\succ$ `routine_wellbeing`.
  2. **Dynamic Question Selection**: 2–5 questions per call chosen from prior strong symptoms, recent falls, 2-day vital flags, 7-day missed doses, engagement drop $<55\%$, chronic condition rotation, and hobby check.
  3. **Multi-Turn Roman-Hindi Dialogue**: Warm, slow, simple Hindi in Roman script using respectful honorifics (`Sharma ji`, `aap`).
- **Personality & Behavioral Signals in Transcripts**:
  - **Stoic Masking**: Seniors with `stoic == True` (`25%` of cohort, plus `SCEN_GRADUAL_MASKED_SPARSE_DECLINE` and `SCEN_ACUTE_FALL_UNREPORTED_SILENT`) under-report symptoms by $50\%\text{–}90\%$.
  - **Brevity / Terse Drift**: As mood or word-count channel $\Delta\text{words}(t)$ drops, `senior_word_count` shrinks and `senior_terse_reply_ratio` (`"Hmm."`, `"Theek hai."`, `"Haan."`) rises.
  - **Cognitive Mismatch**: When `confusion > 0.5` and doses were missed, $40\%$ of seniors claim they took their medicine (`medication_report_mismatch == True`).
- **Ground-Truth NLP Cues (`16,351` annotations in `nlp_annotations.csv`)**:
  - Every mentioned or denied cue is logged with `severity` (`mild`, `strong`, `none`), `negation_status` (`13,733` negated denials vs. `2,618` positive symptom mentions), and `temporal_context` (`current` vs. `historical`).

### 5.6 Senior Voice Notes (`text_gen.py` $\rightarrow$ `senior_voice_notes.csv`, `2,059` rows)
- Short spontaneous voice messages (`15–45 s`) across 8 categories: `festival_greeting` (`509`), `symptom_report` (`475`), `general_chat_hobby` (`425`), `appointment_or_report_query` (`250`), `medicine_refill_request` (`180`), `complaint_or_feedback` (`153`), `loneliness_share` (`54`), `bp_reading_report` (`13`).
- Simulates Speech-to-Text degradation based on `background_noise` (`quiet_room`, `tv_in_background`, `street_noise`, `kitchen_noise`) and senior age ($>80$), injecting `[unclear]` tokens and `stt_confidence` $\in [0.50, 0.98]$.

### 5.7 Family Observations & Two-Way Communication (`family_gen.py` $\rightarrow$ `family_observations.csv`, `3,059` rows)
- **Family Input Categories**: `medication_concern` (`675`), `question_for_coordinator` (`442`), `health_or_wellbeing_observation` (`367`), `status_update_request` (`328`), `logistics_request` (`278`), `privacy_or_handling_note` (`273`), `positive_observation` (`243`), `appreciation` (`199`), `coordinator_feedback` (`184` — e.g. coordinator speaking too fast or calling at lunch), `anxious_check` (`70`).
- **Response Rules Enforced**:
  - `coordinator_warm_reply_en` and `coordinator_warm_reply_hi_roman`: Always state the **objective state first** (exact reading vs. baseline, reported symptom, missed dose count), followed by calm reassurance and non-overstepping next steps.
  - Respects `consent_level == "urgent_only"` (withholds non-urgent details while reassuring safety).
  - `objective_counselor_summary`: Structured clinical/operational summary for internal triage.
  - **Safety Guardrail**: Never advises starting, stopping, or changing any medication dose.
