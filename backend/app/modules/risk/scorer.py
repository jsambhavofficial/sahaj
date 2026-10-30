"""Risk scoring interface plus the interim rule-based scorer.

`RiskScorer` is the contract a real model must meet; `HeuristicScorer` is a clearly labelled
stand-in (scoring_version "heuristic-0") so the coordinator app and demo work now. It is a
transparent points system, NOT a medical tool: evidence strings describe what the data shows,
never a diagnosis, and suggested actions never change anyone's medicines.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import mean
from typing import Protocol

from sqlalchemy.orm import Session

from app.modules.risk import repository as repo
from app.modules.risk.repository import SeniorData

SCORING_VERSION = "heuristic-0"
LEVELS = ("LOW", "MODERATE", "HIGH", "URGENT_REVIEW")
LEVEL_RANK = {lvl: i for i, lvl in enumerate(LEVELS)}
NO_CONCERN_ACTION = "Nothing unusual in the recent data; keep to the usual check-in routine."


def level_for(score: int) -> str:
    if score >= 75:
        return "URGENT_REVIEW"
    if score >= 50:
        return "HIGH"
    if score >= 25:
        return "MODERATE"
    return "LOW"


@dataclass
class ScoreResult:
    risk_score: int
    risk_level: str
    confidence_level: str
    baseline_confidence: str
    top_factors: list[dict]
    recommended_action: str
    data_quality_flags: list[str] = field(default_factory=list)
    scoring_version: str = SCORING_VERSION

    @property
    def has_tripwire(self) -> bool:
        return any(f.get("is_safety_tripwire") for f in self.top_factors)

    def as_row(self) -> dict:
        """Column values for daily_risk_scores."""
        return {"risk_score": self.risk_score, "risk_level": self.risk_level,
                "confidence_level": self.confidence_level,
                "baseline_confidence": self.baseline_confidence, "top_factors": self.top_factors,
                "recommended_action": self.recommended_action,
                "data_quality_flags": self.data_quality_flags,
                "scoring_version": self.scoring_version}


class RiskScorer(Protocol):
    def score(self, db: Session, senior_id: str, on_date: date) -> ScoreResult: ...


@dataclass
class _Factor:
    rule_id: str
    category: str
    evidence: str
    window: str
    points: float
    action: str
    tripwire: bool = False

    def as_dict(self) -> dict:
        return {"rule_id": self.rule_id, "category": self.category, "evidence": self.evidence,
                "window": self.window, "points_contributed": round(self.points, 1),
                "is_safety_tripwire": self.tripwire}


# Category saturation caps stop many weak signals from adding up to an emergency.
CATEGORY_CAPS = {"acute_safety": 85.0, "medication": 36.0, "baseline_deviation": 45.0,
                 "nlp_cues": 35.0, "communication": 45.0, "cross_modal": 20.0}

# (measurement_type, baseline column prefix, plain label, unit, minimum change that matters, direction)
VITAL_RULES = [
    ("blood_pressure_systolic", "sbp", "Top blood pressure number", "", 15.0, "both"),
    ("blood_pressure_diastolic", "dbp", "Bottom blood pressure number", "", 10.0, "both"),
    ("heart_rate", "hr", "Heart rate", " bpm", 15.0, "both"),
    ("spo2", "spo2", "Oxygen level", "%", 3.0, "down"),
    ("weight", "weight_kg", "Weight", " kg", 2.0, "both"),
    ("temperature", "temp_f", "Temperature", " F", 1.5, "up"),
]
MIN_BASELINE_N = 5
IQR_K = 2.5

CUE_WEIGHTS = {"pain": 12, "low_mood": 12, "loneliness": 8, "weakness": 14, "poor_sleep": 8,
               "low_appetite": 10, "dizziness": 16, "breathlessness": 18, "confusion": 20,
               "medication_issue": 8, "swelling": 8, "fever": 10, "urinary": 8}
CUE_LABELS = {"pain": "pain", "low_mood": "feeling low", "loneliness": "feeling lonely",
              "weakness": "weakness", "poor_sleep": "poor sleep", "low_appetite": "low appetite",
              "dizziness": "dizziness", "breathlessness": "breathlessness", "confusion": "confusion",
              "medication_issue": "trouble with medicines", "swelling": "swelling", "fever": "fever",
              "urinary": "urinary discomfort"}
SOURCE_LABELS = {"call": "a call", "message": "a voice note", "checkin": "a check-in"}
MISSED_CALL_STATUSES = ("no_answer", "busy", "declined")


def _days_ago(d: date, on_date: date) -> int:
    return (on_date - d).days


def _fmt_day(d: date) -> str:
    return f"{d.day} {d.strftime('%b')}"


def _num(v: float) -> str:
    return f"{v:.0f}" if abs(v - round(v)) < 0.05 else f"{v:.1f}"


class HeuristicScorer:
    """Interim rule-based scorer (scoring_version "heuristic-0"). Replace via settings.risk_scorer."""

    version = SCORING_VERSION

    def score(self, db: Session, senior_id: str, on_date: date) -> ScoreResult:
        return self.score_many(db, [senior_id], on_date)[senior_id]

    def score_many(self, db: Session, senior_ids: list[str], on_date: date) -> dict[str, ScoreResult]:
        data = repo.load_senior_data(db, senior_ids, on_date)
        return {sid: self.evaluate(d) for sid, d in data.items()}

    # ------------------------------------------------------------------ rules

    def evaluate(self, d: SeniorData) -> ScoreResult:
        factors: list[_Factor] = []
        flags: list[str] = []
        for rule in (self._falls, self._severe_vitals, self._urgency, self._missed_checkins,
                     self._medication, self._vitals_vs_baseline, self._activity, self._cues):
            factors.extend(rule(d, flags))
        factors.extend(self._cross_modal(factors))

        tripwires = [f for f in factors if f.tripwire]
        per_cat: dict[str, float] = {}
        for f in factors:
            per_cat[f.category] = per_cat.get(f.category, 0.0) + f.points
        total = sum(min(p, CATEGORY_CAPS.get(c, 30.0)) for c, p in per_cat.items())
        if tripwires:
            score = int(min(100, max(75, round(max(max(f.points for f in tripwires), total)))))
        else:
            score = int(min(100, round(total)))

        ordered = sorted(factors, key=lambda f: (not f.tripwire, -f.points))
        action = ordered[0].action if ordered else NO_CONCERN_ACTION
        return ScoreResult(
            risk_score=score, risk_level=level_for(score),
            confidence_level=self._confidence(d, bool(tripwires), flags),
            baseline_confidence=(d.baseline.vitals_baseline_confidence or "NONE") if d.baseline else "NONE",
            top_factors=[f.as_dict() for f in ordered[:5]], recommended_action=action,
            data_quality_flags=flags)

    def _confidence(self, d: SeniorData, tripwire: bool, flags: list[str]) -> str:
        if tripwire:
            return "HIGH"
        recent_activity = [a for a in d.activity if a.data_available and a.steps is not None
                           and _days_ago(a.date, d.on_date) < 3]
        recent_vitals = [v for v in d.vitals if _days_ago(v.day, d.on_date) < 3]
        have = int(bool(recent_activity)) + int(bool(recent_vitals)) + int(bool(d.calls or d.cues))
        if have == 0:
            return "LOW"
        return "HIGH" if have >= 2 and d.baseline is not None else "MEDIUM"

    def _falls(self, d: SeniorData, flags):
        out = []
        days = sorted(x for x in d.fall_days if _days_ago(x, d.on_date) <= 1)
        if days:
            out.append(_Factor(
                "RULE_FALL_SENSOR", "acute_safety",
                f"The motion sensor detected a possible fall on {_fmt_day(days[-1])}.",
                "Past 2 days", 80, "Call now to check they are safe and not hurt; arrange a visit "
                "or send help if there is no answer.", True))
        reported = sorted({c.day for c in d.cues if c.cue_type == "fall" and _days_ago(c.day, d.on_date) <= 2})
        if reported:
            out.append(_Factor(
                "RULE_FALL_REPORTED", "acute_safety",
                f"A fall or slip was mentioned in a recent conversation ({_fmt_day(reported[-1])}).",
                "Past 3 days", 80, "Call now to check they are safe and not hurt; arrange a visit "
                "if they are in pain or unsteady.", True))
        return out

    def _severe_vitals(self, d: SeniorData, flags):
        recent = [v for v in d.vitals if _days_ago(v.day, d.on_date) <= 1]

        def worst(t, fn):
            vals = [v.value for v in recent if v.type == t]
            return fn(vals) if vals else None

        out = []
        sbp_hi, sbp_lo = worst("blood_pressure_systolic", max), worst("blood_pressure_systolic", min)
        spo2, glu_lo, glu_hi = worst("spo2", min), worst("blood_glucose", min), worst("blood_glucose", max)
        hr_hi, hr_lo = worst("heart_rate", max), worst("heart_rate", min)
        w = "Past 2 days"
        retest = ("Call now, ask them to sit and rest, and re-check the reading; contact their "
                  "doctor or arrange a visit if it stays the same.")
        if sbp_hi is not None and sbp_hi >= 180:
            out.append(_Factor("RULE_SEVERE_BP_HIGH", "acute_safety",
                               f"A very high top blood pressure number was recorded ({_num(sbp_hi)}).",
                               w, 75, retest, True))
        elif sbp_hi is not None and sbp_hi >= 170:
            out.append(_Factor("RULE_BP_HIGH", "acute_safety",
                               f"A high top blood pressure number was recorded ({_num(sbp_hi)}).",
                               w, 55, retest))
        if sbp_lo is not None and sbp_lo <= 85:
            out.append(_Factor("RULE_SEVERE_BP_LOW", "acute_safety",
                               f"A very low top blood pressure number was recorded ({_num(sbp_lo)}).",
                               w, 75, retest, True))
        elif sbp_lo is not None and sbp_lo <= 95:
            out.append(_Factor("RULE_BP_LOW", "acute_safety",
                               f"A low top blood pressure number was recorded ({_num(sbp_lo)}).",
                               w, 45, retest))
        if spo2 is not None and spo2 <= 90:
            out.append(_Factor("RULE_SEVERE_SPO2", "acute_safety",
                               f"A very low oxygen level was recorded ({_num(spo2)}%).", w, 75,
                               retest, True))
        elif spo2 is not None and spo2 <= 92:
            out.append(_Factor("RULE_LOW_SPO2", "acute_safety",
                               f"A low oxygen level was recorded ({_num(spo2)}%).", w, 55, retest))
        if glu_lo is not None and glu_lo <= 54:
            out.append(_Factor("RULE_SEVERE_GLUCOSE_LOW", "acute_safety",
                               f"A very low blood sugar reading was recorded ({_num(glu_lo)}).", w, 75,
                               retest, True))
        if glu_hi is not None and glu_hi >= 300:
            out.append(_Factor("RULE_SEVERE_GLUCOSE_HIGH", "acute_safety",
                               f"A very high blood sugar reading was recorded ({_num(glu_hi)}).", w, 70,
                               retest, True))
        if hr_hi is not None and hr_hi >= 130 or hr_lo is not None and hr_lo <= 40:
            val = hr_hi if hr_hi is not None and hr_hi >= 130 else hr_lo
            out.append(_Factor("RULE_SEVERE_HEART_RATE", "acute_safety",
                               f"An unusual heart rate was recorded ({_num(val)} bpm).", w, 70,
                               retest, True))
        return out

    def _urgency(self, d: SeniorData, flags):
        days = sorted([c.day for c in d.calls if c.urgency and _days_ago(c.day, d.on_date) <= 1]
                      + [x for x in d.urgent_message_days if _days_ago(x, d.on_date) <= 1])
        if not days:
            return []
        return [_Factor("RULE_URGENCY_FLAG", "communication",
                        f"A recent call or voice note ({_fmt_day(days[-1])}) was marked urgent.",
                        "Past 2 days", 45, "Call today and ask about what they reported; arrange a "
                        "visit if you cannot reach them.")]

    def _missed_checkins(self, d: SeniorData, flags):
        missed = [c.day for c in d.calls if c.status in MISSED_CALL_STATUSES
                  and _days_ago(c.day, d.on_date) <= 2]
        missed += [x for x in d.missed_checkin_days if _days_ago(x, d.on_date) <= 2]
        if len(missed) < 2:
            return []
        flags.append(f"{len(missed)} check-in calls went unanswered in the last 3 days.")
        return [_Factor("RULE_MISSED_CHECKINS", "communication",
                        f"{len(missed)} check-in calls went unanswered in the last 3 days.",
                        "Past 3 days", 12, "Try calling again today; ask family or a neighbour to "
                        "check in if there is still no answer.")]

    def _medication(self, d: SeniorData, flags):
        recent = [x for x in d.doses if _days_ago(x.day, d.on_date) <= 2]
        out = []
        crit_missed = sum(1 for x in recent if x.status == "missed" and x.criticality == "high")
        other_missed = sum(1 for x in recent if x.status == "missed" and x.criticality != "high")
        crit_unknown = sum(1 for x in recent if x.status == "unknown" and x.criticality == "high")
        action = ("Call to check how they are managing their medicines; if unsure about a missed "
                  "dose, ask their doctor's team.")
        if crit_missed:
            out.append(_Factor("RULE_MISSED_CRITICAL_MEDS", "medication",
                               (f"{crit_missed} doses of important medicines were" if crit_missed != 1
                                else "1 dose of an important medicine was")
                               + " recorded as missed in the last 3 days.",
                               "Past 3 days", min(30.0, 12.0 * crit_missed), action))
        elif other_missed >= 3:
            out.append(_Factor("RULE_MISSED_MEDS", "medication",
                               f"{other_missed} medicine doses were recorded as missed in the last "
                               "3 days.", "Past 3 days", 10, action))
        if crit_unknown:
            out.append(_Factor("RULE_UNVERIFIED_CRITICAL_MEDS", "medication",
                               (f"{crit_unknown} doses of important medicines could" if crit_unknown != 1
                                else "1 dose of an important medicine could")
                               + " not be confirmed in the last 3 days.",
                               "Past 3 days", min(12.0, 4.0 * crit_unknown), action))
            flags.append(f"{crit_unknown} important medicine dose(s) unconfirmed in the last 3 days.")
        return out

    def _vitals_vs_baseline(self, d: SeniorData, flags):
        b = d.baseline
        if b is None:
            flags.append("No personal baseline yet; vital signs are only checked against fixed limits.")
            return []
        out = []
        weak = False
        for vtype, prefix, label, unit, min_change, direction in VITAL_RULES:
            median = getattr(b, f"{prefix}_median", None)
            n = getattr(b, f"{prefix}_n", None) or 0
            window = 6 if vtype == "weight" else 2
            readings = [v.value for v in d.vitals if v.type == vtype and _days_ago(v.day, d.on_date) <= window]
            if not readings or median is None:
                continue
            if n < MIN_BASELINE_N:
                weak = True
                continue
            iqr = getattr(b, f"{prefix}_iqr", None) or 0.0
            spread = max(iqr, 0.03 * abs(median))
            threshold = max(IQR_K * spread, min_change)
            avg = mean(readings)
            delta = avg - median
            if direction == "up" and delta <= 0 or direction == "down" and delta >= 0:
                continue
            if abs(delta) < threshold:
                continue
            sign = 1 if delta > 0 else -1
            beyond = sum(1 for r in readings if (r - median) * sign >= threshold)
            points = 16.0 if beyond >= 2 else 10.0
            word = "above" if delta > 0 else "below"
            span = "the last 7 days" if vtype == "weight" else "the last 3 days"
            out.append(_Factor(
                f"RULE_{prefix.upper()}_OFF_BASELINE", "baseline_deviation",
                f"{label} averaged {_num(avg)}{unit} over {span}, {_num(abs(delta))}{unit} "
                f"{word} their usual {_num(median)}{unit}.", "Past 3 days" if window == 2 else "Past 7 days",
                points, "Call and ask how they are feeling; ask them to re-check the reading and "
                "arrange a visit or doctor contact if it stays off."))
        if weak:
            flags.append("Personal baseline for some vital signs is based on very few readings.")
        if not any(v for v in d.vitals if _days_ago(v.day, d.on_date) <= 2):
            flags.append("No valid vital sign readings in the last 3 days.")
        return out

    def _activity(self, d: SeniorData, flags):
        rows = [a for a in d.activity if _days_ago(a.date, d.on_date) <= 2 and a.data_available]
        out = []
        b = d.baseline
        steps = [a.steps for a in rows if a.steps is not None]
        if not steps:
            flags.append("No step data in the last 3 days (device may be uncharged or not worn).")
        if b is None:
            return out
        if len(steps) >= 2 and b.steps_median and b.steps_median >= 500:
            ratio = mean(steps) / b.steps_median
            if ratio < 0.6:
                pct = int(round(ratio * 100))
                out.append(_Factor(
                    "RULE_STEPS_DROP", "baseline_deviation",
                    f"Daily steps averaged {pct}% of their usual level over the last {len(steps)} days.",
                    "Past 3 days", 30.0 if ratio < 0.4 else 24.0,
                    "Call and ask how they are moving around; consider a visit if they seem unsteady."))
        sleep = [a.sleep_hours for a in rows if a.sleep_hours is not None]
        if len(sleep) >= 2 and b.sleep_hours_median is not None:
            avg = mean(sleep)
            if avg <= b.sleep_hours_median - 2.0 or avg < 4.5:
                out.append(_Factor(
                    "RULE_SLEEP_DROP", "baseline_deviation",
                    f"Sleep averaged {avg:.1f} hours a night over the last {len(sleep)} days, "
                    f"compared with their usual {b.sleep_hours_median:.1f} hours.", "Past 3 days", 14,
                    "Ask how they have been sleeping and whether anything is worrying them."))
        for col, base, rule, label in (("appetite_level", b.appetite_self_report, "RULE_APPETITE_DROP",
                                        "Appetite"),
                                       ("mood_level", b.mood_self_report, "RULE_MOOD_DROP", "Mood")):
            vals = [getattr(a, col) for a in rows if getattr(a, col) is not None]
            if len(vals) >= 2 and base is not None and mean(vals) <= base - 1.0:
                out.append(_Factor(
                    rule, "baseline_deviation",
                    f"{label} scores averaged {mean(vals):.1f} over the last {len(vals)} days, "
                    f"lower than their usual {base:.1f}.", "Past 3 days", 10,
                    "Call for a friendly chat and ask how they have been eating and feeling."
                    if col == "appetite_level" else
                    "Call for a friendly chat and ask how they have been feeling; offer company or a visit."))
        return out

    def _cues(self, d: SeniorData, flags):
        by_type: dict[str, list] = {}
        for c in d.cues:
            if c.cue_type in CUE_WEIGHTS and _days_ago(c.day, d.on_date) <= 6:
                by_type.setdefault(c.cue_type, []).append(c)
        out = []
        for ctype, hits in by_type.items():
            latest = max(h.day for h in hits)
            sources = {h.source_id for h in hits}
            recent = _days_ago(latest, d.on_date) <= 2
            points = CUE_WEIGHTS[ctype] * (1.0 if recent else 0.6) + (4 if len(sources) >= 2 else 0)
            hit = max(hits, key=lambda h: h.day)
            label = CUE_LABELS[ctype]
            ev = (f"Spoke of {label} in {SOURCE_LABELS[hit.source_type]} on {_fmt_day(latest)}"
                  + (f" and in {len(sources) - 1} other conversation{'s' if len(sources) > 2 else ''}"
                     if len(sources) >= 2 else "") + ".")
            out.append(_Factor(f"RULE_CUE_{ctype.upper()}", "nlp_cues", ev,
                               "Past 3 days" if recent else "Past 7 days", points,
                               f"Call today and ask gently about {label}; consider a visit or their "
                               "doctor if it continues."))
        return out

    def _cross_modal(self, factors: list[_Factor]):
        ids = {f.rule_id for f in factors}
        if "RULE_STEPS_DROP" in ids and ids & {"RULE_CUE_WEAKNESS", "RULE_CUE_DIZZINESS"}:
            return [_Factor("RULE_CORROBORATED_DECLINE", "cross_modal",
                            "Lower activity from the step sensor matches what they said about "
                            "weakness or dizziness.", "Past 3 days", 15,
                            "Call promptly: both the sensor and their own words point the same way; "
                            "arrange a visit.")]
        return []



class MultimodalScorer:
    """
    Production Multimodal Risk Scorer (`scoring_version = "multimodal-3.0.0"`).
    1. Calls the Vitals Forecast Model first (`forecast_senior` for 1 individual, `forecast_cohort` for cohort)
       and writes forecasted vitals & slopes to `vital_forecasts`.
    2. Gathers all DB signals (vitals forecasts, slopes, NLP cues, voice notes, check-in calls,
       medication adherence, daily activity, accelerometer falls, and open talking points/issues).
    3. Runs `MultimodalRiskCalculator.calculate` and returns `ScoreResult` for `daily_risk_scores`.
    """

    version = "multimodal-3.0.0"

    def score(self, db: Session, senior_id: str, on_date: date) -> ScoreResult:
        from ml.models.vitals.forecast_db import forecast_senior
        from ml.src.risk_engine.risk_score_calculation import (
            MultimodalRiskCalculator,
            build_multimodal_inputs_from_db,
        )

        fc_res = forecast_senior(db=db, senior_id=senior_id, on_date=on_date, commit=False)
        inputs_map, base_conf_map = build_multimodal_inputs_from_db(
            db=db,
            senior_ids=[senior_id],
            on_date=on_date,
            forecasts_by_senior={senior_id: fc_res},
        )
        input_data = inputs_map.get(senior_id, {"senior_id": senior_id, "date": on_date.isoformat()})
        res = MultimodalRiskCalculator.calculate(input_data)
        return ScoreResult(
            risk_score=res.final_risk_score,
            risk_level=res.risk_level,
            confidence_level=res.confidence_level,
            baseline_confidence=base_conf_map.get(senior_id, "NONE"),
            top_factors=res.to_db_top_factors(),
            recommended_action=res.recommended_clinical_action,
            data_quality_flags=res.data_quality_flags,
            scoring_version=self.version,
        )

    def score_many(self, db: Session, senior_ids: list[str], on_date: date) -> dict[str, ScoreResult]:
        if not senior_ids:
            return {}
        from ml.models.vitals.forecast_db import forecast_cohort
        from ml.src.risk_engine.risk_score_calculation import (
            MultimodalRiskCalculator,
            build_multimodal_inputs_from_db,
        )

        cohort_fc = forecast_cohort(db=db, on_date=on_date, senior_ids=senior_ids, commit=False)
        forecasts_by_senior = cohort_fc.get("results", {})
        inputs_map, base_conf_map = build_multimodal_inputs_from_db(
            db=db,
            senior_ids=senior_ids,
            on_date=on_date,
            forecasts_by_senior=forecasts_by_senior,
        )
        out: dict[str, ScoreResult] = {}
        for sid in senior_ids:
            input_data = inputs_map.get(sid, {"senior_id": sid, "date": on_date.isoformat()})
            res = MultimodalRiskCalculator.calculate(input_data)
            out[sid] = ScoreResult(
                risk_score=res.risk_score if hasattr(res, "risk_score") else res.final_risk_score,
                risk_level=res.risk_level,
                confidence_level=res.confidence_level,
                baseline_confidence=base_conf_map.get(sid, "NONE"),
                top_factors=res.to_db_top_factors(),
                recommended_action=res.recommended_clinical_action,
                data_quality_flags=res.data_quality_flags,
                scoring_version=self.version,
            )
        return out
