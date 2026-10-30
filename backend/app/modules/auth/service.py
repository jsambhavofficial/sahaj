import hmac
import uuid
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import Conflict, Forbidden, Unauthorized
from app.core.security import (
    DUMMY_PASSWORD_HASH, create_token, decode_token, hash_device_token, new_device_token,
    verify_password,
)
from app.modules.auth import repository, scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.auth.schemas import PairResponse, TokenResponse, UserOut

PAIR_TOKEN = "pair"


def _issue(user: User) -> TokenResponse:
    s = get_settings()
    access = create_token(str(user.id), "access", timedelta(minutes=s.access_token_minutes), role=user.role)
    refresh = create_token(str(user.id), "refresh", timedelta(days=s.refresh_token_days))
    return TokenResponse(access_token=access, refresh_token=refresh,
                         expires_in=s.access_token_minutes * 60, user=UserOut.model_validate(user))


def _active_user(db: Session, user_id) -> User:
    try:
        user_id = uuid.UUID(str(user_id))
    except ValueError:
        raise Unauthorized("Invalid token", code="invalid_token")
    user = repository.get_user(db, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Account not available")
    return user


def login(db: Session, email: str, password: str) -> TokenResponse:
    user = repository.get_user_by_email(db, email)
    stored = user.password_hash if user and user.password_hash else DUMMY_PASSWORD_HASH
    ok = verify_password(password, stored)
    if not (user and user.password_hash and user.is_active and ok):
        raise Unauthorized("Incorrect email or password", code="invalid_credentials")
    return _issue(user)


def refresh(db: Session, refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token, "refresh")
    return _issue(_active_user(db, payload["sub"]))


def get_user_from_access_token(db: Session, token: str) -> User:
    payload = decode_token(token, "access")
    return _active_user(db, payload["sub"])


def _hash_prefix(device_token_hash: str | None) -> str:
    return (device_token_hash or "")[:16]


def create_pairing_code(db: Session, actor: User, senior_id: str) -> tuple[str, int]:
    """A signed, short-lived, single-use code. Single use: it embeds the senior's current device
    token hash prefix, which changes as soon as the code is redeemed."""
    scope.require_senior_access(db, actor, senior_id)
    if actor.role not in ("coordinator", "admin"):
        raise Forbidden("Only a coordinator can issue a pairing code")
    contact = repository.get_senior_contact(db, senior_id)
    minutes = get_settings().pairing_code_minutes
    code = create_token(senior_id, PAIR_TOKEN, timedelta(minutes=minutes),
                        h=_hash_prefix(contact.device_token_hash if contact else None))
    audit(db, actor, "issue_pairing_code", senior_id)
    db.commit()
    return code, minutes * 60


def pair(db: Session, pairing_code: str) -> PairResponse:
    payload = decode_token(pairing_code, PAIR_TOKEN)
    senior_id = payload["sub"]
    contact = repository.get_senior_contact(db, senior_id)
    senior = repository.get_senior(db, senior_id)
    if contact is None or senior is None or senior.user_id is None:
        raise Unauthorized("Invalid pairing code", code="invalid_token")
    if not hmac.compare_digest(payload.get("h", ""), _hash_prefix(contact.device_token_hash)):
        raise Conflict("Pairing code already used", code="pairing_code_used")
    user = _active_user(db, senior.user_id)
    device_token = new_device_token()
    contact.device_token_hash = hash_device_token(device_token)
    audit(db, user, "senior_paired", senior_id)
    db.commit()
    return PairResponse(**_issue(user).model_dump(), senior_id=senior_id, device_token=device_token)


def senior_login(db: Session, senior_id: str, device_token: str) -> TokenResponse:
    contact = repository.get_senior_contact(db, senior_id)
    senior = repository.get_senior(db, senior_id)
    expected = contact.device_token_hash if contact else None
    given = hash_device_token(device_token)
    if not (expected and senior and senior.user_id and hmac.compare_digest(expected, given)):
        raise Unauthorized("Device not recognised", code="invalid_credentials")
    return _issue(_active_user(db, senior.user_id))
