"""Authorisation and wiring for the voice-agent WebSocket."""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import AppError, Forbidden, Unauthorized
from app.modules.auth import service as auth_service
from app.modules.auth.models import User
from app.modules.seniors.models import Senior
from app.modules.voice import repository as repo
from app.modules.voice.session import VoiceSession

log = logging.getLogger(__name__)


def authenticate(db: Session, token: str) -> tuple[User, Senior]:
    """The access token must belong to an active senior user that is linked to a senior record."""
    if not token:
        raise Unauthorized("Missing token")
    user = auth_service.get_user_from_access_token(db, token)
    if user.role != "senior":
        raise Forbidden("Only a senior can use the voice agent")
    senior = repo.get_senior_by_user(db, user.id)
    if senior is None:
        raise Forbidden("No senior profile is linked to this account")
    return user, senior


def safe_rescore(db: Session, senior_id: str, day: date, reason: str) -> None:
    """Ask the risk module to re-score and re-rank. The risk module may be absent or fail; the call must not."""
    try:
        from app.modules.risk.service import rescore_and_rerank
        rescore_and_rerank(db, senior_id, day, reason=reason)
    except ImportError:
        log.warning("risk.rescore_and_rerank is not available yet (reason=%s)", reason)
    except Exception:
        log.exception("rescore_and_rerank failed (reason=%s)", reason)
        try:
            db.rollback()
        except Exception:
            pass


def new_session(db: Session, user: User, senior: Senior) -> VoiceSession:
    return VoiceSession(db, user, senior, repo.get_contact_name(db, senior.senior_id), safe_rescore)


__all__ = ["authenticate", "new_session", "safe_rescore", "AppError"]
