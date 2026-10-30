"""Recorded phone calls between a coordinator and a senior (Exotel click-to-call).

Flow: start_call -> (poll or webhook) -> finalize: download recording, store it, transcribe,
summarise (masked), extract cues, save turns. Safe to run twice for the same call.
"""

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError, NotFound
from app.integrations.audio import audio_duration
from app.integrations.base import CallInfo
from app.integrations.factory import get_llm, get_stt, get_storage, get_telephony
from app.integrations.masking import mask, unmask
from app.modules.auth.models import User
from app.modules.checkins.models import NlpCue
from app.modules.checkins.nlp import EXTRACTOR_VERSION, extract_cues, is_urgent
from app.modules.seniors.models import Senior, SeniorContact
from app.modules.voice.models import Call, CallTurn

logger = logging.getLogger(__name__)

RETENTION_DAYS = 7
POLL_INTERVAL_S = 5
POLL_TIMEOUT_S = 900
MAX_IMPORT_BYTES = 25 * 1024 * 1024
MAX_IMPORT_SECONDS = 20 * 60
AUDIO_TYPES = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac",
               ".ogg": "audio/ogg", ".webm": "audio/webm", ".flac": "audio/flac"}
_PLACEHOLDER_PREFIX = "+910000"  # seeded numbers are deliberately not dialable
_SUMMARY_SYSTEM = (
    "Summarise this phone call between a care coordinator and an older adult in 2-3 plain sentences "
    "for the coordinator. Mention symptoms, mood, medicines and any follow-up. Never state or imply "
    "a diagnosis and never advise changing medication. Names are masked tokens; keep them as-is."
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CallService:
    def __init__(self, db: Session, *, telephony=None, stt=None, llm=None, storage=None):
        self.db = db
        self.telephony = telephony or get_telephony()
        self.stt = stt or get_stt()
        self.llm = llm or get_llm()
        self.storage = storage or get_storage()

    # ---- starting a call ---------------------------------------------------------------
    def start_call(self, *, senior_id: str, recording_consent: bool, initiator: str = "coordinator",
                   coordinator_id: uuid.UUID | None = None, coordinator_phone: str | None = None,
                   senior_phone: str | None = None) -> Call:
        settings = get_settings()
        if not recording_consent:
            raise AppError("Both people must be told the call is recorded before it starts.",
                           code="consent_required", status_code=400)
        senior = self.db.get(Senior, senior_id) or _missing("Senior", senior_id)
        coordinator = self.db.get(User, coordinator_id or senior.coordinator_id) or _missing("Coordinator", "")
        contact = self.db.get(SeniorContact, senior_id)
        c_phone = coordinator_phone or coordinator.phone
        s_phone = senior_phone or (contact.phone if contact else None)
        if settings.telephony_provider == "exotel":
            for who, number in (("coordinator", c_phone), ("senior", s_phone)):
                if not number or number.startswith(_PLACEHOLDER_PREFIX):
                    raise AppError(f"No dialable phone number for the {who}; pass one explicitly.",
                                   code="no_phone_number", status_code=422)

        call = Call(id=uuid.uuid4(), kind="phone_bridge", senior_id=senior_id, coordinator_id=coordinator.id,
                    provider="exotel", status="queued", started_at=_now(), language=senior.preferred_language,
                    recording_consent=True, consent_at=_now(), transcript_status="pending",
                    model_info={"telephony": settings.telephony_provider, "initiator": initiator})
        self.db.add(call)
        self.db.commit()

        from_number, to_number = (c_phone, s_phone) if initiator == "coordinator" else (s_phone, c_phone)
        try:
            call.provider_call_sid = self.telephony.connect_call(
                from_number=from_number or "", to_number=to_number or "",
                caller_id=settings.exotel_caller_id, status_callback=self._callback_url())
        except Exception as exc:
            logger.exception("Could not start call %s", call.id)
            call.status, call.transcript_status = "failed", "not_applicable"
            self.db.commit()
            raise AppError("The telephony provider could not start the call.", code="telephony_error",
                           status_code=502) from exc
        self.db.commit()
        return call

    # ---- uploading a recording of a conversation (no telephony) --------------------------
    def import_recording(self, *, senior_id: str, audio: bytes, filename: str, recording_consent: bool,
                         initiator: str = "coordinator", coordinator_id: uuid.UUID | None = None,
                         uploaded_by: uuid.UUID | None = None) -> Call:
        """Stores an uploaded conversation and creates the call record; processing runs separately."""
        if not recording_consent:
            raise AppError("Everyone on the recording must have agreed to it.", code="consent_required",
                           status_code=400)
        if len(audio) > MAX_IMPORT_BYTES:
            raise AppError(f"Recording is larger than {MAX_IMPORT_BYTES // (1024 * 1024)} MB.",
                           code="file_too_large", status_code=413)
        suffix = Path(filename or "").suffix.lower()
        if suffix not in AUDIO_TYPES:
            raise AppError(f"Unsupported audio type; use one of {', '.join(sorted(AUDIO_TYPES))}.",
                           code="unsupported_audio", status_code=422)
        try:
            seconds = audio_duration(audio)
        except ValueError as exc:
            raise AppError("The file could not be read as audio.", code="unreadable_audio", status_code=422) from exc
        if seconds > MAX_IMPORT_SECONDS:
            raise AppError(f"Recording is longer than {MAX_IMPORT_SECONDS // 60} minutes.",
                           code="recording_too_long", status_code=422)
        senior = self.db.get(Senior, senior_id) or _missing("Senior", senior_id)
        coordinator = self.db.get(User, coordinator_id or senior.coordinator_id) or _missing("Coordinator", "")
        call_id = uuid.uuid4()
        path = f"calls/{call_id}{suffix}"
        self.storage.put(path, audio, AUDIO_TYPES[suffix])
        now = _now()
        call = Call(id=call_id, kind="phone_bridge", senior_id=senior_id, coordinator_id=coordinator.id,
                    initiated_by_user_id=uploaded_by, provider="import", status="completed",
                    started_at=now - timedelta(seconds=seconds), ended_at=now, duration_sec=int(seconds),
                    language=senior.preferred_language, recording_path=path,
                    recording_expires_at=now + timedelta(days=RETENTION_DAYS), recording_consent=True,
                    consent_at=now, transcript_status="pending",
                    model_info={"source": "upload", "initiator": initiator})
        self.db.add(call)
        self.db.commit()
        return call

    @staticmethod
    def _callback_url() -> str | None:
        s = get_settings()
        if not s.public_base_url:
            return None
        url = f"{s.public_base_url}/api/v1/webhooks/exotel/call-status"
        return f"{url}?token={s.exotel_webhook_secret}" if s.exotel_webhook_secret else url

    # ---- tracking ------------------------------------------------------------------------
    def apply_info(self, call: Call, info: CallInfo) -> None:
        call.status = info.status
        call.duration_sec = info.duration_sec or call.duration_sec
        call.started_at = info.started_at or call.started_at
        call.ended_at = info.ended_at or call.ended_at
        if info.recording_url:
            call.model_info = {**(call.model_info or {}), "recording_url": info.recording_url}
        self.db.commit()

    def by_sid(self, sid: str) -> Call | None:
        return self.db.scalar(select(Call).where(Call.provider_call_sid == sid))

    # ---- processing the recording --------------------------------------------------------
    def finalize(self, call_id: uuid.UUID) -> Call:
        call = self.db.get(Call, call_id) or _missing("Call", str(call_id))
        if call.transcript_status == "done":
            return call
        if call.recording_path:
            audio = self.storage.get(call.recording_path)
        else:
            url = (call.model_info or {}).get("recording_url")
            if not url:
                self.apply_info(call, self.telephony.get_call(call.provider_call_sid))
                url = (call.model_info or {}).get("recording_url")
            if not url:
                raise AppError("The recording is not available yet.", code="recording_not_ready", status_code=409)
            audio = self.telephony.download_recording(url)
            path = f"calls/{call.id}.mp3"
            self.storage.put(path, audio, "audio/mpeg")
            call.recording_path, call.recording_expires_at = path, _now() + timedelta(days=RETENTION_DAYS)

        segments = self.stt.transcribe(audio, call.language)
        # Assumption to verify on the first real recording: channel 0 is the person dialled first.
        first, second = (("coordinator", "senior") if (call.model_info or {}).get("initiator", "coordinator")
                         == "coordinator" else ("senior", "coordinator"))
        for seg in segments:
            if seg.speaker is None and seg.channel is not None:
                seg.speaker = (first, second)[seg.channel]
        self.db.execute(delete(CallTurn).where(CallTurn.call_id == call.id))
        for i, seg in enumerate(segments):
            self.db.add(CallTurn(id=uuid.uuid4(), call_id=call.id, turn_index=i, speaker=seg.speaker or "unknown",
                                 text=seg.text, language=call.language, stt_confidence=seg.confidence,
                                 offset_ms=seg.start_ms))

        senior_says = [s.text for s in segments if s.speaker in (None, "senior", "unknown")] or [s.text for s in segments]
        cues = extract_cues(senior_says)
        self.db.execute(delete(NlpCue).where(NlpCue.source_type == "call", NlpCue.source_id == str(call.id)))
        for cue in cues:
            self.db.add(NlpCue(id=uuid.uuid4(), source_type="call", source_id=str(call.id),
                               senior_id=call.senior_id, extractor_version=EXTRACTOR_VERSION, **cue))

        call.summary = self._summarise(call, segments)
        call.urgency_flag = call.urgency_flag or is_urgent(cues)
        call.transcript_status, call.processed_at = "done", _now()
        call.model_info = {**(call.model_info or {}), "stt": "stub", "llm": "stub"}
        self.db.commit()
        self._after_processing(call)
        return call

    def _after_processing(self, call: Call) -> None:
        """Re-score the senior and tell the coordinator. Failures here never fail the call."""
        from app.core.config import today
        try:
            from app.modules.risk.service import rescore_and_rerank
            rescore_and_rerank(self.db, call.senior_id, today(), reason="new_alert" if call.urgency_flag
                               else "post_ai_call")
            self.db.commit()
        except Exception:
            logger.warning("Re-score after call %s skipped", call.id, exc_info=True)
            self.db.rollback()
        if call.coordinator_id:
            try:
                from app.modules.notifications.service import notify
                notify(self.db, call.coordinator_id, "call_summary_ready", "Call summary ready",
                       "A call summary is ready to view.", {"call_id": str(call.id)})
                self.db.commit()
            except Exception:
                logger.warning("Call summary notification skipped", exc_info=True)
                self.db.rollback()

    def _summarise(self, call: Call, segments) -> str:
        contact = self.db.get(SeniorContact, call.senior_id)
        coordinator = self.db.get(User, call.coordinator_id) if call.coordinator_id else None
        names = [n for n in (contact.full_name if contact else None, coordinator.display_name if coordinator else None) if n]
        transcript = "\n".join(f"{s.speaker or 'speaker'}: {s.text}" for s in segments)
        masked, mapping = mask(transcript, names)  # only masked text leaves the system
        try:
            return unmask(self.llm.complete(_SUMMARY_SYSTEM, masked), mapping)
        except Exception:  # a model outage must not stop the recording from being processed
            logger.warning("Call summary model failed for call %s", call.id, exc_info=True)
            return "The call was recorded and transcribed. An automatic summary was not available."


def _missing(what: str, ident: str):
    raise NotFound(f"{what} not found: {ident}".strip(": "))


# ---- background entry points (own session; not tied to a request) -------------------------
def poll_and_finalize(call_id: uuid.UUID, session_factory, *, sleep=time.sleep, **providers) -> None:
    deadline = time.monotonic() + POLL_TIMEOUT_S
    while True:
        with session_factory() as db:
            svc = CallService(db, **providers)
            call = db.get(Call, call_id)
            if call is None or call.transcript_status in ("done", "not_applicable", "failed"):
                return
            try:
                info = svc.telephony.get_call(call.provider_call_sid)
                svc.apply_info(call, info)
                if info.is_terminal and info.status != "completed":
                    call.transcript_status = "not_applicable"
                    db.commit()
                    return
                if info.status == "completed" and info.recording_url:
                    svc.finalize(call_id)
                    return
            except Exception:
                logger.exception("Processing call %s failed", call_id)
                db.rollback()
                call = db.get(Call, call_id)
                call.transcript_status = "failed"
                db.commit()
                return
            if time.monotonic() > deadline:
                call.transcript_status = "failed"
                db.commit()
                return
        sleep(POLL_INTERVAL_S)


def finalize_in_background(call_id: uuid.UUID, session_factory, **providers) -> None:
    with session_factory() as db:
        try:
            CallService(db, **providers).finalize(call_id)
        except Exception:
            logger.exception("Processing call %s failed", call_id)
            db.rollback()
            call = db.get(Call, call_id)
            if call is not None:
                call.transcript_status = "failed"
                db.commit()
