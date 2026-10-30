"""The conversational side of the voice agent.

`ScriptedAgent` asks a fixed question sequence and needs no accounts (used whenever the configured
LLM is the stub). `LLMAgent` asks a real model, but every reply is masked on the way out, checked by
the safety guard, and replaced by the scripted line if the model fails or says something unsafe.
"""

import json
import logging
import re
from functools import lru_cache
from pathlib import Path

from app.core.safety import violations
from app.integrations.base import LLMProvider
from app.integrations.masking import mask, unmask
from app.integrations.stub.providers import StubLLM
from app.modules.checkins.nlp import is_urgent
from app.modules.voice.context_builder import render_context
from app.modules.voice.schemas import CallContext, Stage, Turn

log = logging.getLogger(__name__)
PROMPT_DIR = Path(__file__).parent / "prompts"
_MAX_REPLY_CHARS = 400

# The shared cue extractor only knows "fall"; these are the other phrases that must reach a human now.
_URGENT_TEXT = [re.compile(p, re.IGNORECASE) for p in [
    r"chest\s*pain|seene\s*(?:mein|me|main)\s*(?:bahut\s*)?(?:dard|jalan|bhaari)|सीने\s*में\s*(?:दर्द|जलन)",
    r"(?:can'?t|cannot|unable to)\s*breathe|breathless|saans\s*(?:nahi|nahin|phool|lene mein)|सांस\s*(?:नहीं|फूल)|साँस\s*(?:नहीं|फूल)",
    r"\b(?:faint(?:ed|ing)?|unconscious|behosh|behoshi)\b|बेहोश",
    r"\b(?:fell|gir\s*(?:gaya|gayi|gai|pada|padi))\b|गिर\s*(?:गया|गई|गयी|पड़)",
    r"\b(?:bachao|emergency|ambulance|heart attack)\b|बचाओ",
    r"\bsuicide|marna chahta|marna chahti|jeena nahi|मरना चाहत",
]]


def detect_urgent(text: str, cues: list[dict]) -> bool:
    """True if the senior said something that needs the coordinator right away."""
    return is_urgent(cues) or any(p.search(text or "") for p in _URGENT_TEXT)


@lru_cache
def load_phrases(language: str) -> dict:
    path = PROMPT_DIR / f"scripted_{language}.json"
    if not path.exists():
        path = PROMPT_DIR / "scripted_hinglish.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache
def load_system_prompt(language: str) -> str:
    path = PROMPT_DIR / f"system_{language}.txt"
    if not path.exists():
        path = PROMPT_DIR / "system_hinglish.txt"
    return path.read_text(encoding="utf-8")


def question_count(language: str) -> int:
    return len(load_phrases(language)["questions"])


class ScriptedAgent:
    """Fixed question sequence and a polite goodbye. Works with zero accounts."""
    name = "scripted"

    def __init__(self, language: str, context: CallContext | None = None):
        self.language = language
        self.phrases = load_phrases(language)
        self.context = context or CallContext(language=language)

    def say(self, stage: Stage, history: list[Turn]) -> str:
        p = self.phrases
        if stage.kind == "goodbye":
            return p["goodbye"]
        if stage.kind == "opening":
            first = p["followup"] if self.context.has_open_symptom else p["questions"][0]
            return f"{p['greeting']} {first}"
        ack = p["acks"][(stage.index - 1) % len(p["acks"])]
        return f"{ack} {p['questions'][stage.index]}"


class LLMAgent:
    """Asks a real model. The prompt is masked as one piece so name tokens stay consistent."""
    name = "llm"

    def __init__(self, llm: LLMProvider, language: str, context: CallContext, names: list[str]):
        self.llm = llm
        self.language = language
        self.context = context
        self.names = names
        self.script = ScriptedAgent(language, context)
        self.system = load_system_prompt(language)

    def _task(self, stage: Stage) -> str:
        intended = self.script.say(stage, [])
        if stage.kind == "goodbye":
            return "TASK: Thank the person warmly and say goodbye. Do not ask a question."
        if stage.kind == "opening":
            return ("TASK: Greet the person warmly as Samarth's caller in one short sentence, then ask a simple "
                    f"question about how they are feeling. Question {stage.index + 1} of {stage.total}. "
                    f"Suggested wording: \"{intended}\"")
        return (f"TASK: Acknowledge what they just said in a few kind words (no advice, no diagnosis), then ask "
                f"question {stage.index + 1} of {stage.total}. Suggested wording: \"{self.script.phrases['questions'][stage.index]}\"")

    def build_user_prompt(self, stage: Stage, history: list[Turn]) -> str:
        parts = []
        ctx = render_context(self.context)
        parts.append("CONTEXT:\n" + (ctx or "(none)"))
        if history:
            parts.append("DIALOGUE SO FAR:\n" + "\n".join(f"{t.speaker.title()}: {t.text}" for t in history))
        parts.append(self._task(stage))
        return "\n\n".join(parts)

    def say(self, stage: Stage, history: list[Turn]) -> str:
        masked_prompt, mapping = mask(self.build_user_prompt(stage, history), self.names)
        fallback_line = self.script.say(stage, history)
        try:
            reply = self.llm.complete(self.system, masked_prompt)
        except Exception as e:  # a model outage must not end the call: use the scripted line
            log.warning("LLM failed (%s); using the scripted line", type(e).__name__)
            return fallback_line
        reply = " ".join((reply or "").split()).strip('"')[:_MAX_REPLY_CHARS]
        if not reply:
            return fallback_line
        if violations(reply):
            safe = self.script.phrases["safe_fallback"]
            return fallback_line if stage.kind == "goodbye" else f"{safe} {fallback_line}"
        return unmask(reply, mapping)


def select_agent(llm: LLMProvider, language: str, context: CallContext, names: list[str]):
    """The scripted agent whenever the configured LLM is the stub."""
    if isinstance(llm, StubLLM):
        return ScriptedAgent(language, context)
    return LLMAgent(llm, language, context, names)
