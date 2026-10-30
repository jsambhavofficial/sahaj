import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.modules.notifications.models import DeviceToken, Notification, NotificationPreference


def get_by_token(db: Session, token: str) -> DeviceToken | None:
    return db.scalar(select(DeviceToken).where(DeviceToken.token == token))


def get_device(db: Session, device_id: uuid.UUID) -> DeviceToken | None:
    return db.get(DeviceToken, device_id)


def add(db: Session, device: DeviceToken) -> DeviceToken:
    db.add(device)
    return device


# ---- notifications ----


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


def count_unread(db: Session, user_id: uuid.UUID, now: datetime) -> int:
    conds = [Notification.user_id == user_id, Notification.scheduled_for <= now, Notification.read_at.is_(None)]
    return db.scalar(select(func.count()).select_from(Notification).where(*conds)) or 0


def mark_all_read(db: Session, user_id: uuid.UUID, now: datetime) -> int:
    res = db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None), Notification.scheduled_for <= now)
        .values(read_at=now)
    )
    return res.rowcount or 0


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


# ---- preferences ----


def get_preferences(db: Session, user_id: uuid.UUID) -> NotificationPreference | None:
    return db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id))


def upsert_preferences(db: Session, user_id: uuid.UUID, prefs: dict) -> NotificationPreference:
    existing = get_preferences(db, user_id)
    if existing:
        existing.preferences = prefs
        return existing
    pref = NotificationPreference(user_id=user_id, preferences=prefs)
    db.add(pref)
    db.flush()
    return pref
