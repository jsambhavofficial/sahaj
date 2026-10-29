"""Clinical and operational risk rules for SamarthCare AI early-warning engine."""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Callable
import pandas as pd


@dataclass
class RuleEvaluation:
    rule_id: str
    category: str
    triggered: bool
    points: float
    evidence: str
    window: str
    is_safety_tripwire: bool
    recommended_action: str


class RiskRulesRegistry:
    """
    Transparent clinical risk rules capturing acute tripwires, baseline deviations,
    sustained longitudinal deterioration, and cross-modal multi-signal corroboration.
    """

    @staticmethod
    def evaluate_all(row: Dict[str, Any]) -> List[RuleEvaluation]:
        evaluations: List[RuleEvaluation] = []

        # ---------------------------------------------------------
        # Category 1: Acute Safety Tripwires (Independent Pathway)
        # ---------------------------------------------------------
        # Rule 1.1: Mechanical Fall or Slip Incident
        fall_current = bool(row.get("cue_fall_current", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_ACUTE_FALL",
            category="acute_safety",
            triggered=fall_current,
            points=80.0 if fall_current else 0.0,
            evidence="Senior or coordinator check-in note confirmed an acute slip or fall incident.",
            window="Past 24-72 hours",
            is_safety_tripwire=True,
            recommended_action="Care Coordinator must immediately contact senior or local emergency contact, assess for injury, and initiate post-fall safety protocol."
        ))

        # Rule 1.2: Severe Hypertensive Spike (SBP >= 170 mmHg)
        sbp_severe = bool(row.get("bp_severe_spike_flag", False))
        sbp_val = row.get("bp_systolic_latest")
        evaluations.append(RuleEvaluation(
            rule_id="RULE_ACUTE_HYPERTENSIVE_SPIKE",
            category="acute_safety",
            triggered=sbp_severe,
            points=75.0 if sbp_severe else 0.0,
            evidence=f"Critical systolic blood pressure spike recorded ({sbp_val} mmHg)." if sbp_severe else "",
            window="Today",
            is_safety_tripwire=True,
            recommended_action="Care Coordinator should verify reading with repeat check, enquire regarding headaches/vision changes, and escalate to supervising physician."
        ))

        # Rule 1.3: Severe Desaturation / Hypoxia (SpO2 <= 92%)
        spo2_hypoxia = bool(row.get("spo2_hypoxia_flag", False))
        spo2_val = row.get("spo2_latest")
        evaluations.append(RuleEvaluation(
            rule_id="RULE_ACUTE_HYPOXIA",
            category="acute_safety",
            triggered=spo2_hypoxia,
            points=75.0 if spo2_hypoxia else 0.0,
            evidence=f"Pulse oximeter reading indicated acute hypoxia ({spo2_val}% SpO2)." if spo2_hypoxia else "",
            window="Today / 3-day mean",
            is_safety_tripwire=True,
            recommended_action="Immediate follow-up required. Check probe placement, enquire about breathing difficulty, and seek prompt clinical attention if sustained."
        ))

        # Rule 1.4: Severe Orthostatic / Acute Hypotension (SBP <= 95 mmHg)
        sbp_hypo = bool(row.get("bp_hypotension_flag", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_ACUTE_HYPOTENSION",
            category="acute_safety",
            triggered=sbp_hypo,
            points=60.0 if sbp_hypo else 0.0,
            evidence=f"Systolic blood pressure dropped to hypotensive trough ({sbp_val} mmHg)." if sbp_hypo else "",
            window="Today",
            is_safety_tripwire=False,
            recommended_action="Coordinator should advise sitting down immediately, ensuring adequate hydration, and checking for syncope/dizziness."
        ))

        # ---------------------------------------------------------
        # Category 2: Baseline Deviations & Sustained Trends
        # ---------------------------------------------------------
        # Rule 2.1: Sustained Mobility / Physical Activity Collapse (>40% drop over 3 days)
        steps_sustained = bool(row.get("steps_sustained_drop_flag", False))
        steps_3d_ratio = row.get("steps_rolling_3d_ratio")
        evaluations.append(RuleEvaluation(
            rule_id="RULE_SUSTAINED_MOBILITY_DROP",
            category="sustained_trend",
            triggered=steps_sustained,
            points=28.0 if steps_sustained else 0.0,
            evidence=f"Daily step count averaged only {int(steps_3d_ratio*100) if pd.notna(steps_3d_ratio) else 0}% of senior's personal baseline over 3 consecutive days.",
            window="3-day rolling window",
            is_safety_tripwire=False,
            recommended_action="Inquire about physical mobility, joint stiffness, pain flares, or unsteadiness during scheduled check-in."
        ))

        # Rule 2.2: Sustained Elevated Blood Pressure (>145 mmHg or +25 mmHg above baseline)
        bp_sustained = bool(row.get("bp_sustained_high_flag", False))
        sbp_3d = row.get("bp_systolic_rolling_3d")
        evaluations.append(RuleEvaluation(
            rule_id="RULE_SUSTAINED_HYPERTENSION",
            category="sustained_trend",
            triggered=bp_sustained,
            points=24.0 if bp_sustained else 0.0,
            evidence=f"Systolic BP rolling average is {sbp_3d} mmHg (elevated above personal baseline).",
            window="3-day rolling window",
            is_safety_tripwire=False,
            recommended_action="Review sodium intake, stress factors, and confirm whether prescribed anti-hypertensive doses were taken."
        ))

        # Rule 2.3: Marked Sleep Disruption (Sleep < 4.5h or Delta >= 2.5h)
        sleep_disrupted = bool(row.get("sleep_disrupted_flag", False))
        sleep_dev = row.get("sleep_dev_baseline")
        evaluations.append(RuleEvaluation(
            rule_id="RULE_SLEEP_DISRUPTION",
            category="baseline_deviation",
            triggered=sleep_disrupted,
            points=16.0 if sleep_disrupted else 0.0,
            evidence=f"Sleep deviated by {sleep_dev} hours from baseline, reflecting acute or worsening sleep fragmentation.",
            window="Past 24 hours",
            is_safety_tripwire=False,
            recommended_action="Review nighttime restlessness, pain, or anxiety during daytime interaction."
        ))

        # Rule 2.4: Sustained Appetite & Weight Loss
        appetite_drop = bool(row.get("appetite_sustained_drop_flag", False))
        wt_change = row.get("weight_change_7d", 0.0)
        wt_loss_flag = wt_change <= -2.0
        app_wt_triggered = appetite_drop or wt_loss_flag
        evaluations.append(RuleEvaluation(
            rule_id="RULE_APPETITE_WEIGHT_DECLINE",
            category="sustained_trend",
            triggered=app_wt_triggered,
            points=22.0 if app_wt_triggered else 0.0,
            evidence=f"Appetite score substantially decreased ({row.get('appetite_dev_baseline')} from baseline) with {wt_change} kg 7-day weight trend.",
            window="3-day to 7-day window",
            is_safety_tripwire=False,
            recommended_action="Check nutritional intake, hydration, and schedule coordinator or dietary review."
        ))

        # ---------------------------------------------------------
        # Category 3: Medication Adherence Concerns
        # ---------------------------------------------------------
        # Rule 3.1: Consecutive Missed Scheduled Doses
        consec_miss = bool(row.get("consecutive_miss_flag", False))
        missed_count = row.get("missed_doses_3d", 0)
        evaluations.append(RuleEvaluation(
            rule_id="RULE_MEDICATION_MISSED_DOSES",
            category="medication",
            triggered=consec_miss,
            points=26.0 if consec_miss else 0.0,
            evidence=f"Multiple scheduled doses confirmed missed ({missed_count} doses missed over past 3 days).",
            window="3-day rolling window",
            is_safety_tripwire=False,
            recommended_action="Check pillbox organization, verify if senior experienced side effects, and re-establish daily dosing routine."
        ))

        # ---------------------------------------------------------
        # Category 4: Unstructured Clinical NLP Signals
        # ---------------------------------------------------------
        # Rule 4.1: Active Weakness or Unusual Fatigue
        cue_weakness = bool(row.get("cue_weakness_current", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_NLP_WEAKNESS",
            category="nlp_cues",
            triggered=cue_weakness,
            points=18.0 if cue_weakness else 0.0,
            evidence="Check-in dialogue note captured active complaints of unusual weakness or physical exhaustion.",
            window="Past 72 hours",
            is_safety_tripwire=False,
            recommended_action="Monitor energy levels, confirm hydration, and evaluate whether routine mobility is compromised."
        ))

        # Rule 4.2: Active Dizziness or Unsteadiness
        cue_dizzy = bool(row.get("cue_dizziness_current", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_NLP_DIZZINESS",
            category="nlp_cues",
            triggered=cue_dizzy,
            points=22.0 if cue_dizzy else 0.0,
            evidence="Check-in note logged sensations of postural dizziness, lightheadedness, or unsteadiness.",
            window="Past 72 hours",
            is_safety_tripwire=False,
            recommended_action="Warn senior about sudden standing, review BP logs, and assess fall risk precautions."
        ))

        # Rule 4.3: Cognitive Disorientation or Confusion
        cue_conf = bool(row.get("cue_confusion_current", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_NLP_CONFUSION",
            category="nlp_cues",
            triggered=cue_conf,
            points=25.0 if cue_conf else 0.0,
            evidence="Senior exhibited temporal disorientation or confusion regarding medications/meals during check-in.",
            window="Past 72 hours",
            is_safety_tripwire=False,
            recommended_action="Contact family or caregiver, verify orienting routine, and evaluate for potential infection or delirium."
        ))

        # Rule 4.4: Localized / Worsening Pain
        cue_pain = bool(row.get("cue_pain_current", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_NLP_PAIN",
            category="nlp_cues",
            triggered=cue_pain,
            points=16.0 if cue_pain else 0.0,
            evidence="Active pain or joint stiffness documented in conversational check-in notes.",
            window="Past 72 hours",
            is_safety_tripwire=False,
            recommended_action="Assess pain severity, functional restriction, and current analgesic regimen."
        ))

        # ---------------------------------------------------------
        # Category 5: Multi-Modal Corroboration & Cross-Source Synergy
        # ---------------------------------------------------------
        # Rule 5.1: Cross-Modal Frailty (Activity Drop + Stated Weakness/Dizziness)
        cross_frailty = (steps_sustained or bool(row.get("steps_acute_drop_flag", False))) and (cue_weakness or cue_dizzy)
        evaluations.append(RuleEvaluation(
            rule_id="RULE_CORROBORATED_DECLINE",
            category="cross_modal",
            triggered=cross_frailty,
            points=20.0 if cross_frailty else 0.0,
            evidence="Objective sensor drop in activity is corroborated by subjective conversational complaints of weakness or dizziness.",
            window="3-day window",
            is_safety_tripwire=False,
            recommended_action="High synergy warning: multiple independent modalities confirm functional decline. Schedule prompt coordinator call."
        ))

        # Rule 5.2: Family Caregiver Corroboration
        fam_corroborated = bool(row.get("family_mobility_flag", False) or row.get("family_routine_flag", False))
        evaluations.append(RuleEvaluation(
            rule_id="RULE_FAMILY_CORROBORATION",
            category="cross_modal",
            triggered=fam_corroborated,
            points=15.0 if fam_corroborated else 0.0,
            evidence="Caregiver observations independently report unsteadiness or routine disruption.",
            window="7-day window",
            is_safety_tripwire=False,
            recommended_action="Coordinate with family caregiver to align on observations and support requirements."
        ))

        return evaluations

