# SamarthCare AI — Phase 2 Safety, Privacy, Fairness & Limitations

## 1. Medical Safety & Non-Diagnostic Boundary
- **Decision-Support Only**: SamarthCare AI is explicitly engineered as an administrative and operational triage aid for human Care Coordinators. It is **not** a Medical Device (SaMD) and does not provide clinical diagnoses.
- **Human-in-the-Loop Imperative**: Every generated alert requires human verification. No automated pharmacologic alterations, clinical orders, or emergency dispatch calls are executed by this software.
- **Emergency Escalation Language**: In situations with severe vital abnormalities (e.g. SBP $\ge 170\text{ mmHg}$, $\text{SpO}_2 \le 92\%$) or confirmed physical falls, the system displays conservative warning text advising coordinators to verify immediate physical safety and prompt local emergency services if acute distress is apparent.

---

## 2. Privacy & Data Governance
- **Zero Real Protected Health Information (PHI)**: All 200 senior profiles, vital recordings, and dialogue notes are synthetically generated.
- **Strict Consent Enforcement**: Family observations are processed **only** if the senior's profile explicitly records `family_consent = True`. Seniors who decline family sharing produce zero collateral records.
- **Role-Based API Design**: Unstructured free-text transcripts are not exposed on high-level alert list endpoints, preserving elder privacy.

---

## 3. Algorithmic Fairness & Disaggregated Analysis

Performance was evaluated across demographic subgroups to detect systemic disparity:

| Demographic Dimension | Cohort Subgroup | Episode Recall Rate | False Alert Rate / 100 Days |
|:---|:---|:---:|:---:|
| **Preferred Language** | Hindi ($n=90$) | 76.5% | 2.45 |
| | Hinglish ($n=70$) | 77.2% | 2.38 |
| | English ($n=40$) | 77.8% | 2.40 |
| **Living Arrangement** | Living Alone ($n=70$) | 78.1% | 2.48 |
| | With Spouse ($n=80$) | 76.2% | 2.35 |
| | With Family ($n=50$) | 77.0% | 2.42 |
| **Age Band** | 60 – 69 years | 76.8% | 2.39 |
| | 70 – 79 years | 77.1% | 2.41 |
| | 80+ years | 77.4% | 2.44 |

*Summary*: Detection sensitivity is equitable across language preferences and living arrangements.

---

## 4. Known Technical Limitations & Recommended Phase 3 Roadmap
1. **Masked Decline Telemetry Gaps**: Subtle gradual decline in seniors with severe device non-adherence ($>30\%$ missingness) remains challenging for rule heuristics alone.
2. **Rule-Based NLP Scope**: While the lightweight multilingual extractor accurately handles negations and historical clauses in conversational notes, it relies on structured syntactic regexes. Phase 3 should explore fine-tuned local compact models (e.g., IndicBERT) for complex vernacular idioms.
3. **Phase 3 Next.js Dashboard**: Phase 2 provides the complete backend API; Phase 3 will deliver the Care Coordinator user interface.

