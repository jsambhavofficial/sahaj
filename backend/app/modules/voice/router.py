"""WS /ws/voice-agent and HTTP /voice/* endpoints."""

import asyncio
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.concurrency import run_in_threadpool
from pydantic import TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.modules.voice import service
from app.modules.voice.schemas import (
    SimpleMessage,
    StartMessage,
    TalkingPointItem,
    VoiceNoteProcessRequest,
    VoiceNoteProcessResponse,
)
from app.modules.voice.service import VoiceNoteService

log = logging.getLogger(__name__)
router = APIRouter(tags=["voice-agent"])

IDLE_TIMEOUT_SEC = 180
MAX_AUDIO_BYTES = 10 * 1024 * 1024
_client_message = TypeAdapter(StartMessage | SimpleMessage)


def _err(code: str, message: str) -> dict:
    return {"type": "error", "code": code, "message": message}


def get_voice_service() -> VoiceNoteService:
    return VoiceNoteService()


@router.post(
    "/voice/process-note",
    response_model=VoiceNoteProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Senior Voice Note Transcript",
    description=(
        "Ingests senior audio transcript, extracts Risk vs Attention Required events, "
        "computes bounded risk delta, writes to context_repo, triggers risk calculation, "
        "and returns dynamic talking points for future bot check-ins."
    ),
)
def process_voice_note(
    request: VoiceNoteProcessRequest,
    db: Session = Depends(get_db),
    svc: VoiceNoteService = Depends(get_voice_service),
) -> VoiceNoteProcessResponse:
    try:
        return svc.process_voice_note(request, db=db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process voice note transcript: {str(exc)}",
        )


@router.get(
    "/voice/talking-points/{senior_id}",
    response_model=List[TalkingPointItem],
    status_code=status.HTTP_200_OK,
    summary="Get Active Talking Points for Senior",
    description="Returns all active, unresolved talking points from context_repo for dynamic check-in bot question generation.",
)
def get_talking_points(
    senior_id: str,
    db: Session = Depends(get_db),
    svc: VoiceNoteService = Depends(get_voice_service),
) -> List[TalkingPointItem]:
    return svc.get_active_talking_points(senior_id, db=db)


@router.websocket("/ws/voice-agent")
async def voice_agent(ws: WebSocket, token: str = Query(default=""), db: Session = Depends(get_db)):
    """AI wellbeing call. Protocol: docs/api-contract.md section 4 (WebSocket). Closes with 4401 on a bad token."""
    await ws.accept()
    try:
        user, senior = await run_in_threadpool(service.authenticate, db, token)
    except AppError as e:
        await ws.close(code=4401, reason=e.code)
        return

    session = service.new_session(db, user, senior)
    buffer = bytearray()
    try:
        while not session.finished:
            try:
                msg = await asyncio.wait_for(ws.receive(), IDLE_TIMEOUT_SEC)
            except asyncio.TimeoutError:
                for event in await run_in_threadpool(session.finish, "abandoned", "idle_timeout"):
                    await ws.send_json(event)
                break
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                if session.call is None:
                    await ws.send_json(_err("not_started", "Send a start message first"))
                elif len(buffer) + len(msg["bytes"]) > MAX_AUDIO_BYTES:
                    buffer.clear()
                    await ws.send_json(_err("audio_too_large", "This audio clip is too long"))
                else:
                    buffer.extend(msg["bytes"])
                continue
            try:
                parsed = _client_message.validate_python(json.loads(msg.get("text") or ""))
            except (ValueError, ValidationError):
                await ws.send_json(_err("bad_message", "Unrecognised message"))
                continue
            if isinstance(parsed, StartMessage):
                events = await run_in_threadpool(session.start, parsed.language)
            elif parsed.type == "end_utterance":
                audio = bytes(buffer)
                buffer.clear()
                events = await run_in_threadpool(session.handle_utterance, audio)
            else:
                events = await run_in_threadpool(session.end_call)
            for event in events:
                await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("voice-agent socket error")
        if not session.finished and session.call is not None:
            await run_in_threadpool(session.finish, "failed", "server_error")
    finally:
        if not session.finished and session.call is not None:  # client dropped without end_call
            await run_in_threadpool(session.finish, "abandoned", "disconnected")
        try:
            await ws.close(code=1000)
        except Exception:
            pass
