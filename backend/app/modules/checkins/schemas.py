from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.modules.voice.schemas import TalkingPointItem


class CueOut(BaseModel):
    cue_type: str
    cue_value: str
    temporal_context: str | None = None
    negated: bool
    uncertain: bool
    source_type: str
    at: datetime


class CallTurn(BaseModel):
    speaker: str = Field(..., description="'Coordinator' or 'Senior' (diarized speaker label)")
    text: str


class CallProcessRequest(BaseModel):
    senior_id: str
    turns: List[CallTurn] = Field(..., description="Diarized turns in chronological order")
    call_id: Optional[str] = None
    call_duration_seconds: Optional[int] = None
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
    provider: Optional[str] = Field(default=None, description="Optional LLM provider override")
    model: Optional[str] = Field(default=None, description="Optional model override")


class CallEventItem(BaseModel):
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
    grounded: bool


class StateTransitionItem(BaseModel):
    topic: str
    previous_status: str
    new_status: str
    evidence_text: str
    confidence: float


class CoordinatorFeedbackItem(BaseModel):
    speaking_pace: str
    empathy_score: int
    mandatory_topics_covered: bool
    coaching_notes: str


class CallProcessResponse(BaseModel):
    call_id: str
    senior_id: str
    timestamp: str
    call_duration_seconds: Optional[int] = None
    summary: str
    dominant_sentiment: str
    state_transitions: List[StateTransitionItem]
    new_events: List[CallEventItem]
    new_talking_points: List[TalkingPointItem]
    coordinator_feedback: CoordinatorFeedbackItem
    total_call_risk_delta: float
    requires_clinical_escalation: bool
    requires_operations_action: bool
    pairs_kept: int
    pairs_dropped: int
    used_fallback: bool
