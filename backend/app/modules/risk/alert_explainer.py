"""Alert Explainer Service for SamarthCare AI.

Explains why seniors were flagged for high risk in understandable, compassionate language
and generates actionable coordinator recommendations (calling, visiting, medical checkups,
community clubs, and support services).

Gating rule:
- LLM is called ONLY for the top 5% highest risk seniors in the cohort (or seniors with acute high risk).
- For the top 5%, the 2-3 line primary driver summary and suggested action are written into `context_repo`.
- For the rest (95%), only the deterministic risk score breakdown is written.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time, timedelta, timezone
import json
import logging
import math
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.seniors.models import Senior, SeniorCondition, SeniorContact, SeniorHealthProfile
from app.modules.voice.models import ContextRepo

logger = logging.getLogger("risk_alert_explainer")
IST = ZoneInfo("Asia/Kolkata")


@dataclass
class UnderstandableAlert:
    senior_id: str
    date: str
    risk_score: int
    risk_level: str
    is_top_5_percent: bool
    score_breakdown: Dict[str, Any]
    primary_driver_summary: Optional[str] = None
    suggested_action: Optional[str] = None
    action_type: Optional[str] = None
    recommended_action: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


ALERT_EXPLAINER_SYSTEM_PROMPT = """You are a senior clinical care coordinator explaining risk alerts for older adults living at home in India.
Your goal is to make risk alerts clear, empathetic, transparent, and actionable for family members and field care coordinators.

You must output strictly valid JSON with the following three fields:
1. "primary_driver_summary": A concise 2 to 3 sentence plain-language explanation of what actually triggered them to be flagged for high risk today. Highlight the primary physiological or daily life driver (e.g. sharp blood pressure drop, confirmed fall, severe morning dizziness, skipped essential medications, or acute loneliness). Do NOT use obscure clinical jargon.
2. "suggested_action": A concrete, practical, personalized recommendation for the care coordinator. Must explicitly indicate the action mode:
   - "Call them..." (for mild vital follow-ups or medication checks)
   - "Visit them..." (for high risk, mobility assessment, or home safety)
   - "Visit them and get them for a medical checkup" (for acute incidents, falls, syncope, chest/breathing distress)
   - "Suggest them to join this [club/group]" (connecting their specific hobbies/interests like gardening, music, books, or walking to relieve social isolation)
   - Or operational assistance (e.g., pharmacy refill, hospital escort).
3. "action_type": One of:
   - "VISIT_MEDICAL_CHECKUP"
   - "VISIT_HOME_SAFETY"
   - "SUGGEST_COMMUNITY_CLUB"
   - "CALL_WELLBEING"
   - "MEDICATION_REFILL"
   - "TRANSPORT_ESCORT"
   - "CALL_COORDINATOR"
