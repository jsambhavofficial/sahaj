"""Small in-memory sliding-window rate limiter for the auth endpoints.

Per process only, which is enough for a single Render instance; put a shared store behind it
if the service is ever scaled out.
"""

import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import AppError

_hits: dict[str, deque] = defaultdict(deque)


class RateLimited(AppError):
    status_code, code = 429, "rate_limited"


def reset() -> None:
    _hits.clear()


def limit(name: str, per_minute: int | None = None):
    """FastAPI dependency factory: at most `per_minute` calls per client IP per endpoint name."""
    def dependency(request: Request) -> None:
        allowed = per_minute or get_settings().auth_rate_limit_per_minute
        if allowed <= 0:
            return
        key = f"{name}:{request.client.host if request.client else 'unknown'}"
        now = time.monotonic()
        window = _hits[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= allowed:
            raise RateLimited("Too many requests; try again in a minute")
        window.append(now)
    return dependency
