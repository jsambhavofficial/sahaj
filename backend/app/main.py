"""FastAPI application entrypoint."""

from fastapi import FastAPI

from app.core.config import get_settings
from app.modules.checkins import checkins_router
from app.modules.voice import voice_router
from app.modules.risk import risk_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="3.0.0")

    @app.get("/health")
    def health():
        return {"status": "healthy", "environment": settings.environment}

    # Mount module routers
    app.include_router(voice_router, prefix="/api/v1")
    app.include_router(checkins_router, prefix="/api/v1")
    app.include_router(risk_router, prefix="/api/v1")

    return app


app = create_app()
