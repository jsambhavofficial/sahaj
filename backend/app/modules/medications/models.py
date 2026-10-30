from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, one_of


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    __table_args__ = (one_of("criticality", ("high", "medium", "low")),)

    medication_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), index=True)
    drug_name: Mapped[str] = mapped_column(Text)
    dosage: Mapped[str] = mapped_column(Text)
    indication: Mapped[str | None] = mapped_column(Text)
    linked_condition: Mapped[str | None] = mapped_column(Text)
    criticality: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    times_per_day: Mapped[int] = mapped_column(Integer)
    scheduled_times: Mapped[list] = mapped_column(JSONType, default=list)
    is_sos: Mapped[bool] = mapped_column(Boolean, default=False)
    prescribed_by: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class MedicationEvent(Base):
    __tablename__ = "medication_events"
    __table_args__ = (
        one_of("status", ("taken", "missed", "unknown", "double_dose", "sos_taken")),
        one_of("verification_status", ("verified", "self_reported", "unverified")),
        Index("ix_medication_events_senior_time", "senior_id", "scheduled_at"),
    )

    medication_event_id: Mapped[str] = mapped_column(Text, primary_key=True)
    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"))
    medication_id: Mapped[str] = mapped_column(ForeignKey("medication_schedules.medication_id"), index=True)
    scheduled_at: Mapped[datetime] = mapped_column(TZ)
    status: Mapped[str] = mapped_column(Text)
    actual_at: Mapped[datetime | None] = mapped_column(TZ)
    # smart_pillbox, senior_app_confirmation, coordinator_call, family_reported
    record_source: Mapped[str] = mapped_column(Text)
    verification_status: Mapped[str | None] = mapped_column(Text)
