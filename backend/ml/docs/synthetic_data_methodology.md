# SamarthCare AI — Synthetic Data Generation Methodology

This document details the mathematical, stochastic, and architectural principles employed to generate the Phase 1 synthetic longitudinal healthcare dataset for SamarthCare AI.

---

## 1. Architectural Philosophy: Hierarchical Generative Process

To guarantee internal temporal and causal consistency across heterogeneous tables (vitals, sensor logs, medication tracking, free-text dialogues, and family notes), SamarthCare AI avoids generating columns independently or from unrelated uniform distributions. Instead, a strict **hierarchical generative pipeline** is implemented:

```
[Master Seed: 42]
       │
       ▼
1. Cohort Configuration & Priors (dataset_config.yaml)
       │
       ▼
2. Senior Profile Sampling (Demographics, Cadence, Language, City)
       │
       ▼
3. Individual Baseline Sampling (Generative Pre-Observation Priors)
       │
       ▼
4. Scenario & Ground-Truth Episode Allocation (50% Stable, 20% Intermittent, 20% Gradual, 10% Acute)
       │
       ▼
5. Multi-Stream Stochastic Simulation (Daily Progression, Autoregressive Noise, Clinical Signals)
       ├── Daily Physical Activity & Sensor Logging
       ├── Measurement-Level Vital Signs with Variable Timing & Quality
       ├── Medication Schedules & Dose Events (Adherence Dynamics)
       ├── Check-in Dialogues (Hindi, Hinglish, English) & Ground-Truth NLP Annotations
       └── Collateral Caregiver Observations (Governed by Strict Consent)
       │
       ▼
6. Deterministic Master Derivation (Aggregation into processed/daily_master.csv)
       │
       ▼
7. Automated Invariant Validation & Target Leakage Verification
```

---

## 2. Demographic and Baseline Parameter Generation

### 2.1 Senior Profiles
The cohort defaults to 200 seniors (`S0001` through `S0200`). Age is sampled from a Gaussian prior calibrated to an older-adult community population:
$$\text{Age} \sim \text{Clip}(\mathcal{N}(\mu=73.5, \sigma=6.8), 60, 92)$$
Living arrangements are assigned as:
- *Alone* (35%)
- *With Spouse* (40%)
- *With Family* (25%)

Language preference is distributed as 45% Hindi, 35% Hinglish, and 20% English.

### 2.2 Baseline Physiological & Behavioral Parameters
Baselines represent the individual's habitual pre-observation steady-state. They are generated using parameterized prior distributions:
- **Systolic BP ($SBP_{base}$)**: $\mathcal{N}(128.0 + 0.4 \cdot (\text{Age} - 70), 8.5)$, clipped to $[110, 155]$ mmHg.
- **Diastolic BP ($DBP_{base}$)**: $\mathcal{N}(76.0 + 0.25 \cdot (SBP_{base} - 128.0), 5.0)$, clipped to $[64, 92]$ mmHg.
- **Blood Glucose**: 70% fasting ($\mathcal{N}(108, 14)$ mg/dL), 30% post-meal ($\mathcal{N}(142, 18)$ mg/dL).
- **Oxygen Saturation ($SpO_{2, base}$)**: $\mathcal{N}(96.8, 0.9)$, clipped to $[94.0, 99.0]\%$.
- **Body Weight**: $\mathcal{N}(68.0, 9.5)$, clipped to $[48.0, 96.0]$ kg.
- **Physical Steps**: $\mathcal{N}(3200, 1100)$, clipped to $[1100, 7500]$ steps/day.
- **Sleep Duration**: $\mathcal{N}(7.1, 0.7)$, clipped to $[5.2, 8.8]$ hours.
- **Appetite & Mood**: 1–5 ordinal scales centered around habitual healthy elder levels ($\mu \approx 4.25, \sigma \approx 0.35$).
- **Adherence Tendency**: $\text{Beta}(\alpha=24, \beta=2)$, bounded within $[0.78, 0.99]$.
- **Check-in Participation**: $\text{Beta}(\alpha=20, \beta=3)$, bounded within $[0.75, 0.99]$.

---

## 3. Temporal Dynamics & Autoregressive Noise

Real-world human daily signals exhibit short-term temporal autocorrelation (a senior who sleeps poorly on Tuesday is more likely to feel tired on Wednesday). Daily noise is modeled using a first-order autoregressive process ($\text{AR}(1)$):

