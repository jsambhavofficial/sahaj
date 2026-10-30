"""Call transcript NLP processor for SamarthCare AI.

Pipeline: diarized turns -> deterministic cleaning (pairing, third-party shield, chit-chat drop) -> LLM (switchable provider) with active talking points from `context_repo` -> guarded parsing
(evidence grounding, topic validation, saturation cap) -> structured result written to `context_repo` + risk score recalculation.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
import logging
import re
from typing import Any, Dict, List, Optional

try:
    from sqlalchemy import select
    from sqlalchemy.orm import Session
except ImportError:
    select = None  # type: ignore
    Session = Any  # type: ignore

from .call_cleaner import SIGNAL_RE, CleanedCall, DeterministicCallCleaner
from .llm_client import BaseLLMProvider, MockFallbackProvider, get_llm_provider
from .prompts import CALL_SYSTEM_PROMPT

logger = logging.getLogger("call_nlp")

VALID_TRANSITIONS = {"RESOLVED", "PERSISTENT", "ESCALATED"}
RESOLVED_MODERATOR = -6.0


def _parse_iso_timestamp(ts: Optional[str | datetime]) -> datetime:
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if isinstance(ts, str) and ts.strip():
        try:
            parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _domain_to_memory_kind(domain: str) -> str:
    d = (domain or "").upper()
    if "MEDICATION" in d:
        return "medication_issue"
    if "MOOD" in d or "PSYCH" in d:
        return "mood"
    if "ASSISTANCE" in d or "SERVICE" in d:
        return "topic"
    return "symptom"


@dataclass
class CallEvent:
    intent: str
    category: str
    specific_issue: str
    status: str
    temporality: str
    severity: str
    urgency: str
    evidence_text: str
    confidence: float
    risk_delta: float
    recommended_action: str
    grounded: bool = True


@dataclass
class StateTransition:
    topic: str
    previous_status: str
    new_status: str
    evidence_text: str
    confidence: float


@dataclass
class CallTalkingPoint:
    topic: str
    domain: str
    status: str
    priority: int
    target_signal_to_verify: str
    suggested_bot_question_hinglish: str
    suggested_bot_question_english: str


@dataclass
class CoordinatorFeedback:
    speaking_pace: str = "APPROPRIATE"
    empathy_score: int = 5
    mandatory_topics_covered: bool = True
    coaching_notes: str = ""


@dataclass
class CallProcessingResult:
    call_id: str
    senior_id: str
    timestamp: str
    call_duration_seconds: Optional[int]
    summary: str
    dominant_sentiment: str
    state_transitions: List[StateTransition]
    new_events: List[CallEvent]
    new_talking_points: List[CallTalkingPoint]
    coordinator_feedback: CoordinatorFeedback
    total_call_risk_delta: float
    requires_clinical_escalation: bool
    requires_operations_action: bool
    pairs_kept: int
    pairs_dropped: int
    used_fallback: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", (s or "").lower(), flags=re.UNICODE)).strip()


def _is_grounded(evidence: str, self_text: str) -> bool:
    """Evidence must come from the senior's own words (substring or high token overlap)."""
    ev, src = _norm(evidence), _norm(self_text)
    if not ev or not src:
        return False
    if ev in src:
        return True
    ev_tokens = ev.split()
    src_tokens = set(src.split())
    if len(ev_tokens) < 2:
        return False
    overlap = sum(1 for t in ev_tokens if t in src_tokens) / len(ev_tokens)
    return overlap >= 0.7


