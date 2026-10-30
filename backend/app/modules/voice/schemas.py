"""Messages of the voice-agent WebSocket (see docs/api-contract.md, section 4) and Voice Note processing DTOs."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Language = Literal["hindi", "hinglish", "english"]


class StartMessage(BaseModel):
    type: Literal["start"]
    language: Language | None = None  # defaults to the senior's preferred language


class SimpleMessage(BaseModel):
    type: Literal["end_utterance", "end_call"]


@dataclass
class Stage:
    """What the agent has to say next."""
    kind: Literal["opening", "question", "goodbye"]
    index: int = 0   # 0-based question number for kind == "question" (opening asks question 0)
    total: int = 4


@dataclass
class Turn:
    speaker: Literal["agent", "senior"]
    text: str


@dataclass
class CallContext:
    """Everything the agent is told. Stored verbatim in calls.context_snapshot. No name or phone."""
    language: str
    age: int | None = None
    living_arrangement: str | None = None
    last_call_summary: str | None = None
    open_memory_items: list[dict] = field(default_factory=list)
    talking_points: list[dict] = field(default_factory=list)
    risk_factors_today: list[str] = field(default_factory=list)
    missed_medicines_today: list[str] = field(default_factory=list)
    recent_vitals: list[dict] = field(default_factory=list)
    hobbies: list[str] = field(default_factory=list)
    background: str | None = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}

    @property
    def has_open_symptom(self) -> bool:
        return bool(self.talking_points) or any(i.get("kind") in ("symptom", "mood") for i in self.open_memory_items)


@dataclass
class MemoryOp:
    action: Literal["create", "touch", "resolve"]
    kind: str
    content: str


# ---- Voice Note NLP Processing Schemas -------------------------------------------------------

class VoiceNoteProcessRequest(BaseModel):
    senior_id: str = Field(..., description="Unique senior citizen ID (e.g., 'SR_1042')")
    transcript: str = Field(..., description="Transcribed audio text in Hindi, English, or Hinglish")
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
    provider: Optional[str] = Field(default=None, description="Optional LLM provider override: 'gemini', 'openai', 'groq', 'anthropic', 'ollama', 'mock'")
    model: Optional[str] = Field(default=None, description="Optional model override (e.g. 'gemini-2.0-flash', 'gpt-4o-mini', 'llama-3.3-70b-versatile')")


class VoiceEventItem(BaseModel):
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


class TalkingPointItem(BaseModel):
    topic: str
    domain: str
    status: str
    priority: int
    target_signal_to_verify: str
    suggested_bot_question_hinglish: str
    suggested_bot_question_english: str


class VoiceNoteProcessResponse(BaseModel):
    senior_id: str
    timestamp: str
    summary: str
    dominant_sentiment: str
    events: List[VoiceEventItem]
    talking_points: List[TalkingPointItem]
    total_nlp_risk_delta: float
    requires_clinical_escalation: bool
    requires_operations_action: bool
    raw_transcript: str
