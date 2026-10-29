"""NLP processing package for SamarthCare AI."""

from .voice_notes_processing import (
    VoiceNotesProcessor,
    VoiceNoteProcessingResult,
    VoiceEvent,
    TalkingPoint,
)
from .call_processing import CallProcessor, CallProcessingResult
from .call_cleaner import DeterministicCallCleaner
from .prompts import VOICE_NOTE_SYSTEM_PROMPT, CALL_SYSTEM_PROMPT

__all__ = [
    "VoiceNotesProcessor",
    "VoiceNoteProcessingResult",
    "VoiceEvent",
    "TalkingPoint",
    "CallProcessor",
    "CallProcessingResult",
    "DeterministicCallCleaner",
    "VOICE_NOTE_SYSTEM_PROMPT",
    "CALL_SYSTEM_PROMPT",
]