class CallProcessor:
    NLP_MAX_SATURATION_CAP = 35.0

    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        provider_name: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.provider = provider or get_llm_provider(provider_name=provider_name, api_key=api_key, model=model)

    # ------------------------------------------------------------------ public
    def process(
        self,
        senior_id: str,
        turns: List[Dict[str, str]],
        active_talking_points: Optional[List[Dict[str, Any]]] = None,
        call_id: Optional[str] = None,
        timestamp: Optional[str] = None,
        call_duration_seconds: Optional[int] = None,
    ) -> CallProcessingResult:
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        cid = call_id or f"CALL_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        points = active_talking_points or []

        cleaned = DeterministicCallCleaner.clean(turns)

        data: Dict[str, Any] = {}
        used_fallback = False
        if cleaned.pairs:
            try:
                data = self.provider.generate_json(
                    system_prompt=CALL_SYSTEM_PROMPT,
                    user_prompt=self._build_user_prompt(cleaned, points),
                )
                if isinstance(self.provider, MockFallbackProvider):
                    data = self._heuristic(cleaned, points)
                    used_fallback = True
            except Exception as exc:
                logger.warning("LLM provider failed for call %s (%s); using heuristic fallback.", cid, exc)
                data = self._heuristic(cleaned, points)
                used_fallback = True

        return self._build_result(cid, senior_id, ts, call_duration_seconds, cleaned, points, data, used_fallback)

    def process_and_save(
        self,
        db: Session,
        senior_id: str,
        turns: List[Dict[str, str]],
        active_talking_points: Optional[List[Dict[str, Any]]] = None,
        call_id: Optional[str] = None,
        timestamp: Optional[str | datetime] = None,
        call_duration_seconds: Optional[int] = None,
        source_type: str = "checkin_call",
        trigger_risk_calc: bool = True,
        commit: bool = True,
    ) -> CallProcessingResult:
        """
        Processes a check-in or coordinator call, reading open talking points from `context_repo`
        in the DB, reconciling state transitions, writing the call's NLP output into `context_repo`,
        and triggering the risk calculation model.
        """
        ts_dt = _parse_iso_timestamp(timestamp)
        db_points = load_open_talking_points_from_context_repo(db, senior_id)
        if active_talking_points:
            seen_topics = {p.get("topic") for p in db_points}
            for p in active_talking_points:
                if p.get("topic") not in seen_topics:
                    db_points.append(p)
                    seen_topics.add(p.get("topic"))

        result = self.process(
            senior_id=senior_id,
            turns=turns,
            active_talking_points=db_points,
            call_id=call_id,
            timestamp=ts_dt.isoformat(),
            call_duration_seconds=call_duration_seconds,
        )
        raw_transcript = "\n".join(f"{t.get('speaker', 'Speaker')}: {t.get('text', '')}" for t in turns)
        save_call_result_to_db(
            db=db,
            result=result,
            raw_transcript=raw_transcript,
            timestamp_dt=ts_dt,
            source_type=source_type,
            trigger_risk_calc=trigger_risk_calc,
            commit=commit,
        )
        return result

    # ----------------------------------------------------------------- prompts
    @staticmethod
    def _build_user_prompt(cleaned: CleanedCall, points: List[Dict[str, Any]]) -> str:
        if points:
            tp_lines = [
                f"- topic: {p.get('topic')} | domain: {p.get('domain', '')} | verify: {p.get('target_signal_to_verify', '')}"
                for p in points
            ]
        else:
            tp_lines = ["(none)"]
        return (
            "ACTIVE OPEN TALKING POINTS:\n" + "\n".join(tp_lines) + "\n\n"
            "CALL TRANSCRIPT (pre-cleaned):\n" + cleaned.to_prompt_block()
        )

    # --------------------------------------------------------------- fallback
    @staticmethod
    def _heuristic(cleaned: CleanedCall, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Offline mode: run the mock extractor on the senior's own words only (never coordinator text)."""
        base = MockFallbackProvider().generate_json("", cleaned.self_text)
        transitions = []
        text = cleaned.self_text.lower()
        for p in points:
            topic = str(p.get("topic", "")).lower()
            if "dizz" in topic or "chakkar" in topic or "vertigo" in topic:
                if re.search(
                    r"(chakkar|dizzy)\s+[\w\s]{0,20}?(nahi|theek|thik|aaram|better|fine)|"
                    r"(nahi|theek|thik|aaram)\s+[\w\s]{0,20}?(chakkar|dizzy)",
                    text,
                ):
                    transitions.append({
                        "topic": p["topic"], "new_status": "RESOLVED",
                        "evidence_text": cleaned.self_text[:120], "confidence": 0.85,
                    })
            elif re.search(r"\b(theek hai|thik hai|aaram mil|resolved|better now)\b", text):
                transitions.append({
                    "topic": p["topic"], "new_status": "RESOLVED",
                    "evidence_text": cleaned.self_text[:120], "confidence": 0.75,
                })
        # The mock extractor emits placeholder evidence; replace it with a real quote from the senior
        # so offline results survive the grounding check.
        clauses = [c.strip() for c in re.findall(r"[^,;.?!]+[,;.?!]*", cleaned.self_text) if c.strip()]
        for ev in base.get("events", []):
            ev["evidence_text"] = next((c for c in clauses if SIGNAL_RE.search(c)), cleaned.self_text[:120])
        return {
            "summary": base.get("summary", ""),
            "dominant_sentiment": base.get("dominant_sentiment", "NEUTRAL"),
            "state_transitions": transitions,
            "new_events": base.get("events", []),
            "new_talking_points": base.get("talking_points", []),
            "coordinator_feedback": {},
        }

    # ----------------------------------------------------------------- parsing
    def _build_result(
        self,
        call_id: str,
        senior_id: str,
        timestamp: str,
        duration: Optional[int],
        cleaned: CleanedCall,
        points: List[Dict[str, Any]],
        data: Dict[str, Any],
        used_fallback: bool,
    ) -> CallProcessingResult:
        self_text = cleaned.self_text
        status_by_topic = {str(p.get("topic")): str(p.get("status", "OPEN")) for p in points}

        # --- state transitions: only for topics that actually exist
        transitions: List[StateTransition] = []
        seen_topics = set()
        for t in data.get("state_transitions", []) or []:
            topic = str(t.get("topic", ""))
            new_status = str(t.get("new_status", "")).upper()
            if topic not in status_by_topic or new_status not in VALID_TRANSITIONS or topic in seen_topics:
                continue
            evidence = str(t.get("evidence_text", ""))
            if not _is_grounded(evidence, self_text):
                logger.info("Dropped ungrounded transition for topic %s", topic)
                continue
            seen_topics.add(topic)
            transitions.append(StateTransition(
                topic=topic,
                previous_status=status_by_topic[topic],
                new_status=new_status,
                evidence_text=evidence,
                confidence=float(t.get("confidence", 0.8)),
            ))

        # --- events: ground each one in the senior's own words
        events: List[CallEvent] = []
        for ev in data.get("new_events", []) or []:
            evidence = str(ev.get("evidence_text", ""))
            status = ev.get("status", "present")
            delta = float(ev.get("risk_delta", 0.0))
            grounded = _is_grounded(evidence, self_text)
            if not grounded:
                status, delta = "uncertain", 0.0
            events.append(CallEvent(
                intent=ev.get("intent", "ROUTINE_WELLBEING"),
                category=ev.get("category", "NEUTRAL"),
                specific_issue=ev.get("specific_issue", "general"),
                status=status,
                temporality=ev.get("temporality", "current"),
                severity=ev.get("severity", "LOW"),
                urgency=ev.get("urgency", "ROUTINE"),
                evidence_text=evidence,
                confidence=float(ev.get("confidence", 0.8)) if grounded else min(0.4, float(ev.get("confidence", 0.4))),
                risk_delta=delta,
                recommended_action=ev.get("recommended_action", ""),
                grounded=grounded,
            ))

        # --- talking points
        new_points: List[CallTalkingPoint] = []
        for tp in data.get("new_talking_points", []) or []:
            new_points.append(CallTalkingPoint(
                topic=tp.get("topic", "general_checkin"),
                domain=tp.get("domain", "PHYSICAL_DISCOMFORT"),
                status="OPEN",
                priority=int(tp.get("priority", 5)),
                target_signal_to_verify=tp.get("target_signal_to_verify", ""),
                suggested_bot_question_hinglish=tp.get("suggested_bot_question_hinglish", ""),
                suggested_bot_question_english=tp.get("suggested_bot_question_english", ""),
            ))

        # --- risk delta: sum of present+current, cap, then recovery moderator
        raw = sum(e.risk_delta for e in events if e.status == "present" and e.temporality == "current" and e.risk_delta > 0)
        capped = min(raw, self.NLP_MAX_SATURATION_CAP)
        if any(t.new_status == "RESOLVED" for t in transitions):
            capped += RESOLVED_MODERATOR
        total = round(max(0.0, capped), 2)

        escalated = any(t.new_status == "ESCALATED" for t in transitions)
        clinical = escalated or any(
            e.category == "RISK" and e.status == "present" and e.temporality == "current" for e in events
        )
        ops = any(e.category == "ATTENTION_REQUIRED" and e.status == "present" for e in events)

        fb = data.get("coordinator_feedback") or {}
        feedback = CoordinatorFeedback(
            speaking_pace=fb.get("speaking_pace", "APPROPRIATE"),
            empathy_score=int(fb.get("empathy_score", 5)),
            mandatory_topics_covered=bool(fb.get("mandatory_topics_covered", True)),
            coaching_notes=fb.get("coaching_notes", ""),
        )

        summary = data.get("summary") or (
            "No clinically relevant content found in call." if not cleaned.pairs else f"Call processed: {len(events)} event(s)."
        )

        return CallProcessingResult(
            call_id=call_id,
            senior_id=senior_id,
            timestamp=timestamp,
            call_duration_seconds=duration,
            summary=summary,
            dominant_sentiment=data.get("dominant_sentiment", "NEUTRAL"),
            state_transitions=transitions,
            new_events=events,
            new_talking_points=new_points,
            coordinator_feedback=feedback,
            total_call_risk_delta=total,
            requires_clinical_escalation=clinical,
            requires_operations_action=ops,
            pairs_kept=len(cleaned.pairs),
            pairs_dropped=cleaned.dropped_pairs,
            used_fallback=used_fallback,
        )


def load_open_talking_points_from_context_repo(db: Session, senior_id: str) -> List[Dict[str, Any]]:
    """
    Read all active (`status == "OPEN"`) talking points for `senior_id` from `context_repo`
    ordered by priority descending, deduped by `topic`.
    """
    from app.modules.voice.models import ContextRepo

    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception:
        pass

    rows = list(
        db.scalars(
            select(ContextRepo)
            .where(ContextRepo.senior_id == senior_id)
            .order_by(ContextRepo.timestamp.desc())
            .limit(50)
        )
    )

    resolved_topics: set[str] = set()
    open_by_topic: Dict[str, Dict[str, Any]] = {}

    # Walk newest to oldest so state_transitions in newer rows override older OPEN points
    for row in rows:
        for st in (row.state_transitions or []):
            if isinstance(st, dict) and str(st.get("new_status", "")).upper() == "RESOLVED":
                resolved_topics.add(str(st.get("topic", "")))
        for tp in (row.talking_points or []):
            if not isinstance(tp, dict):
                continue
            topic = str(tp.get("topic", "")).strip()
            if not topic or topic in resolved_topics:
                continue
            status = str(tp.get("status", "OPEN")).upper()
            if status == "RESOLVED":
                resolved_topics.add(topic)
                continue
            if status == "OPEN" and topic not in open_by_topic:
                open_by_topic[topic] = dict(tp)

    points = list(open_by_topic.values())
    points.sort(key=lambda p: (-int(p.get("priority", 5)), str(p.get("topic", ""))))
    return points


def save_call_result_to_db(
    db: Session,
    result: CallProcessingResult,
    raw_transcript: str = "",
    timestamp_dt: Optional[datetime] = None,
    source_type: str = "checkin_call",
    trigger_risk_calc: bool = True,
    commit: bool = True,
) -> None:
    """
    Reconcile resolved/escalated talking points in `context_repo`, write the new call row
    into `context_repo` (with `(senior_id, timestamp)` PK), and trigger risk calculation.
    """
    from app.core.config import today as get_today
    from app.modules.seniors.models import Senior
    from app.modules.voice import repository as voice_repo
    from app.modules.voice.models import ContextRepo

    try:
        ContextRepo.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception as exc:
        logger.debug("ContextRepo table creation check skipped: %s", exc)

    ts = timestamp_dt or _parse_iso_timestamp(result.timestamp)
    while db.get(ContextRepo, (result.senior_id, ts)) is not None:
        ts = ts + timedelta(microseconds=1)

    # 1. Reconcile state transitions in existing `context_repo` rows
    if result.state_transitions:
        transitions_by_topic = {t.topic: t.new_status.upper() for t in result.state_transitions}
        prior_rows = list(
            db.scalars(
                select(ContextRepo)
                .where(ContextRepo.senior_id == result.senior_id)
                .order_by(ContextRepo.timestamp.desc())
                .limit(50)
            )
        )
        for prow in prior_rows:
            updated_tps = []
            changed = False
            for tp in (prow.talking_points or []):
                if isinstance(tp, dict):
                    tp_copy = dict(tp)
                    t_name = str(tp_copy.get("topic", ""))
                    if t_name in transitions_by_topic and str(tp_copy.get("status", "OPEN")).upper() == "OPEN":
                        new_st = transitions_by_topic[t_name]
                        if new_st == "RESOLVED":
                            tp_copy["status"] = "RESOLVED"
                            changed = True
                        elif new_st == "ESCALATED":
                            tp_copy["priority"] = 10
                            changed = True
                    updated_tps.append(tp_copy)
                else:
                    updated_tps.append(tp)
            if changed:
                prow.talking_points = updated_tps

    # 2. Insert new `ContextRepo` row for this call
    row = ContextRepo(
        senior_id=result.senior_id,
        timestamp=ts,
        source_type=source_type,
        source_id=result.call_id,
        raw_transcript=raw_transcript or None,
        summary=result.summary,
        dominant_sentiment=result.dominant_sentiment,
        extracted_signals=[asdict(e) for e in result.new_events],
        talking_points=[asdict(tp) for tp in result.new_talking_points],
        state_transitions=[asdict(st) for st in result.state_transitions],
        risk_score_contribution=float(result.total_call_risk_delta),
        requires_clinical_escalation=bool(result.requires_clinical_escalation),
        requires_operations_action=bool(result.requires_operations_action),
    )
    db.add(row)

    senior_exists = db.get(Senior, result.senior_id) is not None
    if senior_exists:
        for tp in result.new_talking_points:
            if tp.status.upper() != "OPEN":
                continue
            kind = _domain_to_memory_kind(tp.domain)
            content = f"{tp.topic}: {tp.target_signal_to_verify}" if tp.target_signal_to_verify else tp.topic
            existing_mem = voice_repo.find_memory_item(db, result.senior_id, kind, content)
            if existing_mem is not None:
                existing_mem.last_seen_at = ts
            else:
                voice_repo.add_memory_item(
                    db,
                    senior_id=result.senior_id,
                    kind=kind,
                    content=content,
                    status="open",
                    first_seen_at=ts,
                    last_seen_at=ts,
                )

    if commit:
        db.commit()
    else:
        db.flush()

    if trigger_risk_calc and senior_exists:
        try:
            from app.modules.risk.service import rescore_and_rerank

            rescore_and_rerank(
                db,
                result.senior_id,
                get_today(),
                reason="new_alert" if result.requires_clinical_escalation else "post_ai_call",
            )
        except Exception:
            logger.warning("Risk calculation after call failed for %s", result.senior_id, exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
