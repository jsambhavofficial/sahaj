"""The conversational side of the voice agent.

`ScriptedAgent` asks a fixed question sequence and needs no accounts (used whenever the configured
LLM is the stub). `LLMAgent` asks a real model, but every reply is masked on the way out, checked by
the safety guard, and replaced by the scripted line if the model fails or says something unsafe.
"""

import json
import logging
import re
from difflib import SequenceMatcher
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
FOLLOWUP_TURNS = 3  # extra turns the LLM agent may spend on follow-ups beyond the fixed topics

# The shared cue extractor only knows "fall"; these are the other phrases that must reach a human now.
_URGENT_TEXT = [re.compile(p, re.IGNORECASE) for p in [
    r"chest\s*pain|seene\s*(?:mein|me|main)\s*(?:bahut\s*)?(?:dard|jalan|bhaari)|सीने\s*में\s*(?:दर्द|जलन)",
    r"(?:can'?t|cannot|unable to)\s*breathe|breathless|saans\s*(?:nahi|nahin|phool|lene mein)|सांस\s*(?:नहीं|फूल)|साँस\s*(?:नहीं|फूल)",
    r"\b(?:faint(?:ed|ing)?|unconscious|behosh|behoshi)\b|बेहोश",
    r"dil\s*(?:baith|dooba|doob)|दिल\s*(?:बैठ|डूब)",
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


def _norm(text: str) -> str:
    return re.sub(r"[\W_]+", " ", text.lower()).strip()


def _question_part(text: str) -> str:
    """The question in a reply: its last sentence (the first part is usually just an acknowledgement)."""
    sentences = [x for x in re.split(r"(?<=[?।.])\s+", text.strip()) if x]
    questions = [x for x in sentences if x.endswith("?")]
    return _norm((questions or sentences or [text])[-1])


def _is_repeat(text: str, history: list[Turn]) -> bool:
    """True if `text` asks (nearly) what the agent already asked, so the senior is never asked the same thing twice."""
    q = _question_part(text)
    return any(SequenceMatcher(None, q, _question_part(t.text)).ratio() > 0.8 or SequenceMatcher(None, _norm(text), _norm(t.text)).ratio() > 0.85
               for t in history if t.speaker == "agent")


def _one_question(reply: str) -> str:
    """Keep the acknowledgement and the first question; drop any further questions (one question per turn)."""
    sentences = [x for x in re.split(r"(?<=[?।.])\s+", reply.strip()) if x]
    kept = []
    for sentence in sentences:
        kept.append(sentence)
        if sentence.endswith("?"):
            break
    return " ".join(kept)


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
        qs = p["questions"]
        return f"{ack} {qs[stage.index] if stage.index < len(qs) else p.get('more', qs[-1])}"


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

    def _task(self, stage: Stage, history: list[Turn]) -> str:
        intended = self.script.say(stage, [])
        if stage.kind == "goodbye":
            return "TASK: Thank the person warmly and say goodbye. Do not ask a question."
        if stage.kind == "opening":
            return ("TASK: Greet the person warmly as Samarth's caller in one short sentence, then ask a simple "
                    f"question about how they are feeling. Suggested wording: \"{intended}\"")
        topics = "\n".join(f"- {q}" for q in self.script.phrases["questions"])
        asked = "\n".join(f"- {t.text}" for t in history if t.speaker == "agent") or "- (nothing yet)"
        left = max(1, stage.total - stage.index)
        return (
            "TASK: The person has just answered. Your job is ONLY to collect answers to the decided questions—never inform, teach, or advise them. Reply in at most two short sentences.\n"
            "1) Briefly acknowledge what THEY said in a few warm words.\n"
            "2) Choose your ONE question using this exact decision flow:\n"
            "   - CASE A (Clear answer + no issue mentioned): If their first response already gives the information needed for the question you asked and mentions no issue from the Important / Useful Issues List, DO NOT ask a follow-up. Ask the next decided question below.\n"
            "   - CASE B (Vague / incomplete answer): If their response does not meaningfully answer the question you asked or is not elaborate enough, ask a clarifying follow-up question that helps them answer the original question better.\n"
            "   - CASE C (Answer mentions an Important / Useful Issue): If they answered the question AND also mentioned something from the Important / Useful Issues List (1. falls/slips/injury, 2. dizziness/vertigo, 3. chest/joint/body pain, 4. breathing trouble, 5. severe weakness/fatigue, 6. fever/swelling/urinary discomfort, 7. poor sleep or skipped meals/low appetite, 8. loneliness/anxiety/memory confusion, 9. missed/confusing/finished medicines, or 10. needing escort/groceries/app help/coordinator support—e.g. 'Yes I took the medicine, btw I felt dizzy'), ask a follow-up question about that specific issue (since when, how bad is it now, or what help they need).\n"
            "   - HARD CAP OF 2 FOLLOW-UPS: Ask at most 2 follow-up questions per decided question (whether clarifying or probing an issue). After 2 follow-ups, drop the topic whatever the result is and ask the NEXT decided question (not another follow-up).\n"
            f"DECIDED QUESTIONS TO COVER (each once, any order):\n{topics}\n"
            f"QUESTIONS YOU HAVE ALREADY ASKED (never repeat or rephrase any of them):\n{asked}\n"
            f"TURNS LEFT including this one: {left}. Cover every decided question before the turns run out, "
            "so skip a follow-up when turns left is not more than the decided questions still uncovered.\n"
            "STRICT RULES:\n"
            "- Use only what the person actually said. Never invent or assume any detail (for example never say there is "
            "no food at home unless they said so).\n"
            "- Read the whole dialogue. If they have already told you something (sleep, food, medicine, mood), that decided question is "
            "COVERED even if it is on the list: do not ask about it again.\n"
            "- Do not call the person sir, madam or सर (it is confused with सर meaning head); just say आप or जी.\n"
            "- Ask about their situation, never make a suggestion in question form (not 'will you try to eat?', "
            "'will you rest?', 'have you seen a doctor?').\n"
            "- Never give advice or tell them to eat, rest, drink, take medicine or see a doctor; never diagnose. "
            "If something sounds serious, just say their coordinator will be told.\n"
            "- When every decided question is covered and no follow-up is needed, ask if there is anything else they want to share.")

    def build_user_prompt(self, stage: Stage, history: list[Turn]) -> str:
        parts = []
        ctx = render_context(self.context)
        parts.append("CONTEXT:\n" + (ctx or "(none)"))
        if history:
            parts.append("DIALOGUE SO FAR:\n" + "\n".join(f"{t.speaker.title()}: {t.text}" for t in history))
        parts.append(self._task(stage, history))
        return "\n\n".join(parts)

    def _next_unasked(self, stage: Stage, history: list[Turn]) -> str:
        """An acknowledgement plus the first scripted topic not asked yet (or the generic closing question)."""
        p = self.script.phrases
        ack = p["acks"][max(stage.index - 1, 0) % len(p["acks"])]
        for q in p["questions"]:
            if not _is_repeat(q, history):
                return f"{ack} {q}"
        return f"{ack} {p.get('more', p['questions'][-1])}"

    def say(self, stage: Stage, history: list[Turn]) -> str:
        masked_prompt, mapping = mask(self.build_user_prompt(stage, history), self.names)
        fallback_line = self.script.say(stage, history)
        try:
            reply = self.llm.complete(self.system, masked_prompt)
        except Exception as e:  # a model outage must not end the call: use the scripted line
            log.warning("LLM failed (%s); using the scripted line", type(e).__name__)
            return fallback_line
        reply = " ".join((reply or "").split()).strip('"')[:_MAX_REPLY_CHARS]
        reply = _one_question(reply)
        if reply and _is_repeat(reply, history):
            log.info("LLM repeated an earlier question; asking the next topic it has not asked")
            return self._next_unasked(stage, history)
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
