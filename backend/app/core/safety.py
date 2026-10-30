"""One guard for every piece of generated text shown to seniors or family.

The product is not a diagnosis tool: generated text must never tell someone they have a
condition and must never advise starting, stopping or changing a medicine or dose.
"""

import re

_PATTERNS = {
    "diagnosis": [
        r"\byou (?:have|are suffering from|might have|may have|probably have|likely have)\b"
        r"\s+(?:a\s+|an\s+)?(?:diabet|hypertens|depress|dementia|alzheimer|heart|cardiac|stroke|"
        r"pneumonia|infection|cancer|arthritis|anemi|anaemi|copd|asthma|parkinson)",
        r"\b(?:diagnos(?:is|ed|e)|aapko .{0,30}(?:bimari|rog) hai|aapko (?:sugar|diabetes|bp|"
        r"depression|dementia) hai)\b",
    ],
    "medication_change": [
        r"\b(?:stop|skip|increase|decrease|reduce|double|halve|change|start|take extra|"
        r"take more|take less)\b.{0,25}\b(?:medicine|medication|tablet|pill|dose|dosage|insulin|dawai|dawa)\b",
        r"\b(?:dawai|dawa|tablet|goli|dose)\b.{0,25}\b(?:band kar|badha|kam kar|chhod|mat lo|extra lo)\b",
    ],
    "false_reassurance": [
        r"\b(?:nothing to worry|don'?t worry about it|you are (?:perfectly )?fine|medically fine|"
        r"koi chinta ki baat nahi|sab theek hai, doctor ki zaroorat nahi)\b",
    ],
}
_COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in _PATTERNS.items()}

SAFE_FALLBACK = "Please speak to your care coordinator about this. They will call you."


def violations(text: str) -> list[str]:
    """Names of the rule groups the text breaks (empty list when it is safe)."""
    return [group for group, pats in _COMPILED.items() if any(p.search(text or "") for p in pats)]


def is_safe(text: str) -> bool:
    return not violations(text)


def guard_text(text: str, fallback: str = SAFE_FALLBACK) -> str:
    """Return `text` unchanged if safe, otherwise `fallback`."""
    return text if is_safe(text) else fallback
