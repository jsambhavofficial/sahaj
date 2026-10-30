import pytest
from fastapi import APIRouter

from app.core.config import Settings
from app.core.exceptions import Forbidden, register_exception_handlers  # noqa: F401
from app.main import create_app


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "healthy"


def test_health_db(client):
    assert client.get("/health/db").json() == {"status": "healthy", "database": "ok"}


def test_unknown_route_uses_error_shape(client):
    r = client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_validation_and_app_errors_use_error_shape():
    app = create_app()
    router = APIRouter()

    @router.get("/boom")
    def boom():
        raise Forbidden("nope")

    @router.get("/num")
    def num(n: int):
        return n

    app.include_router(router)
    from fastapi.testclient import TestClient
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/boom").json() == {"error": {"code": "forbidden", "message": "nope"}}
    r = c.get("/num?n=abc")
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error" and body["details"][0]["field"] == "query.n"


def test_public_base_url_trailing_slash_stripped():
    assert Settings(public_base_url="https://x.onrender.com/").public_base_url == "https://x.onrender.com"


def test_demo_today_empty_means_unset():
    assert Settings(demo_today="").demo_today is None
    assert str(Settings(demo_today="2026-10-11").demo_today) == "2026-10-11"


def test_production_rejects_default_jwt_secret():
    with pytest.raises(RuntimeError):
        Settings(environment="production", jwt_secret="change-me").validate_for_runtime()
    Settings(environment="production", jwt_secret="x" * 40).validate_for_runtime()


def test_cors_preflight(client):
    r = client.options("/health", headers={"Origin": "http://localhost:3000",
                                           "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
