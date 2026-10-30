import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceRegister(BaseModel):
    platform: str = Field(pattern="^(android|ios|web)$")
    token: str = Field(min_length=8, description="FCM registration token")
    app_version: str | None = None


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    platform: str
    app_version: str | None = None
    created_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict = Field(default_factory=dict)
    scheduled_for: datetime
    sent_at: datetime | None = None
    read_at: datetime | None = None


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    total: int
    limit: int
    offset: int