"""


def _val(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _compute_subscores_from_factors(factors: List[Dict[str, Any]]) -> Dict[str, float]:
    sub_scores: Dict[str, float] = {
        "vital_trajectories": 0.0,
        "vital_levels": 0.0,
        "physical_wellbeing": 0.0,
        "psychological_wellbeing": 0.0,
        "medicine_adherence": 0.0,
        "assistance_and_issues": 0.0,
    }
    for f in factors:
        cat = str(f.get("category", "")).lower()
        pts = float(f.get("points", f.get("points_contributed", 0.0)) or 0.0)
        if "slope" in cat or "momentum" in cat or "trajector" in cat:
            sub_scores["vital_trajectories"] += pts
        elif "vital" in cat or "level" in cat or "forecast" in cat:
            sub_scores["vital_levels"] += pts
        elif "phys" in cat:
            sub_scores["physical_wellbeing"] += pts
        elif "psych" in cat or "mood" in cat:
            sub_scores["psychological_wellbeing"] += pts
        elif "med" in cat:
            sub_scores["medicine_adherence"] += pts
        elif "assist" in cat or "issue" in cat or "ops" in cat:
            sub_scores["assistance_and_issues"] += pts
        else:
            sub_scores["physical_wellbeing"] += pts
    return {k: round(v, 1) for k, v in sub_scores.items()}


def _build_heuristic_explanation(
    senior: Senior,
    profile: Optional[SeniorHealthProfile],
    contact: Optional[SeniorContact],
    score: int,
    risk_level: str,
    factors: List[Dict[str, Any]],
    tripwire: bool,
) -> Dict[str, str]:
    """Offline heuristic generator matching clinical rationale when LLM is unavailable or offline."""
    name = contact.full_name if contact and contact.full_name else f"Senior {senior.senior_id}"
    hobbies = list(profile.hobbies or []) if profile else []
    top_desc = [f.get("description", "") for f in factors[:2] if f.get("description")]
    desc_text = " and ".join(top_desc) if top_desc else "recent telemetry fluctuations"

    factor_ids = {str(f.get("factor_id", f.get("rule_id", ""))) for f in factors}
    has_fall = any("FALL" in fid for fid in factor_ids)
    has_dizzy = any("DIZZ" in fid for fid in factor_ids)
    has_breathless = any("BREATH" in fid for fid in factor_ids)
    has_bp_crisis = any("SBP_CRITICAL" in fid or "SBP_ELEVATED" in fid or "HYPERTENSIVE" in fid for fid in factor_ids)
    has_lonely = any("LONELINESS" in fid or "ISOLATION" in fid for fid in factor_ids)
    has_med = any("MED_" in fid for fid in factor_ids)

    if tripwire or has_fall or (has_dizzy and has_bp_crisis):
        summary = (
            f"{name} was flagged for urgent review ({score}/100) due to {desc_text}. "
            f"The combination of physical instability and vital deviation indicates an immediate risk of injury or syncope."
        )
        action = (
            f"Visit them and get them for a medical checkup to assess physical mobility, "
            f"verify blood pressure stability, and inspect home fall hazards."
        )
        action_type = "VISIT_MEDICAL_CHECKUP"
    elif has_breathless or has_bp_crisis:
        summary = (
            f"{name} was flagged with elevated clinical risk ({score}/100) primarily driven by {desc_text}. "
            f"Cardiorespiratory indicators exceed personalized safety thresholds."
        )
        action = (
            f"Call them immediately to verify current vital signs and dispatch a coordinator or clinical nurse "
            f"to visit them and get them for a medical checkup if symptoms persist."
        )
        action_type = "VISIT_MEDICAL_CHECKUP"
    elif has_lonely:
        hobby_str = ", ".join(hobbies[:2]) if hobbies else "community gathering"
        summary = (
            f"{name} was flagged with high risk ({score}/100) due to severe reported social isolation, "
            f"low mood, and sleep fragmentation over recent check-in touchpoints."
        )
        if hobbies:
            action = (
                f"Visit them for a warm in-person check-in and suggest them to join a local community {hobby_str} club "
                f"to encourage social connection and relieve isolation."
            )
            action_type = "SUGGEST_COMMUNITY_CLUB"
        else:
            action = (
                f"Visit them to check on daily emotional wellbeing and suggest them to join a local senior club "
                f"or neighborhood walking group."
            )
            action_type = "SUGGEST_COMMUNITY_CLUB"
    elif has_med:
        summary = (
            f"{name} was flagged ({score}/100) due to missed scheduled medication doses and depleted prescription strips. "
            f"Regimen non-adherence presents a direct threat to chronic disease control."
        )
        action = (
            f"Call them immediately to verify missing prescription details and place a partner pharmacy refill order "
            f"for same-day home delivery."
        )
        action_type = "MEDICATION_REFILL"
    else:
        summary = (
            f"{name} was flagged with elevated risk ({score}/100) driven by {desc_text}. "
            f"Multiple sub-threshold factors compounded to place this senior in the top risk cohort today."
        )
        action = (
            f"Visit them at home to review overall wellbeing, inspect mobility assistance needs, "
            f"and coordinate required care support."
        )
        action_type = "VISIT_HOME_SAFETY"

    return {
        "primary_driver_summary": summary,
        "suggested_action": action,
        "action_type": action_type,
    }


def explain_and_persist_top_risk_alerts(
    db: Session,
    scored_results: Any,
    on_date: date,
    top_percentile: float = 0.05,
) -> List[Dict[str, Any]]:
    """Identifies the top 5% highest risk seniors in the cohort.

    Calls the LLM ONLY for these top seniors to generate an understandable
    2-3 line primary driver summary and a tailored suggested action, and writes
    the result to `context_repo`. For the remaining seniors, only the deterministic
    score breakdown is retained.
    """
    if not scored_results:
        return []

    items_list: List[tuple[str, Any]] = []
    if isinstance(scored_results, dict):
        for sid, res in scored_results.items():
            items_list.append((str(sid), res))
    elif isinstance(scored_results, (list, tuple)):
        for res in scored_results:
            sid = _val(res, "senior_id")
            if sid:
                items_list.append((str(sid), res))
    else:
        return []

    # Sort scored seniors by risk score descending
    sorted_items = sorted(
        items_list,
        key=lambda item: _val(item[1], "final_risk_score", _val(item[1], "risk_score", 0)) or 0,
        reverse=True,
    )
    n_total = len(sorted_items)
    cutoff_count = max(1, math.ceil(n_total * top_percentile))

    # Candidates: top 5% seniors whose score is elevated (at least >= 25 or tripwire)
    top_5_sids: set[str] = set()
    for sid, res in sorted_items[:cutoff_count]:
        score = _val(res, "final_risk_score", _val(res, "risk_score", 0)) or 0
        tripwire = bool(_val(res, "safety_tripwire_triggered", False))
        if score >= 25 or tripwire:
            top_5_sids.add(sid)

    out: Dict[str, UnderstandableAlert] = {}
    ts_base = datetime(on_date.year, on_date.month, on_date.day, 6, 0, tzinfo=IST)

    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception:
        pass

    all_sids = [sid for sid, _ in items_list]
    seniors = {s.senior_id: s for s in db.scalars(select(Senior).where(Senior.senior_id.in_(all_sids)))}
    profiles = {p.senior_id: p for p in db.scalars(select(SeniorHealthProfile).where(SeniorHealthProfile.senior_id.in_(all_sids)))}
    contacts = {c.senior_id: c for c in db.scalars(select(SeniorContact).where(SeniorContact.senior_id.in_(all_sids)))}
    conditions_list = list(db.scalars(select(SeniorCondition).where(SeniorCondition.senior_id.in_(all_sids))))
    conditions_by_sid: Dict[str, List[str]] = {}
    for cond in conditions_list:
        conditions_by_sid.setdefault(cond.senior_id, []).append(cond.condition)

    for sid, res in items_list:
        score = int(_val(res, "final_risk_score", _val(res, "risk_score", 0)) or 0)
        risk_level = str(_val(res, "risk_level", "LOW"))
        tripwire = bool(_val(res, "safety_tripwire_triggered", False))
        factors = (
            res.to_db_top_factors()
            if hasattr(res, "to_db_top_factors")
            else (_val(res, "top_factors") or [])
        )
        sub_scores = (
            _val(res, "sub_scores")
            or _compute_subscores_from_factors(factors)
        )
        active_synergies = _val(res, "active_synergies") or []
        score_breakdown = {
            "sub_scores": sub_scores,
            "top_factors": factors,
            "active_synergies": active_synergies,
            "safety_tripwire_triggered": tripwire,
        }

        senior = seniors.get(sid)
        profile = profiles.get(sid)
        contact = contacts.get(sid)
        conds = conditions_by_sid.get(sid, [])
        is_top_5 = (sid in top_5_sids)

        if not is_top_5 or senior is None:
            # 95% of seniors: NO LLM called, only breakdown
            out[sid] = UnderstandableAlert(
                senior_id=sid,
                date=on_date.isoformat(),
                risk_score=score,
                risk_level=risk_level,
                is_top_5_percent=False,
                score_breakdown=score_breakdown,
                primary_driver_summary=None,
                suggested_action=None,
                action_type=None,
                recommended_action=_val(res, "recommended_clinical_action", _val(res, "recommended_action")),
            )
            continue

        # TOP 5% SENIORS: Generate LLM understandable explanation + suggested action
        explanation = _generate_llm_or_heuristic_explanation(
            senior=senior,
            profile=profile,
            contact=contact,
            conditions=conds,
            score=score,
            risk_level=risk_level,
            factors=factors,
            sub_scores=sub_scores,
            synergies=active_synergies,
            tripwire=tripwire,
        )

        driver_summary = explanation["primary_driver_summary"]
        suggested_action = explanation["suggested_action"]
        action_type = explanation["action_type"]

        # Persist into context_repo for top 5%
        _write_alert_to_context_repo(
            db=db,
            senior_id=sid,
            on_date=on_date,
            score=score,
            risk_level=risk_level,
            tripwire=tripwire,
            driver_summary=driver_summary,
            suggested_action=suggested_action,
            action_type=action_type,
            score_breakdown=score_breakdown,
            ts=ts_base,
        )

        out[sid] = UnderstandableAlert(
            senior_id=sid,
            date=on_date.isoformat(),
            risk_score=score,
            risk_level=risk_level,
            is_top_5_percent=True,
            score_breakdown=score_breakdown,
            primary_driver_summary=driver_summary,
            suggested_action=suggested_action,
            action_type=action_type,
            recommended_action=_val(res, "recommended_clinical_action", _val(res, "recommended_action")),
        )

    # Return list of top 5% alerts that were enriched and persisted
    return [v.to_dict() for k, v in out.items() if v.is_top_5_percent]


def _generate_llm_or_heuristic_explanation(
    senior: Senior,
    profile: Optional[SeniorHealthProfile],
    contact: Optional[SeniorContact],
    conditions: List[str],
    score: int,
    risk_level: str,
    factors: List[Dict[str, Any]],
    sub_scores: Dict[str, Any],
    synergies: List[Any],
    tripwire: bool,
) -> Dict[str, str]:
    """Attempts LLM provider call; falls back to heuristic on failure or mock/stub."""
    settings = get_settings()
    llm_provider_name = settings.llm_provider

    if llm_provider_name == "stub":
        return _build_heuristic_explanation(senior, profile, contact, score, risk_level, factors, tripwire)

    try:
        from ml.src.nlp.llm_client import get_llm_provider

        provider = get_llm_provider(
            provider_name=llm_provider_name,
            api_key=settings.llm_api_key or settings.gemini_api_key or settings.openai_api_key or settings.groq_api_key,
            model=settings.llm_model or settings.gemini_model,
        )

        name = contact.full_name if contact and contact.full_name else f"Senior {senior.senior_id}"
        hobbies = list(profile.hobbies or []) if profile else []
        factors_text = "\n".join(
            f"- [{f.get('category')}] {f.get('description')} ({f.get('evidence')}): +{f.get('points')} pts [{f.get('urgency')}]"
            for f in factors[:5]
        )
        synergies_text = (
            "\n".join(f"- {s.get('synergy_name', '')}: {s.get('clinical_rationale', '')}" for s in synergies)
            if synergies
            else "(None)"
        )

        user_prompt = f"""Explain this senior's risk alert:
