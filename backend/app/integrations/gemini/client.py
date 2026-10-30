"""Google Gemini as the LLM provider, over plain REST (generativelanguage.googleapis.com).

The key goes in the `x-goog-api-key` header, never in the URL, so it cannot end up in logs. A reply that
Gemini blocks or leaves empty comes back as "" and callers fall back to their scripted text.
"""

import logging
import time

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class GeminiError(Exception):
    pass


class GeminiLLM:
    def __init__(self, *, api_key: str, model: str = "gemini-3.8-flash", temperature: float = 0.4,
                 max_output_tokens: int = 400, timeout: float = 20.0, attempts: int = 2,
                 http: httpx.Client | None = None, sleep=time.sleep):
        if not api_key:
            raise GeminiError("GEMINI_API_KEY is not set")
        self.api_key, self.model = api_key, model
        self.temperature, self.max_output_tokens = temperature, max_output_tokens
        self.http = http or httpx.Client(timeout=timeout)
        self.attempts, self.sleep = attempts, sleep

    def complete(self, system: str, user: str) -> str:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": self.temperature, "maxOutputTokens": self.max_output_tokens},
        }
        url = f"{BASE_URL}/models/{self.model}:generateContent"
        last = ""
        for attempt in range(self.attempts):
            try:
                r = self.http.post(url, headers={"x-goog-api-key": self.api_key}, json=body)
            except httpx.TransportError as exc:
                last = f"network error: {type(exc).__name__}"
            else:
                if r.status_code == 200:
                    return self._text(r.json())
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUSES:
                    raise GeminiError(f"Gemini request failed: {last} {r.text[:150]}")
            if attempt < self.attempts - 1:
                self.sleep(1 + attempt)
        raise GeminiError(f"Gemini is unavailable ({last})")

    @staticmethod
    def _text(data: dict) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            logger.warning("Gemini returned no candidate (blockReason=%s)", (data.get("promptFeedback") or {}).get("blockReason"))
            return ""
        parts = (candidates[0].get("content") or {}).get("parts") or []
        return "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
