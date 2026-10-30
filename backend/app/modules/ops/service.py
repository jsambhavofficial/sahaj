"""Ops dashboard rules: city scoping, date ranges and metric assembly."""

import logging
import statistics
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import today
from app.core.exceptions import AppError, Forbidden, NotFound
from app.jobs import registry
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.ops import repository
from app.modules.seniors import service as seniors_service
from app.modules.seniors.models import Senior

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))


# ---- scope and ranges ------------------------------------------------------------------------

def senior_conds(user: User, city: str | None = None, coordinator_id: uuid.UUID | None = None) -> list:
    """Senior conditions: the caller's scope, narrowed (never widened) by optional filters."""
    conds = list(scope.senior_filters(user))
    if city:
        conds.append(Senior.city == city)
    if coordinator_id:
        conds.append(Senior.coordinator_id == coordinator_id)
    return conds


def user_conds(user: User, city: str | None = None, coordinator_id: uuid.UUID | None = None) -> list:
    """Conditions over `User` (coordinators) with the same city scoping."""
    conds = []
    if user.role == "ops" and user.city:
        conds.append(User.city == user.city)
    if city:
        conds.append(User.city == city)
    if coordinator_id:
        conds.append(User.id == coordinator_id)
    return conds


def resolve_range(date_from: date | None, date_to: date | None) -> tuple[date, date, datetime, datetime]:
    """(from, to, start, end): inclusive dates, [start, end) India-time datetimes. Default 30 days."""
    end_date = date_to or today()
    start_date = date_from or end_date - timedelta(days=29)
    if start_date > end_date:
        raise AppError("'from' must not be after 'to'", code="validation_error", status_code=422)
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=IST)
    end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=IST)
    return start_date, end_date, start, end


def _local(dt: datetime) -> datetime:
    return dt.astimezone(IST) if dt.tzinfo else dt


def _minutes(later: datetime | None, earlier: datetime) -> float | None:
    if later is None:
        return None
    if (later.tzinfo is None) != (earlier.tzinfo is None):
        later, earlier = later.replace(tzinfo=None), earlier.replace(tzinfo=None)
    return round((later - earlier).total_seconds() / 60.0, 1)


def _median(values: list[float]) -> float | None:
    return round(statistics.median(values), 1) if values else None


# ---- alerts ----------------------------------------------------------------------------------

def _response_times(rows) -> list[dict]:
    return [{
        "alert_id": r.alert_id, "city": r.city, "coordinator_id": r.coordinator_id,
        "severity": r.severity, "created_at": r.created_at,
        "minutes_to_ack": _minutes(r.first_ack_at, r.created_at),
        "minutes_to_resolve": _minutes(r.resolved_at, r.created_at),
    } for r in rows]


def overview(db: Session, user: User, date_from, date_to, city, coordinator_id) -> dict:
    _, _, start, end = resolve_range(date_from, date_to)
    sc = senior_conds(user, city, coordinator_id)
    rt = _response_times(repository.alert_response_rows(db, sc, start, end))
    fb = repository.feedback_rows(db, sc, start, end)
    ai_total, ai_done = repository.ai_call_counts(db, sc, start, end)
    return {
        "open_alerts": repository.count_open_alerts(db, sc),
        "alerts_in_range": repository.count_alerts_in_range(db, sc, start, end),
        "median_minutes_to_ack": _median([r["minutes_to_ack"] for r in rt if r["minutes_to_ack"] is not None]),
        "median_minutes_to_resolve": _median(
            [r["minutes_to_resolve"] for r in rt if r["minutes_to_resolve"] is not None]),
        "useful_share": round(sum(1 for f in fb if f.useful) / len(fb), 3) if fb else None,
        "ai_call_completion_rate": round(ai_done / ai_total, 3) if ai_total else None,
        "seniors_covered": repository.seniors_covered(db, sc, start, end),
        "seniors_total": repository.count_seniors(db, sc),
    }


def alert_volume(db: Session, user: User, date_from, date_to, city, coordinator_id) -> list[dict]:
    _, _, start, end = resolve_range(date_from, date_to)
    rows = repository.alert_volume_rows(db, senior_conds(user, city, coordinator_id), start, end)
    counts = Counter((_local(r.created_at).date(), r.city, r.severity, r.status) for r in rows)
    return [{"day": d, "city": c, "severity": sev, "status": st, "alerts": n}
            for (d, c, sev, st), n in sorted(counts.items())]


def response_times(db: Session, user: User, date_from, date_to, city, coordinator_id, limit) -> list[dict]:
    _, _, start, end = resolve_range(date_from, date_to)
    return _response_times(repository.alert_response_rows(
        db, senior_conds(user, city, coordinator_id), start, end, limit))


def outcomes(db: Session, user: User, date_from, date_to, city, coordinator_id) -> list[dict]:
    _, _, start, end = resolve_range(date_from, date_to)
    rows = repository.alert_outcome_rows(db, senior_conds(user, city, coordinator_id), start, end)
    groups: dict[tuple, set] = defaultdict(set)
    for r in rows:
        groups[(r.city, r.resolution_reason, r.useful, r.outcome)].add(r.alert_id)
    key = lambda k: tuple("" if v is None else str(v) for v in k)  # noqa: E731
    return [{"city": c, "resolution_reason": rr, "useful": u, "outcome": o, "alerts": len(ids)}
            for (c, rr, u, o), ids in sorted(groups.items(), key=lambda kv: key(kv[0]))]