$$\epsilon_t = \phi \cdot \epsilon_{t-1} + \sqrt{1 - \phi^2} \cdot \eta_t, \quad \eta_t \sim \mathcal{N}(0, \sigma^2)$$

For daily step count, $\phi = 0.4$ with volatility $\sigma = 0.12 \cdot \text{Steps}_{base}$.
For sleep duration, $\phi = 0.3$ with volatility $\sigma = 0.45\text{ hours}$.

---

## 4. Scenario Dynamics and Clinical Progression

Each senior is allocated to one of four mutually exclusive top-level clinical trajectories, configured in `config/dataset_config.yaml`:

### 4.1 Progression Functions
For any day $t \in [0, 89]$ and an episode spanning $[t_{onset}, t_{end}]$:
1. **Gradual Decline**: A monotonically increasing progression factor:
   $$\pi(t) = \min\left(1.0, \frac{t - t_{onset}}{\max(20, t_{end} - t_{onset} + 1)}\right)$$
2. **Intermittent Concern**: A transient Gaussian bell-shaped perturbation:
   $$\pi(t) = \exp\left( - \frac{(t - t_{mid})^2}{2 \sigma_{trans}^2} \right), \quad t_{mid} = \frac{t_{onset} + t_{end}}{2}$$
3. **Acute Event**: A sharp step-function at $t_{onset}$ followed by exponential or linear decay toward post-acute recovery or partial deficit:
   $$\pi(t) = \begin{cases} 1.0 & \text{if } t - t_{onset} < 4 \\ \max(0.2, 1.0 - 0.12 \cdot (t - t_{onset} - 4)) & \text{otherwise} \end{cases}$$
4. **Recovery Trajectory**: Deterioration peaking at $40\%$ of episode duration, followed by positive slope representing proactive coordinator intervention and rehabilitation.

---

## 5. Missingness and Sensor Artifact Mechanisms

Missing data is an inherent reality in geriatric remote monitoring. The simulation reproduces four distinct missingness paradigms:
1. **Random Device Inavailability / Dead Battery**: Smartwatch/pedometer sensors experience a stochastic $5\%$ daily omission rate (`data_available = False`).
2. **Modality-Specific Measurement Frequency**:
   - Blood Pressure: Monitored 4–5 days/week ($68\%$ measurement rate).
   - Blood Glucose: Monitored 2–3 days/week ($42\%$ measurement rate).
   - SpO2: Monitored 4 days/week ($60\%$ measurement rate).
   - Weight: Monitored 1–2 days/week ($22\%$ measurement rate).
3. **Telemetric Device Artifacts**: $4\%$ of recorded vital measurements are flagged as `device_artifact` or `questionable`, simulating cuff displacement, motion blur, or finger slip.
4. **Masked Decline Scenarios**: In difficult detection scenarios (`SCEN_GRADUAL_DECLINE_DIFFICULT_MASKED`), missingness probabilities double during the active decline phase, challenging future predictive models to handle sparse signals.

Missing numerical fields are preserved as nulls (`NaN` / empty in CSV). **Under no circumstances is zero substituted for missing physiological values.**

---

## 6. Seed Derivation and Reproducibility

Reproducibility is strictly enforced through isolated deterministic seed hierarchies. For each senior $i$ and master seed $S_{master}$:
$$\text{Seed}_i = \text{uint32}(\text{SHA-256}(S_{master} \parallel ":" \parallel \text{SeniorID})[0:4]) \pmod{2^{31} - 1}$$

Downstream generation routines (vitals, activity, check-ins, medications) branch from $\text{Seed}_i$ with fixed modular offsets ($+101, +202, +303, \dots$). Consequently:
- Generating the dataset with identical configuration yields bitwise identical outputs.
- Modifying parameters for one senior does not perturb unrelated seniors' random streams.

---

## 7. Known Limitations and Synthetic Boundaries

1. **Non-Diagnostic Scope**: This synthetic dataset is designed solely to benchmark early-warning anomaly detection algorithms and workflow triaging. It does not model pathophysiological disease etiologies or pharmacology.
2. **Clinical Representation**: Demographic distributions and vital variations reflect heuristic bounds for simulation testing and must not be cited as empirical epidemiological prevalence for the Indian population.
3. **Vocabulary Bounds**: Linguistic notes are generated from a carefully constructed bilingual template corpus of geriatric dialogues; while syntactically diverse, it does not replace open-ended natural human conversation.

