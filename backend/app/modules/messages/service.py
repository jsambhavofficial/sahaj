"""Coordinator <-> senior message thread (text and voice notes).

Voice notes: store audio privately -> STT -> masked summary -> cues -> check-in row. Each step
after the message row exists is isolated, so a provider failure leaves the message saved
(without transcript/summary) instead of failing the request.
"""

import io
import logging
import uuid
import wave
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings, today
from app.core.exceptions import AppError, Forbidden, NotFound
from app.core.safety import guard_text
from app.integrations.factory import get_llm, get_stt, get_storage
from app.integrations.masking import mask, unmask
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.auth.scope import require_senior_access
from app.modules.checkins.nlp import EXTRACTOR_VERSION, extract_cues, is_urgent
from app.modules.messages import repository
from app.modules.messages.models import Message
from app.modules.messages.schemas import MessageOut, MessageSender
from app.modules.seniors.models import Senior, SeniorContact

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 2 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
LANGUAGES = ("hindi", "hinglish", "english")
AUDIO_TYPES = {"m4a": "audio/mp4", "aac": "audio/aac", "wav": "audio/wav", "mp3": "audio/mpeg"}
_CONTENT_TYPE_EXT = {"audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac",
                     "audio/x-aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
                     "audio/mpeg": "mp3"}
SENDER_ROLES = ("coordinator", "admin", "senior")
_SUMMARY_SYSTEM = (
    "Summarise this voice note from an older adult to their care coordinator in 1-2 plain sentences. "
    "Mention symptoms, mood, medicines and requests. Never state or imply a diagnosis and never advise "
    "changing medication. Names are masked tokens; keep them as-is."
)
NOTIFY_TITLE = "New message"
NOTIFY_BODY = "You have a new message."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _invalid(message: str, code: str = "validation_error", status: int = 422) -> AppError:
    return AppError(message, code=code, status_code=status)


# ---- safe wrappers around services owned by other slices -------------------------------------
def safe_rescore(db: Session, senior_id: str, on_date=None, reason: str = "new_alert") -> None:
    try:
        from app.modules.risk.service import rescore_and_rerank
        rescore_and_rerank(db, senior_id, on_date or today(), reason=reason)
    except Exception:  # ImportError while the risk slice is being built, or any scoring failure
        logger.warning("Re-score after urgent message skipped", exc_info=True)
        db.rollback()


def safe_notify(db: Session, user_id: uuid.UUID, kind: str, title: str, body: str, data: dict) -> None:
    try:
        from app.modules.notifications.service import notify
        notify(db, user_id, kind, title, body, data)
        db.commit()
    except Exception:
        logger.warning("Notification skipped", exc_info=True)
        db.rollback()


# ---- output ----------------------------------------------------------------------------------
def audio_url(message: Message) -> str | None:
    if not message.audio_path:
        return None
    return f"{get_settings().public_base_url}/api/v1/messages/{message.id}/audio"


def to_out(message: Message, users: dict, viewer: User) -> MessageOut:
    sender = users.get(message.sender_user_id)
    is_senior_viewer = viewer.role == "senior"
    return MessageOut(
        id=message.id, senior_id=message.senior_id,
        sender=MessageSender(user_id=message.sender_user_id, role=sender.role if sender else "unknown",
                             display_name=sender.display_name if sender else ""),
        kind=message.kind, body=message.body, audio_url=audio_url(message),
        transcript=message.transcript, summary=None if is_senior_viewer else message.summary,
        language=message.language, duration_sec=message.duration_sec,
        urgency_flag=None if is_senior_viewer else bool(message.urgency_flag),
        created_at=message.created_at, delivered_at=message.delivered_at, read_at=message.read_at)


def _out_many(db: Session, messages: list[Message], viewer: User) -> list[MessageOut]:
    users = repository.users_by_id(db, {m.sender_user_id for m in messages})
    return [to_out(m, users, viewer) for m in messages]


# ---- reading ---------------------------------------------------------------------------------
def list_messages(db: Session, viewer: User, senior_id: str, *, limit: int, offset: int,
                  before: datetime | None) -> dict:
    require_senior_access(db, viewer, senior_id)
    rows, total = repository.list_thread(db, senior_id, limit=limit, offset=offset, before=before)
    if viewer.role != "senior":
        audit(db, viewer, "messages.list", senior_id)
        db.commit()
    return {"items": _out_many(db, rows, viewer), "total": total, "limit": limit, "offset": offset}


def _get_accessible(db: Session, viewer: User, message_id: uuid.UUID) -> Message:
    message = repository.get_message(db, message_id)
    if message is None:
        raise NotFound("Message not found")
    require_senior_access(db, viewer, message.senior_id)
    return message