Senior Context:
- ID: {senior.senior_id}
- Name: {name} (Age: {senior.age}, City: {senior.city}, Living: {senior.living_arrangement})
- Known conditions: {', '.join(conditions) if conditions else 'None listed'}
- Hobbies & Interests: {', '.join(hobbies) if hobbies else 'General'}
- Mobility Aid: {profile.mobility_aid if profile and profile.mobility_aid else 'None'}
- Social/Loneliness status: {profile.loneliness_risk if profile and profile.loneliness_risk else 'normal'}

Risk Assessment:
- Score: {score}/100 ({risk_level})
- Safety Tripwire Triggered: {tripwire}
- Sub-scores: {json.dumps(sub_scores)}
- Active Synergies: {synergies_text}
- Top Contributing Drivers:
{factors_text}

Provide strictly valid JSON with "primary_driver_summary", "suggested_action", and "action_type"."""

        response_text = provider.generate(
            prompt=user_prompt,
            system_instruction=ALERT_EXPLAINER_SYSTEM_PROMPT,
            temperature=0.2,
        )

        # Parse JSON from response
        clean_json = response_text.strip()
        if clean_json.startswith("```"):
            lines = clean_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_json = "\n".join(lines).strip()

        parsed = json.loads(clean_json)
        if "primary_driver_summary" in parsed and "suggested_action" in parsed:
            return {
                "primary_driver_summary": str(parsed["primary_driver_summary"]).strip(),
                "suggested_action": str(parsed["suggested_action"]).strip(),
                "action_type": str(parsed.get("action_type", "CALL_WELLBEING")).strip(),
            }
    except Exception as exc:
        logger.warning("LLM explanation call failed for senior %s: %s. Using heuristic.", senior.senior_id, exc)

    return _build_heuristic_explanation(senior, profile, contact, score, risk_level, factors, tripwire)


def _write_alert_to_context_repo(
    db: Session,
    senior_id: str,
    on_date: date,
    score: int,
    risk_level: str,
    tripwire: bool,
    driver_summary: str,
    suggested_action: str,
    action_type: str,
    score_breakdown: Dict[str, Any],
    ts: datetime,
) -> None:
    """Writes the alert explanation into `context_repo` for top 5% seniors."""
    # Delete existing risk_alert record for the same senior on the same day if present
    start_dt = datetime(on_date.year, on_date.month, on_date.day, 0, 0, tzinfo=IST)
    end_dt = start_dt + timedelta(days=1)

    existing = list(
        db.scalars(
            select(ContextRepo).where(
                ContextRepo.senior_id == senior_id,
                ContextRepo.source_type == "risk_alert",
                ContextRepo.timestamp >= start_dt,
                ContextRepo.timestamp < end_dt,
            )
        )
    )
    for ex in existing:
        db.delete(ex)

    context_row = ContextRepo(
        senior_id=senior_id,
        timestamp=ts,
        source_type="risk_alert",
        source_id=f"RISK_ALERT_{senior_id}_{on_date.isoformat()}",
        summary=driver_summary,
        dominant_sentiment="CONCERNED" if score >= 50 else "NEUTRAL",
        extracted_signals=[
            {
                "intent": "PRIMARY_RISK_DRIVER",
                "category": "RISK",
                "specific_issue": action_type,
                "severity": risk_level,
                "summary": driver_summary,
                "suggested_action": suggested_action,
                "action_type": action_type,
                "score_breakdown": score_breakdown,
                "is_top_5_percent": True,
            }
        ],
        talking_points=[
            {
                "topic": "risk_alert_followup",
                "domain": "CLINICAL_FOLLOWUP",
                "status": "OPEN",
                "priority": 10,
                "target_signal_to_verify": suggested_action,
                "suggested_bot_question_hinglish": (
                    "Namaste ji, kal aapki tabiyat ka health review hua tha. Aaj aap kaisa mehsoos kar rahe hain?"
                ),
                "suggested_bot_question_english": (
                    "Following up on yesterday's health alert: how are you feeling today?"
                ),
            }
        ],
        state_transitions=[],
        risk_score_contribution=float(score),
        requires_clinical_escalation=(score >= 50 or tripwire),
        requires_operations_action=bool(score_breakdown.get("sub_scores", {}).get("assistance_and_issues", 0) > 0),
    )
    db.add(context_row)


def get_senior_risk_detail(
    db: Session,
    senior_id: str,
    target_date: date,
) -> Dict[str, Any]:
    """Queries risk score breakdown, checking context_repo for top 5% LLM summary & action."""
    from app.modules.risk import repository as risk_repo

    score_row = risk_repo.get_score(db, senior_id, target_date)
    if score_row is None:
        return {
            "senior_id": senior_id,
            "date": target_date.isoformat(),
            "risk_score": 0,
            "risk_level": "LOW",
            "confidence_level": "NONE",
            "baseline_confidence": "NONE",
            "is_top_5_percent": False,
            "score_breakdown": {
                "sub_scores": {
                    "vital_trajectories": 0.0,
                    "vital_levels": 0.0,
                    "physical_wellbeing": 0.0,
                    "psychological_wellbeing": 0.0,
                    "medicine_adherence": 0.0,
                    "assistance_and_issues": 0.0,
                },
                "top_factors": [],
                "active_synergies": [],
                "safety_tripwire_triggered": False,
            },
            "primary_driver_summary": None,
            "suggested_action": None,
            "action_type": None,
            "recommended_action": None,
            "scoring_version": "unknown",
        }

    factors = list(score_row.top_factors or [])
    sub_scores = _compute_subscores_from_factors(factors)

    # Check context_repo for top 5% alert explanation
    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, tzinfo=IST)
    end_dt = start_dt + timedelta(days=1)

    ctx_row = None
    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
        ctx_row = db.scalar(
            select(ContextRepo)
            .where(
                ContextRepo.senior_id == senior_id,
                ContextRepo.source_type == "risk_alert",
                ContextRepo.timestamp >= start_dt,
                ContextRepo.timestamp < end_dt,
            )
            .order_by(ContextRepo.timestamp.desc())
            .limit(1)
        )
    except Exception:
        pass

    is_top_5 = False
    driver_summary = None
    suggested_action = None
    action_type = None

    if ctx_row is not None:
        is_top_5 = True
        driver_summary = ctx_row.summary
        signals = ctx_row.extracted_signals or []
        first_sig = signals[0] if (isinstance(signals, list) and signals and isinstance(signals[0], dict)) else (signals if isinstance(signals, dict) else {})
        suggested_action = first_sig.get("suggested_action")
        action_type = first_sig.get("action_type")
        if "score_breakdown" in first_sig:
            stored_bd = first_sig["score_breakdown"]
            if isinstance(stored_bd, dict) and "sub_scores" in stored_bd:
                sub_scores = stored_bd["sub_scores"]

    score_breakdown = {
        "sub_scores": sub_scores,
        "top_factors": factors,
        "active_synergies": [],
        "safety_tripwire_triggered": any(f.get("is_safety_tripwire") for f in factors),
    }

    return {
        "senior_id": senior_id,
        "date": target_date.isoformat(),
        "risk_score": score_row.risk_score,
        "risk_level": score_row.risk_level,
        "confidence_level": score_row.confidence_level,
        "baseline_confidence": score_row.baseline_confidence,
        "is_top_5_percent": is_top_5,
        "score_breakdown": score_breakdown,
        "primary_driver_summary": driver_summary,
        "suggested_action": suggested_action,
        "action_type": action_type,
        "recommended_action": score_row.recommended_action,
        "scoring_version": score_row.scoring_version,
    }
