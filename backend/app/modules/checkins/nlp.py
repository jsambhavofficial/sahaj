"""Cue extraction for new text, reusing the rule-based Hindi/English extractor from ml/.

Speech-to-text output has no punctuation, so before extraction each utterance becomes its own
sentence, and Hindi contrast words (लेकिन, मगर, परंतु) start a new one. The extractor's Devanagari
negation list matches "ना" inside ordinary words (खाना, जाना), so we replace it with whole-word matches.
"""

import importlib.util
import re
from functools import lru_cache
from pathlib import Path

_EXTRACTOR_FILE = Path(__file__).resolve().parents[3] / "ml" / "src" / "features" / "nlp_extractor.py"
EXTRACTOR_VERSION = "rules_v1.1"
URGENT_CUES = {"fall"}

_DEVANAGARI = "ऀ-ॿ"
_NEGATION = [
    r"\b(no|not|denies|denied|without|free of|pain-free|\w+-free|zero|none)\b",
    rf"(?<![{_DEVANAGARI}])(नहीं|नही|ना|मुक्त)(?![{_DEVANAGARI}])",
    r"\b(nahi|nahin|na|koi nahi|no)\b",
]
_CONTRAST = re.compile(rf"(?<![{_DEVANAGARI}])(लेकिन|मगर|परंतु)(?![{_DEVANAGARI}])")


@lru_cache
def _extractor():
    spec = importlib.util.spec_from_file_location("samarth_nlp_extractor", _EXTRACTOR_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    extractor = module.ClinicalNLPExtractor()
    extractor.neg_compiled = [re.compile(p, re.IGNORECASE) for p in _NEGATION]
    return extractor


def _prepare(utterances: list[str]) -> str:
    return "\n".join(_CONTRAST.sub("।", u) for u in utterances if u)


def extract_cues(text: str | list[str]) -> list[dict]:
    """text: one string or a list of utterances. Returns dicts shaped like nlp_cues columns."""
    utterances = [text] if isinstance(text, str) else text
    prepared = _prepare(utterances)
    if not prepared or not _EXTRACTOR_FILE.exists():
        return []
    return [dict(cue_type=c.category, cue_value=c.status, temporal_context=c.temporal,
                 negated=c.negation_detected, uncertain=c.uncertainty_detected, confidence=c.confidence)
            for c in _extractor().extract_cues(prepared)]


def is_urgent(cues: list[dict]) -> bool:
    return any(c["cue_type"] in URGENT_CUES and c["cue_value"] == "present" for c in cues)
