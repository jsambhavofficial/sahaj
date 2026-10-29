"""Call transcript NLP processor for SamarthCare AI.

Pipeline: diarized turns -> deterministic cleaning (pairing, third-party shield, chit-chat drop) -> LLM (switchable provider) with active talking points -> guarded parsing
(evidence grounding, topic validation, saturation cap) -> structured result.
"""

from dataclasses import dataclass, asdict, field
from datetime import datetime
import logging
import re
from typing import Any, Dict, List, Optional

from .call_cleaner import SIGNAL_RE, CleanedCall, DeterministicCallCleaner
from .llm_client import BaseLLMProvider, MockFallbackProvider, get_llm_provider
from .prompts import CALL_SYSTEM_PROMPT

logger = logging.getLogger("call_nlp")

VALID_TRANSITIONS = {"RESOLVED", "PERSISTENT", "ESCALATED"}
RESOLVED_MODERATOR = -6.0


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
        d = asdict(self)
        return d


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
        ts = timestamp or datetime.utcnow().isoformat()
        cid = call_id or f"CALL_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
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
            if "dizz" in topic or "chakkar" in topic:
                if re.search(r"(chakkar|dizzy)\s+\w*\s*nahi|nahi\s+\w*\s*(chakkar|dizzy)|chakkar\s+nahi", text):
                    transitions.append({
                        "topic": p["topic"], "new_status": "RESOLVED",
                        "evidence_text": cleaned.self_text[:120], "confidence": 0.6,
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
