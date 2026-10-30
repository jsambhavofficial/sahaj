"""Engine and session factory."""

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine():
    s = get_settings()
    kwargs = {"pool_pre_ping": True}
    if not s.database_url.startswith("sqlite"):
        # Supabase's session pooler allows only 15 connections for the whole project, shared by every
        # copy of the API (dev servers, scripts, the deployed service). SQLAlchemy's default of 15 per
        # process used them all up, so keep each process small.
        kwargs.update(pool_size=s.db_pool_size, max_overflow=s.db_max_overflow, pool_recycle=300)
    return create_engine(s.database_url, **kwargs)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db():
    """FastAPI dependency yielding a session."""
    with get_sessionmaker()() as session:
        yield session
