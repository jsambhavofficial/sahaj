"""Groq as the LLM provider (fast hosted open models), over its OpenAI-compatible chat completions API.

Note this is Groq (groq.com, keys start with `gsk_`), not xAI's Grok. The key goes in the Authorization
header only. An empty reply comes back as "" and callers fall back to their scripted text.
"""

import logging
import time

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.groq.com/openai/v1"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class GroqError(Exception):
    pass


class GroqLLM:
    def __init__(self, *, api_key: str, model: str = "openai/gpt-oss-120b", temperature: float = 0.4,
                 max_tokens: int = 500, reasoning_effort: str = "low", timeout: float = 20.0, attempts: int = 2,
                 http: httpx.Client | None = None, sleep=time.sleep):
        if not api_key:
            raise GroqError("GROQ_API_KEY is not set")
        self.api_key, self.model = api_key, model
        self.temperature, self.max_tokens, self.reasoning_effort = temperature, max_tokens, reasoning_effort
        self.http = http or httpx.Client(timeout=timeout)
        self.attempts, self.sleep = attempts, sleep

    def complete(self, system: str, user: str) -> str:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if self.reasoning_effort:  # gpt-oss models think first; "low" keeps the reply fast and leaves room for text
            body["reasoning_effort"] = self.reasoning_effort
        last = ""
        for attempt in range(self.attempts):
            try:
                r = self.http.post(f"{BASE_URL}/chat/completions", headers={"Authorization": f"Bearer {self.api_key}"}, json=body)
            except httpx.TransportError as exc:
                last = f"network error: {type(exc).__name__}"
            else:
                if r.status_code == 200:
                    return self._text(r.json())
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUSES:
                    raise GroqError(f"Groq request failed: {last} {r.text[:200]}")
            if attempt < self.attempts - 1:
                self.sleep(1 + attempt)
        raise GroqError(f"Groq is unavailable ({last})")

    @staticmethod
    def _text(data: dict) -> str:
        choices = data.get("choices") or []
        text = ((choices[0].get("message") or {}).get("content") or "").strip() if choices else ""
        if not text:
            logger.warning("Groq returned no text (finish_reason=%s)", choices[0].get("finish_reason") if choices else None)
        return text
