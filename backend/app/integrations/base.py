"""Provider interfaces. Real and stub implementations are chosen in integrations/factory.py."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class CallInfo:
    sid: str
    status: str  # queued | in_progress | completed | failed | busy | no_answer
    duration_sec: int | None = None
    recording_url: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in {"completed", "failed", "busy", "no_answer"}


@dataclass
class Segment:
    text: str
    speaker: str | None = None  # "coordinator" | "senior" when known
    start_ms: int | None = None
    confidence: float | None = None
    channel: int | None = None  # recording channel; the service maps it to a speaker


class TelephonyProvider(Protocol):
    def connect_call(self, *, from_number: str, to_number: str, caller_id: str,
                     status_callback: str | None, record: bool = True) -> str:
        """Ring from_number first, then to_number, and join them. Returns the provider call id."""

    def get_call(self, sid: str) -> CallInfo: ...

    def download_recording(self, url: str) -> bytes: ...


class STTProvider(Protocol):
    def transcribe(self, audio: bytes, language: str | None) -> list[Segment]: ...


class TTSProvider(Protocol):
    def synthesize(self, text: str, language: str | None = "hindi", gender: str = "female") -> bytes:
        """WAV audio."""


class LLMProvider(Protocol):
    def complete(self, system: str, user: str) -> str: ...


class StorageProvider(Protocol):
    def put(self, path: str, data: bytes, content_type: str) -> None: ...

    def get(self, path: str) -> bytes: ...

    def delete(self, path: str) -> None: ...


class PushProvider(Protocol):
    def send(self, token: str, title: str, body: str, data: dict[str, str]) -> bool:
        """True if the push was accepted. Title and body must already be generic (no PII)."""
