"""Deterministic (zero-LLM) call transcript cleaner.

Goal: reduce LLM hallucination on coordinator <-> senior calls by
  1. pairing coordinator questions with senior answers,
  2. tagging third-party gossip clause-by-clause,
  3. dropping chit-chat pairs only when it is provably safe.
"""

from dataclasses import dataclass, field
import re
from typing import Dict, List


def _compile(words: List[str]) -> re.Pattern:
    """Compile Roman-script (Hinglish / English) alternatives into one whole-word, case-insensitive regex."""
    return re.compile(r"(?<![a-z])(?:" + "|".join(words) + r")(?![a-z])", re.IGNORECASE)


# Transcripts arrive in Roman script (Hinglish), so spellings vary: nahi/nahin/nhi, chakkar/chakar, dawai/davai...
_NAHI = r"(?:nahi+n?|nahee|nehi|nhi|nai)"

# Anything that carries clinical / operational / emotional signal. A pair containing one is never dropped.
SIGNAL_RE = _compile([
    # pain / symptoms
    r"dard\w*", r"darad", r"pain\w*", r"ache", r"aching", r"chak+ar\w*", r"chakr\w*", r"dizz\w*", r"vertigo",
    r"kam[zj]o+r\w*", r"weak\w*", r"sa+ns", r"saas", r"breath\w*", r"beh?osh\w*", r"bhosh", r"ch+h?a+ti", r"seena", r"seene", r"chest",
    r"ulti", r"bukh+a+r", r"fever", r"kh?oon", r"sujan", r"swelling", r"ne+nd", r"nind", r"sleep\w*", r"bh?ookh", r"appetite",
    r"thak\w*", r"sust", r"ghabra\w*", r"bechaini", r"darr?", r"dar\s+lag\w*", r"tension",
    # falls / injury
    r"gir\s+(?:gaya|gayi|gaye|gya|gyi|pada|padi|padha|padhi)", r"girte", r"girna", r"fell", r"fall\w*", r"slip\w*", r"ph?isal\w*",
    r"chot\w*", r"injur\w*",
    # medicines
    r"dawa\w*", r"dava\w*", r"medicine\w*", r"goli", r"tablet\w*", r"strip", r"insulin", r"refill", r"khatam", r"pharmacy", r"medical",
    # care / logistics / service
    r"doctor", r"hospital", r"station", r"gaadi", r"gadi", r"cab", r"escort", r"ration", r"sabzi", r"app", r"phone", r"mobile",
    r"help", r"madad", r"coordinator", r"jaldi", r"tez\s+bol\w*", r"samajh\s+" + _NAHI, r"club", r"booking",
    # mood / cognition
    r"akel\w*", r"lonely", r"udaa?s", r"rona", r"ro\s+(?:raha|rahi)", r"man\s+" + _NAHI + r"\s+lag\w*", r"bh?ool\w*", r"yaad\s+" + _NAHI,
    r"confus\w*", r"takleef", r"taklif",
])

# Coordinator small talk.
PHATIC_Q_RE = _compile([
    r"namaste", r"namaskar", r"pranam", r"kaise\s+hain?", r"kaisi\s+hain?", r"kya\s+haal", r"chai", r"nashta", r"khana\s+kha\w*", r"mausam",
    r"aur\s+bataiye", r"aur\s+suniye", r"sab\s+th(?:ee?|i)k", r"sab\s+badhiya", r"good\s+morning", r"hello", r"how\s+are\s+you",
    r"thank\s*you", r"dhanyavaad", r"shukriya", r"phir\s+milte", r"rakhti\s+hoo?n", r"rakhta\s+hoo?n", r"take\s+care",
])

# Senior pleasantries.
PHATIC_A_RE = _compile([
    r"namaste", r"namaskar", r"pranam", r"sab\s+th(?:ee?|i)k", r"sab\s+badhiya", r"badhiya", r"th(?:ee?|i)k\s+hu+n?", r"th(?:ee?|i)k\s+hoo?n?",
    r"th(?:ee?|i)k\s+hai", r"kripa", r"bhagwan", r"mausam", r"thand", r"garmi", r"baarish", r"chai", r"pee\s+li", r"shukriya", r"dhanyavaad",
])

# "I'm doing fine" style statements worth telling the LLM about (possible feeling_good moderator).
WELL_RE = _compile([r"sab\s+th(?:ee?|i)k", r"sab\s+badhiya", r"badhiya", r"th(?:ee?|i)k\s+hu+n?", r"th(?:ee?|i)k\s+hoo?n?", r"aaram", r"fine", r"all\s+good"])

# Other people mentioned by the senior (neighbours, named acquaintances, pronouns for them).
THIRD_PARTY_RE = _compile([
    r"padosi", r"padosan", r"neighbou?r", r"(?:sharma|gupta|verma|singh|mishra|yadav|khanna|iyer|reddy|patel)(?:\s*(?:ji|sahab|saab|uncle|aunty))?",
    r"unko", r"unke", r"unka", r"unki", r"unhe", r"unhein", r"unhone", r"woh\s+log", r"un\s+logon",
])

