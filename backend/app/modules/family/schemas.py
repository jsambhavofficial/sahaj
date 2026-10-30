from datetime import date, datetime

from pydantic import BaseModel, Field


class SummaryDetails(BaseModel):
    """Numbers behind the summary text; only shown at consent level `full` and to staff."""

    doses_scheduled: int
    doses_confirmed: int
    adherence_pct: int | None = None
    steps_change_pct: int | None = Field(None, description="Average daily steps vs previous week")
    activity_trend: str = Field(description="higher | similar | lower | unknown")
    checkins: int
    alerts: int


class FamilySummaryOut(BaseModel):
    senior_id: str
    week_start: date
    language: str
    body_text: str
    generated_by: str
    sent_at: datetime | None = None
    details: SummaryDetails | None = None
