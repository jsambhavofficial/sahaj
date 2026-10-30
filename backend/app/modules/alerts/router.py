from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.modules.alerts import service
from app.modules.alerts.schemas import (
    AcknowledgeBody, AlertDetail, AlertPage, AlertSeverity, AlertStatus, EscalateBody, FeedbackBody,
    FeedbackOut, ResolveBody,
)
from app.modules.auth.models import User

router = APIRouter(prefix="/alerts", tags=["alerts"])

reader = require_role("coordinator", "ops", "admin")
actor = require_role("coordinator", "admin")  # ops is read-only


@router.get("", response_model=AlertPage, summary="List alerts for the seniors you may access")
def list_alerts(status: AlertStatus | None = None, severity: AlertSeverity | None = None,
                senior_id: str | None = None,
                limit: Annotated[int, Query(ge=1, le=200)] = 50,
                offset: Annotated[int, Query(ge=0)] = 0,
                user: User = Depends(reader), db: Session = Depends(get_db)):
    return service.list_alerts(db, user, status=status, severity=severity, senior_id=senior_id,
                               limit=limit, offset=offset)


@router.get("/{alert_id}", response_model=AlertDetail, summary="One alert with its status history")
def get_alert(alert_id: str, user: User = Depends(reader), db: Session = Depends(get_db)):
    return service.get_alert(db, user, alert_id)


@router.post("/{alert_id}/acknowledge", response_model=AlertDetail, summary="Acknowledge an alert")
def acknowledge(alert_id: str, body: AcknowledgeBody | None = None, user: User = Depends(actor),
                db: Session = Depends(get_db)):
    return service.acknowledge(db, user, alert_id, body or AcknowledgeBody())


@router.post("/{alert_id}/escalate", response_model=AlertDetail, summary="Escalate an alert")
def escalate(alert_id: str, body: EscalateBody, user: User = Depends(actor), db: Session = Depends(get_db)):
    return service.escalate(db, user, alert_id, body)


@router.post("/{alert_id}/resolve", response_model=AlertDetail, summary="Resolve an alert")
def resolve(alert_id: str, body: ResolveBody, user: User = Depends(actor), db: Session = Depends(get_db)):
    return service.resolve(db, user, alert_id, body)


@router.post("/{alert_id}/feedback", response_model=FeedbackOut, status_code=201,
             summary="Say whether the alert was useful")
def feedback(alert_id: str, body: FeedbackBody, user: User = Depends(actor), db: Session = Depends(get_db)):
    return service.give_feedback(db, user, alert_id, body)
