import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class MessageSender(BaseModel):
    user_id: uuid.UUID
    role: str
    display_name: str


class MessageOut(BaseModel):
    id: uuid.UUID
    senior_id: str
    sender: MessageSender
    kind: str = Field(description="text | voice_note")
    body: str | None = None
    audio_url: str | None = Field(None, description="Authenticated endpoint (Bearer token) that streams the audio")
    transcript: str | None = None
    summary: str | None = Field(None, description="Masked, non-diagnostic summary of a voice note (staff view)")
    language: str | None = None
    duration_sec: int | None = None
    urgency_flag: bool | None = Field(None, description="Staff only; null for the senior")
    created_at: datetime
    delivered_at: datetime | None = None
    read_at: datetime | None = None


class MessageList(BaseModel):
    items: list[MessageOut]
    total: int
    limit: int
    offset: int


class TextMessageIn(BaseModel):
    body: str = Field(max_length=2000)
    language: str | None = None

    @field_validator("body")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("body must not be empty")
        return v
