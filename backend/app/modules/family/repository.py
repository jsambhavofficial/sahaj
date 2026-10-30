"""Queries for weekly family summaries (read-only on other modules' tables)."""

import uuid
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.alerts.models import Alert
from app.modules.auth.models import FamilyLink
from app.modules.checkins.models import Checkin
from app.modules.family.models import FamilyInteraction, WeeklyFamilySummary
from app.modules.medications.models import MedicationEvent
from app.modules.seniors.models import Senior
from app.modules.vitals.models import DailyActivity


def get_summary(db: Session, senior_id: str, week_start: date) -> WeeklyFamilySummary | None:
    return db.scalar(select(WeeklyFamilySummary).where(
        WeeklyFamilySummary.senior_id == senior_id, WeeklyFamilySummary.week_start == week_start))


def add_summary(db: Session, summary: WeeklyFamilySummary) -> WeeklyFamilySummary:
    db.add(summary)
    db.flush()
    return summary


def consenting_links(db: Session, senior_id: str) -> list[FamilyLink]:
    return list(db.scalars(select(FamilyLink).where(
        FamilyLink.senior_id == senior_id, FamilyLink.consent_given.is_(True))
        .order_by(FamilyLink.id)).all())


def links_for_family_user(db: Session, user_id: uuid.UUID) -> list[FamilyLink]:
    return list(db.scalars(select(FamilyLink).where(FamilyLink.family_user_id == user_id)
                           .order_by(FamilyLink.senior_id)).all())


def active_seniors(db: Session) -> list[Senior]:
    return list(db.scalars(select(Senior).where(Senior.is_active.is_(True))
                           .order_by(Senior.senior_id)).all())


def latest_family_language(db: Session, senior_id: str) -> str | None:
    return db.scalar(select(FamilyInteraction.message_language)
                     .where(FamilyInteraction.senior_id == senior_id,
                            FamilyInteraction.message_language.is_not(None))
                     .order_by(FamilyInteraction.at.desc()).limit(1))


def medication_status_counts(db: Session, senior_id: str, start: datetime, end: datetime) -> dict[str, int]:
    rows = db.execute(select(MedicationEvent.status, func.count()).where(
        MedicationEvent.senior_id == senior_id, MedicationEvent.scheduled_at >= start,
        MedicationEvent.scheduled_at < end).group_by(MedicationEvent.status)).all()
    return {status: n for status, n in rows}


def avg_steps(db: Session, senior_id: str, start: date, end: date) -> float | None:
    """Average daily steps for start <= date < end, ignoring days without data."""
    return db.scalar(select(func.avg(DailyActivity.steps)).where(
        DailyActivity.senior_id == senior_id, DailyActivity.date >= start,
        DailyActivity.date < end, DailyActivity.data_available.is_(True),
        DailyActivity.steps.is_not(None)))


def count_checkins(db: Session, senior_id: str, start: datetime, end: datetime) -> int:
    return db.scalar(select(func.count()).select_from(Checkin).where(
        Checkin.senior_id == senior_id, Checkin.at >= start, Checkin.at < end)) or 0


def count_alerts(db: Session, senior_id: str, start: datetime, end: datetime) -> int:
    return db.scalar(select(func.count()).select_from(Alert).where(
        Alert.senior_id == senior_id, Alert.created_at >= start, Alert.created_at < end)) or 0