def mark_read(db: Session, viewer: User, message_id: uuid.UUID) -> None:
    message = _get_accessible(db, viewer, message_id)
    if message.sender_user_id == viewer.id or message.read_at is not None:
        return  # you cannot "read" your own message; reading twice keeps the first time
    message.read_at = _now()
    db.commit()


def get_audio(db: Session, viewer: User, message_id: uuid.UUID) -> tuple[bytes, str]:
    message = _get_accessible(db, viewer, message_id)
    if not message.audio_path:
        raise NotFound("This message has no audio")
    try:
        data = get_storage().get(message.audio_path)
    except Exception as exc:
        logger.warning("Audio for message %s unavailable", message.id)
        raise NotFound("Audio is no longer available") from exc
    if viewer.role != "senior":
        audit(db, viewer, "messages.audio", message.senior_id)
        db.commit()
    ext = message.audio_path.rsplit(".", 1)[-1]
    return data, AUDIO_TYPES.get(ext, "application/octet-stream")


# ---- sending ---------------------------------------------------------------------------------
def _check_language(language: str | None, senior: Senior) -> str:
    if language is None or language == "":
        return senior.preferred_language
    if language not in LANGUAGES:
        raise _invalid(f"language must be one of {', '.join(LANGUAGES)}")
    return language


def _recipient_id(sender: User, senior: Senior) -> uuid.UUID | None:
    return senior.coordinator_id if sender.role == "senior" else senior.user_id


def send_text(db: Session, sender: User, senior_id: str, body: str, language: str | None = None) -> MessageOut:
    senior = _prepare_send(db, sender, senior_id)
    message = Message(id=uuid.uuid4(), senior_id=senior_id, sender_user_id=sender.id, kind="text",
                      body=body, language=_check_language(language, senior), urgency_flag=False,
                      created_at=_now(), delivered_at=_now())
    db.add(message)
    audit(db, sender, "messages.send", senior_id, {"kind": "text"})
    db.commit()
    if sender.role == "senior":
        _analyse(db, message, senior, body)
    _after_send(db, message, sender, senior)
    return _out_many(db, [message], sender)[0]


def _prepare_send(db: Session, sender: User, senior_id: str) -> Senior:
    if sender.role not in SENDER_ROLES:
        raise Forbidden("Your role cannot send messages")
    return require_senior_access(db, sender, senior_id)


def validate_audio(data: bytes, filename: str | None, content_type: str | None,
                   duration_sec: int | None) -> tuple[str, int | None]:
    """Returns (extension, duration). Raises 422/413 for unusable uploads."""
    if not data:
        raise _invalid("The audio file is empty")
    if len(data) > MAX_AUDIO_BYTES:
        raise _invalid("The audio file is larger than 2 MB", code="payload_too_large", status=413)
    ext = (filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else None)
    if ext not in AUDIO_TYPES:
        ext = _CONTENT_TYPE_EXT.get((content_type or "").split(";")[0].strip().lower())
    if ext not in AUDIO_TYPES:
        raise _invalid("Audio must be m4a, aac or wav")
    if ext == "wav":
        try:
            with wave.open(io.BytesIO(data)) as w:
                duration_sec = round(w.getnframes() / float(w.getframerate()))
        except Exception:
            pass  # not a parseable WAV; fall back to the client-reported duration
    if duration_sec is not None and (duration_sec < 0 or duration_sec > MAX_AUDIO_SECONDS):
        raise _invalid(f"Voice notes can be at most {MAX_AUDIO_SECONDS} seconds")
    return ext, duration_sec


def send_voice_note(db: Session, sender: User, senior_id: str, data: bytes, *, filename: str | None,
                    content_type: str | None, language: str | None = None,
                    duration_sec: int | None = None) -> MessageOut:
    senior = _prepare_send(db, sender, senior_id)
    language = _check_language(language, senior)
    ext, duration = validate_audio(data, filename, content_type, duration_sec)
    message_id = uuid.uuid4()
    path = f"messages/{senior_id}/{uuid.uuid4()}.{ext}"
    try:
        get_storage().put(path, data, AUDIO_TYPES[ext])
    except Exception as exc:
        logger.exception("Could not store voice note")
        raise AppError("Could not store the audio.", code="storage_error", status_code=502) from exc

    message = Message(id=message_id, senior_id=senior_id, sender_user_id=sender.id, kind="voice_note",
                      audio_path=path, duration_sec=duration, language=language, urgency_flag=False,
                      category=None, created_at=_now(), delivered_at=_now())
    db.add(message)
    audit(db, sender, "messages.send", senior_id, {"kind": "voice_note"})
    db.commit()

    transcript = _transcribe(db, message, data, language)
    if transcript and sender.role == "senior":
        _summarise(db, message, senior, transcript)
        _analyse(db, message, senior, transcript)
        _run_voice_note_processor(db, message, senior_id, transcript)
        safe_rescore(db, senior_id, reason="new_alert")
    _after_send(db, message, sender, senior)
    return _out_many(db, [message], sender)[0]


