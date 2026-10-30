import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.checkins.models import Checkin, NlpCue
from app.modules.messages.models import Message


def get_message(db: Session, message_id: uuid.UUID) -> Message | None:
    return db.get(Message, message_id)


def list_thread(db: Session, senior_id: str, *, limit: int, offset: int,
                before: datetime | None) -> tuple[list[Message], int]:
    conds = [Message.senior_id == senior_id]
    if before is not None:
        conds.append(Message.created_at < before)
    total = db.scalar(select(func.count()).select_from(Message).where(*conds)) or 0
    rows = db.scalars(select(Message).where(*conds)
                      .order_by(Message.created_at.desc(), Message.id).limit(limit).offset(offset)).all()
    return list(rows), total


def last_message_from_others(db: Session, senior_id: str, senior_user_id: uuid.UUID | None) -> Message | None:
    conds = [Message.senior_id == senior_id]
    if senior_user_id is not None:
        conds.append(Message.sender_user_id != senior_user_id)
    return db.scalar(select(Message).where(*conds).order_by(Message.created_at.desc()).limit(1))


def users_by_id(db: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not ids:
        return {}
    return {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids)))}


def add_checkin(db: Session, **fields) -> Checkin:
    row = Checkin(**fields)
    db.add(row)
    return row


def add_cue(db: Session, **fields) -> NlpCue:
    row = NlpCue(id=uuid.uuid4(), **fields)
    db.add(row)
    return row
