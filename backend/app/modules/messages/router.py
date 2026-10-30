import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import AppError
from app.modules.auth.models import User
from app.modules.messages import service
from app.modules.messages.schemas import MessageList, MessageOut, TextMessageIn

router = APIRouter(tags=["messages"])

SEND_BODY_DOC = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {"schema": TextMessageIn.model_json_schema(),
                                 "example": {"body": "Namaste, kal subah call kijiye.", "language": "hinglish"}},
            "multipart/form-data": {"schema": {
                "type": "object", "required": ["audio"],
                "properties": {
                    "audio": {"type": "string", "format": "binary",
                              "description": "m4a/aac/wav voice note, at most 60 s and 2 MB"},
                    "language": {"type": "string", "enum": list(service.LANGUAGES)},
                    "duration_sec": {"type": "integer",
                                     "description": "Optional; checked against the 60 s limit (WAV is measured)"}}}},
        },
    }
}


def _validation_error(exc: ValidationError) -> AppError:
    first = exc.errors()[0]
    field = ".".join(str(p) for p in first["loc"])
    return AppError(f"{field}: {first['msg']}".strip(": "), code="validation_error", status_code=422)


async def send_from_request(request: Request, db: Session, sender: User, senior_id: str) -> MessageOut:
    """Accepts JSON {body, language?} (text) or multipart with `audio` (voice note)."""
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        audio = form.get("audio")
        if not isinstance(audio, UploadFile):
            raise AppError("audio: field required", code="validation_error", status_code=422)
        data = await audio.read(service.MAX_AUDIO_BYTES + 1)
        raw_duration = form.get("duration_sec")
        try:
            duration = int(raw_duration) if raw_duration not in (None, "") else None
        except ValueError:
            raise AppError("duration_sec: must be an integer", code="validation_error", status_code=422)
        language = form.get("language")
        return await run_in_threadpool(
            service.send_voice_note, db, sender, senior_id, data, filename=audio.filename,
            content_type=audio.content_type, language=language if isinstance(language, str) else None,
            duration_sec=duration)
    try:
        payload = TextMessageIn.model_validate_json(await request.body())
    except ValidationError as exc:
        raise _validation_error(exc)
    return await run_in_threadpool(service.send_text, db, sender, senior_id, payload.body, payload.language)


@router.get("/seniors/{senior_id}/messages", response_model=MessageList)
def list_messages(senior_id: str, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                  before: datetime | None = Query(None, description="Only messages created before this time"),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The thread between a senior and their coordinator, newest first."""
    return service.list_messages(db, user, senior_id, limit=limit, offset=offset, before=before)


@router.post("/seniors/{senior_id}/messages", response_model=MessageOut, status_code=201,
             openapi_extra=SEND_BODY_DOC)
async def send_message(senior_id: str, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(require_role(*service.SENDER_ROLES))):
    """Send a text (JSON) or a voice note (multipart `audio`). Ops users cannot send."""
    return await send_from_request(request, db, user, senior_id)


@router.post("/messages/{message_id}/read", status_code=204)
def read_message(message_id: uuid.UUID, db: Session = Depends(get_db),
                 user: User = Depends(require_role(*service.SENDER_ROLES))):
    service.mark_read(db, user, message_id)
    return Response(status_code=204)


@router.get("/messages/{message_id}/audio", response_class=Response,
            responses={200: {"content": {"audio/*": {}}, "description": "The voice note audio"}})
def message_audio(message_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Streams a voice note. Same access rules as the thread; send the Bearer token."""
    data, content_type = service.get_audio(db, user, message_id)
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "private, no-store"})
