"""End-of-call work: memory items, summary and sentiment. Only uses what the senior said and system facts.

Nothing written here contains a diagnosis, a name or a phone number: items and the rule-based summary are
built from fixed templates, and any model-written summary is guarded and re-masked.
"""

import logging
import re
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.safety import guard_text
from app.integrations.base import LLMProvider
from app.integrations.masking import mask
from app.integrations.stub.providers import StubLLM
from app.modules.voice import repository as repo
from app.modules.voice.agent import PROMPT_DIR
from app.modules.voice.models import Call
from app.modules.voice.schemas import CallContext

log = logging.getLogger(__name__)

SYMPTOM_LABELS = {"pain": "pain", "weakness": "weakness", "dizziness": "dizziness",
                  "low_appetite": "low appetite", "poor_sleep": "poor sleep", "confusion": "confusion",
                  "fall": "a fall"}
MOOD_LABELS = {"low_mood": "low mood or loneliness"}
MISSED_SYSTEM_ITEM = "Medicine marked missed today in the records"
MEDICINE_ISSUE_ITEM = "Senior said a medicine was missed or confusing"
URGENT_PROMISE_ITEM = "Coordinator to call the senior about an urgent report"

_POSITIVE = re.compile(r"\b(theek|thik|achha|accha|acchi|achhi|badhiya|better|fine|good|normal|sudhar|improved|no problem)\b"
                       r"|ठीक|अच्छ|बेहतर|सुधार", re.IGNORECASE)
_MED_NOT_TAKEN = re.compile(r"(?:dawai|dawa|dawaiyan|medicine|tablet|goli|दवा).{0,25}(?:nahi|nahin|nhi|not|miss|bhool|नहीं|भूल)"
                            r"|(?:nahi|not|didn'?t|bhool).{0,25}(?:dawai|dawa|medicine|tablet|goli)", re.IGNORECASE)
_MED_TAKEN = re.compile(r"(?:dawai|dawa|dawaiyan|medicine|tablet|goli).{0,20}(?:le li|le liya|li hai|kha li|taken|took)"
                        r"|(?:took|taken|le li|le liya|kha li).{0,20}(?:dawai|dawa|medicine|tablet|goli)", re.IGNORECASE)


def _remember(db: Session, call: Call, kind: str, content: str, now: datetime, day: date,
              follow_up_days: int | None = 1) -> None:
    item = repo.find_memory_item(db, call.senior_id, kind, content)
    if item:
        item.last_seen_at, item.last_seen_call_id = now, call.id
        return
    repo.add_memory_item(db, senior_id=call.senior_id, kind=kind, content=content, status="open",
                         first_seen_call_id=call.id, last_seen_call_id=call.id,
                         first_seen_at=now, last_seen_at=now,
                         follow_up_after=day + timedelta(days=follow_up_days) if follow_up_days else None)


def _resolve(db: Session, call: Call, kind: str, content: str, now: datetime) -> bool:
    item = repo.find_memory_item(db, call.senior_id, kind, content)
    if item is None:
        return False
    item.status, item.resolved_at, item.last_seen_at, item.last_seen_call_id = "resolved", now, now, call.id
    return True


