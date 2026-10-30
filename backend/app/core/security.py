"""Password hashing (stdlib scrypt) and JWT helpers."""

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings
from app.core.exceptions import Unauthorized

_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, digest_b64 = stored.split("$")
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
    except ValueError:
        return False
    actual = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return hmac.compare_digest(actual, expected)


# A valid hash of a random value, verified against when the account does not exist so
# login takes about the same time either way.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def new_device_token() -> str:
    return secrets.token_urlsafe(32)


def hash_device_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_token(subject: str, token_type: str, expires_in: timedelta, **claims) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "typ": token_type, "iat": now, "exp": now + expires_in, **claims}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, token_type: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise Unauthorized("Token expired", code="token_expired")
    except jwt.PyJWTError:
        raise Unauthorized("Invalid token", code="invalid_token")
    if payload.get("typ") != token_type:
        raise Unauthorized("Invalid token", code="invalid_token")
    return payload
