import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def preflight(client, origin):
    return client.options("/api/v1/auth/login", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization"})


@pytest.fixture
def app_with(monkeypatch):
    def make(**env):
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        get_settings.cache_clear()
        return TestClient(create_app())
    yield make
    get_settings.cache_clear()


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://localhost:5173", "http://localhost:8081"])
def test_local_web_and_expo_web_origins_are_allowed_by_default(app_with, origin):
    r = preflight(app_with(), origin)
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == origin


def test_an_unknown_website_is_refused(app_with):
    r = preflight(app_with(), "https://evil.example.com")
    assert "access-control-allow-origin" not in r.headers


def test_deployed_web_portal_can_be_added_from_the_environment(app_with):
    client = app_with(CORS_ORIGINS="http://localhost:3000,https://samarth-portal.vercel.app")
    assert preflight(client, "https://samarth-portal.vercel.app").headers["access-control-allow-origin"] == "https://samarth-portal.vercel.app"
    assert "access-control-allow-origin" not in preflight(client, "https://other.vercel.app").headers


def test_a_pattern_covers_changing_addresses_but_only_those(app_with):
    client = app_with(CORS_ORIGIN_REGEX=r"https://[a-z0-9-]+\.vercel\.app|http://192\.168\.\d+\.\d+:\d+")
    for ok in ("https://samarth-git-main-abc.vercel.app", "http://192.168.1.20:3000"):
        assert preflight(client, ok).headers["access-control-allow-origin"] == ok
    for bad in ("https://vercel.app.evil.com", "http://10.0.0.5:3000", "https://evil.com"):
        assert "access-control-allow-origin" not in preflight(client, bad).headers


def test_a_broken_pattern_fails_loudly(monkeypatch):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", "([unclosed")
    get_settings.cache_clear()
    try:
        with pytest.raises(Exception, match="CORS_ORIGIN_REGEX"):
            get_settings()
    finally:
        get_settings.cache_clear()
