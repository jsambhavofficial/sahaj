from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MeasurementType = Literal["blood_pressure_systolic", "blood_pressure_diastolic", "heart_rate",
                          "spo2", "blood_glucose", "weight", "temperature"]


class VitalIn(BaseModel):
    measurement_type: MeasurementType
    value: float = Field(allow_inf_nan=False)
    unit: str | None = Field(None, description="Defaults to the usual unit of the measurement")
    measured_at: datetime | None = None
    context: str | None = None


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


class VitalForecastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    senior_id: str
    date: date
    bp_systolic_forecast: float | None = None
    bp_diastolic_forecast: float | None = None
    pulse_forecast: float | None = None
    spo2_forecast: float | None = None
    weight_forecast: float | None = None
    blood_glucose_forecast: float | None = None
    bp_systolic_slope_3d: float | None = None
    spo2_slope_3d: float | None = None
    weight_slope_7d: float | None = None
    r_vitals_score: float | None = None
    contributions: dict[str, float] = Field(default_factory=dict)
    forecasts_detail: dict[str, Any] = Field(default_factory=dict)
    model_version: str = "vitals_v1"
    computed_at: datetime | None = None


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
