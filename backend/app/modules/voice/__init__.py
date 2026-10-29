"""Voice module package."""

from app.modules.voice.router import router as voice_router
from app.modules.voice.service import VoiceNoteService

__all__ = ["voice_router", "VoiceNoteService"]
