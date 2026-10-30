from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.messages.schemas import MessageOut

MeasurementType = Literal["blood_pressure_systolic", "blood_pressure_diastolic", "blood_glucose", "spo2",
                          "weight", "heart_rate", "temperature"]


class MedicationToday(BaseModel):
    medication_id: str
    drug_name: str
    dosage: str
    scheduled_at: datetime
    status: Literal["taken", "missed", "unknown", "pending"]


class NextCheckin(BaseModel):
    at: datetime
    kind: str = "ai_call"


class CoordinatorContact(BaseModel):
    display_name: str
    phone: str | None = None


class HomeOut(BaseModel):
    greeting_name: str | None
    language: str
    date: date
    medications_today: list[MedicationToday]
    last_message: MessageOut | None
    next_checkin: NextCheckin | None
    coordinator: CoordinatorContact | None = None


class ConfirmIn(BaseModel):
    scheduled_at: datetime = Field(description="The dose time shown on the home screen (ISO 8601)")


class ConfirmOut(BaseModel):
    status: Literal["taken"] = "taken"
    actual_at: datetime


class VitalIn(BaseModel):
    measurement_type: MeasurementType
    value: float = Field(allow_inf_nan=False)
    unit: str | None = Field(None, description="Defaults to the usual unit of the measurement")
    measured_at: datetime | None = None


class VitalOut(BaseModel):
    measurement_id: str
    measured_at: datetime
    measurement_type: str
    value: float
    unit: str
    source: str
    quality_status: str


class ReportIn(BaseModel):
    text: str = Field(max_length=2000)
    language: Literal["hindi", "hinglish", "english"] | None = None

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v


class ReportOut(BaseModel):
    checkin_id: str