def _run_voice_note_processor(db: Session, message: Message, senior_id: str, transcript: str) -> None:
    """Runs VoiceNoteService on the senior's voice note transcript, writes to context_repo, and updates message summary/urgency."""
    try:
        from app.modules.voice.schemas import VoiceNoteProcessRequest
        from app.modules.voice.service import VoiceNoteService

        res = VoiceNoteService().process_voice_note(
            VoiceNoteProcessRequest(senior_id=senior_id, transcript=transcript),
            db=db,
            source_id=str(message.id),
            trigger_risk_calc=False,
        )
        if res.summary and (not message.summary or "stub" in message.summary.lower()):
            message.summary = res.summary
        if res.requires_clinical_escalation:
            message.urgency_flag = True
        db.commit()
    except Exception:
        logger.warning("VoiceNoteService processing skipped for senior %s", senior_id, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass


def _transcribe(db: Session, message: Message, data: bytes, language: str | None) -> str | None:
    try:
        segments = get_stt().transcribe(data, language)
        own = [s for s in segments if s.speaker != "coordinator"] or segments
        text = " ".join(s.text for s in own).strip()
        confs = [s.confidence for s in own if s.confidence is not None]
        message.transcript = text or None
        message.stt_confidence = round(sum(confs) / len(confs), 3) if confs else None
        db.commit()
        return message.transcript
    except Exception:
        logger.exception("Transcription failed for message %s", message.id)
        db.rollback()
        return None


def _summarise(db: Session, message: Message, senior: Senior, transcript: str) -> None:
    try:
        contact = db.get(SeniorContact, senior.senior_id)
        coordinator = db.get(User, senior.coordinator_id)
        names = [n for n in (contact.full_name if contact else None,
                             coordinator.display_name if coordinator else None) if n]
        masked, mapping = mask(transcript, names)  # only masked text leaves the system
        summary = guard_text(unmask(get_llm().complete(_SUMMARY_SYSTEM, masked), mapping), fallback="")
        message.summary = summary or None
        db.commit()
    except Exception:
        logger.exception("Summary failed for message %s", message.id)
        db.rollback()


def _analyse(db: Session, message: Message, senior: Senior, text: str) -> None:
    """Cues + check-in row for something the senior wrote or said; raises urgency if needed."""
    try:
        if not text or not text.strip():
            return
        _, urgent = record_checkin(db, senior, text, channel="voice_note" if message.kind == "voice_note" else "app_checkin",
                                language=message.language, cue_source=("message", str(message.id)),
                                transcription_status="done" if message.kind == "voice_note" else "not_applicable",
                                message=message)
        db.commit()
    except Exception:
        logger.exception("Cue extraction failed for message %s", message.id)
        db.rollback()
        return
    if urgent:
        safe_rescore(db, senior.senior_id)


def record_checkin(db: Session, senior: Senior, text: str, *, channel: str, language: str | None,
                   cue_source: tuple[str, str] | None = None, transcription_status: str = "not_applicable",
                   message: Message | None = None) -> tuple[str, bool]:
    """Adds a check-in row and its cues to the session (no commit). Returns (checkin_id, urgent)."""
    checkin_id = f"CHK_{uuid.uuid4().hex[:16].upper()}"
    repository.add_checkin(db, checkin_id=checkin_id, senior_id=senior.senior_id, at=_now(), channel=channel,
                           language=language, note_text=text, transcription_status=transcription_status,
                           source_role="senior_citizen")
    db.flush()
    cues = extract_cues(text)
    source_type, source_id = cue_source or ("checkin", checkin_id)
    for cue in cues:
        repository.add_cue(db, source_type=source_type, source_id=source_id, senior_id=senior.senior_id,
                           extractor_version=EXTRACTOR_VERSION, **cue)
    urgent = is_urgent(cues)
    if message is not None:
        message.checkin_id = checkin_id
        message.urgency_flag = urgent
    return checkin_id, urgent


def _after_send(db: Session, message: Message, sender: User, senior: Senior) -> None:
    recipient = _recipient_id(sender, senior)
    if recipient is None:
        return
    data = {"senior_id": senior.senior_id, "message_id": str(message.id)}
    safe_notify(db, recipient, "message_received", NOTIFY_TITLE, NOTIFY_BODY, data)
    db.refresh(message)
