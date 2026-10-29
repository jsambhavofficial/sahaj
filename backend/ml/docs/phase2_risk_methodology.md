# Phase 2 Risk Scoring & Early Warning Methodology

This document details the mathematical formulation, rule categorization, category saturation caps, alert lifecycle policy, and explainability architecture of the Phase 2 Early Warning Engine for SamarthCare AI.

---

## 1. Engine Architecture & Mathematical Formulation

The engine employs a transparent **Rules-First Bounded Composite Scoring** architecture:

$$\text{RiskScore}(i, t) = \text{Clip}\left(\sum_{c \in \mathcal{C}} \min\left(\sum_{r \in \mathcal{R}_c} P_r \cdot \mathbb{I}(r \text{ triggered}), \text{Cap}_c\right) - \mathcal{M}_{wellbeing}, 0, 100\right)$$

Where:
- $\mathcal{C}$ is the set of clinical categories:
  - $\text{Cap}_{\text{acute\_safety}} = 85\text{ pts}$
  - $\text{Cap}_{\text{sustained\_trend}} = 35\text{ pts}$
  - $\text{Cap}_{\text{baseline\_deviation}} = 25\text{ pts}$
  - $\text{Cap}_{\text{medication}} = 30\text{ pts}$
  - $\text{Cap}_{\text{nlp\_cues}} = 35\text{ pts}$
  - $\text{Cap}_{\text{cross\_modal}} = 25\text{ pts}$
- $P_r$ is the calibrated points assigned to rule $r$.
- $\mathbb{I}(r \text{ triggered})$ is the indicator function evaluating causal window features up to date $t$.
- $\mathcal{M}_{wellbeing} = 8\text{ pts}$ is a negative modifier applied only when positive wellbeing or recovery is actively reported and no safety tripwire is present.

### Independent Safety Tripwire Pathway
If any critical safety tripwire is triggered (acute mechanical fall, severe hypertensive spike $\ge 170\text{ mmHg}$, or acute hypoxia $\le 92\%\text{ SpO}_2$):
$$\text{RiskScore}(i, t) = \max\left(\text{RiskScore}(i, t), 75\right) \implies \text{RiskLevel} = \text{URGENT\_REVIEW}$$
This mathematical guarantee ensures that acute elder emergencies cannot be suppressed or diluted by normal values in other channels.

---

## 2. Risk Bands & Triage Thresholds

| Risk Level | Score Range | Primary Interpretation | Care Coordinator Action |
|:---|:---:|:---|:---|
| `LOW` | 0 – 24 | Signals fluctuate within habitual personal baseline bounds. | Routine continuous remote monitoring. |
| `MODERATE` | 25 – 49 | Minor single-channel drift or transient self-limiting flare. | Note in records; follow up on next scheduled call. |
| `HIGH` | 50 – 74 | Sustained multi-day deterioration or cross-modal corroboration. | Prioritize prompt check-in call within 24 hours. |
| `URGENT_REVIEW`| 75 – 100 | Critical tripwire (fall, hypertensive spike, hypoxia). | Immediate coordinator contact and family escalation. |

---

## 3. Causal Rolling Windows & Cold Start

1. **Strict Temporal Causality**: For any date $t$, the engine computes features strictly over $[t - W + 1, t]$ where $W \in \{1, 3, 7\}$. Future observations ($t' > t$) are physically isolated from feature calculation.
2. **Cold Start & Baseline Confidence**:
   - Individual steady-state priors from `senior_baselines.csv` establish habitual levels prior to day 0.
   - On early observation days ($t < 3$), rolling windows dynamically expand from available history $[0, t]$ rather than lookahead imputation.
   - If telemetry completeness is sparse ($< 2$ readings in lookback), `confidence_level` is set to `LOW`.

---

## 4. Multilingual Clinical NLP Extraction

The conversational NLP module (`src/features/nlp_extractor.py`) processes raw dialogues in Hindi, Hinglish, and English without requiring third-party LLM APIs:
- **Scope Propagation**: Negation markers (`denies`, `no`, `not`, `nahi`, `pain-free`) propagate across comma-separated conjunctions (`"Denies chest pain, shortness of breath, or dizziness"`), correctly labeling all items as `absent`.
- **Adversative Clause Splitting**: Clauses joined by adversative conjunctions (`but`, `lekin`, `par`, `however`) are evaluated independently (e.g., `"Last week fall hua tha but abhi balance normal hai"` isolates the historical fall and does not flag acute balance impairment).
- **Uncertainty Tracking**: Hedges (`"shayad"`, `"lagta hai"`, `"unsure"`) are tagged with lower confidence ($0.75$).

---

## 5. Alert Lifecycle & Deduplication Policy

Alert fatigue is a recognized threat to healthcare monitoring. The `AlertLifecyclePolicy` implements four discrete state transitions:
1. **Creation**: Triggered when a senior enters `HIGH` ($\ge 50$) or `URGENT_REVIEW` ($\ge 75$) status (`status = OPEN`).
2. **Continuation & Deduplication**: If high risk continues without escalation, the open alert is updated with the latest date, but duplicate alert creation is suppressed.
3. **Escalation**: If risk level rises (e.g., from `HIGH` to `URGENT_REVIEW`), the alert status is updated to `ESCALATED`.
4. **Resolution**: If risk remains low ($< 50$) for at least 3 consecutive days, the alert status transitions to `RESOLVED` with an explicit reason logged in the audit trail.

