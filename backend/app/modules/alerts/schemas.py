import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AlertStatus = Literal["OPEN", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"]
AlertSeverity = Literal["MODERATE", "HIGH", "URGENT_REVIEW"]
Outcome = Literal["called", "visited", "doctor", "no_action"]


class AlertEventOut(BaseModel):
    at: datetime
    from_status: str | None
    to_status: str
    actor: str | None = Field(description="Display name of who made the change; 'System' for automatic changes")
    note: str | None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alert_id: str
    senior_id: str
    status: AlertStatus
    severity: AlertSeverity
    created_at: datetime
    last_updated_at: datetime
    triggering_signals: list[str]
    recommended_next_step: str
    resolution_reason: str | None
    assigned_to: uuid.UUID | None


class AlertDetail(AlertOut):
    events: list[AlertEventOut]


class AlertPage(BaseModel):
    items: list[AlertOut]
    total: int
    limit: int
    offset: int


class AcknowledgeBody(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class EscalateBody(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


class ResolveBody(BaseModel):
    resolution_reason: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=1000)


class FeedbackBody(BaseModel):
    useful: bool
    outcome: Outcome | None = None
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alert_id: str
    useful: bool
    outcome: str | None
    comment: str | None
    at: datetime
