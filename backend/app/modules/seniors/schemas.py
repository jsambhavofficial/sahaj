import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SeniorListItem(BaseModel):
    senior_id: str
    display_name: str | None = None
    age: int
    city: str
    preferred_language: str
    living_arrangement: str
    coordinator_id: uuid.UUID
    family_consent_level: str
    risk_score: int | None = None
    risk_level: str | None = None
    open_alert_id: str | None = None
    last_contact_at: datetime | None = None


class SeniorListPage(BaseModel):
    items: list[SeniorListItem]
    total: int
    limit: int
    offset: int


class ConditionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    category: str
    condition: str


class ContactOut(BaseModel):
    phone: str | None = None


class SeniorDetail(BaseModel):
    senior_id: str
    display_name: str | None = None
    age: int
    gender: str | None = None
    marital_status: str | None = None
    city: str
    living_arrangement: str
    preferred_language: str
    communication_style: str | None = None
    coordinator_id: uuid.UUID
    family_consent_level: str
    conditions: list[ConditionOut]
    health_profile: dict[str, Any] | None = None
    baseline: dict[str, Any] | None = None
    contact: ContactOut | None = None


class RiskHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: date
    risk_score: int
    risk_level: str
    top_factors: list[dict[str, Any]] = []
    recommended_action: str | None = None
    scoring_version: str


class SeniorCallItem(BaseModel):
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
    language: str | None = None
    sentiment: str | None = None
    insights: dict | None = None  # questions answered/total, urgent, end reason, cue types


class SeniorCallPage(BaseModel):
    items: list[SeniorCallItem]
    total: int
    limit: int
    offset: int


class MemoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: str
    content: str
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    follow_up_after: date | None = None


class FamilyInteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    interaction_id: str
    at: datetime
    channel: str
    category: str
    family_message: str
    coordinator_reply_en: str | None = None
    counselor_summary: str | None = None
    suggested_action: str | None = None
    escalation_needed: bool


class LegacySeniorItem(BaseModel):
    """Flat senior row used by the older dashboard pages (GET /seniors)."""
    senior_id: str
    name: str | None = None
    age: int
    preferred_language: str
    city_id: str
    living_arrangement: str
    coordinator_id: uuid.UUID
    expected_checkin_frequency: str | None = None
    family_consent: bool
    current_risk_level: str | None = None
    current_risk_score: int | None = None
    last_observation_date: str | None = None
    active_alert_count: int = 0


class LegacySeniorPage(BaseModel):
    items: list[LegacySeniorItem]
    total: int
    limit: int
    offset: int
