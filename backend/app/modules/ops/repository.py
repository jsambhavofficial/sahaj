"""SQLAlchemy queries for the ops dashboard. No rules or authorization here.

The v_ops_* Postgres views are re-expressed on the base tables so the same code runs on SQLite
(tests) and Postgres. `sconds` is a list of conditions over `Senior` (scope, city, coordinator).
"""

import uuid
from datetime import date, datetime

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.modules.alerts.models import Alert, AlertEvent, AlertFeedback
from app.modules.auth.models import User
from app.modules.checkins.models import Checkin
from app.modules.messages.models import Message
from app.modules.coordinators.models import PriorityList, PriorityListItem
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors.models import Senior, SeniorContact
from app.modules.voice.models import Call


def _in_range(col, start: datetime | None, end: datetime | None) -> list:
    conds = []
    if start is not None:
        conds.append(col >= start)
    if end is not None:
        conds.append(col < end)
    return conds


def count_seniors(db: Session, sconds: list) -> int:
    return db.scalar(select(func.count()).select_from(Senior).where(*sconds)) or 0


def count_open_alerts(db: Session, sconds: list) -> int:
    return db.scalar(select(func.count()).select_from(Alert)
                     .join(Senior, Senior.senior_id == Alert.senior_id)
                     .where(Alert.status != "RESOLVED", *sconds)) or 0


def count_alerts_in_range(db: Session, sconds: list, start, end) -> int:
    return db.scalar(select(func.count()).select_from(Alert)
                     .join(Senior, Senior.senior_id == Alert.senior_id)
                     .where(*sconds, *_in_range(Alert.created_at, start, end))) or 0


def alert_response_rows(db: Session, sconds: list, start, end, limit: int | None = None) -> list:
    """v_ops_alert_response: rows (alert_id, city, coordinator_id, severity, status, created_at,
    first_ack_at, resolved_at), newest first."""
    ack = func.min(case((AlertEvent.to_status == "ACKNOWLEDGED", AlertEvent.at)))
    res = func.min(case((AlertEvent.to_status == "RESOLVED", AlertEvent.at)))
    stmt = (select(Alert.alert_id, Senior.city, Senior.coordinator_id, Alert.severity, Alert.status,
                   Alert.created_at, ack.label("first_ack_at"), res.label("resolved_at"))
            .join(Senior, Senior.senior_id == Alert.senior_id)
            .outerjoin(AlertEvent, AlertEvent.alert_id == Alert.alert_id)
            .where(*sconds, *_in_range(Alert.created_at, start, end))
            .group_by(Alert.alert_id, Senior.city, Senior.coordinator_id, Alert.severity,
                      Alert.status, Alert.created_at)
            .order_by(Alert.created_at.desc(), Alert.alert_id))
    if limit:
        stmt = stmt.limit(limit)
    return list(db.execute(stmt).all())


def alert_volume_rows(db: Session, sconds: list, start, end) -> list:
    """Rows (created_at, city, severity, status), one per alert; grouped by day in the service."""
    return list(db.execute(
        select(Alert.created_at, Senior.city, Alert.severity, Alert.status)
        .join(Senior, Senior.senior_id == Alert.senior_id)
        .where(*sconds, *_in_range(Alert.created_at, start, end))).all())


def alert_outcome_rows(db: Session, sconds: list, start, end) -> list:
    """Rows (alert_id, city, resolution_reason, useful, outcome); one per feedback or one with nulls."""
    return list(db.execute(
        select(Alert.alert_id, Senior.city, Alert.resolution_reason, AlertFeedback.useful,
               AlertFeedback.outcome)
        .join(Senior, Senior.senior_id == Alert.senior_id)
        .outerjoin(AlertFeedback, AlertFeedback.alert_id == Alert.alert_id)
        .where(*sconds, *_in_range(Alert.created_at, start, end))).all())


def feedback_rows(db: Session, sconds: list, start, end) -> list:
    """Rows (at, city, useful) for feedback given in the range."""
    return list(db.execute(
        select(AlertFeedback.at, Senior.city, AlertFeedback.useful)
        .join(Alert, Alert.alert_id == AlertFeedback.alert_id)
        .join(Senior, Senior.senior_id == Alert.senior_id)
        .where(*sconds, *_in_range(AlertFeedback.at, start, end))).all())


def ai_call_counts(db: Session, sconds: list, start, end) -> tuple[int, int]:
    """(ai calls started in range, of which completed)."""
    row = db.execute(
        select(func.count(), func.sum(case((Call.status == "completed", 1), else_=0)))
        .select_from(Call).join(Senior, Senior.senior_id == Call.senior_id)
        .where(Call.kind == "ai_agent", *sconds, *_in_range(Call.started_at, start, end))).one()
    return row[0] or 0, int(row[1] or 0)


def seniors_covered(db: Session, sconds: list, start, end) -> int:
    """Seniors with a completed call or a check-in in the range."""
    called = (select(Call.senior_id).where(Call.status == "completed",
                                           *_in_range(Call.started_at, start, end)))
    checked = select(Checkin.senior_id).where(*_in_range(Checkin.at, start, end))
    return db.scalar(select(func.count()).select_from(Senior).where(
        *sconds, Senior.senior_id.in_(called.union(checked)))) or 0


