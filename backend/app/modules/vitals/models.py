from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, one_of


class Vital(Base):
    __tablename__ = "vitals"
    __table_args__ = (
        one_of("quality_status", ("valid", "questionable", "device_artifact")),
        Index("ix_vitals_senior_type_time", "senior_id", "measurement_type", "measured_at"),
    )

    measurement_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    measured_at: Mapped[datetime] = mapped_column(TZ)
    # blood_pressure_systolic/diastolic, heart_rate, spo2, blood_glucose, weight, temperature
    measurement_type: Mapped[str] = mapped_column(Text)
    value: Mapped[float] = mapped_column(Numeric)
    unit: Mapped[str] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    quality_status: Mapped[str] = mapped_column(Text, default="valid")


class DailyActivity(Base):
    __tablename__ = "daily_activity"

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    day_index: Mapped[int | None] = mapped_column(Integer)
    steps: Mapped[float | None] = mapped_column(Float)
    active_minutes: Mapped[float | None] = mapped_column(Float)
    sedentary_hours: Mapped[float | None] = mapped_column(Float)
    max_inactive_block_hours: Mapped[float | None] = mapped_column(Float)
    sleep_hours: Mapped[float | None] = mapped_column(Float)
    appetite_level: Mapped[float | None] = mapped_column(Float)
    mood_level: Mapped[float | None] = mapped_column(Float)
    social_contact_count: Mapped[int | None] = mapped_column(Integer)
    hobby_sessions: Mapped[int | None] = mapped_column(Integer)
    whatsapp_group_messages: Mapped[int | None] = mapped_column(Integer)
    community_event_registered: Mapped[bool | None] = mapped_column(Boolean)
    community_event_attended: Mapped[bool | None] = mapped_column(Boolean)
    calls_to_family: Mapped[int | None] = mapped_column(Integer)
    motion_sensor_source: Mapped[str | None] = mapped_column(Text)
    data_available: Mapped[bool] = mapped_column(Boolean, default=True)


class AccelerometerWindow(Base):
    """Fall / activity windows. Raw waveforms stay out of Postgres (waveform_ref points at them)."""

    __tablename__ = "accelerometer_windows"
    __table_args__ = (
        one_of("label", ("fall", "non_fall", "non_fall_near_fall")),
        Index("ix_accelerometer_senior_time", "senior_id", "window_start"),
    )

    window_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    window_start: Mapped[datetime] = mapped_column(TZ)
    duration_s: Mapped[float | None] = mapped_column(Float)
    sample_rate_hz: Mapped[int | None] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(Text)
    activity_type: Mapped[str | None] = mapped_column(Text)
    fall_type: Mapped[str | None] = mapped_column(Text)
    fall_event_id: Mapped[str | None] = mapped_column(Text)
    device: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    peak_g: Mapped[float | None] = mapped_column(Float)
    min_g_before_peak: Mapped[float | None] = mapped_column(Float)
    pre_impact_std_g: Mapped[float | None] = mapped_column(Float)
    orientation_change_deg: Mapped[float | None] = mapped_column(Float)
    post_impact_still_s: Mapped[float | None] = mapped_column(Float)
    max_jerk_g_per_s: Mapped[float | None] = mapped_column(Float)
    waveform_ref: Mapped[str | None] = mapped_column(Text)
