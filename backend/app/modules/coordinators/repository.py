"""Priority-list queries only."""

import uuid
from datetime import date

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.modules.coordinators.models import PriorityList, PriorityListItem
from app.modules.risk.repository import IST, day_start
from app.modules.seniors.models import Senior, SeniorContact
from app.modules.voice.models import Call
from datetime import timedelta


def seniors_by_coordinator(db: Session, coordinator_ids: list[uuid.UUID], on_date: date) -> dict[uuid.UUID, list[str]]:
    out: dict[uuid.UUID, list[str]] = {cid: [] for cid in coordinator_ids}
    q = select(Senior.coordinator_id, Senior.senior_id).where(
        Senior.coordinator_id.in_(coordinator_ids), Senior.is_active.is_(True),
        (Senior.enrollment_date.is_(None)) | (Senior.enrollment_date <= on_date)).order_by(Senior.senior_id)
    for cid, sid in db.execute(q):
        out[cid].append(sid)
    return out


def ai_call_done_ids(db: Session, senior_ids: list[str], on_date: date) -> set[str]:
    if not senior_ids:
        return set()
    start, end = day_start(on_date), day_start(on_date + timedelta(days=1))
    return set(db.scalars(select(Call.senior_id).where(
        Call.senior_id.in_(senior_ids), Call.kind == "ai_agent", Call.status == "completed",
        Call.started_at >= start, Call.started_at < end).distinct()))


def latest_lists(db: Session, coordinator_ids: list[uuid.UUID], on_date: date) -> dict[uuid.UUID, PriorityList]:
    """Highest revision per coordinator for the date."""
    latest = (select(PriorityList.coordinator_id, func.max(PriorityList.revision).label("rev"))
              .where(PriorityList.coordinator_id.in_(coordinator_ids), PriorityList.list_date == on_date)
              .group_by(PriorityList.coordinator_id).subquery())
    rows = db.scalars(select(PriorityList).join(
        latest, (PriorityList.coordinator_id == latest.c.coordinator_id) & (PriorityList.revision == latest.c.rev))
        .where(PriorityList.list_date == on_date))
    return {r.coordinator_id: r for r in rows}


def items_of(db: Session, list_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[PriorityListItem]]:
    out: dict[uuid.UUID, list[PriorityListItem]] = {i: [] for i in list_ids}
    if list_ids:
        for it in db.scalars(select(PriorityListItem).where(PriorityListItem.list_id.in_(list_ids))
                             .order_by(PriorityListItem.rank)):
            out[it.list_id].append(it)
    return out


def new_list(db: Session, coordinator_id: uuid.UUID, on_date: date, revision: int, reason: str) -> PriorityList:
    # Client-side id and no flush: the list and its items are inserted together in one batch, which
    # matters on a remote database where every round trip costs ~300 ms.
    pl = PriorityList(id=uuid.uuid4(), coordinator_id=coordinator_id, list_date=on_date,
                      revision=revision, reason=reason)
    db.add(pl)
    return pl


def clear_items(db: Session, list_ids: list[uuid.UUID]) -> None:
    if list_ids:
        db.execute(delete(PriorityListItem).where(PriorityListItem.list_id.in_(list_ids)))
        db.flush()


def add_item(db: Session, **fields) -> PriorityListItem:
    it = PriorityListItem(**fields)
    db.add(it)
    return it


def senior_summaries(db: Session, senior_ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    if senior_ids:
        rows = db.execute(select(Senior.senior_id, Senior.age, Senior.city, Senior.preferred_language,
                                 SeniorContact.full_name)
                          .outerjoin(SeniorContact, SeniorContact.senior_id == Senior.senior_id)
                          .where(Senior.senior_id.in_(senior_ids)))
        for sid, age, city, lang, name in rows:
            out[sid] = {"senior_id": sid, "display_name": name or sid, "age": age, "city": city,
                        "preferred_language": lang}
    return out
