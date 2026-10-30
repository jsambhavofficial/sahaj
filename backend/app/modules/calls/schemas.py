import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ConnectRequest(BaseModel):
    senior_id: str
    recording_consent: bool
    initiator: Literal["coordinator", "senior"] = "coordinator"
    coordinator_id: uuid.UUID | None = None
    # Testing overrides: the seeded phone numbers are deliberately not dialable.
    coordinator_phone: str | None = None
    senior_phone: str | None = None


class MeConnectRequest(BaseModel):
    recording_consent: bool


class TurnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    turn_index: int
    speaker: str
    text: str
    offset_ms: int | None = None


class CueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cue_type: str
    cue_value: str
    temporal_context: str | None = None
    negated: bool
    uncertain: bool


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    senior_id: str
    kind: str
    status: str
    transcript_status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_sec: int | None = None
    recording_stored: bool = False
    recording_expires_at: datetime | None = None
    summary: str | None = None
    urgency_flag: bool = False
    turns: list[TurnOut] = []
    cues: list[CueOut] = []