# If any of these appear in the same clause, the senior is talking about themselves.
SELF_RE = _compile([r"mujhe", r"mujhko", r"mereko", r"mere\s+ko", r"mera", r"meri", r"mere", r"main", r"mai", r"maine", r"mene",
                    r"hamein", r"hame", r"humein", r"hum", r"hamara", r"hamari", r"i", r"my"])


THIRD_PARTY_TAG = "[THIRD-PARTY, not the senior]"
PLEASANTRY_NOTE = "[NOTE: senior gave routine pleasantries / said all is fine]"
UNPROMPTED_Q = "[Unprompted - senior initiated]"
NO_ANSWER = "[No verbal response]"


@dataclass
class CallPair:
    index: int
    coordinator: str
    senior: str  # cleaned text with third-party clauses tagged
    senior_self_text: str  # only clauses attributable to the senior
    initiated_by: str = "coordinator"  # or "senior"


@dataclass
class CleanedCall:
    pairs: List[CallPair] = field(default_factory=list)
    dropped_pairs: int = 0
    pleasantry_seen: bool = False

    @property
    def self_text(self) -> str:
        """Everything the senior said about themselves (ground truth for evidence checks)."""
        return " ".join(p.senior_self_text for p in self.pairs if p.senior_self_text)

    def to_prompt_block(self) -> str:
        lines: List[str] = []
        for p in self.pairs:
            lines.append(f"[PAIR {p.index}]")
            lines.append(f"Coordinator: {p.coordinator}")
            lines.append(f"Senior: {p.senior}")
            lines.append("")
        if self.pleasantry_seen:
            lines.append(PLEASANTRY_NOTE)
        return "\n".join(lines).strip()


def _normalize_speaker(raw: str) -> str:
    s = (raw or "").lower()
    if any(k in s for k in ("coord", "agent", "caregiver", "nurse", "staff")):
        return "coordinator"
    if any(k in s for k in ("senior", "elder", "patient", "member", "user")):
        return "senior"
    return "unknown"


def _clauses(text: str) -> List[str]:
    return [c.strip() for c in re.findall(r"[^,;.?!]+[,;.?!]*", text) if c.strip()]


class DeterministicCallCleaner:
    """Runs locally in a few milliseconds with no model calls."""

    @classmethod
    def clean(cls, turns: List[Dict[str, str]]) -> CleanedCall:
        merged = cls._merge_turns(turns)
        result = CleanedCall()
        idx = 0
        i = 0
        while i < len(merged):
            speaker, text = merged[i]
            if speaker == "coordinator":
                answer = ""
                if i + 1 < len(merged) and merged[i + 1][0] == "senior":
                    answer = merged[i + 1][1]
                    i += 1
                if not answer:
                    result.dropped_pairs += 1  # question with no senior words carries no evidence
                else:
                    cls._add_pair(result, text, answer, "coordinator")
            elif speaker == "senior":
                cls._add_pair(result, UNPROMPTED_Q, text, "senior")
            i += 1

        # Re-number kept pairs sequentially for a clean prompt.
        for n, p in enumerate(result.pairs, start=1):
            p.index = n
        return result

    @staticmethod
    def _merge_turns(turns: List[Dict[str, str]]) -> List[tuple]:
        merged: List[tuple] = []
        for t in turns or []:
            text = (t.get("text") or "").strip()
            if not text:
                continue
            sp = _normalize_speaker(t.get("speaker", ""))
            if sp == "unknown":
                continue
            if merged and merged[-1][0] == sp:
                merged[-1] = (sp, merged[-1][1] + " " + text)
            else:
                merged.append((sp, text))
        return merged

    @classmethod
    def _add_pair(cls, result: CleanedCall, question: str, answer: str, initiated_by: str) -> None:
        q_signal = bool(SIGNAL_RE.search(question)) and question != UNPROMPTED_Q
        a_signal = bool(SIGNAL_RE.search(answer))
        q_phatic = bool(PHATIC_Q_RE.search(question)) and not q_signal
        a_phatic = bool(PHATIC_A_RE.search(answer))

        # Golden rule: never drop on the question alone; only drop when neither side carries signal.
        if not q_signal and not a_signal and (q_phatic or a_phatic or initiated_by == "senior"):
            result.dropped_pairs += 1
            if WELL_RE.search(answer):
                result.pleasantry_seen = True
            return

        tagged: List[str] = []
        self_parts: List[str] = []
        about_other = False  # third-party context carries over to following clauses until the senior says "I/my"
        for clause in _clauses(answer):
            if SELF_RE.search(clause):
                about_other = False
            elif THIRD_PARTY_RE.search(clause):
                about_other = True
            if about_other:
                tagged.append(f"{THIRD_PARTY_TAG} {clause}")
            else:
                tagged.append(clause)
                self_parts.append(clause)

        self_text = " ".join(self_parts)
        pair = CallPair(
            index=len(result.pairs) + 1,
            coordinator=question,
            senior=" ".join(tagged),
            senior_self_text=self_text,
            initiated_by=initiated_by,
        )
        result.pairs.append(pair)
