from datetime import date, datetime

from pydantic import BaseModel


class SeniorBrief(BaseModel):
    senior_id: str
    display_name: str
    age: int
    city: str
    preferred_language: str


class PriorityItemOut(BaseModel):
    rank: int
    previous_rank: int | None
    senior: SeniorBrief
    risk_score: int
    risk_level: str
    reasons: list[str]
    suggested_action: str | None
    alert_id: str | None
    ai_call_done: bool


class TodayOut(BaseModel):
    date: date
    revision: int
    reason: str
    generated_at: datetime
    items: list[PriorityItemOut]
