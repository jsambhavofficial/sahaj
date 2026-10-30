"""Stand-ins that need no accounts, so the whole flow runs in development and tests."""

import uuid
from datetime import datetime, timezone

from app.integrations.base import CallInfo, Segment

_STUB_DIALOGUE = [
    ("coordinator", "Namaste ji, main Samarth se bol rahi hoon. Aap kaise hain aaj?"),
    ("senior", "Namaste beta. Thoda chakkar aa raha hai subah se, aur kamzori bhi lag rahi hai."),
    ("coordinator", "Achha, dawai time par li aapne?"),
    ("senior", "Haan, dawai le li hai. Khana kam khaya aaj."),
    ("coordinator", "Theek hai ji, main kal phir call karungi. Dhyan rakhiye."),
]


class StubTelephony:
    """Pretends every call connects and finishes immediately with a recording."""

    def connect_call(self, *, from_number, to_number, caller_id, status_callback, record=True) -> str:
        return f"STUB-{uuid.uuid4().hex[:12]}"

    def get_call(self, sid: str) -> CallInfo:
        now = datetime.now(timezone.utc)
        return CallInfo(sid=sid, status="completed", duration_sec=62, recording_url=f"stub://{sid}.mp3",
                        started_at=now, ended_at=now)

    def download_recording(self, url: str) -> bytes:
        return b"STUB-AUDIO:" + url.encode()


class StubSTT:
    def transcribe(self, audio: bytes, language: str | None) -> list[Segment]:
        return [Segment(text=t, speaker=s, start_ms=i * 6000, confidence=0.9)
                for i, (s, t) in enumerate(_STUB_DIALOGUE)]


class StubLLM:
    def complete(self, system: str, user: str) -> str:
        return "Auto-summary (stub, not a real model): " + " ".join(user.split())[:300]


class StubTTS:
    def synthesize(self, text: str, language: str | None = "hindi", gender: str = "female") -> bytes:
        return b"RIFF....WAVE-stub:" + text.encode()


class StubPush:
    """Records pushes in memory (inspect `.sent` in tests) and logs nothing sensitive."""

    def __init__(self):
        self.sent: list[dict] = []

    def send(self, token: str, title: str, body: str, data: dict[str, str]) -> bool:
        self.sent.append({"token": token, "title": title, "body": body, "data": data})
        return True
