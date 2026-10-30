from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.vitals.models import DailyActivity, Vital, VitalForecast


def list_vitals(db: Session, senior_id: str, measurement_type: str | None, start: datetime | None,
                end: datetime | None, limit: int) -> list[Vital]:
    stmt = select(Vital).where(Vital.senior_id == senior_id)
    if measurement_type:
        stmt = stmt.where(Vital.measurement_type == measurement_type)
    if start:
        stmt = stmt.where(Vital.measured_at >= start)
    if end:
        stmt = stmt.where(Vital.measured_at < end)
    rows = list(db.scalars(stmt.order_by(Vital.measured_at.desc(), Vital.measurement_id.desc()).limit(limit)))
    rows.reverse()  # oldest first, ready for charts
    return rows


def get_forecast(db: Session, senior_id: str, on_date: date) -> VitalForecast | None:
    return db.get(VitalForecast, (senior_id, on_date))


def get_latest_forecast(db: Session, senior_id: str) -> VitalForecast | None:
    stmt = (
        select(VitalForecast)
        .where(VitalForecast.senior_id == senior_id)
        .order_by(VitalForecast.date.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def list_forecasts(db: Session, senior_id: str, date_from: date | None, date_to: date | None,
                   limit: int = 90) -> list[VitalForecast]:
    stmt = select(VitalForecast).where(VitalForecast.senior_id == senior_id)
    if date_from:
        stmt = stmt.where(VitalForecast.date >= date_from)
    if date_to:
        stmt = stmt.where(VitalForecast.date <= date_to)
    rows = list(db.scalars(stmt.order_by(VitalForecast.date.desc()).limit(limit)))
    rows.reverse()
    return rows


def list_activity(db: Session, senior_id: str, date_from: date | None, date_to: date | None,
                  limit: int) -> list[DailyActivity]:
    stmt = select(DailyActivity).where(DailyActivity.senior_id == senior_id)
    if date_from:
        stmt = stmt.where(DailyActivity.date >= date_from)
    if date_to:
        stmt = stmt.where(DailyActivity.date <= date_to)
    rows = list(db.scalars(stmt.order_by(DailyActivity.date.desc()).limit(limit)))
    rows.reverse()
    return rows
