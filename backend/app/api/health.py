"""Liveness and database health checks (no secrets in responses)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "healthy", "environment": get_settings().environment}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("select 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "healthy", "database": "ok"}
