import hmac
import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db, get_sessionmaker
from app.core.deps import require_role
from app.core.exceptions import Forbidden, NotFound, Unauthorized
from app.integrations.exotel.client import to_call_info
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.calls.schemas import CallOut, ConnectRequest, MeConnectRequest
from app.modules.calls.service import MAX_IMPORT_BYTES, CallService, finalize_in_background, poll_and_finalize
from app.modules.checkins.models import NlpCue
from app.modules.voice.models import Call, CallTurn

router = APIRouter(prefix="/calls", tags=["calls"])
me_router = APIRouter(tags=["calls"])
webhooks = APIRouter(prefix="/webhooks/exotel", tags=["webhooks"])


def get_session_factory():
    return get_sessionmaker()


def _out(db: Session, call: Call) -> CallOut:
    out = CallOut.model_validate(call)
    out.recording_stored = bool(call.recording_path)
    turns = db.scalars(select(CallTurn).where(CallTurn.call_id == call.id).order_by(CallTurn.turn_index))
    cues = db.scalars(select(NlpCue).where(NlpCue.source_type == "call", NlpCue.source_id == str(call.id)))
    out.turns = [t for t in turns]
    out.cues = [c for c in cues]
    return CallOut.model_validate(out.model_dump())


def _redact_for_senior(out: CallOut) -> CallOut:
    """A senior sees the status of a call, never its transcript, summary or cues."""
    return out.model_copy(update={"turns": [], "cues": [], "summary": None, "urgency_flag": False})


def _start(db, background, session_factory, user: User, body: ConnectRequest) -> CallOut:
    senior = scope.require_senior_access(db, user, body.senior_id)
    payload = body.model_dump()
    if user.role == "senior":
        payload.update(initiator="senior", coordinator_id=None, coordinator_phone=None, senior_phone=None)
    elif user.role == "coordinator":
        payload.update(initiator="coordinator", coordinator_id=None)  # always the caller's own caseload
    # admin may pass coordinator_id and test phone numbers
    call = CallService(db).start_call(**payload)
    call.initiated_by_user_id = user.id
    audit(db, user, "start_call", senior.senior_id, {"call_id": str(call.id)})
    db.commit()
    background.add_task(poll_and_finalize, call.id, session_factory)
    return _out(db, call)


@router.post("/connect", response_model=CallOut, status_code=202,
             summary="Start a recorded click-to-call between a coordinator and a senior")
def connect_call(body: ConnectRequest, background: BackgroundTasks,
                 user: User = Depends(require_role("coordinator", "senior", "admin")),
                 db: Session = Depends(get_db), session_factory=Depends(get_session_factory)):
    """Rings the initiator first, then the other person, and records the call."""
    return _start(db, background, session_factory, user, body)


@router.post("/import", response_model=CallOut, status_code=202,
             summary="Upload a recorded conversation; it is transcribed, summarised and scored like a call")
async def import_recording(background: BackgroundTasks, senior_id: str = Form(...),
                           recording_consent: bool = Form(...),
                           initiator: Literal["coordinator", "senior"] = Form("coordinator"),
                           coordinator_id: uuid.UUID | None = Form(None), file: UploadFile = File(...),
                           user: User = Depends(require_role("coordinator", "admin")),
                           db: Session = Depends(get_db), session_factory=Depends(get_session_factory)):
    """A two-channel (stereo) file labels who spoke from the channel; a mono file marks every turn 'unknown'."""
    senior = scope.require_senior_access(db, user, senior_id)
    data = await file.read(MAX_IMPORT_BYTES + 1)
    call = CallService(db).import_recording(
        senior_id=senior_id, audio=data, filename=file.filename or "", recording_consent=recording_consent,
        initiator=initiator, coordinator_id=coordinator_id if user.role == "admin" else None,
        uploaded_by=user.id)
    audit(db, user, "import_call", senior.senior_id, {"call_id": str(call.id)})
    db.commit()
    background.add_task(finalize_in_background, call.id, session_factory)
    return _out(db, call)


@me_router.post("/me/call-coordinator", response_model=CallOut, status_code=202,
                summary="Senior calls their coordinator (recorded)")
def call_coordinator(body: MeConnectRequest, background: BackgroundTasks,
                     user: User = Depends(require_role("senior")),
                     db: Session = Depends(get_db), session_factory=Depends(get_session_factory)):
    from app.modules.seniors.models import Senior
    senior = db.scalar(select(Senior).where(Senior.user_id == user.id))
    if senior is None:
        raise NotFound("Senior not found")
    return _start(db, background, session_factory, user,
                  ConnectRequest(senior_id=senior.senior_id, recording_consent=body.recording_consent))


def _load_call(db: Session, user: User, call_id: uuid.UUID) -> Call:
    call = db.get(Call, call_id)
    if call is None:
        raise NotFound(f"Call not found: {call_id}")
    scope.require_senior_access(db, user, call.senior_id)
    return call


@router.get("/{call_id}", response_model=CallOut, summary="Call status, transcript, summary and cues")
def get_call(call_id: uuid.UUID, user: User = Depends(require_role("coordinator", "senior", "ops", "admin")),
             db: Session = Depends(get_db)):
    call = _load_call(db, user, call_id)
    out = _out(db, call)
    if user.role == "senior":
        return _redact_for_senior(out)
    audit(db, user, "view_call", call.senior_id, {"call_id": str(call.id)})
    db.commit()
    return out


@router.post("/{call_id}/process", response_model=CallOut, summary="Re-run transcription and summary")
def reprocess_call(call_id: uuid.UUID, user: User = Depends(require_role("coordinator", "admin")),
                   db: Session = Depends(get_db)):
    """Re-runs recording download, transcription and summary (e.g. after a failure)."""
    call = _load_call(db, user, call_id)
    call.transcript_status = "pending"
    db.commit()
    return _out(db, CallService(db).finalize(call_id))


@webhooks.post("/call-status")
async def exotel_call_status(request: Request, background: BackgroundTasks, token: str = "",
                             db: Session = Depends(get_db), session_factory=Depends(get_session_factory)):
    secret = get_settings().exotel_webhook_secret
    if secret and not hmac.compare_digest(token, secret):
        raise Unauthorized("Invalid webhook token")
    if request.headers.get("content-type", "").startswith("application/json"):
        payload = await request.json()
    else:
        payload = dict(await request.form())
    svc = CallService(db)
    call = svc.by_sid(str(payload.get("CallSid") or payload.get("Sid") or ""))
    if call is None:
        return {"ok": True, "matched": False}  # not ours; do not reveal anything
    info = to_call_info(payload)
    svc.apply_info(call, info)
    if info.status == "completed" and info.recording_url:
        background.add_task(finalize_in_background, call.id, session_factory)
    elif info.is_terminal and info.status != "completed":
        call.transcript_status = "not_applicable"
        db.commit()
    return {"ok": True, "matched": True}
