import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.notifications import service
from app.modules.notifications.schemas import (
    DeviceOut,
    DeviceRegister,
    NotificationOut,
    NotificationPage,
    NotificationPreferencesIn,
    NotificationPreferencesOut,
    NotificationTestRequest,
)

router = APIRouter(tags=["devices"])


@router.post("/devices", response_model=DeviceOut, summary="Register a push token for this user")
def register_device(
    body: DeviceRegister,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.register_device(db, user, body)


@router.delete("/devices/{device_id}", status_code=204, summary="Revoke one of your push tokens")
def revoke_device(
    device_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.revoke_device(db, user, device_id)
    return Response(status_code=204)


# ---- notifications inbox & preferences ----

inbox = APIRouter(tags=["notifications"])


@inbox.get("/notifications", response_model=NotificationPage, summary="Your notifications, newest first")
def list_notifications(
    unread: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_notifications(db, user, unread=unread, limit=limit, offset=offset)


@inbox.get("/notifications/unread-count", summary="Get number of unread notifications for bell badge")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"unread_count": service.get_unread_count(db, user)}


@inbox.get(
    "/me/notifications",
    response_model=NotificationPage,
    summary="Senior app: your notifications, newest first",
)
def my_notifications(
    unread: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("senior")),
    db: Session = Depends(get_db),
):
    return service.list_notifications(db, user, unread=unread, limit=limit, offset=offset)


@inbox.get("/me/notifications/unread-count", summary="Senior app: unread notification count")
def my_unread_count(
    user: User = Depends(require_role("senior")),
    db: Session = Depends(get_db),
):
    return {"unread_count": service.get_unread_count(db, user)}


@inbox.post(
    "/notifications/{notification_id}/read",
    status_code=204,
    summary="Mark one of your notifications as read",
)
def read_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.mark_read(db, user, notification_id)
    return Response(status_code=204)


@inbox.post(
    "/notifications/read-all",
    summary="Mark all notifications as read",
)
def read_all_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = service.mark_all_read(db, user)
    return {"marked_read": count}


@inbox.get(
    "/notifications/preferences",
    response_model=NotificationPreferencesOut,
    summary="Get user notification preferences",
)
def get_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = service.get_user_preferences(db, user)
    return {"preferences": prefs}


@inbox.put(
    "/notifications/preferences",
    response_model=NotificationPreferencesOut,
    summary="Update user notification preferences",
)
def update_preferences(
    body: NotificationPreferencesIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = service.save_user_preferences(db, user, body.preferences)
    return {"preferences": prefs}


@inbox.post(
    "/notifications/test",
    response_model=NotificationOut,
    summary="Send an immediate test notification to verify FCM push delivery on registered devices",
)
def test_notification(
    req: NotificationTestRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.trigger_test_notification(db, user, req)


router.include_router(inbox)
