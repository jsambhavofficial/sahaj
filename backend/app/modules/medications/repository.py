from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.medications.models import MedicationEvent, MedicationSchedule

SCHEDULED_STATUSES = ("taken", "missed", "unknown", "double_dose")  # sos_taken is not scheduled
TAKEN_STATUSES = ("taken", "double_dose")


def list_schedules(db: Session, senior_id: str) -> list[MedicationSchedule]:
    return list(db.scalars(select(MedicationSchedule).where(MedicationSchedule.senior_id == senior_id)
                           .order_by(MedicationSchedule.is_active.desc(), MedicationSchedule.drug_name)))


def adherence_counts(db: Session, senior_id: str, start: datetime, end: datetime) -> tuple[int, int]:
    """(scheduled doses, doses taken) with scheduled_at in [start, end)."""
    taken = func.sum(case((MedicationEvent.status.in_(TAKEN_STATUSES), 1), else_=0))
    row = db.execute(select(func.count(), taken).where(
        MedicationEvent.senior_id == senior_id, MedicationEvent.status.in_(SCHEDULED_STATUSES),
        MedicationEvent.scheduled_at >= start, MedicationEvent.scheduled_at < end)).one()
    return int(row[0] or 0), int(row[1] or 0)


def missed_critical(db: Session, senior_id: str, start: datetime, end: datetime) -> int:
    return db.scalar(select(func.count()).select_from(MedicationEvent).join(
        MedicationSchedule, MedicationSchedule.medication_id == MedicationEvent.medication_id).where(
        MedicationEvent.senior_id == senior_id, MedicationEvent.status == "missed",
        MedicationSchedule.criticality == "high",
        MedicationEvent.scheduled_at >= start, MedicationEvent.scheduled_at < end)) or 0


def recent_events(db: Session, senior_id: str, before: datetime, limit: int):
    return db.execute(
        select(MedicationEvent, MedicationSchedule.drug_name)
        .outerjoin(MedicationSchedule, MedicationSchedule.medication_id == MedicationEvent.medication_id)
        .where(MedicationEvent.senior_id == senior_id, MedicationEvent.scheduled_at < before)
        .order_by(MedicationEvent.scheduled_at.desc()).limit(limit)).all()
