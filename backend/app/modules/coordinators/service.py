"""Priority lists: who needs attention today, and why.

A list is one revision of a coordinator's ranked day; every AI call or new alert appends a new
revision (with previous_rank) and the API always serves the highest revision for the date.
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import today as demo_today
from app.core.exceptions import AppError, NotFound
from app.modules.alerts.notifier import safe_notify
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.coordinators import repository as repo
from app.modules.coordinators.models import PriorityList
from app.modules.coordinators.schemas import PriorityItemOut, SeniorBrief, TodayOut
from app.modules.risk import repository as risk_repo
from app.modules.risk import service as risk_service

TOP_N = 25
MAX_REASONS = 3
NOTHING_UNUSUAL = "Nothing unusual in the recent data"


def build_priority_lists(db: Session, on_date: date, reason: str = "morning_build",
                         coordinator_ids: list[uuid.UUID] | None = None,
                         ai_done_seniors: set[str] | None = None) -> list[PriorityList]:
    """Write the next revision of the priority list for each coordinator (all if none given).

    Seniors without a score for the date are scored first. A repeated "morning_build" is
    idempotent: revision 1 is rebuilt in place, and nothing happens once later revisions exist.
    """
    if coordinator_ids is None:
        coordinator_ids = list(db.scalars(select(User.id).where(User.role == "coordinator", User.is_active.is_(True))
                                          .order_by(User.external_ref)))
    if not coordinator_ids:
        return []
    caseloads = repo.seniors_by_coordinator(db, coordinator_ids, on_date)
    all_ids = [sid for ids in caseloads.values() for sid in ids]
    scores = risk_repo.get_scores(db, all_ids, on_date)
    missing = [sid for sid in all_ids if sid not in scores]
    if missing:
        risk_service.score_and_alert(db, missing, on_date)
        scores = risk_repo.get_scores(db, all_ids, on_date)
    open_alerts = risk_repo.open_alert_ids(db, all_ids)
    ai_done = repo.ai_call_done_ids(db, all_ids, on_date) | (ai_done_seniors or set())
    latest = repo.latest_lists(db, coordinator_ids, on_date)
    prev_items = repo.items_of(db, [pl.id for pl in latest.values()])

    if reason == "morning_build":
        repo.clear_items(db, [pl.id for pl in latest.values() if pl.revision == 1 and pl.reason == "morning_build"])

    built: list[PriorityList] = []
    for cid in coordinator_ids:
        prev = latest.get(cid)
        if reason == "morning_build" and prev is not None:
            if prev.revision == 1 and prev.reason == "morning_build":
                target, previous_rank = prev, {}
            else:
                built.append(prev)
                continue
        else:
            target = repo.new_list(db, cid, on_date, (prev.revision + 1) if prev else 1, reason)
            previous_rank = {i.senior_id: i.rank for i in prev_items.get(prev.id, [])} if prev else {}
        ranked = sorted((scores[sid] for sid in caseloads[cid] if sid in scores),
                        key=lambda s: (-s.risk_score, s.senior_id))[:TOP_N]
        for rank, sc in enumerate(ranked, start=1):
            evidence = [f["evidence"] for f in (sc.top_factors or []) if f.get("evidence")][:MAX_REASONS]
            repo.add_item(db, list_id=target.id, rank=rank, senior_id=sc.senior_id, risk_score=sc.risk_score,
                          risk_level=sc.risk_level, reasons=evidence or [NOTHING_UNUSUAL],
                          suggested_action=sc.recommended_action, alert_id=open_alerts.get(sc.senior_id),
                          ai_call_done=sc.senior_id in ai_done, previous_rank=previous_rank.get(sc.senior_id))
        built.append(target)
        if reason != "morning_build":
            safe_notify(db, cid, "priority_list_updated", "Your list was updated",
                        "Your priority list for today has changed. Open the app to see it.",
                        {"date": on_date.isoformat()})
    db.commit()
    return built


def _render(db: Session, pl: PriorityList) -> TodayOut:
    items = repo.items_of(db, [pl.id])[pl.id]
    summaries = repo.senior_summaries(db, [i.senior_id for i in items])
    return TodayOut(
        date=pl.list_date, revision=pl.revision, reason=pl.reason, generated_at=pl.created_at,
        items=[PriorityItemOut(rank=i.rank, previous_rank=i.previous_rank,
                               senior=SeniorBrief(**summaries[i.senior_id]), risk_score=i.risk_score,
                               risk_level=i.risk_level, reasons=list(i.reasons or []),
                               suggested_action=i.suggested_action, alert_id=i.alert_id,
                               ai_call_done=i.ai_call_done) for i in items])


def get_today(db: Session, user: User, on_date: date | None, coordinator_id: uuid.UUID | None = None) -> TodayOut:
    """The highest revision for the date; builds revision 1 on the fly if none exists yet."""
    on_date = on_date or demo_today()
    if user.role == "admin":
        if coordinator_id is None:
            raise AppError("coordinator_id is required for admin users", code="validation_error",
                           status_code=422)
        coordinator = db.get(User, coordinator_id)
        if coordinator is None or coordinator.role != "coordinator":
            raise NotFound("Coordinator not found")
        cid = coordinator.id
    else:
        cid = user.id
    pl = repo.latest_lists(db, [cid], on_date).get(cid)
    if pl is None:
        built = build_priority_lists(db, on_date, "morning_build", [cid])
        pl = built[0]
    audit(db, user, "priority_list.view", None, {"date": on_date.isoformat(), "coordinator_id": str(cid)})
    db.commit()
    return _render(db, pl)
