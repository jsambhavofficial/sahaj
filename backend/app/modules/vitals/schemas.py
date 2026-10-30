from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class VitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    measurement_id: str
    measured_at: datetime
    measurement_type: str
    value: float
    unit: str
    context: str | None = None
    source: str
    quality_status: str


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: date
    steps: float | None = None
    active_minutes: float | None = None
    sleep_hours: float | None = None
    appetite_level: float | None = None
    mood_level: float | None = None
    social_contact_count: int | None = None
    data_available: bool
