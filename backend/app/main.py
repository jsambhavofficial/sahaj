"""FastAPI application entrypoint."""

from fastapi import FastAPI

from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="3.0.0")

    @app.get("/health")
    def health():
        return {"status": "healthy", "environment": settings.environment}

    return app


app = create_app()
