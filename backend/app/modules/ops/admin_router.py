from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import today
from app.core.database import get_db
from app.core.deps import require_role
from app.modules.auth.models import User
from app.modules.ops import service
from app.modules.ops.schemas import JobRunOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/jobs/{name}/run", response_model=JobRunOut,
             summary="Run a background job now (admin only)")
def run_job(name: str, on_date: date | None = Query(None, alias="date", description="Default: today"),
            user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return service.run_job(db, user, name, on_date or today())