def update_memory(db: Session, call: Call, senior_turns: list[tuple[str, list[dict]]], ctx: CallContext, *,
                  urgent: bool, now: datetime, day: date) -> dict:
    """Create, refresh and resolve senior_memory_items. Returns counts and names for the summary."""
    mentioned: list[str] = []
    resolved: list[str] = []
    took_medicine = False
    for text, cues in senior_turns:
        present = [c for c in cues if c["cue_value"] == "present" and c["temporal_context"] != "historical"]
        present_types = {c["cue_type"] for c in present}
        positive = bool(_POSITIVE.search(text))
        for c in present:
            if c["cue_type"] in SYMPTOM_LABELS:
                label = SYMPTOM_LABELS[c["cue_type"]]
                _remember(db, call, "symptom", f"Senior reported {label}", now, day)
                if label not in mentioned:
                    mentioned.append(label)
            elif c["cue_type"] in MOOD_LABELS:
                label = MOOD_LABELS[c["cue_type"]]
                _remember(db, call, "mood", f"Senior reported {label}", now, day)
                if label not in mentioned:
                    mentioned.append(label)
        if _MED_NOT_TAKEN.search(text) and not _MED_TAKEN.search(text) or "medication_issue" in present_types:
            _remember(db, call, "medication_issue", MEDICINE_ISSUE_ITEM, now, day)
            mentioned.append("a missed medicine")
        elif _MED_TAKEN.search(text):
            took_medicine = True
            for content in (MEDICINE_ISSUE_ITEM, MISSED_SYSTEM_ITEM):
                if _resolve(db, call, "medication_issue", content, now):
                    resolved.append("medicine")
        for c in cues:
            if c["cue_value"] == "absent" and positive and not present_types:
                if c["cue_type"] in SYMPTOM_LABELS and _resolve(db, call, "symptom", f"Senior reported {SYMPTOM_LABELS[c['cue_type']]}", now):
                    resolved.append(SYMPTOM_LABELS[c["cue_type"]])
                if c["cue_type"] in MOOD_LABELS and _resolve(db, call, "mood", f"Senior reported {MOOD_LABELS[c['cue_type']]}", now):
                    resolved.append(MOOD_LABELS[c["cue_type"]])
        if any(c["cue_type"] == "recovery" and c["cue_value"] == "present" for c in cues) and not present_types - {"recovery"}:
            for item in repo.open_memory_items(db, call.senior_id, limit=50):
                if item.kind in ("symptom", "mood") and item.first_seen_call_id != call.id:
                    _resolve(db, call, item.kind, item.content, now)
                    resolved.append(item.content.replace("Senior reported ", ""))
        lowered = text.lower()
        for hobby in ctx.hobbies[:10]:
            words = hobby.replace("_", " ").lower()
            if words and words in lowered:
                _remember(db, call, "topic", f"Enjoys talking about {words}", now, day, follow_up_days=None)
    if ctx.missed_medicines_today and not took_medicine:
        _remember(db, call, "medication_issue", MISSED_SYSTEM_ITEM, now, day)
    if urgent:
        _remember(db, call, "promise", URGENT_PROMISE_ITEM, now, day, follow_up_days=0)
    return {"mentioned": mentioned, "resolved": resolved}


def rule_based_summary(language: str, answers: int, facts: dict, ctx: CallContext, *, urgent: bool, ended_early: bool) -> str:
    parts = [f"AI wellbeing call in {language}; the senior answered {answers} question{'s' if answers != 1 else ''}."]
    if facts["mentioned"]:
        parts.append("Mentioned: " + ", ".join(dict.fromkeys(facts["mentioned"])) + ".")
    else:
        parts.append("No new concerns were mentioned.")
    if facts["resolved"]:
        parts.append("Now said to be better: " + ", ".join(dict.fromkeys(facts["resolved"])) + ".")
    if ctx.missed_medicines_today:
        parts.append("Records show a medicine marked missed today.")
    if urgent:
        parts.append("An urgent phrase was heard; the senior was told the coordinator will call.")
    if ended_early:
        parts.append("The call ended early.")
    return guard_text(" ".join(parts))


def summarize(llm: LLMProvider, language: str, transcript: list[tuple[str, str]], fallback: str, names: list[str]) -> str:
    """A model-written summary when a real LLM is configured; otherwise (or on any problem) `fallback`.
    The transcript is masked before leaving, and the result is guarded and re-masked before it is stored."""
    if isinstance(llm, StubLLM) or not transcript:
        return fallback
    try:
        system = (PROMPT_DIR / "summary_system.txt").read_text(encoding="utf-8")
        masked, _ = mask("\n".join(f"{who}: {text}" for who, text in transcript), names)
        text = " ".join((llm.complete(system, masked) or "").split())[:600]
        if not text:
            return fallback
        safe = guard_text(text, fallback)
        return mask(safe, names)[0]
    except Exception:
        log.warning("summary model failed; using rule-based summary", exc_info=True)
        return fallback


def sentiment(cues: list[dict], urgent: bool) -> str:
    present = [c["cue_type"] for c in cues if c["cue_value"] == "present"]
    if urgent or any(t in SYMPTOM_LABELS or t in MOOD_LABELS for t in present):
        return "concerned"
    return "positive" if "no_new_concern" in present or "recovery" in present else "neutral"
