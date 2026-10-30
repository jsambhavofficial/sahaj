"""Sarvam AI speech services: speech-to-text (Saaras) and text-to-speech (Bulbul) over plain REST.

Both calls authenticate with the `api-subscription-key` header. Same shape as the Bhashini adapter, so
the factory can swap one for the other with a setting.
"""

import base64
import logging
import time

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.sarvam.ai"
RETRY_STATUSES = {429, 502, 503, 504}
LANGUAGE_CODES = {"hindi": "hi-IN", "hinglish": "hi-IN", "english": "en-IN"}


class SarvamError(Exception):
    pass


def language_code(language: str | None) -> str:
    return LANGUAGE_CODES.get((language or "hindi").lower(), "hi-IN")


class SarvamClient:
    def __init__(self, *, api_key: str, stt_model: str = "saaras:v4", tts_model: str = "bulbul:v4-flash",
                 tts_speaker: str = "", http: httpx.Client | None = None, sleep=time.sleep, attempts: int = 3):
        if not api_key:
            raise SarvamError("SARVAM_API_KEY is not set")
        self.api_key, self.stt_model, self.tts_model, self.tts_speaker = api_key, stt_model, tts_model, tts_speaker
        self.http = http or httpx.Client(timeout=60)
        self.sleep, self.attempts = sleep, attempts

    def _post(self, path: str, **kwargs) -> dict:
        last = ""
        for attempt in range(self.attempts):
            try:
                r = self.http.post(f"{BASE_URL}{path}", headers={"api-subscription-key": self.api_key}, **kwargs)
            except httpx.TransportError as exc:
                last = f"network error: {exc}"
            else:
                if r.status_code == 200:
                    return r.json()
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUSES:
                    raise SarvamError(f"Sarvam request failed: {last} {r.text[:150]}")
            if attempt < self.attempts - 1:
                self.sleep(2 ** attempt)
        raise SarvamError(f"Sarvam is unavailable ({last})")

    def asr(self, wav: bytes, language: str = "hi-IN") -> str:
        data = {"model": self.stt_model, "language_code": language}
        out = self._post("/speech-to-text", data=data, files={"file": ("audio.wav", wav, "audio/wav")})
        return (out.get("transcript") or "").strip()

    def tts(self, text: str, language: str = "hi-IN") -> bytes:
        body = {"text": text, "language_code": language, "model": self.tts_model, "output_audio_codec": "wav"}
        if self.tts_speaker:
            body["speaker"] = self.tts_speaker
        audios = self._post("/text-to-speech", json=body).get("audios") or []
        if not audios:
            raise SarvamError("Sarvam returned no audio")
        return base64.b64decode(audios[0])


class SarvamSTT:
    """Same contract as BhashiniSTT: each utterance of each channel is transcribed, then interleaved by time."""

    def __init__(self, client: SarvamClient, workers: int = 4):
        self.client, self.workers = client, workers

    def transcribe(self, audio: bytes, language: str | None):
        from concurrent.futures import ThreadPoolExecutor

        from app.integrations.audio import split_chunks
        from app.integrations.base import Segment

        lang = language_code(language)
        chunks = split_chunks(audio)
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            texts = list(pool.map(lambda c: self.client.asr(c.wav, lang), chunks))
        segments = [Segment(text=text, start_ms=c.start_ms, channel=c.channel if c.channels > 1 else None,
                            speaker=None if c.channels > 1 else "unknown")
                    for c, text in zip(chunks, texts) if text]
        return sorted(segments, key=lambda s: (s.start_ms or 0, s.channel or 0))


class SarvamTTS:
    def __init__(self, client: SarvamClient):
        self.client = client

    def synthesize(self, text: str, language: str | None = "hindi", gender: str = "female") -> bytes:
        return self.client.tts(text, language_code(language))
