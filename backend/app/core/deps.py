"""Shared FastAPI dependencies."""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import Forbidden, Unauthorized
from app.modules.auth import service as auth_service
from app.modules.auth.models import User

_bearer = HTTPBearer(auto_error=False, description="Access token from /api/v1/auth/login")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise Unauthorized("Not authenticated")
    return auth_service.get_user_from_access_token(db, creds.credentials)


def require_role(*roles: str):
    """Dependency factory: the current user must hold one of `roles`."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise Forbidden("Your role cannot perform this action")
        return user
    return checker
