import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.notifications import service
from app.modules.notifications.schemas import DeviceOut, DeviceRegister

router = APIRouter(tags=["devices"])


@router.post("/devices", response_model=DeviceOut, summary="Register a push token for this user")
def register_device(body: DeviceRegister, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return service.register_device(db, user, body)


@router.delete("/devices/{device_id}", status_code=204, summary="Revoke one of your push tokens")
def revoke_device(device_id: uuid.UUID, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    service.revoke_device(db, user, device_id)
    return Response(status_code=204)


# ---- notifications inbox ----

from fastapi import Query  # noqa: E402

from app.core.deps import require_role  # noqa: E402
from app.modules.notifications.schemas import NotificationPage  # noqa: E402

inbox = APIRouter(tags=["notifications"])


@inbox.get("/notifications", response_model=NotificationPage, summary="Your notifications, newest first")
def list_notifications(unread: bool = False, limit: int = Query(50, ge=1, le=200),
                       offset: int = Query(0, ge=0), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    return service.list_notifications(db, user, unread=unread, limit=limit, offset=offset)


@inbox.get("/me/notifications", response_model=NotificationPage,
           summary="Senior app: your notifications, newest first")
def my_notifications(unread: bool = False, limit: int = Query(50, ge=1, le=200),
                     offset: int = Query(0, ge=0), user: User = Depends(require_role("senior")),
                     db: Session = Depends(get_db)):
    return service.list_notifications(db, user, unread=unread, limit=limit, offset=offset)


@inbox.post("/notifications/{notification_id}/read", status_code=204,
            summary="Mark one of your notifications as read")
def read_notification(notification_id: uuid.UUID, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    service.mark_read(db, user, notification_id)
    return Response(status_code=204)


router.include_router(inbox)
