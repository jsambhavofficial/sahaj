import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFound
from app.integrations.factory import get_push
from app.integrations.masking import mask
from app.modules.auth.models import User
from app.modules.notifications import repository
from app.modules.notifications.models import (
    ALL_NOTIFICATION_KINDS,
    DeviceToken,
    Notification,
    NotificationPreference,
)
from app.modules.notifications.schemas import DeviceRegister, NotificationTestRequest
from app.modules.seniors.models import Senior

log = logging.getLogger(__name__)

KINDS = ALL_NOTIFICATION_KINDS

# Allowed identifier keys in payload data
DATA_KEYS = {
    "alert_id",
    "call_id",
    "senior_id",
    "date",
    "message_id",
    "medication_id",
    "scheduled_at",
    "notification_id",
    "priority_list_id",
    "revision",
    "visit_id",
    "task_id",
    "concern_id",
    "url",
    "click_action",
}

STALE_AFTER = timedelta(hours=6)
_DIGITS = re.compile(r"(?<!\d)(?:\+?\d[\s-]?){7,}(?!\d)")
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


class InvalidNotification(AppError):
    status_code, code = 422, "validation_error"


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def generic_text(text: str) -> str:
    """Push text travels through third-party services: neutralise phone-number-like digit runs."""
    masked, _ = mask(text)
    masked = re.sub(r"\[PHONE_\d+\]", "[number]", masked)
    return _DIGITS.sub(
        lambda m: m.group(0) if _ISO_DATE.fullmatch(m.group(0).strip()) else "[number]",
        masked,
    ).strip()


def register_device(db: Session, user: User, body: DeviceRegister) -> DeviceToken:
    """Idempotently register or refresh a device push token for this user."""
    now = datetime.now(timezone.utc)
    device = repository.get_by_token(db, body.token)
    if device is None:
        device = repository.add(
            db,
            DeviceToken(
                user_id=user.id,
                platform=body.platform,
                token=body.token,
                app_version=body.app_version,
            ),
        )
    device.user_id = user.id
    device.platform = body.platform
    device.app_version = body.app_version
    device.last_seen_at = now
    device.revoked_at = None
    db.commit()
    db.refresh(device)
    log.info("Registered device token for user %s on platform %s", user.id, body.platform)
    return device


def revoke_device(db: Session, user: User, device_id: uuid.UUID) -> None:
    device = repository.get_device(db, device_id)
    if device is None or device.user_id != user.id:
        raise NotFound("Device not found")
    device.revoked_at = datetime.now(timezone.utc)
    db.commit()


# ---- Notification Preferences ----

DEFAULT_SENIOR_PREFS = {
    "daily_reminders": True,
    "saathi_reminders": True,
    "caretaker_visits": True,
    "appointment_reminders": True,
    "medication_reminders": True,
    "preferred_time": "09:00",
}

DEFAULT_COORDINATOR_PREFS = {
    "new_concerns": True,
    "assigned_seniors": True,
    "pending_followups": True,
    "missed_checkins": True,
    "escalations": True,
    "overdue_visits": True,
}


def get_default_preferences(role: str) -> dict:
    if role == "senior":
        return dict(DEFAULT_SENIOR_PREFS)
    if role in ("coordinator", "caretaker"):
        return dict(DEFAULT_COORDINATOR_PREFS)
    return {**DEFAULT_SENIOR_PREFS, **DEFAULT_COORDINATOR_PREFS}


def get_user_preferences(db: Session, user: User) -> dict:
    pref_row = repository.get_preferences(db, user.id)
    defaults = get_default_preferences(user.role)
    if not pref_row or not pref_row.preferences:
        return defaults
    merged = {**defaults, **pref_row.preferences}
    return merged


def save_user_preferences(db: Session, user: User, preferences: dict) -> dict:
    defaults = get_default_preferences(user.role)
    merged = {**defaults, **preferences}
    repository.upsert_preferences(db, user.id, merged)
    db.commit()
    return merged


def is_preference_enabled(db: Session, user_id: uuid.UUID, kind: str) -> bool:
    """Check if the user has opted in for this category of notification."""
    pref_row = repository.get_preferences(db, user_id)
    prefs = pref_row.preferences if pref_row and pref_row.preferences else {}

    # Critical escalations and urgent safety alerts bypass optional preferences
    if kind in ("escalation", "alert_escalated"):
        return True

    # Senior mappings
    if kind in ("daily_wellbeing", "checkin_prompt"):
        return prefs.get("daily_reminders", True)
    if kind == "ai_saathi":
        return prefs.get("saathi_reminders", True)
    if kind == "caretaker_visit":
        return prefs.get("caretaker_visits", True)
    if kind == "medication_reminder":
        return prefs.get("medication_reminders", True)
    if kind == "appointment_reminder":
        return prefs.get("appointment_reminders", True)

    # Coordinator mappings
    if kind in ("wellbeing_concern", "alert_new", "ai_concern_review"):
        return prefs.get("new_concerns", True)
    if kind == "senior_assigned":
        return prefs.get("assigned_seniors", True)
    if kind in ("pending_followup", "followup_update"):
        return prefs.get("pending_followups", True)
    if kind == "missed_checkin":
        return prefs.get("missed_checkins", True)
    if kind == "overdue_visit":
        return prefs.get("overdue_visits", True)

    return True


# ---- Notifications CRUD & Dispatch ----


