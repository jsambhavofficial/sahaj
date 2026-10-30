"""Failure-proof wrapper around the notifications module.

Scoring and alert handling must never fail because a notification could not be written, so every
error (including the notifications module not existing yet) is logged and swallowed. Text passed
here is generic on purpose: no names, no conditions. Ids go in `data`.
"""

import logging
import uuid

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def safe_notify(db: Session, user_id: uuid.UUID | None, kind: str, title: str, body: str,
                data: dict | None = None) -> bool:
    """Create a notification for `user_id`; returns False (and logs) instead of raising."""
    if user_id is None:
        return False
    try:
        from app.modules.notifications.service import notify  # imported lazily on purpose

        with db.begin_nested():
            notify(db, user_id, kind, title, body, data=data or {}, scheduled_for=None, commit=False)
        return True
    except Exception:  # noqa: BLE001 - notifications must never break scoring
        logger.warning("notification %s could not be created", kind, exc_info=True)
        return False
