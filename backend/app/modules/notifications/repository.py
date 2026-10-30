import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.notifications.models import DeviceToken


def get_by_token(db: Session, token: str) -> DeviceToken | None:
    return db.scalar(select(DeviceToken).where(DeviceToken.token == token))


def get_device(db: Session, device_id: uuid.UUID) -> DeviceToken | None:
    return db.get(DeviceToken, device_id)


def add(db: Session, device: DeviceToken) -> DeviceToken:
    db.add(device)
    return device


# ---- notifications ----

from datetime import datetime  # noqa: E402

from sqlalchemy import func  # noqa: E402

from app.modules.notifications.models import Notification  # noqa: E402


def add_notification(db: Session, n: Notification) -> Notification:
    db.add(n)
    db.flush()
    return n


def get_notification(db: Session, notification_id: uuid.UUID) -> Notification | None:
    return db.get(Notification, notification_id)


def list_for_user(db: Session, user_id: uuid.UUID, now: datetime, *, unread: bool,
                  limit: int, offset: int) -> tuple[list[Notification], int]:
    conds = [Notification.user_id == user_id, Notification.scheduled_for <= now]
    if unread:
        conds.append(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(Notification).where(*conds)) or 0
    rows = db.scalars(select(Notification).where(*conds)
                      .order_by(Notification.scheduled_for.desc(), Notification.id)
                      .limit(limit).offset(offset)).all()
    return list(rows), total


def due_pending(db: Session, now: datetime, limit: int) -> list[Notification]:
    return list(db.scalars(select(Notification)
                           .where(Notification.delivery_status == "pending",
                                  Notification.scheduled_for <= now)
                           .order_by(Notification.scheduled_for).limit(limit)).all())


def active_devices(db: Session, user_id: uuid.UUID) -> list[DeviceToken]:
    return list(db.scalars(select(DeviceToken).where(DeviceToken.user_id == user_id,
                                                      DeviceToken.revoked_at.is_(None))).all())


def find_notifications(db: Session, user_id: uuid.UUID, kind: str,
                       scheduled_for: datetime) -> list[Notification]:
    return list(db.scalars(select(Notification).where(
        Notification.user_id == user_id, Notification.kind == kind,
        Notification.scheduled_for == scheduled_for)).all())