def verify_senior_coordinator_assignment(db: Session, coordinator_id: uuid.UUID, senior_id: str | None) -> bool:
    """Verify that a Care Coordinator is assigned to this senior before sending sensitive updates."""
    if not senior_id:
        return True
    senior = db.get(Senior, senior_id)
    if senior and senior.coordinator_id and senior.coordinator_id != coordinator_id:
        log.warning(
            "Security block: coordinator %s is not assigned to senior %s (assigned: %s)",
            coordinator_id,
            senior_id,
            senior.coordinator_id,
        )
        return False
    return True


def notify(
    db: Session,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    data: dict | None = None,
    scheduled_for: datetime | None = None,
    *,
    commit: bool = True,
    dispatch_now: bool = False,
) -> Notification | None:
    """Create a pending notification (and optionally dispatch it immediately via FCM).

    Applies role preference checks, PII neutralisation, and duplicate prevention.
    """
    if kind not in KINDS:
        raise InvalidNotification(f"Unknown notification kind: {kind}")

    # Check user preferences
    if not is_preference_enabled(db, user_id, kind):
        log.info("User %s opted out of notification kind '%s'; skipping.", user_id, kind)
        return None

    # Check Care Coordinator assignment if senior_id is present
    target_senior_id = (data or {}).get("senior_id")
    target_user = db.get(User, user_id)
    if target_user and target_user.role in ("coordinator", "caretaker") and target_senior_id:
        if not verify_senior_coordinator_assignment(db, user_id, str(target_senior_id)):
            return None

    sched_time = (_aware(scheduled_for) or datetime.now(timezone.utc)).astimezone(timezone.utc)

    # Duplicate prevention: Avoid duplicate notifications of same kind & key within the same hour
    recent_existing = repository.find_notifications(db, user_id, kind, sched_time)
    if recent_existing:
        log.info("Duplicate notification suppressed for user %s, kind '%s' at %s", user_id, kind, sched_time)
        return recent_existing[0]

    clean_data = {
        str(k): str(v)
        for k, v in (data or {}).items()
        if k in DATA_KEYS and v is not None and len(str(v)) <= 128
    }

    n = repository.add_notification(
        db,
        Notification(
            user_id=user_id,
            kind=kind,
            title=generic_text(title)[:120],
            body=generic_text(body)[:300],
            data=clean_data,
            scheduled_for=sched_time,
            delivery_status="pending",
        ),
    )

    if commit:
        db.commit()
        db.refresh(n)

    if dispatch_now:
        send_pending_for_user(db, user_id)

    return n


def send_pending_for_user(db: Session, user_id: uuid.UUID) -> int:
    """Immediately dispatch pending due notifications for a specific user."""
    now = datetime.now(timezone.utc)
    push, sent = get_push(), 0
    devices = repository.active_devices(db, user_id)
    if not devices:
        return 0

    pending = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.delivery_status == "pending",
            Notification.scheduled_for <= now,
        )
        .all()
    )

    for n in pending:
        title, _ = mask(n.title)
        body, _ = mask(n.body)
        ok = False
        for d in devices:
            try:
                accepted = push.send(d.token, title, body, {k: str(v) for k, v in (n.data or {}).items()})
            except Exception:
                log.warning("FCM provider delivery error for notification %s", n.id, exc_info=True)
                continue
            if accepted:
                ok = True
            else:
                d.revoked_at = now
        n.delivery_status = "sent" if ok else "failed"
        if ok:
            n.sent_at = now
            sent += 1
    db.commit()
    return sent


def send_pending(db: Session, now: datetime | None = None, limit: int = 500) -> int:
    """Push due pending notifications to users' active devices."""
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
            except Exception:
                log.warning("Push provider error for notification %s", n.id, exc_info=True)
                continue
            if accepted:
                ok = True
            else:
                d.revoked_at = now
        n.delivery_status = "sent" if ok else "failed"
        if ok:
            n.sent_at, sent = now, sent + 1
    db.commit()
    return sent


def list_notifications(db: Session, user: User, *, unread: bool, limit: int, offset: int) -> dict:
    items, total = repository.list_for_user(
        db, user.id, datetime.now(timezone.utc), unread=unread, limit=limit, offset=offset
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def get_unread_count(db: Session, user: User) -> int:
    return repository.count_unread(db, user.id, datetime.now(timezone.utc))


def mark_read(db: Session, user: User, notification_id: uuid.UUID) -> None:
    n = repository.get_notification(db, notification_id)
    if n is None or n.user_id != user.id:
        raise NotFound("Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        db.commit()


def mark_all_read(db: Session, user: User) -> int:
    count = repository.mark_all_read(db, user.id, datetime.now(timezone.utc))
    db.commit()
    return count


def trigger_test_notification(db: Session, user: User, req: NotificationTestRequest) -> Notification:
    """Create and immediately dispatch a test notification for the authenticated user to verify device push."""
    role = user.role.lower()
    is_senior = role == "senior"

    default_title = "नमस्ते जी!" if is_senior else "Sahaj Care Update"
    default_body = (
        "नमस्ते जी! आज अपना हाल-चाल बताना न भूलें।"
        if is_senior
        else "A new wellbeing concern requires your review."
    )

    title = req.title or default_title
    body = req.body or default_body
    kind = req.kind if req.kind in KINDS else ("daily_wellbeing" if is_senior else "wellbeing_concern")

    data = {**req.data}
    if is_senior:
        data.setdefault("url", "/senior/check-in")
    else:
        data.setdefault("url", "/caretaker")

    n = notify(db, user.id, kind, title, body, data=data, commit=True, dispatch_now=True)
    if n is None:
        # If disabled by preference, temporarily notify with escalation kind
        n = notify(db, user.id, "escalation", title, body, data=data, commit=True, dispatch_now=True)
    return n
