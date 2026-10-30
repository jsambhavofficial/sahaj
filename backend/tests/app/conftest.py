import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.models  # noqa: F401  (registers all tables)
from app.core.database import get_db
from app.db.base import Base
from app.main import create_app


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db_session):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture(autouse=True)
def _ignore_demo_clock(monkeypatch):
    """Tests run on the real calendar date, whatever DEMO_TODAY a developer set in backend/.env."""
    from app.core.config import get_settings
    monkeypatch.setenv("DEMO_TODAY", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app.core import ratelimit
    ratelimit.reset()
    yield
    ratelimit.reset()


@pytest.fixture(autouse=True)
def _use_stub_providers(monkeypatch):
    """Tests never call real speech services, whatever STT_PROVIDER / TTS_PROVIDER a developer set in backend/.env."""
    from app.core.config import get_settings
    from app.integrations import factory

    def clear():
        get_settings.cache_clear()
        for getter in (factory.get_stt, factory.get_tts, factory.get_llm):
            getattr(getter, "cache_clear", lambda: None)()  # a test may have swapped the getter for a lambda

    monkeypatch.setenv("STT_PROVIDER", "stub")
    monkeypatch.setenv("TTS_PROVIDER", "stub")
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    clear()
    yield
    clear()
