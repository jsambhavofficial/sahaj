import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, created_at_col, one_of, uuid_pk


class Senior(Base):
    __tablename__ = "seniors"
    __table_args__ = (
        one_of("preferred_language", ("hindi", "hinglish", "english")),
        one_of("living_arrangement", ("alone", "with_spouse", "with_domestic_help_or_family")),
        one_of("family_consent_level", ("full", "summary_and_urgent", "urgent_only")),
    )

    senior_id: Mapped[str] = mapped_column(Text, primary_key=True)
    gender: Mapped[str | None] = mapped_column(Text)
    age: Mapped[int] = mapped_column(Integer)
    marital_status: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str] = mapped_column(Text, index=True)
    living_arrangement: Mapped[str] = mapped_column(Text)
    preferred_language: Mapped[str] = mapped_column(Text)
    communication_style: Mapped[str | None] = mapped_column(Text)
    uses_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    coordinator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), unique=True)
    family_id: Mapped[str | None] = mapped_column(Text, index=True)
    family_consent_level: Mapped[str] = mapped_column(Text, default="urgent_only")
    vital_monitoring_enrolled: Mapped[bool] = mapped_column(Boolean, default=False)
    vital_devices: Mapped[list] = mapped_column(JSONType, default=list)
    motion_sensor_source: Mapped[str | None] = mapped_column(Text)
    smart_pillbox: Mapped[bool] = mapped_column(Boolean, default=False)
    checkin_days_of_week: Mapped[list] = mapped_column(JSONType, default=list)
    checkin_preferred_hour: Mapped[int | None] = mapped_column(Integer)
    enrollment_date: Mapped[date | None] = mapped_column(Date)
    observation_end_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = created_at_col()


class SeniorContact(Base):
    """Direct identifiers live only here; never include in prompts, logs or LLM payloads."""

    __tablename__ = "senior_contacts"

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    full_name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    device_token_hash: Mapped[str | None] = mapped_column(Text)


class SeniorCondition(Base):
    __tablename__ = "senior_conditions"
    __table_args__ = (one_of("category", ("physical", "mental_health")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), index=True)
    category: Mapped[str] = mapped_column(Text)
    condition: Mapped[str] = mapped_column(Text)


class SeniorHealthProfile(Base):
    """Context facts about the senior (also fed to the voice agent as background)."""

    __tablename__ = "senior_health_profile"

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    cognitive_status: Mapped[str | None] = mapped_column(Text)
    anxiety_tendency: Mapped[str | None] = mapped_column(Text)
    grief_status: Mapped[str | None] = mapped_column(Text)
    loneliness_risk: Mapped[str | None] = mapped_column(Text)
    falls_last_12_months: Mapped[int | None] = mapped_column(Integer)
    hospitalisations_last_12_months: Mapped[int | None] = mapped_column(Integer)
    fall_risk_level: Mapped[str | None] = mapped_column(Text)
    mobility_aid: Mapped[str | None] = mapped_column(Text)
    equipment_tags: Mapped[list] = mapped_column(JSONType, default=list)
    hobbies: Mapped[list] = mapped_column(JSONType, default=list)
    usual_wake_time: Mapped[str | None] = mapped_column(Text)
    usual_sleep_time: Mapped[str | None] = mapped_column(Text)
    usual_activity_summary: Mapped[str | None] = mapped_column(Text)
    recent_health_events: Mapped[str | None] = mapped_column(Text)


class SeniorBaseline(Base):
    """The senior's own normal (median, IQR and sample count per vital)."""

    __tablename__ = "senior_baselines"

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    sbp_median: Mapped[float | None] = mapped_column(Float)
    sbp_iqr: Mapped[float | None] = mapped_column(Float)
    sbp_n: Mapped[int | None] = mapped_column(Integer)
    dbp_median: Mapped[float | None] = mapped_column(Float)
    dbp_iqr: Mapped[float | None] = mapped_column(Float)
    dbp_n: Mapped[int | None] = mapped_column(Integer)
    hr_median: Mapped[float | None] = mapped_column(Float)
    hr_iqr: Mapped[float | None] = mapped_column(Float)
    hr_n: Mapped[int | None] = mapped_column(Integer)
    spo2_median: Mapped[float | None] = mapped_column(Float)
    spo2_iqr: Mapped[float | None] = mapped_column(Float)
    spo2_n: Mapped[int | None] = mapped_column(Integer)
    weight_kg_median: Mapped[float | None] = mapped_column(Float)
    weight_kg_iqr: Mapped[float | None] = mapped_column(Float)
    weight_kg_n: Mapped[int | None] = mapped_column(Integer)
    temp_f_median: Mapped[float | None] = mapped_column(Float)
    temp_f_iqr: Mapped[float | None] = mapped_column(Float)
    temp_f_n: Mapped[int | None] = mapped_column(Integer)
    glucose_fasting_median: Mapped[float | None] = mapped_column(Float)
    glucose_post_meal_median: Mapped[float | None] = mapped_column(Float)
    steps_median: Mapped[float | None] = mapped_column(Float)
    active_minutes_median: Mapped[float | None] = mapped_column(Float)
    sedentary_hours_median: Mapped[float | None] = mapped_column(Float)
    sleep_hours_median: Mapped[float | None] = mapped_column(Float)
    max_inactive_block_hours: Mapped[float | None] = mapped_column(Float)
    hobby_sessions_per_day: Mapped[float | None] = mapped_column(Float)
    whatsapp_msgs_per_day: Mapped[float | None] = mapped_column(Float)
    calls_to_family_per_day: Mapped[float | None] = mapped_column(Float)
    appetite_self_report: Mapped[float | None] = mapped_column(Float)
    mood_self_report: Mapped[float | None] = mapped_column(Float)
    community_attendance_rate: Mapped[float | None] = mapped_column(Float)
    data_availability: Mapped[float | None] = mapped_column(Float)
    med_adherence_rate: Mapped[float | None] = mapped_column(Float)
    vitals_baseline_confidence: Mapped[str | None] = mapped_column(Text)
    baseline_window_days: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = created_at_col()
