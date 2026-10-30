import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.modules.seniors.schemas import SeniorListItem


class Overview(BaseModel):
    open_alerts: int
    alerts_in_range: int
    median_minutes_to_ack: float | None = None
    median_minutes_to_resolve: float | None = None
    useful_share: float | None = None
    ai_call_completion_rate: float | None = None
    seniors_covered: int
    seniors_total: int


class VolumeRow(BaseModel):
    day: date
    city: str
    severity: str
    status: str
    alerts: int


class ResponseTimeRow(BaseModel):
    alert_id: str
    city: str
    coordinator_id: uuid.UUID
    severity: str
    created_at: datetime
    minutes_to_ack: float | None = None
    minutes_to_resolve: float | None = None


class OutcomeRow(BaseModel):
    city: str
    resolution_reason: str | None = None
    useful: bool | None = None
    outcome: str | None = None
    alerts: int


class PrecisionRow(BaseModel):
    city: str
    week_start: date
    rated_alerts: int
    useful_alerts: int
    precision: float | None = None


class CoordinatorRow(BaseModel):
    coordinator_id: uuid.UUID
    display_name: str
    city: str | None = None
    caseload: int
    open_alerts: int
    alerts_handled: int
    calls: int
    messages_sent: int


class DailyActivity(BaseModel):
    day: date
    alert_actions: int
    calls: int
    messages_sent: int


class CoordinatorDetail(CoordinatorRow):
    daily: list[DailyActivity]


class OpsSeniorItem(SeniorListItem):
    coordinator_name: str | None = None


class OpsSeniorPage(BaseModel):
    items: list[OpsSeniorItem]
    total: int
    limit: int
    offset: int


class CityRow(BaseModel):
    city: str
    seniors: int
    coordinators: int
    open_alerts: int
    avg_risk: float | None = None
    high_risk_count: int


class ReportCoordinator(BaseModel):
    id: uuid.UUID
    display_name: str
    city: str | None = None


class ReportSenior(BaseModel):
    senior_id: str
    display_name: str | None = None
    age: int
    city: str
    preferred_language: str


class ReportItem(BaseModel):
    rank: int
    previous_rank: int | None = None
    senior: ReportSenior
    risk_score: int
    risk_level: str
    reasons: list[Any] = []
    suggested_action: str | None = None
    alert_id: str | None = None
    ai_call_done: bool = False


class DailyReportEntry(BaseModel):
    coordinator: ReportCoordinator
    revision: int
    items: list[ReportItem]


class JobRunOut(BaseModel):
    job: str
    date: date
    status: str