def precision(db: Session, user: User, date_from, date_to, city, coordinator_id) -> list[dict]:
    _, _, start, end = resolve_range(date_from, date_to)
    rows = repository.feedback_rows(db, senior_conds(user, city, coordinator_id), start, end)
    rated: Counter = Counter()
    useful: Counter = Counter()
    for r in rows:
        d = _local(r.at).date()
        key = (r.city, d - timedelta(days=d.weekday()))
        rated[key] += 1
        useful[key] += 1 if r.useful else 0
    return [{"city": c, "week_start": w, "rated_alerts": n, "useful_alerts": useful[(c, w)],
             "precision": round(useful[(c, w)] / n, 3) if n else None}
            for (c, w), n in sorted(rated.items(), key=lambda kv: (kv[0][1], kv[0][0]))]


# ---- coordinators ----------------------------------------------------------------------------

def _coordinator_row(row) -> dict:
    u, caseload, open_alerts, handled, calls, msgs = row
    return {"coordinator_id": u.id, "display_name": u.display_name, "city": u.city,
            "caseload": caseload or 0, "open_alerts": open_alerts or 0,
            "alerts_handled": handled or 0, "calls": calls or 0, "messages_sent": msgs or 0}


def list_coordinators(db: Session, user: User, date_from, date_to, city, coordinator_id) -> list[dict]:
    _, _, start, end = resolve_range(date_from, date_to)
    rows = repository.list_coordinators(db, user_conds(user, city, coordinator_id), start, end)
    return [_coordinator_row(r) for r in rows]


def coordinator_detail(db: Session, user: User, coordinator_id: uuid.UUID, date_from, date_to) -> dict:
    _, _, start, end = resolve_range(date_from, date_to)
    row = repository.get_coordinator(db, coordinator_id, start, end)
    if row is None:
        raise NotFound("Coordinator not found")
    if user.role == "ops" and user.city and row[0].city != user.city:
        raise Forbidden("You do not have access to this coordinator")
    raw = repository.coordinator_daily(db, coordinator_id, start, end)
    days: dict[date, dict] = defaultdict(lambda: {"alert_actions": 0, "calls": 0, "messages_sent": 0})
    for key, field in (("events", "alert_actions"), ("calls", "calls"), ("messages", "messages_sent")):
        for at in raw[key]:
            days[_local(at).date()][field] += 1
    detail = _coordinator_row(row)
    detail["daily"] = [{"day": d, **v} for d, v in sorted(days.items())]
    return detail


# ---- seniors, cities -------------------------------------------------------------------------

def list_seniors(db: Session, user: User, *, on_date: date, q, risk_level, city, coordinator_id,
                 consent_level, sort, limit, offset) -> tuple[list[dict], int]:
    items, total = seniors_service.list_senior_items(
        db, user, on_date=on_date, q=q, risk_level=risk_level, city=city,
        coordinator_id=coordinator_id, consent_level=consent_level, sort=sort,
        limit=limit, offset=offset)
    names = repository.coordinator_names(db, list({i["coordinator_id"] for i in items}))
    for i in items:
        i["coordinator_name"] = names.get(i["coordinator_id"])
    return items, total


def senior_detail(db: Session, user: User, senior_id: str) -> dict:
    return seniors_service.get_senior_detail(db, user, senior_id)  # authorizes and audit-logs


def cities(db: Session, user: User, on_date: date, city, coordinator_id) -> list[dict]:
    rows = repository.city_rollup(db, senior_conds(user, city, coordinator_id), on_date)
    return [{"city": c, "seniors": n, "coordinators": coords, "open_alerts": int(open_alerts or 0),
             "avg_risk": round(float(avg), 1) if avg is not None else None,
             "high_risk_count": int(high or 0)} for c, n, coords, open_alerts, avg, high in rows]


# ---- daily report ----------------------------------------------------------------------------

def daily_report(db: Session, user: User, on_date: date, city, coordinator_id) -> list[dict]:
    lists = repository.priority_lists_for_date(db, user_conds(user, city, coordinator_id), on_date)
    latest: dict[uuid.UUID, tuple] = {}
    for pl, coord in lists:  # ordered by revision ascending, so the last one wins
        latest[coord.id] = (pl, coord)
    items = repository.priority_items(db, [pl.id for pl, _ in latest.values()],
                                      senior_conds(user, city, None))
    by_list: dict[uuid.UUID, list] = defaultdict(list)
    for list_id, item, senior, full_name in items:
        by_list[list_id].append({
            "rank": item.rank, "previous_rank": item.previous_rank,
            "senior": {"senior_id": senior.senior_id, "display_name": full_name, "age": senior.age,
                       "city": senior.city, "preferred_language": senior.preferred_language},
            "risk_score": item.risk_score, "risk_level": item.risk_level,
            "reasons": item.reasons or [], "suggested_action": item.suggested_action,
            "alert_id": item.alert_id, "ai_call_done": bool(item.ai_call_done)})
    out = [{"coordinator": {"id": coord.id, "display_name": coord.display_name, "city": coord.city},
            "revision": pl.revision, "items": by_list.get(pl.id, [])}
           for pl, coord in latest.values()]
    return sorted(out, key=lambda e: (e["coordinator"]["display_name"], str(e["coordinator"]["id"])))


# ---- admin jobs ------------------------------------------------------------------------------

def run_job(db: Session, user: User, name: str, on_date: date) -> dict:
    if name not in registry.JOBS:
        raise NotFound(f"Unknown job: {name}")
    try:
        registry.run_job(name, db, on_date)
        audit(db, user, "run_job", None, {"job": name, "date": on_date.isoformat()})
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Job %s failed", name)
        raise AppError("The job failed; changes were rolled back", code="internal_error",
                       status_code=500)
    return {"job": name, "date": on_date, "status": "ok"}
