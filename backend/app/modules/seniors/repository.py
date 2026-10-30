"""SQLAlchemy queries for the senior read endpoints. No rules or authorization here."""

import uuid
from datetime import date

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.modules.alerts.models import Alert
from app.modules.checkins.models import Checkin
from app.modules.family.models import FamilyInteraction
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors.models import (
    Senior, SeniorBaseline, SeniorCondition, SeniorContact, SeniorHealthProfile,
)
from app.modules.voice.models import Call, SeniorMemoryItem


def _like(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def list_seniors(db: Session, scope_filters: list, *, on_date: date, q: str | None,
                 risk_level: str | None, city: str | None, coordinator_id: uuid.UUID | None,
                 consent_level: str | None, sort: str, limit: int, offset: int):
    """Returns (rows, total). Row: (Senior, full_name, risk_score, risk_level, open_alert_id, last_contact_at)."""
    open_alert = (select(Alert.alert_id)
                  .where(Alert.senior_id == Senior.senior_id, Alert.status != "RESOLVED")
                  .order_by(Alert.created_at.desc()).limit(1).scalar_subquery())
    last_checkin = (select(func.max(Checkin.at))
                    .where(Checkin.senior_id == Senior.senior_id).scalar_subquery())
    last_call = (select(func.max(Call.started_at))
                 .where(Call.senior_id == Senior.senior_id, Call.status == "completed",
                        Call.started_at.is_not(None)).scalar_subquery())
    last_contact = case(
        (last_checkin.is_(None), last_call),
        (last_call.is_(None), last_checkin),
        (last_checkin > last_call, last_checkin),
        else_=last_call,
    )

    stmt = (select(Senior, SeniorContact.full_name, DailyRiskScore.risk_score,
                   DailyRiskScore.risk_level, open_alert.label("open_alert_id"),
                   last_contact.label("last_contact_at"))
            .outerjoin(SeniorContact, SeniorContact.senior_id == Senior.senior_id)
            .outerjoin(DailyRiskScore, and_(DailyRiskScore.senior_id == Senior.senior_id,
                                            DailyRiskScore.date == on_date))
            .where(*scope_filters))
    if q:
        stmt = stmt.where(or_(Senior.senior_id.ilike(_like(q), escape="\\"),
                              SeniorContact.full_name.ilike(_like(q), escape="\\")))
    if risk_level:
        stmt = stmt.where(DailyRiskScore.risk_level == risk_level)
    if city:
        stmt = stmt.where(Senior.city == city)
    if coordinator_id:
        stmt = stmt.where(Senior.coordinator_id == coordinator_id)
    if consent_level:
        stmt = stmt.where(Senior.family_consent_level == consent_level)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    if sort == "name":
        order = [SeniorContact.full_name.asc(), Senior.senior_id.asc()]
    elif sort == "last_contact":  # least recently contacted first
        order = [last_contact.asc().nulls_first(), Senior.senior_id.asc()]
    else:  # risk
        order = [DailyRiskScore.risk_score.desc().nulls_last(), Senior.senior_id.asc()]
    rows = db.execute(stmt.order_by(*order).limit(limit).offset(offset)).all()
    return rows, total


def get_contact(db: Session, senior_id: str) -> SeniorContact | None:
    return db.get(SeniorContact, senior_id)


def list_conditions(db: Session, senior_id: str) -> list[SeniorCondition]:
    return list(db.scalars(select(SeniorCondition).where(SeniorCondition.senior_id == senior_id)
                           .order_by(SeniorCondition.category, SeniorCondition.condition)))


def get_health_profile(db: Session, senior_id: str) -> SeniorHealthProfile | None:
    return db.get(SeniorHealthProfile, senior_id)


def get_baseline(db: Session, senior_id: str) -> SeniorBaseline | None:
    return db.get(SeniorBaseline, senior_id)


def list_risk_history(db: Session, senior_id: str, date_from: date | None, date_to: date | None,
                      limit: int) -> list[DailyRiskScore]:
    stmt = select(DailyRiskScore).where(DailyRiskScore.senior_id == senior_id)
    if date_from:
        stmt = stmt.where(DailyRiskScore.date >= date_from)
    if date_to:
        stmt = stmt.where(DailyRiskScore.date <= date_to)
    rows = list(db.scalars(stmt.order_by(DailyRiskScore.date.desc()).limit(limit)))
    rows.reverse()  # oldest first, ready for charts
    return rows


def list_calls(db: Session, senior_id: str, limit: int, offset: int,
               kind: str | None = None) -> tuple[list[Call], int]:
    base = select(Call).where(Call.senior_id == senior_id)
    if kind:
        base = base.where(Call.kind == kind)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(db.scalars(base.order_by(Call.started_at.desc().nulls_last(), Call.id)
                           .limit(limit).offset(offset)))
    return rows, total


def list_open_memory(db: Session, senior_id: str) -> list[SeniorMemoryItem]:
    return list(db.scalars(select(SeniorMemoryItem)
                           .where(SeniorMemoryItem.senior_id == senior_id,
                                  SeniorMemoryItem.status == "open")
                           .order_by(SeniorMemoryItem.last_seen_at.desc())))


def list_family_interactions(db: Session, senior_id: str, limit: int, offset: int) -> list[FamilyInteraction]:
    return list(db.scalars(select(FamilyInteraction).where(FamilyInteraction.senior_id == senior_id)
                           .order_by(FamilyInteraction.at.desc()).limit(limit).offset(offset)))
