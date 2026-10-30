from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    medication_id: str
    drug_name: str
    dosage: str
    indication: str | None = None
    times_per_day: int
    scheduled_times: list[str] = []
    criticality: str | None = None
    is_active: bool


class AdherenceOut(BaseModel):
    last_7d_pct: float | None = None
    last_30d_pct: float | None = None
    missed_critical_7d: int = 0


class EventOut(BaseModel):
    medication_id: str
    drug_name: str | None = None
    scheduled_at: datetime
    status: str
    actual_at: datetime | None = None
    record_source: str


class MedicationsOut(BaseModel):
    schedules: list[ScheduleOut]
    adherence: AdherenceOut
    recent_events: list[EventOut]
