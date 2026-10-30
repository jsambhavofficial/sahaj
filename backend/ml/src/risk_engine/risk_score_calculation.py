"""Multimodal Risk Score Calculation Engine for SamarthCare AI.

Computes calibrated daily risk scores (0-100) using the multimodal formulation:
    Risk = f(
        forecasted_vitals,
        slope,
        momentum,
        psychological_wellbeing,
        physical_wellbeing,
        assistance_required,
        active_issues,
        medicine_adherence
    )

Supports both:
1. Single individual execution (`calculate_senior_risk(db, senior_id, on_date)`)
2. Full cohort execution (`calculate_cohort_risk(db, on_date, senior_ids=None)`)

Both DB entrypoints call the Vitals Forecast Model (`forecast_senior` / `forecast_cohort`)
first, combine the forecast outputs with DB signals (NLP cues, voice notes, check-in calls,
medication adherence, daily activity, accelerometer falls, and open talking points/issues),
compute the multimodal risk score, and write the result to `daily_risk_scores` in the DB.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
import logging
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
try:
    from sqlalchemy import select
    from sqlalchemy.orm import Session
except ImportError:
    select = None  # type: ignore
    Session = Any  # type: ignore

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


@dataclass
class ContributingFactor:
    factor_id: str
    category: str
    points: float
    description: str
    evidence: str
    urgency: str  # "IMMEDIATE", "SAME_DAY", "ROUTINE"


@dataclass
class RiskCalculationResult:
    senior_id: str
    date: str
    final_risk_score: int
    risk_level: str  # "LOW", "MODERATE", "HIGH", "URGENT_REVIEW"
    confidence_level: str  # "HIGH", "MEDIUM", "LOW"

    # Sub-category breakdown scores (after saturation caps)
    sub_scores: Dict[str, float]

    # Active synergistic multipliers triggered
    active_synergies: List[Dict[str, Any]]

    # Top contributing factors for coordinator dashboard explainability
    top_factors: List[ContributingFactor]

    # Dual-queue operational dispatch
    requires_clinical_escalation: bool
    requires_operations_action: bool
    recommended_clinical_action: str
    recommended_operations_action: str

    # Audit trail & data quality
    safety_tripwire_triggered: bool
    data_quality_flags: List[str]
    calculation_timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["top_factors"] = [asdict(f) for f in self.top_factors]
        return d

    def to_db_top_factors(self) -> List[Dict[str, Any]]:
        """Format top_factors so both RiskCalculationResponse and Alert/PriorityList services read them."""
        out: List[Dict[str, Any]] = []
        for idx, f in enumerate(self.top_factors):
            is_trip = bool(
                f.urgency == "IMMEDIATE"
                and (
                    self.safety_tripwire_triggered
                    or f.factor_id in (
                        "FC_SBP_CRITICAL",
                        "FC_SPO2_HYPOXIA_CRITICAL",
                        "PHYS_FALL_INCIDENT",
                        "PHYS_BREATHLESSNESS",
                    )
                )
            )
            ev_text = (
                f"{f.description} ({f.evidence})"
                if f.evidence and f.evidence not in f.description
                else (f.evidence or f.description)
            )
            out.append(
                {
                    "factor_id": f.factor_id,
                    "rule_id": f.factor_id,
                    "category": f.category,
                    "points": round(float(f.points), 1),
                    "points_contributed": round(float(f.points), 1),
                    "description": f.description,
                    "evidence": ev_text,
                    "urgency": f.urgency,
                    "window": "Current window",
                    "is_safety_tripwire": is_trip,
                }
            )
        return out


class MultimodalRiskCalculator:
    """Calculates unified senior risk scores across physiological, NLP, and operational signals."""

    VERSION = "3.0.0"

    # Category Saturation Caps: prevent multiple correlated signals from overflowing the scale
    CATEGORY_CAPS = {
        "vitals_forecast": 35.0,
        "vitals_slope_momentum": 30.0,
        "physical_wellbeing": 35.0,
        "psychological_wellbeing": 25.0,
        "medicine_adherence": 30.0,
        "assistance_and_issues": 15.0,
    }

    # Baseline Tripwires: force minimum score if acute life-threatening emergency occurs
    TRIPWIRE_FALL_SCORE = 80
    TRIPWIRE_CHEST_PAIN_SCORE = 85
    TRIPWIRE_SEVERE_HYPOXIA_SCORE = 85

    @classmethod
    def calculate(cls, input_data: Dict[str, Any]) -> RiskCalculationResult:
        """
        Executes multimodal calculation for 1 senior.
        input_data can contain forecasted vitals, slopes, NLP events, medication logs, and ops tickets.
        """
        senior_id = str(input_data.get("senior_id", "UNKNOWN"))
        date_str = str(input_data.get("date", datetime.utcnow().strftime("%Y-%m-%d")))

        factors: List[ContributingFactor] = []
        sub_scores_raw: Dict[str, float] = {k: 0.0 for k in cls.CATEGORY_CAPS.keys()}
        active_synergies: List[Dict[str, Any]] = []
        data_flags: List[str] = list(input_data.get("extra_data_quality_flags") or [])

        is_tripwire = False
        tripwire_floor = 0

        # =========================================================================
        # 1. FORECASTED VITALS (Absolute Levels vs Normal Seniors Baselines)
        # =========================================================================
        # Systolic BP Forecast
        sbp_fc = input_data.get("bp_systolic_forecast")
        if sbp_fc is not None and not np.isnan(sbp_fc):
            if sbp_fc >= 170.0:
                pts = 30.0
                is_tripwire = True
                tripwire_floor = max(tripwire_floor, 80)
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SBP_CRITICAL",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted Systolic BP in crisis range (>=170 mmHg)",
                    evidence=f"Model forecast: {sbp_fc:.1f} mmHg",
                    urgency="IMMEDIATE"
                ))
            elif sbp_fc >= 150.0:
                pts = 18.0
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SBP_HIGH",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted Systolic BP stage-2 hypertension (>=150 mmHg)",
                    evidence=f"Model forecast: {sbp_fc:.1f} mmHg",
                    urgency="SAME_DAY"
                ))
            elif sbp_fc <= 95.0:
                pts = 22.0
                if sbp_fc <= 85.0:
                    is_tripwire = True
                    tripwire_floor = max(tripwire_floor, 75)
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SBP_HYPOTENSION",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted acute hypotension (<=95 mmHg, syncope/fall risk)",
                    evidence=f"Model forecast: {sbp_fc:.1f} mmHg",
                    urgency="IMMEDIATE" if sbp_fc <= 85.0 else "SAME_DAY"
                ))
        else:
            data_flags.append("Forecasted blood pressure telemetry missing.")

        # SpO2 Blood Oxygen Forecast
        spo2_fc = input_data.get("spo2_forecast")
        if spo2_fc is not None and not np.isnan(spo2_fc):
            if spo2_fc <= 90.0:
                pts = 35.0
                is_tripwire = True
                tripwire_floor = max(tripwire_floor, cls.TRIPWIRE_SEVERE_HYPOXIA_SCORE)
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SPO2_HYPOXIA_CRITICAL",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted severe hypoxia (SpO2 <= 90%)",
                    evidence=f"Model forecast: {spo2_fc:.1f}%",
                    urgency="IMMEDIATE"
                ))
            elif spo2_fc <= 93.0:
                pts = 20.0
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SPO2_LOW",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted low blood oxygen saturation (<= 93%)",
                    evidence=f"Model forecast: {spo2_fc:.1f}%",
                    urgency="SAME_DAY"
                ))

        # Pulse / Heart Rate Forecast
        pulse_fc = input_data.get("pulse_forecast")
        if pulse_fc is not None and not np.isnan(pulse_fc):
            if pulse_fc >= 115.0 or pulse_fc <= 48.0:
                pts = 16.0
                if pulse_fc >= 130.0 or pulse_fc <= 40.0:
                    is_tripwire = True
                    tripwire_floor = max(tripwire_floor, 75)
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_PULSE_EXTREME",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted extreme resting pulse rate tachycardia/bradycardia",
                    evidence=f"Model forecast: {pulse_fc:.0f} bpm",
                    urgency="IMMEDIATE" if (pulse_fc >= 130.0 or pulse_fc <= 40.0) else "SAME_DAY"
                ))

        # Blood Glucose Forecast (when provided by Vitals Forecast Model)
        gluc_fc = input_data.get("blood_glucose_forecast")
        if gluc_fc is not None and not np.isnan(gluc_fc):
            if gluc_fc <= 54.0 or gluc_fc >= 300.0:
                pts = 28.0
                is_tripwire = True
                tripwire_floor = max(tripwire_floor, 75)
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_GLUCOSE_CRITICAL",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted blood glucose in critical range",
                    evidence=f"Model forecast: {gluc_fc:.0f} mg/dL",
                    urgency="IMMEDIATE"
                ))
            elif gluc_fc <= 70.0 or gluc_fc >= 220.0:
                pts = 15.0
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_GLUCOSE_ABNORMAL",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted blood glucose outside safe glycemic range",
                    evidence=f"Model forecast: {gluc_fc:.0f} mg/dL",
                    urgency="SAME_DAY"
                ))

        # Composite Vitals Forecast Model R_vitals contribution (captures personal baseline drift)
        r_vitals = input_data.get("r_vitals_score")
        if r_vitals is not None and not np.isnan(r_vitals) and float(r_vitals) >= 25.0:
            scaled_r_pts = round(min(float(r_vitals) * 0.35, 25.0), 1)
            if scaled_r_pts > sub_scores_raw["vitals_forecast"]:
                diff_pts = round(scaled_r_pts - sub_scores_raw["vitals_forecast"], 1)
                if diff_pts >= 4.0:
                    sub_scores_raw["vitals_forecast"] += diff_pts
                    factors.append(ContributingFactor(
                        factor_id="FC_PERSONAL_BASELINE_DRIFT",
                        category="vitals_forecast",
                        points=diff_pts,
                        description="Vitals forecast model detected deviation from personal baseline",
                        evidence=f"Vitals model risk index: {float(r_vitals):.1f}/100",
                        urgency="SAME_DAY" if float(r_vitals) >= 50.0 else "ROUTINE"
                    ))

        # =========================================================================
        # 2. SLOPE & MOMENTUM (Rate of Drift & Volatility)
        # =========================================================================
        sbp_slope = input_data.get("bp_systolic_slope_3d", 0.0) or 0.0
        if sbp_slope >= 6.0:  # rising >6 mmHg per day over 3 days
            pts = 18.0
            sub_scores_raw["vitals_slope_momentum"] += pts
            factors.append(ContributingFactor(
                factor_id="SLOPE_SBP_RAPID_RISE",
                category="vitals_slope_momentum",
                points=pts,
                description="Systolic BP trending steeply upward over past 3-day window",
                evidence=f"Slope: +{sbp_slope:.1f} mmHg/day",
                urgency="SAME_DAY"
            ))
        elif sbp_slope <= -8.0:  # plunging rapidly
            pts = 16.0
            sub_scores_raw["vitals_slope_momentum"] += pts
            factors.append(ContributingFactor(
                factor_id="SLOPE_SBP_RAPID_DROP",
                category="vitals_slope_momentum",
                points=pts,
                description="Systolic BP dropping rapidly over past 3-day window",
                evidence=f"Slope: {sbp_slope:.1f} mmHg/day",
                urgency="SAME_DAY"
            ))

        spo2_slope = input_data.get("spo2_slope_3d", 0.0) or 0.0
        if spo2_slope <= -1.2:  # steady hypoxic degradation
            pts = 18.0
            sub_scores_raw["vitals_slope_momentum"] += pts
            factors.append(ContributingFactor(
                factor_id="SLOPE_SPO2_DECLINE",
                category="vitals_slope_momentum",
                points=pts,
                description="SpO2 oxygen saturation declining over 3-day window",
                evidence=f"Slope: {spo2_slope:.2f}%/day",
                urgency="SAME_DAY"
            ))

        weight_slope_7d = input_data.get("weight_slope_7d", 0.0) or 0.0
        if weight_slope_7d >= 1.8:  # rapid weight gain >= 1.8 kg over 7d (fluid retention)
            pts = 16.0
            sub_scores_raw["vitals_slope_momentum"] += pts
            factors.append(ContributingFactor(
                factor_id="SLOPE_WEIGHT_SURGE",
                category="vitals_slope_momentum",
                points=pts,
                description="Rapid 7-day weight gain indicating fluid retention (CHF risk)",
                evidence=f"7-day weight delta: +{weight_slope_7d:.1f} kg",
                urgency="SAME_DAY"
            ))

        # =========================================================================
        # 3. PHYSICAL WELLBEING (Extracted NLP Cues & Physical Telemetry)
        # =========================================================================
        cue_fall = bool(input_data.get("cue_fall_incident", False))
        if cue_fall:
            pts = 35.0
            is_tripwire = True
            tripwire_floor = max(tripwire_floor, cls.TRIPWIRE_FALL_SCORE)
            sub_scores_raw["physical_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PHYS_FALL_INCIDENT",
                category="physical_wellbeing",
                points=pts,
                description="Mechanical fall, slip, or trip reported in voice note, call, or sensor",
                evidence="Fall/slip incident detected",
                urgency="IMMEDIATE"
            ))

        cue_pain = bool(input_data.get("cue_acute_pain", False))
        if cue_pain:
            pts = 22.0
            sub_scores_raw["physical_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PHYS_ACUTE_PAIN",
                category="physical_wellbeing",
                points=pts,
                description="Active acute pain (chest, joint, or severe abdominal)",
                evidence="Dialogue/transcript documented pain complaint",
                urgency="SAME_DAY"
            ))

        cue_dizzy = bool(input_data.get("cue_dizziness_vertigo", False))
        if cue_dizzy:
            pts = 20.0
            sub_scores_raw["physical_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PHYS_DIZZINESS_VERTIGO",
                category="physical_wellbeing",
                points=pts,
                description="Postural dizziness, lightheadedness, or balance loss",
                evidence="Senior reported head spinning / chakkar",
                urgency="SAME_DAY"
            ))

        cue_breathless = bool(input_data.get("cue_breathlessness", False))
        if cue_breathless:
            pts = 28.0
            sub_scores_raw["physical_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PHYS_BREATHLESSNESS",
                category="physical_wellbeing",
                points=pts,
                description="Dyspnea / difficulty breathing reported",
                evidence="Senior stated breathlessness / saans phoolna",
                urgency="IMMEDIATE"
            ))

        cue_weakness = bool(input_data.get("cue_severe_weakness", False))
        if cue_weakness:
            pts = 18.0
            sub_scores_raw["physical_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PHYS_SEVERE_WEAKNESS",
                category="physical_wellbeing",
                points=pts,
                description="Severe physical weakness or bedbound immobility",
                evidence="Senior reported exhaustion / kamzori",
                urgency="SAME_DAY"
            ))

        # Sensor Activity / Step Ratio
        step_ratio = input_data.get("daily_step_count_ratio")
        if step_ratio is not None and not np.isnan(step_ratio):
            if step_ratio <= 0.35:  # steps plunged <35% of personal 14-day baseline
                pts = 16.0
                sub_scores_raw["physical_wellbeing"] += pts
                factors.append(ContributingFactor(
                    factor_id="PHYS_ACTIVITY_COLLAPSE",
                    category="physical_wellbeing",
                    points=pts,
                    description="Severe drop in daily physical mobility vs personal baseline",
                    evidence=f"Daily step volume: {step_ratio*100:.0f}% of steady state",
                    urgency="SAME_DAY"
                ))
            elif step_ratio < 0.60:
                pts = 12.0
                sub_scores_raw["physical_wellbeing"] += pts
                factors.append(ContributingFactor(
                    factor_id="PHYS_ACTIVITY_DROP",
                    category="physical_wellbeing",
                    points=pts,
                    description="Drop in daily physical mobility vs personal baseline",
                    evidence=f"Daily step volume: {step_ratio*100:.0f}% of steady state",
                    urgency="ROUTINE"
                ))

        # =========================================================================
        # 4. PSYCHOLOGICAL WELLBEING (NLP Distress, Loneliness, Insomnia, Cognition)
        # =========================================================================
        cue_conf = bool(input_data.get("cue_cognitive_confusion", False))
        if cue_conf:
            pts = 25.0
            sub_scores_raw["psychological_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PSYCH_CONFUSION_DISORIENTATION",
                category="psychological_wellbeing",
                points=pts,
                description="Temporal disorientation, cognitive lapse, or memory confusion",
                evidence="Dialogue noted confusion regarding day/meds",
                urgency="SAME_DAY"
            ))

        cue_anxiety = bool(input_data.get("cue_severe_anxiety_panic", False))
        if cue_anxiety:
            pts = 18.0
            sub_scores_raw["psychological_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PSYCH_ANXIETY_PANIC",
                category="psychological_wellbeing",
                points=pts,
                description="Expressed acute anxiety, fear of falling, or restlessness",
                evidence="Documented emotional distress / ghabrahat",
                urgency="SAME_DAY"
            ))

        cue_lonely = bool(input_data.get("cue_loneliness_isolation", False))
        if cue_lonely:
            pts = 14.0
            sub_scores_raw["psychological_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PSYCH_LONELINESS_ISOLATION",
                category="psychological_wellbeing",
                points=pts,
                description="Significant social isolation, persistent low mood, or tearfulness",
                evidence="Senior reported akelapan / feeling isolated",
                urgency="ROUTINE"
            ))

        cue_sleep = bool(input_data.get("cue_sleep_fragmentation", False))
        if cue_sleep:
            pts = 12.0
            sub_scores_raw["psychological_wellbeing"] += pts
            factors.append(ContributingFactor(
                factor_id="PSYCH_SLEEP_DISRUPTION",
                category="psychological_wellbeing",
                points=pts,
                description="Severe sleep fragmentation or insomnia (<4.5 hours)",
                evidence="Reported disrupted or sleepless night",
                urgency="ROUTINE"
            ))

        # Direct NLP Risk Contribution (from VoiceNotesProcessor / CallProcessor)
        nlp_risk_delta = float(input_data.get("nlp_risk_delta", 0.0) or 0.0)
        current_nlp_pts = sub_scores_raw["physical_wellbeing"] + sub_scores_raw["psychological_wellbeing"]
        if nlp_risk_delta > current_nlp_pts:
            extra_nlp = round(nlp_risk_delta - current_nlp_pts, 1)
            sub_scores_raw["physical_wellbeing"] += extra_nlp
            factors.append(ContributingFactor(
                factor_id="NLP_SIGNAL_CONTRIBUTION",
                category="physical_wellbeing",
                points=extra_nlp,
                description="Additional risk signals extracted from voice note or check-in conversation",
                evidence=f"NLP risk contribution: +{nlp_risk_delta:.1f} pts",
                urgency="SAME_DAY" if nlp_risk_delta >= 20.0 else "ROUTINE"
            ))

        # =========================================================================
        # 5. MEDICATION ADHERENCE & LOGISTICS
        # =========================================================================
        missed_doses_3d = input_data.get("med_consecutive_missed_doses", 0) or 0
        if missed_doses_3d >= 2:
            pts = 24.0
            sub_scores_raw["medicine_adherence"] += pts
            factors.append(ContributingFactor(
                factor_id="MED_CONSECUTIVE_MISS",
                category="medicine_adherence",
                points=pts,
                description=f"Multiple scheduled doses confirmed missed ({missed_doses_3d} in 3 days)",
                evidence=f"{missed_doses_3d} missed doses in rolling window",
                urgency="SAME_DAY"
            ))
        elif missed_doses_3d == 1:
            pts = 10.0
            sub_scores_raw["medicine_adherence"] += pts
            factors.append(ContributingFactor(
                factor_id="MED_SINGLE_MISS",
                category="medicine_adherence",
                points=pts,
                description="Single scheduled medication dose missed",
                evidence="1 missed dose recorded",
                urgency="ROUTINE"
            ))

        crit_med = bool(input_data.get("med_critical_omission_flag", False))
        if crit_med:
            pts = 16.0
            sub_scores_raw["medicine_adherence"] += pts
            factors.append(ContributingFactor(
                factor_id="MED_CRITICAL_DRUG_OMISSION",
                category="medicine_adherence",
                points=pts,
                description="Missed high-risk critical medication (antihypertensive, insulin, anticoagulant)",
                evidence="Critical medication schedule violated",
                urgency="IMMEDIATE"
            ))

        med_refill = bool(input_data.get("med_refill_depleted", False))
        if med_refill:
            pts = 10.0
            sub_scores_raw["medicine_adherence"] += pts
            factors.append(ContributingFactor(
                factor_id="MED_REFILL_DEPLETED",
                category="medicine_adherence",
                points=pts,
                description="Prescription medication depleted; partner pharmacy refill required",
                evidence="Senior reported strip khatam ho gayi",
                urgency="SAME_DAY"
            ))

        # =========================================================================
        # 6. ASSISTANCE REQUIRED & ACTIVE OPERATIONAL ISSUES
        # =========================================================================
        if bool(input_data.get("needs_transport_escort", False)):
            pts = 6.0
            sub_scores_raw["assistance_and_issues"] += pts
            factors.append(ContributingFactor(
                factor_id="OPS_TRANSPORT_ESCORT",
                category="assistance_and_issues",
                points=pts,
                description="Station, hospital, or travel escort assistance requested",
                evidence="Escort assistance ticket open",
                urgency="ROUTINE"
            ))

        if bool(input_data.get("needs_daily_essentials", False)):
            pts = 8.0
            sub_scores_raw["assistance_and_issues"] += pts
            factors.append(ContributingFactor(
                factor_id="OPS_DAILY_ESSENTIALS",
                category="assistance_and_issues",
                points=pts,
                description="Grocery, food, or essential household supply shortage",
                evidence="Essentials supply ticket open",
                urgency="SAME_DAY"
            ))

        if bool(input_data.get("tech_app_confusion", False)):
            pts = 5.0
            sub_scores_raw["assistance_and_issues"] += pts
            factors.append(ContributingFactor(
                factor_id="OPS_TECH_CONFUSION",
                category="assistance_and_issues",
                points=pts,
                description="Senior struggling with mobile app interface or device usage",
                evidence="App confusion reported",
                urgency="ROUTINE"
            ))

        if bool(input_data.get("service_friction_pacing", False)):
            pts = 5.0
            sub_scores_raw["assistance_and_issues"] += pts
            factors.append(ContributingFactor(
                factor_id="OPS_COORDINATOR_PACING",
                category="assistance_and_issues",
                points=pts,
                description="Coordinator speech pace too rapid for elder comprehension",
                evidence="Service feedback noted fast speech rate",
                urgency="ROUTINE"
            ))

        # Aging assistance penalty: unresolved > 48h escalates operational friction into care risk
        aging_hrs = input_data.get("assistance_unresolved_aging_hours", 0) or 0
        if aging_hrs >= 48:
            pts = 8.0
            sub_scores_raw["assistance_and_issues"] += pts
            factors.append(ContributingFactor(
                factor_id="OPS_UNRESOLVED_AGING",
                category="assistance_and_issues",
                points=pts,
                description=f"Assistance ticket open for >48 hours without coordinator resolution ({aging_hrs}h)",
                evidence=f"Aging ticket duration: {aging_hrs} hours",
                urgency="SAME_DAY"
            ))

        # =========================================================================
        # 7. APPLY CATEGORY SATURATION CAPS
        # =========================================================================
        capped_sub_scores: Dict[str, float] = {}
        for cat, raw_pts in sub_scores_raw.items():
            cap = cls.CATEGORY_CAPS.get(cat, 30.0)
            capped_sub_scores[cat] = min(raw_pts, cap)

        base_aggregate = sum(capped_sub_scores.values())

        # =========================================================================
        # 8. CROSS-MODAL SYNERGY MULTIPLIERS (Non-linear Interaction Effects)
        # =========================================================================
        synergy_boost = 0.0

        # Synergy 1: Orthostatic Collapse (BP Drop or Slope Plunge + Reported Dizziness)
        if (cue_dizzy) and (sbp_slope <= -5.0 or (sbp_fc is not None and sbp_fc <= 100.0)):
            mult = 1.35
            boost = 14.0
            synergy_boost += boost
            active_synergies.append({
                "synergy_name": "Orthostatic Collapse Synergy",
                "multiplier": mult,
                "added_points": boost,
                "clinical_rationale": "Blood pressure drop corroborated by reported dizziness creates high impending syncope/fall risk."
            })

        # Synergy 2: Hypertensive Crisis with Missed Meds
        if (sbp_fc is not None and sbp_fc >= 155.0) and (missed_doses_3d >= 1 or crit_med):
            mult = 1.40
            boost = 16.0
            synergy_boost += boost
            active_synergies.append({
                "synergy_name": "Hypertensive Decompensation Synergy",
                "multiplier": mult,
                "added_points": boost,
                "clinical_rationale": "Severe systolic elevation compounded by omitted antihypertensive dosing."
            })

        # Synergy 3: Functional Frailty (Step Collapse + Stated Weakness)
        if cue_weakness and (step_ratio is not None and step_ratio <= 0.4):
            mult = 1.25
            boost = 10.0
            synergy_boost += boost
            active_synergies.append({
                "synergy_name": "Corroborated Functional Frailty",
                "multiplier": mult,
                "added_points": boost,
                "clinical_rationale": "Objective telemetry activity drop corroborated by subjective verbal exhaustion."
            })

        total_accumulated = base_aggregate + synergy_boost

        # =========================================================================
        # 9. RECOVERY & WELLBEING MODERATORS (Score Relief)
        # =========================================================================
        rec_count = int(input_data.get("cue_recovery_confirmed", 0) or 0)
        well_streak = int(input_data.get("cue_routine_wellbeing_streak", 0) or 0)

        if not is_tripwire:
            if rec_count > 0:
                relief = 6.0 * rec_count
                total_accumulated = max(0.0, total_accumulated - relief)
            if well_streak >= 3:
                total_accumulated = max(0.0, total_accumulated - 4.0)
            if nlp_risk_delta < 0:
                total_accumulated = max(0.0, total_accumulated + nlp_risk_delta)

        # =========================================================================
        # 10. FINAL RISK SCORE & TRIPWIRE ENFORCEMENT
        # =========================================================================
        if is_tripwire:
            final_score = int(np.clip(max(tripwire_floor, round(total_accumulated)), 75, 100))
        else:
            final_score = int(np.clip(round(total_accumulated), 0, 100))

        # Risk Band Assignment
        if final_score >= 75:
            risk_level = "URGENT_REVIEW"
        elif final_score >= 50:
            risk_level = "HIGH"
        elif final_score >= 25:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        # Confidence Level Calculation
        if is_tripwire:
            confidence = "HIGH"
        elif len(data_flags) >= 2:
            confidence = "LOW"
        elif len(data_flags) == 1:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"

        # Sort factors by points descending
        factors.sort(key=lambda x: x.points, reverse=True)

        # Dual-Queue Routing Actions
        clinical_escalate = (risk_level in ("HIGH", "URGENT_REVIEW")) or is_tripwire or (sub_scores_raw["physical_wellbeing"] >= 20.0)
        ops_action = (sub_scores_raw["assistance_and_issues"] > 0) or med_refill

        clinical_rec = cls._generate_clinical_recommendation(final_score, is_tripwire, factors, active_synergies)
        ops_rec = cls._generate_ops_recommendation(factors, input_data)

        return RiskCalculationResult(
            senior_id=senior_id,
            date=date_str,
            final_risk_score=final_score,
            risk_level=risk_level,
            confidence_level=confidence,
            sub_scores=capped_sub_scores,
            active_synergies=active_synergies,
            top_factors=factors[:5],
            requires_clinical_escalation=clinical_escalate,
            requires_operations_action=ops_action,
            recommended_clinical_action=clinical_rec,
            recommended_operations_action=ops_rec,
            safety_tripwire_triggered=is_tripwire,
            data_quality_flags=data_flags,
        )

    @classmethod
    def calculate_cohort(cls, cohort_inputs: List[Dict[str, Any]]) -> Dict[str, RiskCalculationResult]:
        """Executes multimodal risk calculation across a full cohort of senior input dictionaries."""
        results: Dict[str, RiskCalculationResult] = {}
        for item in cohort_inputs:
            res = cls.calculate(item)
            results[res.senior_id] = res
        return results

    @classmethod
    def _generate_clinical_recommendation(
        cls,
        score: int,
        is_tripwire: bool,
        factors: List[ContributingFactor],
        synergies: List[Dict[str, Any]],
    ) -> str:
        if is_tripwire:
            top_emergency = factors[0].description if factors else "Acute incident reported"
            return f"SAFETY TRIPWIRE ACTIVE ({top_emergency}). Dispatch immediate clinical nurse triage call within 60 minutes."
        if synergies:
            return f"HIGH SYNERGY ALERT: {synergies[0]['synergy_name']}. Schedule same-day physician or nursing review of vitals and regimen."
        if score >= 50:
            return "Schedule coordinator video check-in within 4 hours; verify morning vitals, mobility, and symptom persistence."
        if score >= 25:
            return "Review longitudinal baseline drift during routine daily check-in; monitor hydration and sleep."
        return "Patient within personalized baseline limits. Continue routine daily monitoring."

    @classmethod
    def _generate_ops_recommendation(cls, factors: List[ContributingFactor], data: Dict[str, Any]) -> str:
        ops_factors = [f for f in factors if f.category == "assistance_and_issues"]
        if bool(data.get("med_refill_depleted", False)):
            return "Place immediate medication prescription refill order with partner pharmacy for same-day delivery."
        if any(f.factor_id == "OPS_COORDINATOR_PACING" for f in ops_factors):
            return "Coach assigned coordinator to slow speaking rate and verify elder comprehension on next call."
        if any(f.factor_id == "OPS_TRANSPORT_ESCORT" for f in ops_factors):
            return "Coordinate transport escort / field assistant booking for scheduled travel."
        if ops_factors:
            return f"Follow up on pending concierge request: {ops_factors[0].description}."
        return "No pending operational concierge tickets."


# =============================================================================
# DB-Backed Execution: 1 Individual & Full Cohort
# =============================================================================

def _day_start_ist(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=IST)


def _to_ist_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(IST).date()


def _effective_vital(forecast_val: Optional[float], observed_vals: List[float], baseline: Optional[float], mode: str) -> Optional[float]:
    """
    Combine the Vitals Forecast Model output with any acute reading recorded in the last 48h
    so that an acute crisis reading entered from the frontend is never masked by smoothing.
    """
    if not observed_vals:
        return forecast_val
    if forecast_val is None:
        return float(observed_vals[-1])
    if mode == "sbp":
        hi, lo = max(observed_vals), min(observed_vals)
        if hi >= 150.0 and hi > forecast_val:
            return float(hi)
        if lo <= 95.0 and lo < forecast_val:
            return float(lo)
    elif mode == "spo2":
        lo = min(observed_vals)
        if lo <= 93.0 and lo < forecast_val:
            return float(lo)
    elif mode == "hr":
        hi, lo = max(observed_vals), min(observed_vals)
        if hi >= 115.0 and hi > forecast_val:
            return float(hi)
        if lo <= 48.0 and lo < forecast_val:
            return float(lo)
    elif mode == "gluc":
        hi, lo = max(observed_vals), min(observed_vals)
        if hi >= 220.0 and hi > forecast_val:
            return float(hi)
        if lo <= 70.0 and lo < forecast_val:
            return float(lo)
    return forecast_val


def build_multimodal_inputs_from_db(
    db: Session,
    senior_ids: List[str],
    on_date: date,
    forecasts_by_senior: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, str]]:
    """
    Batch-load all multimodal signals from the database for `senior_ids` up to `on_date`
    and combine them with the outputs from the Vitals Forecast Model (`forecasts_by_senior`).
    Returns `(inputs_by_senior, baseline_confidence_by_senior)`.
    """
    from app.modules.checkins.models import Checkin, NlpCue
    from app.modules.medications.models import MedicationEvent, MedicationSchedule
    from app.modules.messages.models import Message
    from app.modules.seniors.models import SeniorBaseline
    from app.modules.vitals.models import AccelerometerWindow, DailyActivity, Vital
    from app.modules.voice.models import Call, SeniorMemoryItem

    if not senior_ids:
        return {}, {}

    first_day = on_date - timedelta(days=6)
    start_dt = _day_start_ist(first_day)
    end_dt = _day_start_ist(on_date + timedelta(days=1))

    # 1. Baselines
    baselines: Dict[str, SeniorBaseline] = {}
    for b in db.scalars(select(SeniorBaseline).where(SeniorBaseline.senior_id.in_(senior_ids))):
        baselines[b.senior_id] = b

    # 2. Recent Vitals (last 2 days for acute reading check)
    recent_vitals: Dict[str, Dict[str, List[float]]] = {sid: {} for sid in senior_ids}
    for sid, mtype, val, at in db.execute(
        select(Vital.senior_id, Vital.measurement_type, Vital.value, Vital.measured_at).where(
            Vital.senior_id.in_(senior_ids),
            Vital.measured_at >= _day_start_ist(on_date - timedelta(days=1)),
            Vital.measured_at < end_dt,
            Vital.quality_status == "valid",
        )
    ):
        recent_vitals.setdefault(sid, {}).setdefault(mtype, []).append(float(val))

    # 3. Daily Activity (last 3 days)
    activities: Dict[str, List[DailyActivity]] = {sid: [] for sid in senior_ids}
    for a in db.scalars(
        select(DailyActivity).where(
            DailyActivity.senior_id.in_(senior_ids),
            DailyActivity.date >= on_date - timedelta(days=2),
            DailyActivity.date <= on_date,
        )
    ):
        activities.setdefault(a.senior_id, []).append(a)

    # 4. Medication Events (last 3 days)
    missed_meds_count: Dict[str, int] = {sid: 0 for sid in senior_ids}
    crit_med_missed: Dict[str, bool] = {sid: False for sid in senior_ids}
    unverified_crit_count: Dict[str, int] = {sid: 0 for sid in senior_ids}

    for sid, status, crit, at in db.execute(
        select(
            MedicationEvent.senior_id,
            MedicationEvent.status,
            MedicationSchedule.criticality,
            MedicationEvent.scheduled_at,
        )
        .join(MedicationSchedule, MedicationSchedule.medication_id == MedicationEvent.medication_id)
        .where(
            MedicationEvent.senior_id.in_(senior_ids),
            MedicationEvent.scheduled_at >= _day_start_ist(on_date - timedelta(days=2)),
            MedicationEvent.scheduled_at < end_dt,
            MedicationSchedule.is_sos.is_(False),
            MedicationEvent.status.in_(("taken", "missed", "unknown")),
        )
    ):
        if status == "missed":
            missed_meds_count[sid] = missed_meds_count.get(sid, 0) + 1
            if crit == "high":
                crit_med_missed[sid] = True
        elif status == "unknown" and crit == "high":
            unverified_crit_count[sid] = unverified_crit_count.get(sid, 0) + 1

    # 5. Calls, Messages, Check-ins & NLP Cues (last 7 days)
    source_day: Dict[str, Tuple[str, date]] = {}
    urgent_comm: Dict[str, bool] = {sid: False for sid in senior_ids}
    missed_checkins: Dict[str, int] = {sid: 0 for sid in senior_ids}
    nlp_deltas: Dict[str, float] = {sid: 0.0 for sid in senior_ids}

    for cid, sid, status, urgent, insights, model_info, at in db.execute(
        select(
            Call.id,
            Call.senior_id,
            Call.status,
            Call.urgency_flag,
            Call.call_insights,
            Call.model_info,
            Call.started_at,
        ).where(Call.senior_id.in_(senior_ids), Call.started_at >= start_dt, Call.started_at < end_dt)
    ):
        if at is None:
            continue
        day = _to_ist_date(at)
        source_day[str(cid)] = ("call", day)
        if (on_date - day).days <= 2:
            if urgent:
                urgent_comm[sid] = True
            if status in ("no_answer", "busy", "declined"):
                missed_checkins[sid] = missed_checkins.get(sid, 0) + 1
            for meta in (insights, model_info):
                if isinstance(meta, dict) and "nlp_risk_delta" in meta:
                    try:
                        nlp_deltas[sid] = nlp_deltas.get(sid, 0.0) + float(meta["nlp_risk_delta"])
                    except (TypeError, ValueError):
                        pass

    for mid, sid, kind, urgent, at in db.execute(
        select(
            Message.id,
            Message.senior_id,
            Message.kind,
            Message.urgency_flag,
            Message.created_at,
        ).where(Message.senior_id.in_(senior_ids), Message.created_at >= start_dt, Message.created_at < end_dt)
    ):
        day = _to_ist_date(at)
        source_day[str(mid)] = ("message", day)
        if urgent and kind == "voice_note" and (on_date - day).days <= 1:
            urgent_comm[sid] = True

    for ch_id, sid, channel, at in db.execute(
        select(Checkin.checkin_id, Checkin.senior_id, Checkin.channel, Checkin.at).where(
            Checkin.senior_id.in_(senior_ids), Checkin.at >= start_dt, Checkin.at < end_dt
        )
    ):
        day = _to_ist_date(at)
        source_day[str(ch_id)] = ("checkin", day)
        if channel == "missed_call" and (on_date - day).days <= 2:
            missed_checkins[sid] = missed_checkins.get(sid, 0) + 1

    cues_by_senior: Dict[str, List[Tuple[str, Optional[str], Optional[float]]]] = {
        sid: [] for sid in senior_ids
    }
    if source_day:
        for cue in db.scalars(
            select(NlpCue).where(
                NlpCue.senior_id.in_(senior_ids),
                NlpCue.cue_value == "present",
                NlpCue.negated.is_(False),
                NlpCue.uncertain.is_(False),
            )
        ):
            hit = source_day.get(cue.source_id)
            if hit is None or cue.temporal_context == "historical":
                continue
            if (on_date - hit[1]).days <= 6:
                conf_val = float(cue.confidence) if cue.confidence is not None else None
                cues_by_senior.setdefault(cue.senior_id, []).append(
                    (cue.cue_type.lower(), cue.severity, conf_val)
                )

    # 6. Accelerometer Fall Windows (last 2 days)
    fall_sensors: Dict[str, bool] = {sid: False for sid in senior_ids}
    for sid, at in db.execute(
        select(AccelerometerWindow.senior_id, AccelerometerWindow.window_start).where(
            AccelerometerWindow.senior_id.in_(senior_ids),
            AccelerometerWindow.label == "fall",
            AccelerometerWindow.window_start >= _day_start_ist(on_date - timedelta(days=1)),
            AccelerometerWindow.window_start < end_dt,
        )
    ):
        fall_sensors[sid] = True

    # 7. Open SeniorMemoryItems (talking points & unresolved operational/clinical issues)
    memory_items: Dict[str, List[SeniorMemoryItem]] = {sid: [] for sid in senior_ids}
    for item in db.scalars(
        select(SeniorMemoryItem).where(
            SeniorMemoryItem.senior_id.in_(senior_ids),
            SeniorMemoryItem.status == "open",
            SeniorMemoryItem.first_seen_at < end_dt,
        )
    ):
        memory_items.setdefault(item.senior_id, []).append(item)

    inputs_by_senior: Dict[str, Dict[str, Any]] = {}
    baseline_conf_by_senior: Dict[str, str] = {}

    for sid in senior_ids:
        b = baselines.get(sid)
        baseline_conf_by_senior[sid] = (b.vitals_baseline_confidence or "NONE") if b else "NONE"
        fc = forecasts_by_senior.get(sid, {})
        rec_v = recent_vitals.get(sid, {})
        extra_flags: List[str] = []

        if b is None:
            extra_flags.append("No personal baseline yet; vital signs are only checked against fixed limits.")
        elif any(
            (getattr(b, f"{p}_n", None) or 0) < 5
            for p in ("sbp", "dbp", "hr", "spo2")
            if getattr(b, f"{p}_median", None) is not None
        ):
            extra_flags.append("Personal baseline for some vital signs is based on very few readings.")

        sbp_fc = _effective_vital(
            fc.get("bp_systolic_forecast"),
            rec_v.get("blood_pressure_systolic", []),
            b.sbp_median if b else None,
            "sbp",
        )
        spo2_fc = _effective_vital(
            fc.get("spo2_forecast"),
            rec_v.get("spo2", []),
            b.spo2_median if b else None,
            "spo2",
        )
        pulse_fc = _effective_vital(
            fc.get("pulse_forecast"),
            rec_v.get("heart_rate", []),
            b.hr_median if b else None,
            "hr",
        )
        gluc_fc = _effective_vital(
            fc.get("blood_glucose_forecast"),
            rec_v.get("blood_glucose", []),
            b.glucose_fasting_median if b else None,
            "gluc",
        )

        # Daily step ratio & sleep check
        act_rows = [a for a in activities.get(sid, []) if a.data_available]
        steps_vals = [float(a.steps) for a in act_rows if a.steps is not None]
        if not steps_vals:
            extra_flags.append("No step data in the last 3 days (device may be uncharged or not worn).")
        step_ratio: Optional[float] = None
        if steps_vals and b and b.steps_median and b.steps_median >= 500:
            step_ratio = mean(steps_vals) / float(b.steps_median)

        sleep_vals = [float(a.sleep_hours) for a in act_rows if a.sleep_hours is not None]
        sleep_drop = False
        if sleep_vals:
            avg_sleep = mean(sleep_vals)
            if avg_sleep < 4.5 or (b and b.sleep_hours_median is not None and avg_sleep <= b.sleep_hours_median - 2.0):
                sleep_drop = True

        if unverified_crit_count.get(sid, 0) > 0:
            extra_flags.append(
                f"{unverified_crit_count[sid]} important medicine dose(s) unconfirmed in the last 3 days."
            )
        if missed_checkins.get(sid, 0) >= 2:
            extra_flags.append(f"{missed_checkins[sid]} check-in calls went unanswered in the last 3 days.")

        # Map NLP cues
        cue_set = {c[0] for c in cues_by_senior.get(sid, [])}
        cue_fall = bool(fall_sensors.get(sid, False) or (cue_set & {"fall", "fall_incident"}))
        cue_pain = bool(cue_set & {"pain", "acute_pain", "chest_pain", "fever", "swelling", "urinary"})
        cue_dizzy = bool(cue_set & {"dizziness", "dizziness_vertigo"})
        cue_breathless = bool(cue_set & {"breathlessness", "dyspnea"})
        cue_weakness = bool(cue_set & {"weakness", "severe_weakness", "low_appetite", "appetite_loss"})
        cue_conf = bool(cue_set & {"confusion", "cognitive_confusion"})
        cue_anxiety = bool(
            (cue_set & {"anxiety", "severe_anxiety_panic", "low_mood"}) or urgent_comm.get(sid, False)
        )
        cue_lonely = bool(cue_set & {"loneliness", "loneliness_isolation"})
        cue_sleep = bool(sleep_drop or (cue_set & {"poor_sleep", "sleep_fragmentation"}))

        med_crit_flag = bool(crit_med_missed.get(sid, False) or (cue_set & {"medication_issue", "medication_omission"}))
        med_refill = bool(cue_set & {"medication_refill_needed", "med_refill"})
        needs_escort = bool(cue_set & {"assistance_escort_needed", "transport_escort"})
        needs_essentials = bool(cue_set & {"assistance_essentials_needed", "daily_essentials"})
        tech_confusion = bool(cue_set & {"tech_app_friction", "tech_app_confusion"})
        pacing_fast = bool(cue_set & {"coordinator_pacing_fast", "service_friction_pacing"})

        rec_confirmed = sum(1 for c, _, _ in cues_by_senior.get(sid, []) if c in ("recovery_confirmed",))
        well_streak = sum(1 for c, _, _ in cues_by_senior.get(sid, []) if c in ("routine_wellbeing",))

        # Inspect open SeniorMemoryItem records (talking points)
        max_aging_hours = 0
        end_ref = _day_start_ist(on_date + timedelta(days=1))
        for m in memory_items.get(sid, []):
            txt = (m.content or "").lower()
            if m.kind == "medication_issue" or "refill" in txt or "khatam" in txt:
                med_refill = True
            if "escort" in txt or "station" in txt or "hospital" in txt or "transport" in txt:
                needs_escort = True
            if "grocery" in txt or "essential" in txt or "ration" in txt or "milk" in txt:
                needs_essentials = True
            if "app" in txt or "button" in txt:
                tech_confusion = True
            if m.first_seen_at:
                seen_dt = m.first_seen_at if m.first_seen_at.tzinfo else m.first_seen_at.replace(tzinfo=IST)
                hrs = int(max(0.0, (end_ref - seen_dt).total_seconds() / 3600.0))
                if hrs > max_aging_hours:
                    max_aging_hours = hrs

        inputs_by_senior[sid] = {
            "senior_id": sid,
            "date": on_date.isoformat(),
            "bp_systolic_forecast": sbp_fc,
            "spo2_forecast": spo2_fc,
            "pulse_forecast": pulse_fc,
            "blood_glucose_forecast": gluc_fc,
            "r_vitals_score": fc.get("r_vitals_score", 0.0),
            "bp_systolic_slope_3d": fc.get("bp_systolic_slope_3d", 0.0) or 0.0,
            "spo2_slope_3d": fc.get("spo2_slope_3d", 0.0) or 0.0,
            "weight_slope_7d": fc.get("weight_slope_7d", 0.0) or 0.0,
            "cue_fall_incident": cue_fall,
            "cue_acute_pain": cue_pain,
            "cue_dizziness_vertigo": cue_dizzy,
            "cue_breathlessness": cue_breathless,
            "cue_severe_weakness": cue_weakness,
            "daily_step_count_ratio": step_ratio,
            "cue_cognitive_confusion": cue_conf,
            "cue_severe_anxiety_panic": cue_anxiety,
            "cue_loneliness_isolation": cue_lonely,
            "cue_sleep_fragmentation": cue_sleep,
            "nlp_risk_delta": nlp_deltas.get(sid, 0.0),
            "med_consecutive_missed_doses": missed_meds_count.get(sid, 0),
            "med_critical_omission_flag": med_crit_flag,
            "med_refill_depleted": med_refill,
            "needs_transport_escort": needs_escort,
            "needs_daily_essentials": needs_essentials,
            "tech_app_confusion": tech_confusion,
            "service_friction_pacing": pacing_fast,
            "assistance_unresolved_aging_hours": max_aging_hours,
            "cue_recovery_confirmed": rec_confirmed,
            "cue_routine_wellbeing_streak": well_streak,
            "extra_data_quality_flags": extra_flags,
        }

    return inputs_by_senior, baseline_conf_by_senior


def _upsert_daily_risk_score_row(
    db: Session,
    result: RiskCalculationResult,
    on_date: date,
    baseline_confidence: str = "NONE",
):
    """Persist a `RiskCalculationResult` into `daily_risk_scores` (`DailyRiskScore`)."""
    from app.modules.risk import repository as risk_repo

    existing = risk_repo.get_score(db, result.senior_id, on_date)
    fields = {
        "risk_score": result.final_risk_score,
        "risk_level": result.risk_level,
        "confidence_level": result.confidence_level,
        "baseline_confidence": baseline_confidence,
        "top_factors": result.to_db_top_factors(),
        "recommended_action": result.recommended_clinical_action,
        "data_quality_flags": result.data_quality_flags,
        "scoring_version": f"multimodal-{MultimodalRiskCalculator.VERSION}",
    }
    return risk_repo.upsert_score(db, existing, result.senior_id, on_date, fields)


def calculate_senior_risk(
    db: Session,
    senior_id: str,
    on_date: Optional[date] = None,
    commit: bool = True,
) -> RiskCalculationResult:
    """
    Run the full risk calculation pipeline for 1 individual alone:
    1. Calls `forecast_senior(db, senior_id, target_date)` first (writes to `vital_forecasts`).
    2. Gathers all multimodal signals for `senior_id` from the DB.
    3. Runs `MultimodalRiskCalculator.calculate(input_data)`.
    4. Writes the resulting score to `daily_risk_scores` in the DB.
    """
    from ml.models.vitals.forecast_db import forecast_senior

    target_date = on_date or date.today()
    fc_res = forecast_senior(db=db, senior_id=senior_id, on_date=target_date, commit=False)
    inputs_map, base_conf_map = build_multimodal_inputs_from_db(
        db=db,
        senior_ids=[senior_id],
        on_date=target_date,
        forecasts_by_senior={senior_id: fc_res},
    )
    input_data = inputs_map.get(senior_id, {"senior_id": senior_id, "date": target_date.isoformat()})
    result = MultimodalRiskCalculator.calculate(input_data)
    _upsert_daily_risk_score_row(
        db=db,
        result=result,
        on_date=target_date,
        baseline_confidence=base_conf_map.get(senior_id, "NONE"),
    )
    if commit:
        db.commit()
    else:
        db.flush()
    return result


def calculate_cohort_risk(
    db: Session,
    on_date: Optional[date] = None,
    senior_ids: Optional[List[str]] = None,
    commit: bool = True,
) -> Dict[str, Any]:
    """
    Run the full risk calculation pipeline for the entire cohort at a time:
    1. Calls `forecast_cohort(db, target_date, senior_ids)` first (writes all rows to `vital_forecasts`).
    2. Batch-gathers all multimodal signals for the cohort from the DB.
    3. Runs `MultimodalRiskCalculator.calculate` across every senior in the cohort.
    4. Writes all resulting scores to `daily_risk_scores` in the DB.
    """
    from app.modules.risk import repository as risk_repo
    from ml.models.vitals.forecast_db import forecast_cohort

    target_date = on_date or date.today()
    target_ids = list(senior_ids) if senior_ids is not None else risk_repo.scorable_senior_ids(db, target_date)
    if not target_ids:
        return {
            "date": target_date.isoformat(),
            "seniors_scored": 0,
            "levels": {},
            "results": {},
        }

    cohort_fc = forecast_cohort(db=db, on_date=target_date, senior_ids=target_ids, commit=False)
    forecasts_by_senior = cohort_fc.get("results", {})

    inputs_map, base_conf_map = build_multimodal_inputs_from_db(
        db=db,
        senior_ids=target_ids,
        on_date=target_date,
        forecasts_by_senior=forecasts_by_senior,
    )

    results_by_senior: Dict[str, RiskCalculationResult] = {}
    levels_count: Dict[str, int] = {}

    for sid in target_ids:
        input_data = inputs_map.get(sid, {"senior_id": sid, "date": target_date.isoformat()})
        res = MultimodalRiskCalculator.calculate(input_data)
        _upsert_daily_risk_score_row(
            db=db,
            result=res,
            on_date=target_date,
            baseline_confidence=base_conf_map.get(sid, "NONE"),
        )
        results_by_senior[sid] = res
        levels_count[res.risk_level] = levels_count.get(res.risk_level, 0) + 1

    if commit:
        db.commit()
    else:
        db.flush()

    return {
        "date": target_date.isoformat(),
        "seniors_scored": len(results_by_senior),
        "levels": levels_count,
        "results": results_by_senior,
    }



if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    import sys

    _backend_root = Path(__file__).resolve().parents[3]
    if str(_backend_root) not in sys.path:
        sys.path.insert(0, str(_backend_root))

    parser = argparse.ArgumentParser(description="Run Multimodal Risk Calculation (1 individual or full cohort)")
    parser.add_argument("--senior-id", type=str, default=None, help="Senior ID to calculate risk for (omit for full cohort)")
    parser.add_argument("--cohort", action="store_true", help="Run for full cohort of active seniors")
    parser.add_argument("--date", type=str, default=None, help="Target date YYYY-MM-DD (default: demo today / today)")
    args = parser.parse_args()

    from app.core.config import today as get_today
    from app.core.database import SessionLocal

    target_date = date.fromisoformat(args.date) if args.date else get_today()
    with SessionLocal() as db:
        if args.senior_id and not args.cohort:
            res = calculate_senior_risk(db, args.senior_id, target_date, commit=True)
            print(json.dumps(res.to_dict(), indent=2))
        else:
            summary = calculate_cohort_risk(db, target_date, commit=True)
            out = {
                "date": summary["date"],
                "seniors_scored": summary["seniors_scored"],
                "levels": summary["levels"],
            }
            print(json.dumps(out, indent=2))
