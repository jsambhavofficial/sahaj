import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import NotFound
from app.modules.auth.models import User
from app.modules.notifications import repository
from app.modules.notifications.models import DeviceToken
from app.modules.notifications.schemas import DeviceRegister


def register_device(db: Session, user: User, body: DeviceRegister) -> DeviceToken:
    """Idempotent: the same push token moves to the current user and is un-revoked."""
    now = datetime.now(timezone.utc)
    device = repository.get_by_token(db, body.token)
    if device is None:
        device = repository.add(db, DeviceToken(user_id=user.id, platform=body.platform,
                                                token=body.token, app_version=body.app_version))
    device.user_id, device.platform = user.id, body.platform
    device.app_version, device.last_seen_at, device.revoked_at = body.app_version, now, None
    db.commit()
    db.refresh(device)
    return device


def revoke_device(db: Session, user: User, device_id: uuid.UUID) -> None:
    device = repository.get_device(db, device_id)
    if device is None or device.user_id != user.id:
        raise NotFound("Device not found")
    device.revoked_at = datetime.now(timezone.utc)
    db.commit()


# ---- notifications ----

import logging
import re

from app.core.exceptions import AppError
from app.integrations.factory import get_push
from app.integrations.masking import mask
from app.modules.notifications.models import Notification

log = logging.getLogger(__name__)

KINDS = ("medication_reminder", "checkin_prompt", "alert_new", "alert_escalated",
         "priority_list_updated", "message_received", "call_summary_ready")
# Only identifiers may travel in `data`; anything else (free text, names) is dropped.
DATA_KEYS = {"alert_id", "call_id", "senior_id", "date", "message_id", "medication_id",
             "scheduled_at", "notification_id", "priority_list_id", "revision"}
STALE_AFTER = timedelta(hours=6)  # a reminder this late is useless; do not push it
_DIGITS = re.compile(r"(?<!\d)(?:\+?\d[\s-]?){7,}(?!\d)")
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


class InvalidNotification(AppError):
    status_code, code = 422, "validation_error"


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def generic_text(text: str) -> str:
    """Push text travels through a third party: neutralise phone-number-like digit runs."""
    masked, _ = mask(text)
    masked = re.sub(r"\[PHONE_\d+\]", "[number]", masked)
    return _DIGITS.sub(lambda m: m.group(0) if _ISO_DATE.fullmatch(m.group(0).strip()) else "[number]",
                       masked).strip()


def notify(db: Session, user_id: uuid.UUID, kind: str, title: str, body: str,
           data: dict | None = None, scheduled_for: datetime | None = None, *,
           commit: bool = True) -> Notification:
    """Create a pending notification (sent later by `send_pending`).

    Text is made generic (phone-like numbers removed) and `data` is reduced to known id keys
    with string values. Pass `commit=False` to leave the commit to the caller.
    """
    if kind not in KINDS:
        raise InvalidNotification(f"Unknown notification kind: {kind}")
    clean = {str(k): str(v) for k, v in (data or {}).items()
             if k in DATA_KEYS and v is not None and len(str(v)) <= 64}
    n = repository.add_notification(db, Notification(
        user_id=user_id, kind=kind, title=generic_text(title)[:120], body=generic_text(body)[:300],
        data=clean, scheduled_for=(_aware(scheduled_for) or datetime.now(timezone.utc)).astimezone(timezone.utc),
        delivery_status="pending"))
    if commit:
        db.commit()
        db.refresh(n)
    return n


def send_pending(db: Session, now: datetime | None = None, limit: int = 500) -> int:
    """Push due pending notifications to the user's live devices. Returns how many were sent.

    Idempotent: only `pending` rows are touched and each leaves that state exactly once.
    """
    now = _aware(now) or datetime.now(timezone.utc)
    push, sent = get_push(), 0
    for n in repository.due_pending(db, now, limit):
        if now - _aware(n.scheduled_for) > STALE_AFTER:
            n.delivery_status = "skipped"
            continue
        devices = repository.active_devices(db, n.user_id)
        if not devices:
            n.delivery_status = "skipped"
            continue
        title, _ = mask(n.title)
        body, _ = mask(n.body)
        ok = False
        for d in devices:
            try:
                accepted = push.send(d.token, title, body, {k: str(v) for k, v in (n.data or {}).items()})
            except Exception:  # provider outage: keep the token, count as failed
                log.warning("push provider error for notification %s", n.id)
                continue
            if accepted:
                ok = True
            else:
                d.revoked_at = now  # provider rejected the token
        n.delivery_status = "sent" if ok else "failed"
        if ok:
            n.sent_at, sent = now, sent + 1
    db.commit()
    return sent


def list_notifications(db: Session, user: User, *, unread: bool, limit: int, offset: int) -> dict:
    items, total = repository.list_for_user(db, user.id, datetime.now(timezone.utc),
                                            unread=unread, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def mark_read(db: Session, user: User, notification_id: uuid.UUID) -> None:
    n = repository.get_notification(db, notification_id)
    if n is None or n.user_id != user.id:
        raise NotFound("Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        db.commit()
