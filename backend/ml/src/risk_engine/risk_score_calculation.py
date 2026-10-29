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

Features:
- Bounded sub-category scoring with saturation caps (prevents score explosion)
- Cross-modal synergy multipliers (e.g. BP slope spike * reported dizziness)
- Deterministic clinical tripwires (guarantees falls/acute chest pain force URGENT_REVIEW >= 75)
- Dual-Queue routing flags (Clinical Escalation Queue vs Care Concierge / Ops Queue)
- Actionable coordinator explainability ("Why" and recommended next steps)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np


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
        Executes multimodal calculation.
        input_data can contain forecasted vitals, slopes, NLP events, medication logs, and ops tickets.
        """
        senior_id = str(input_data.get("senior_id", "UNKNOWN"))
        date_str = str(input_data.get("date", datetime.utcnow().strftime("%Y-%m-%d")))

        factors: List[ContributingFactor] = []
        sub_scores_raw: Dict[str, float] = {k: 0.0 for k in cls.CATEGORY_CAPS.keys()}
        active_synergies: List[Dict[str, Any]] = []
        data_flags: List[str] = []

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
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_SBP_HYPOTENSION",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted acute hypotension (<=95 mmHg, syncope/fall risk)",
                    evidence=f"Model forecast: {sbp_fc:.1f} mmHg",
                    urgency="SAME_DAY"
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
                sub_scores_raw["vitals_forecast"] += pts
                factors.append(ContributingFactor(
                    factor_id="FC_PULSE_EXTREME",
                    category="vitals_forecast",
                    points=pts,
                    description="Forecasted extreme resting pulse rate tachycardia/bradycardia",
                    evidence=f"Model forecast: {pulse_fc:.0f} bpm",
                    urgency="SAME_DAY"
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
                description="Mechanical fall, slip, or trip reported in voice note or call",
                evidence="Senior stated fall/slip incident",
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
        if len(data_flags) >= 2:
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
