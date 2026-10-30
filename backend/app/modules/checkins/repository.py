import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.checkins.models import Checkin, NlpCue
from app.modules.messages.models import Message
from app.modules.voice.models import Call

MAX_CUES = 5000  # a senior has tens of cues; this only guards against runaway data


def list_cues(db: Session, senior_id: str) -> list[NlpCue]:
    return list(db.scalars(select(NlpCue).where(NlpCue.senior_id == senior_id).limit(MAX_CUES)))


def _uuids(values) -> list[uuid.UUID]:
    out = []
    for v in values:
        try:
            out.append(uuid.UUID(str(v)))
        except ValueError:
            pass
    return out


def source_times(db: Session, cues: list[NlpCue]) -> dict[tuple[str, str], datetime]:
    """When each cue's source (check-in, call or message) happened, keyed by (type, source_id)."""
    ids = {t: {c.source_id for c in cues if c.source_type == t} for t in ("checkin", "call", "message")}
    times: dict[tuple[str, str], datetime] = {}
    if ids["checkin"]:
        for cid, at in db.execute(select(Checkin.checkin_id, Checkin.at)
                                  .where(Checkin.checkin_id.in_(ids["checkin"]))):
            times[("checkin", cid)] = at
    if ids["call"]:
        for cid, at in db.execute(select(Call.id, Call.started_at).where(Call.id.in_(_uuids(ids["call"])))):
            if at is not None:
                times[("call", str(cid))] = at
    if ids["message"]:
        for mid, at in db.execute(select(Message.id, Message.created_at)
                                  .where(Message.id.in_(_uuids(ids["message"])))):
            times[("message", str(mid))] = at
    return times
