"""Alert lifecycle rules.

One unresolved alert per senior. Severity follows the risk level; an existing alert is only
escalated when the level goes UP, a lower or equal level just refreshes the reasons (no repeat
alert). An alert resolves itself after N consecutive low days, and a recently resolved alert
suppresses a new one for a cooldown unless things are clearly worse or a new safety event appears.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import today
from app.core.exceptions import Conflict, NotFound
from app.modules.alerts import repository as repo
from app.modules.alerts.models import Alert, AlertFeedback
from app.modules.alerts.notifier import safe_notify
from app.modules.alerts.schemas import (
    AcknowledgeBody, AlertDetail, AlertEventOut, AlertOut, AlertPage, EscalateBody, FeedbackBody,
    ResolveBody,
)
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.risk import repository as risk_repo
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors.models import Senior

IST = ZoneInfo("Asia/Kolkata")
ALERT_MIN_SCORE = 50  # HIGH and above raise an alert (fewer, better alerts); safety tripwires always do
AUTO_RESOLVE_DAYS = 3
COOLDOWN_HOURS = 48
SEVERITY_RANK = {"MODERATE": 1, "HIGH": 2, "URGENT_REVIEW": 3}

# action -> (statuses it may start from, resulting status)
TRANSITIONS = {
    "acknowledge": ({"OPEN", "ESCALATED"}, "ACKNOWLEDGED"),
    "escalate": ({"OPEN", "ACKNOWLEDGED"}, "ESCALATED"),
    "resolve": ({"OPEN", "ACKNOWLEDGED", "ESCALATED"}, "RESOLVED"),
}


def now_ist() -> datetime:
    return datetime.now(IST)


def stamp_for(on_date: date) -> datetime:
    """Timestamp for system changes made while scoring `on_date`: now for the current (demo) day
    or later, otherwise 06:00 India time on that day (so back-filled history stays in order)."""
    if on_date >= today():
        return now_ist()
    return datetime(on_date.year, on_date.month, on_date.day, 6, 0, tzinfo=IST)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=IST)


def is_alert_worthy(score: int, top_factors: list[dict]) -> bool:
    return score >= ALERT_MIN_SCORE or any(f.get("is_safety_tripwire") for f in top_factors)


@dataclass
class AlertContext:
    """Preloaded state so a batch of seniors needs a handful of queries, not hundreds."""

    unresolved: dict[str, Alert] = field(default_factory=dict)
    last_resolved: dict[str, Alert] = field(default_factory=dict)
    recent_scores: dict[str, list[DailyRiskScore]] = field(default_factory=dict)


def build_context(db: Session, senior_ids: list[str], on_date: date) -> AlertContext:
    return AlertContext(
        unresolved=repo.unresolved_by_senior(db, senior_ids),
        last_resolved=repo.last_resolved_by_senior(db, senior_ids),
        recent_scores=risk_repo.recent_scores(db, senior_ids, on_date, AUTO_RESOLVE_DAYS))


@dataclass
class AlertChange:
    alert: Alert | None
    action: str | None  # created / escalated / resolved / refreshed / suppressed / None


def _signals(score: DailyRiskScore) -> list[str]:
    return [f["evidence"] for f in (score.top_factors or []) if f.get("evidence")]


def _sustained_low(ctx: AlertContext, senior_id: str, on_date: date) -> bool:
    rows = {r.date: r for r in ctx.recent_scores.get(senior_id, [])}
    for i in range(AUTO_RESOLVE_DAYS):
        r = rows.get(on_date - timedelta(days=i))
        if r is None or is_alert_worthy(r.risk_score, r.top_factors or []):
            return False
    return True


def apply_score(db: Session, senior: Senior, score: DailyRiskScore, on_date: date,
                ctx: AlertContext) -> AlertChange:
    """Create, escalate, refresh or auto-resolve the senior's alert for today's score."""
    sid = senior.senior_id
    active = ctx.unresolved.get(sid)
    at = stamp_for(on_date)
    factors = score.top_factors or []
    worthy = is_alert_worthy(score.risk_score, factors)
    signals = _signals(score)

    if not worthy:
        if active is not None and _sustained_low(ctx, sid, on_date):
            old = active.status
            active.status, active.last_updated_at = "RESOLVED", at
            active.resolution_reason = f"Auto-resolved: risk stayed low for {AUTO_RESOLVE_DAYS} days in a row"
            repo.add_event(db, active.alert_id, None, old, "RESOLVED", active.resolution_reason, at)
            ctx.last_resolved[sid] = active
            del ctx.unresolved[sid]
            return AlertChange(active, "resolved")
        return AlertChange(active, None)

    severity = score.risk_level if score.risk_level in SEVERITY_RANK else "MODERATE"

    if active is None:
        old = ctx.last_resolved.get(sid)
        if old is not None and _in_cooldown(old, severity, factors, at):
            return AlertChange(None, "suppressed")
        alert = Alert(senior_id=sid, created_at=at, last_updated_at=at, status="OPEN",
                      severity=severity, triggering_signals=signals,
                      recommended_next_step=score.recommended_action or "Call and check how they are.")
        db.add(alert)
        db.flush()
        repo.add_event(db, alert.alert_id, None, None, "OPEN", "Created by daily risk scoring", at)
        ctx.unresolved[sid] = alert
        safe_notify(db, senior.coordinator_id, "alert_new", "New alert",
                    "A senior in your caseload needs attention. Open the app to review.",
                    {"alert_id": alert.alert_id})
        return AlertChange(alert, "created")

    if SEVERITY_RANK[severity] > SEVERITY_RANK.get(active.severity, 0):
        old = active.status
        active.severity, active.status, active.last_updated_at = severity, "ESCALATED", at
        active.triggering_signals, active.recommended_next_step = signals, score.recommended_action or active.recommended_next_step
        repo.add_event(db, active.alert_id, None, old, "ESCALATED",
                       "Risk level increased to " + severity.replace("_", " ").lower(), at)
        safe_notify(db, senior.coordinator_id, "alert_escalated", "Alert escalated",
                    "An alert in your caseload became more serious. Open the app to review.",
                    {"alert_id": active.alert_id})
        return AlertChange(active, "escalated")

    # Same or lower severity: keep the single alert, refresh the reasons only if they changed.
    if signals != list(active.triggering_signals or []):
        active.triggering_signals = signals
        active.recommended_next_step = score.recommended_action or active.recommended_next_step
        active.last_updated_at = at
        return AlertChange(active, "refreshed")
    return AlertChange(active, None)


def _in_cooldown(resolved: Alert, severity: str, factors: list[dict], at: datetime) -> bool:
    if at - _aware(resolved.last_updated_at) >= timedelta(hours=COOLDOWN_HOURS):
        return False
    if SEVERITY_RANK[severity] > SEVERITY_RANK.get(resolved.severity, 0):
        return False
    old_signals = set(resolved.triggering_signals or [])
    new_tripwire = any(f.get("is_safety_tripwire") and f.get("evidence") not in old_signals for f in factors)
    return not new_tripwire


# ---------------------------------------------------------------- API-facing operations


def _to_detail(db: Session, alert: Alert) -> AlertDetail:
    events = [AlertEventOut(at=e.at, from_status=e.from_status, to_status=e.to_status,
                            actor=name if e.actor_user_id else "System", note=e.note)
              for e, name in repo.events_for(db, alert.alert_id)]
    return AlertDetail(**AlertOut.model_validate(alert).model_dump(), events=events)


def _load_for_user(db: Session, user: User, alert_id: str) -> Alert:
    alert = repo.get_alert(db, alert_id)
    if alert is None:
        raise NotFound("Alert not found")
    scope.require_senior_access(db, user, alert.senior_id)
    return alert


def list_alerts(db: Session, user: User, *, status, severity, senior_id, limit: int, offset: int) -> AlertPage:
    if senior_id:
        scope.require_senior_access(db, user, senior_id)
    rows, total = repo.list_alerts(db, senior_conditions=scope.senior_filters(user), status=status,
                                   severity=severity, senior_id=senior_id, limit=limit, offset=offset)
    return AlertPage(items=[AlertOut.model_validate(a) for a in rows], total=total, limit=limit, offset=offset)


def get_alert(db: Session, user: User, alert_id: str) -> AlertDetail:
    alert = _load_for_user(db, user, alert_id)
    audit(db, user, "alert.view", alert.senior_id, {"alert_id": alert.alert_id})
    db.commit()
    return _to_detail(db, alert)


def _transition(db: Session, user: User, alert_id: str, action: str, note: str | None,
                reason: str | None = None) -> AlertDetail:
    alert = _load_for_user(db, user, alert_id)
    allowed_from, new_status = TRANSITIONS[action]
    if alert.status not in allowed_from:
        raise Conflict(f"Cannot {action} an alert that is {alert.status}")
    at, old = now_ist(), alert.status
    alert.status, alert.last_updated_at = new_status, at
    if action == "acknowledge":
        alert.assigned_to = user.id
    if action == "resolve":
        alert.resolution_reason = reason
    repo.add_event(db, alert.alert_id, user.id, old, new_status, note or reason if action == "resolve" else note, at)
    audit(db, user, f"alert.{action}", alert.senior_id, {"alert_id": alert.alert_id, "to": new_status})
    db.commit()
    return _to_detail(db, alert)


def acknowledge(db: Session, user: User, alert_id: str, body: AcknowledgeBody) -> AlertDetail:
    return _transition(db, user, alert_id, "acknowledge", body.note)


def escalate(db: Session, user: User, alert_id: str, body: EscalateBody) -> AlertDetail:
    return _transition(db, user, alert_id, "escalate", body.note)


def resolve(db: Session, user: User, alert_id: str, body: ResolveBody) -> AlertDetail:
    return _transition(db, user, alert_id, "resolve", body.note, body.resolution_reason)


def give_feedback(db: Session, user: User, alert_id: str, body: FeedbackBody) -> AlertFeedback:
    """One rating per coordinator and alert; sending again updates it. Feeds v_ops_alert_precision."""
    alert = _load_for_user(db, user, alert_id)
    row = repo.get_feedback(db, alert.alert_id, user.id)
    if row is None:
        row = repo.add_feedback(db, alert_id=alert.alert_id, coordinator_id=user.id, useful=body.useful,
                                outcome=body.outcome, comment=body.comment, at=now_ist())
    else:
        row.useful, row.outcome, row.comment, row.at = body.useful, body.outcome, body.comment, now_ist()
    audit(db, user, "alert.feedback", alert.senior_id, {"alert_id": alert.alert_id, "useful": body.useful})
    db.commit()
    db.refresh(row)
    return row
