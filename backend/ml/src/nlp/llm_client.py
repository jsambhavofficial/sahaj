"""Switchable LLM Provider abstraction for SamarthCare AI NLP.

Supports seamless switching between:
- "gemini" (Google Gemini 1.5/2.0)
- "openai" (OpenAI GPT-4o, GPT-4o-mini)
- "groq" (Groq ultra-fast Llama-3.3 / Mistral)
- "anthropic" (Claude 3.5 Sonnet / Haiku)
- "ollama" / "openai_compatible" (Local vLLM, Ollama, LMStudio)
- "mock" (Deterministic offline heuristic fallback)
"""

from abc import ABC, abstractmethod
import json
import logging
import os
import re
from typing import Dict, Any, Optional
import urllib.request
import urllib.error

logger = logging.getLogger("llm_client")


class BaseLLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Generates a structured JSON response from system and user instructions."""
        pass


class GeminiProvider(BaseLLMProvider):
    """Google Gemini provider (Gemini 1.5/2.0 Flash/Pro)."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        # Try google-genai SDK if available
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config={
                    "system_instruction": system_prompt,
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                },
            )
            return json.loads(response.text)
        except ImportError:
            pass

        # Standard REST endpoint fallback (Zero extra SDK required)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15.0) as response:
            data = json.loads(response.read().decode("utf-8"))

        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw_text)


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    OpenAI, Groq, Together, DeepSeek, and local Ollama/vLLM endpoints.
    Uses standard OpenAI Chat Completions REST spec with response_format: json_object.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system_prompt + "\nYou MUST return valid JSON."},
                {"role": "user", "content": user_prompt},
            ],
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15.0) as response:
            data = json.loads(response.read().decode("utf-8"))

        raw_text = data["choices"][0]["message"]["content"]
        return json.loads(raw_text)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider (Claude 3.5 Sonnet / Haiku)."""

    def __init__(self, api_key: str, model: str = "claude-3-5-haiku-latest"):
        self.api_key = api_key
        self.model = model

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self.model,
            "max_tokens": 2048,
            "system": system_prompt + "\nOutput strictly valid JSON with no preamble or markdown backticks.",
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": 0.1,
        }

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15.0) as response:
            data = json.loads(response.read().decode("utf-8"))

        raw_text = data["content"][0]["text"].strip()
        # Clean potential markdown wrapping if present
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        return json.loads(raw_text)


class MockFallbackProvider(BaseLLMProvider):
    """Deterministic offline fallback provider for dev, local testing, and offline modes."""

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        events = []
        talking_points = []
        lower = user_prompt.lower()

        if re.search(r"\b(chakkar|chakar|dizzy|sir ghoom)\b", lower) and not re.search(r"(chakkar|dard)\s+(nahi)", lower):
            events.append({
                "intent": "PHYSICAL_ILLNESS",
                "category": "RISK",
                "specific_issue": "dizziness_vertigo",
                "status": "present",
                "temporality": "current",
                "severity": "MODERATE",
                "urgency": "SAME_DAY",
                "evidence_text": "chakkar keyword match",
                "confidence": 0.95,
                "risk_delta": 20.0,
                "recommended_action": "Triage for orthostatic hypotension / check BP baseline.",
            })
            talking_points.append({
                "topic": "morning_dizziness",
                "domain": "PHYSICAL_DISCOMFORT",
                "status": "OPEN",
                "priority": 8,
                "target_signal_to_verify": "Did dizziness reoccur upon waking today?",
                "suggested_bot_question_hinglish": "Uncleji, kal aapko jo chakkar sa aaya tha, aaj subah uthne par kaisa laga?",
                "suggested_bot_question_english": "Follow up if dizziness from yesterday reoccurred.",
            })

        if re.search(r"(jaldi jaldi bol|jaldi bol|tez bol|samajh nahi aaya|speed)", lower):
            events.append({
                "intent": "SERVICE_FRICTION",
                "category": "ATTENTION_REQUIRED",
                "specific_issue": "coordinator_pacing",
                "status": "present",
                "temporality": "current",
                "severity": "LOW",
                "urgency": "ROUTINE",
                "evidence_text": "coordinator speech speed match",
                "confidence": 0.9,
                "risk_delta": 5.0,
                "recommended_action": "Advise coordinator to adjust pace of conversation.",
            })
            talking_points.append({
                "topic": "coordinator_communication",
                "domain": "ASSISTANCE_AND_SERVICE",
                "status": "OPEN",
                "priority": 4,
                "target_signal_to_verify": "Did the coordinator speak slowly and clearly on callback?",
                "suggested_bot_question_hinglish": "Mataji, kya coordinator ne dubara baat karke aaram se sab samjha diya tha?",
                "suggested_bot_question_english": "Verify coordinator adjusted speaking pace.",
            })

        has_risk = any(e["category"] == "RISK" for e in events)
        has_attn = any(e["category"] == "ATTENTION_REQUIRED" for e in events)

        return {
            "summary": f"Offline processed note with {len(events)} extracted events.",
            "dominant_sentiment": "ANXIOUS" if has_risk else "NEUTRAL",
            "events": events,
            "talking_points": talking_points,
            "total_nlp_risk_delta": sum(e["risk_delta"] for e in events),
            "requires_clinical_escalation": has_risk,
            "requires_operations_action": has_attn,
        }


def get_llm_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Factory function to instantiate the active LLM provider.
    Default provider priority:
    1. Explicit provider_name argument
    2. LLM_PROVIDER env variable ("gemini", "openai", "groq", "anthropic", "ollama", "mock")
    3. Auto-detected from available API keys: GEMINI_API_KEY -> OPENAI_API_KEY -> ANTHROPIC_API_KEY
    4. MockFallbackProvider (if zero keys configured)
    """
    provider = (provider_name or os.getenv("LLM_PROVIDER", "")).strip().lower()

    # Auto-detect if provider not explicitly set
    if not provider:
        if api_key or os.getenv("GEMINI_API_KEY"):
            provider = "gemini"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        elif os.getenv("GROQ_API_KEY"):
            provider = "groq"
        elif os.getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        else:
            provider = "mock"

    key = api_key or os.getenv("LLM_API_KEY", "")

    if provider == "gemini":
        gemini_key = key or os.getenv("GEMINI_API_KEY", "")
        if not gemini_key:
            logger.warning("No GEMINI_API_KEY found; falling back to Mock provider.")
            return MockFallbackProvider()
        return GeminiProvider(api_key=gemini_key, model=model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))

    elif provider == "openai":
        openai_key = key or os.getenv("OPENAI_API_KEY", "")
        if not openai_key:
            return MockFallbackProvider()
        return OpenAICompatibleProvider(
            api_key=openai_key,
            model=model or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            base_url=base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )

    elif provider == "groq":
        groq_key = key or os.getenv("GROQ_API_KEY", "")
        if not groq_key:
            return MockFallbackProvider()
        return OpenAICompatibleProvider(
            api_key=groq_key,
            model=model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            base_url=base_url or "https://api.groq.com/openai/v1",
        )

    elif provider == "anthropic":
        anthropic_key = key or os.getenv("ANTHROPIC_API_KEY", "")
        if not anthropic_key:
            return MockFallbackProvider()
        return AnthropicProvider(
            api_key=anthropic_key,
            model=model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
        )

    elif provider in ("ollama", "openai_compatible"):
        return OpenAICompatibleProvider(
            api_key=key or "ollama",
            model=model or os.getenv("OLLAMA_MODEL", "llama3"),
            base_url=base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        )

    return MockFallbackProvider()
