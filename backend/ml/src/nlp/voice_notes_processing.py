"""Voice note NLP processor for SamarthCare AI.

Extracts clinical and operational events from senior voice note transcripts,
computes risk deltas with saturation caps, and preserves actionable talking points.
Supports pluggable/switchable LLM providers (Gemini, OpenAI, Groq, Anthropic, Ollama).
"""

from dataclasses import dataclass, asdict
from datetime import datetime
import logging
from typing import List, Dict, Any, Optional

from .prompts import VOICE_NOTE_SYSTEM_PROMPT
from .llm_client import BaseLLMProvider, get_llm_provider, MockFallbackProvider

logger = logging.getLogger("voice_nlp")


@dataclass
class VoiceEvent:
    intent: str
    category: str  # "RISK", "ATTENTION_REQUIRED", "NEUTRAL"
    specific_issue: str
    status: str  # "present", "negated", "uncertain"
    temporality: str  # "current", "historical", "hypothetical"
    severity: str  # "LOW", "MODERATE", "HIGH", "CRITICAL"
    urgency: str  # "IMMEDIATE", "SAME_DAY", "ROUTINE"
    evidence_text: str
    confidence: float
    risk_delta: float
    recommended_action: str


@dataclass
class TalkingPoint:
    topic: str
    domain: str  # "PHYSICAL_DISCOMFORT", "MOOD_AND_WELLBEING", "MEDICATION", "ASSISTANCE_AND_SERVICE"
    status: str  # "OPEN", "RESOLVED", "MONITORING"
    priority: int  # 1 to 10
    target_signal_to_verify: str
    suggested_bot_question_hinglish: str
    suggested_bot_question_english: str


@dataclass
class VoiceNoteProcessingResult:
    senior_id: str
    timestamp: str
    summary: str
    dominant_sentiment: str
    events: List[VoiceEvent]
    talking_points: List[TalkingPoint]
    total_nlp_risk_delta: float
    requires_clinical_escalation: bool
    requires_operations_action: bool
    raw_transcript: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "senior_id": self.senior_id,
            "timestamp": self.timestamp,
            "summary": self.summary,
            "dominant_sentiment": self.dominant_sentiment,
            "events": [asdict(e) for e in self.events],
            "talking_points": [asdict(t) for t in self.talking_points],
            "total_nlp_risk_delta": self.total_nlp_risk_delta,
            "requires_clinical_escalation": self.requires_clinical_escalation,
            "requires_operations_action": self.requires_operations_action,
            "raw_transcript": self.raw_transcript,
        }


class VoiceNotesProcessor:
    """Processes senior citizen voice notes with pluggable LLM provider support."""

    NLP_MAX_SATURATION_CAP = 35.0

    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        provider_name: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        if provider is not None:
            self.provider = provider
        else:
            self.provider = get_llm_provider(
                provider_name=provider_name,
                api_key=api_key,
                model=model,
            )

    def process(
        self,
        senior_id: str,
        transcript: str,
        timestamp: Optional[str] = None,
    ) -> VoiceNoteProcessingResult:
        """Processes a voice note transcript and extracts events + talking points."""
        ts = timestamp or datetime.utcnow().isoformat()
        clean_text = (transcript or "").strip()

        if not clean_text:
            return VoiceNoteProcessingResult(
                senior_id=senior_id,
                timestamp=ts,
                summary="Empty audio note received.",
                dominant_sentiment="NEUTRAL",
                events=[],
                talking_points=[],
                total_nlp_risk_delta=0.0,
                requires_clinical_escalation=False,
                requires_operations_action=False,
                raw_transcript="",
            )

        try:
            raw_json = self.provider.generate_json(
                system_prompt=VOICE_NOTE_SYSTEM_PROMPT,
                user_prompt=clean_text,
            )
            return self._parse_llm_response(senior_id, ts, clean_text, raw_json)
        except Exception as exc:
            logger.warning("Primary LLM provider failed (%s); falling back to heuristic mock.", exc)
            fallback_provider = MockFallbackProvider()
            raw_json = fallback_provider.generate_json(
                system_prompt=VOICE_NOTE_SYSTEM_PROMPT,
                user_prompt=clean_text,
            )
            return self._parse_llm_response(senior_id, ts, clean_text, raw_json)

    def _parse_llm_response(
        self,
        senior_id: str,
        timestamp: str,
        transcript: str,
        data: Dict[str, Any],
    ) -> VoiceNoteProcessingResult:
        """Parses and bounds LLM JSON output."""
        summary = data.get("summary", "")
        dominant_sentiment = data.get("dominant_sentiment", "NEUTRAL")

        events: List[VoiceEvent] = []
        raw_delta_sum = 0.0
        has_clinical = False
        has_ops = False

        for ev in data.get("events", []):
            delta = float(ev.get("risk_delta", 0.0))
            is_present = ev.get("status") == "present"
            is_current = ev.get("temporality") == "current"

            if is_present and is_current:
                raw_delta_sum += delta

            cat = ev.get("category", "NEUTRAL")
            if cat == "RISK" and is_present and is_current:
                has_clinical = True
            elif cat == "ATTENTION_REQUIRED" and is_present:
                has_ops = True

            events.append(
                VoiceEvent(
                    intent=ev.get("intent", "ROUTINE_WELLBEING"),
                    category=cat,
                    specific_issue=ev.get("specific_issue", "general"),
                    status=ev.get("status", "present"),
                    temporality=ev.get("temporality", "current"),
                    severity=ev.get("severity", "LOW"),
                    urgency=ev.get("urgency", "ROUTINE"),
                    evidence_text=ev.get("evidence_text", ""),
                    confidence=float(ev.get("confidence", 0.9)),
                    risk_delta=delta,
                    recommended_action=ev.get("recommended_action", ""),
                )
            )

        talking_points: List[TalkingPoint] = []
        for tp in data.get("talking_points", []):
            talking_points.append(
                TalkingPoint(
                    topic=tp.get("topic", "general_checkin"),
                    domain=tp.get("domain", "PHYSICAL_DISCOMFORT"),
                    status=tp.get("status", "OPEN"),
                    priority=int(tp.get("priority", 5)),
                    target_signal_to_verify=tp.get("target_signal_to_verify", ""),
                    suggested_bot_question_hinglish=tp.get("suggested_bot_question_hinglish", ""),
                    suggested_bot_question_english=tp.get("suggested_bot_question_english", ""),
                )
            )

        # Enforce saturation cap
        capped_delta = min(max(0.0, raw_delta_sum), self.NLP_MAX_SATURATION_CAP)

        return VoiceNoteProcessingResult(
            senior_id=senior_id,
            timestamp=timestamp,
            summary=summary,
            dominant_sentiment=dominant_sentiment,
            events=events,
            talking_points=talking_points,
            total_nlp_risk_delta=capped_delta,
            requires_clinical_escalation=has_clinical or data.get("requires_clinical_escalation", False),
            requires_operations_action=has_ops or data.get("requires_operations_action", False),
            raw_transcript=transcript,
        )
