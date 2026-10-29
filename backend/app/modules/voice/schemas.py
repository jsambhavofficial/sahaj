"""Pydantic schemas for Voice Note processing API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


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