# ---- coordinators ----------------------------------------------------------------------------

def _coordinator_stmt(start, end):
    caseload = (select(func.count()).select_from(Senior)
                .where(Senior.coordinator_id == User.id).correlate(User).scalar_subquery())
    open_alerts = (select(func.count()).select_from(Alert)
                   .join(Senior, Senior.senior_id == Alert.senior_id)
                   .where(Senior.coordinator_id == User.id, Alert.status != "RESOLVED")
                   .correlate(User).scalar_subquery())
    handled = (select(func.count(func.distinct(AlertEvent.alert_id))).select_from(AlertEvent)
               .where(AlertEvent.actor_user_id == User.id, *_in_range(AlertEvent.at, start, end))
               .correlate(User).scalar_subquery())
    calls = (select(func.count()).select_from(Call)
             .where(Call.coordinator_id == User.id, *_in_range(Call.started_at, start, end))
             .correlate(User).scalar_subquery())
    msgs = (select(func.count()).select_from(Message)
            .where(Message.sender_user_id == User.id, *_in_range(Message.created_at, start, end))
            .correlate(User).scalar_subquery())
    return select(User, caseload.label("caseload"), open_alerts.label("open_alerts"),
                  handled.label("alerts_handled"), calls.label("calls"),
                  msgs.label("messages_sent"))


def list_coordinators(db: Session, uconds: list, start, end) -> list:
    """Rows (User, caseload, open_alerts, alerts_handled, calls, messages_sent)."""
    return list(db.execute(_coordinator_stmt(start, end)
                           .where(User.role == "coordinator", *uconds)
                           .order_by(User.display_name, User.id)).all())


def get_coordinator(db: Session, coordinator_id: uuid.UUID, start, end):
    return db.execute(_coordinator_stmt(start, end)
                      .where(User.id == coordinator_id, User.role == "coordinator")).first()


def coordinator_daily(db: Session, coordinator_id: uuid.UUID, start, end) -> dict:
    """Raw timestamps of the coordinator's actions: {'events': [...], 'calls': [...], 'messages': [...]}."""
    events = db.scalars(select(AlertEvent.at).where(
        AlertEvent.actor_user_id == coordinator_id, *_in_range(AlertEvent.at, start, end))).all()
    calls = db.scalars(select(Call.started_at).where(
        Call.coordinator_id == coordinator_id, Call.started_at.is_not(None),
        *_in_range(Call.started_at, start, end))).all()
    msgs = db.scalars(select(Message.created_at).where(
        Message.sender_user_id == coordinator_id, *_in_range(Message.created_at, start, end))).all()
    return {"events": list(events), "calls": list(calls), "messages": list(msgs)}


def coordinator_names(db: Session, ids: list) -> dict:
    if not ids:
        return {}
    return {u.id: u.display_name for u in db.scalars(select(User).where(User.id.in_(ids)))}


# ---- cities ----------------------------------------------------------------------------------

def city_rollup(db: Session, sconds: list, on_date: date) -> list:
    """Rows (city, seniors, coordinators, open_alerts, avg_risk, high_risk_count)."""
    stmt = (select(Senior.city,
                   func.count(Senior.senior_id),
                   func.count(func.distinct(Senior.coordinator_id)),
                   func.avg(DailyRiskScore.risk_score),
                   func.sum(case((DailyRiskScore.risk_level.in_(("HIGH", "URGENT_REVIEW")), 1),
                                 else_=0)))
            .outerjoin(DailyRiskScore, and_(DailyRiskScore.senior_id == Senior.senior_id,
                                            DailyRiskScore.date == on_date))
            .where(*sconds).group_by(Senior.city).order_by(Senior.city))
    open_by_city = dict(db.execute(
        select(Senior.city, func.count()).select_from(Alert)
        .join(Senior, Senior.senior_id == Alert.senior_id)
        .where(Alert.status != "RESOLVED", *sconds).group_by(Senior.city)).all())
    return [(c, n, coords, open_by_city.get(c, 0), avg, high)
            for c, n, coords, avg, high in db.execute(stmt).all()]


# ---- daily report ----------------------------------------------------------------------------

def priority_lists_for_date(db: Session, uconds: list, on_date: date) -> list:
    """Rows (PriorityList, User), all revisions for the date for coordinators in scope."""
    return list(db.execute(
        select(PriorityList, User).join(User, User.id == PriorityList.coordinator_id)
        .where(PriorityList.list_date == on_date, *uconds)
        .order_by(User.display_name, PriorityList.revision)).all())


def priority_items(db: Session, list_ids: list, sconds: list) -> list:
    """Rows (list_id, PriorityListItem, Senior, full_name) restricted to seniors in scope."""
    if not list_ids:
        return []
    return list(db.execute(
        select(PriorityListItem.list_id, PriorityListItem, Senior, SeniorContact.full_name)
        .join(Senior, Senior.senior_id == PriorityListItem.senior_id)
        .outerjoin(SeniorContact, SeniorContact.senior_id == Senior.senior_id)
        .where(PriorityListItem.list_id.in_(list_ids), *sconds)
        .order_by(PriorityListItem.rank)).all())
