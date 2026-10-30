"""The only way text should reach an external service: names and phone numbers are replaced
with tokens before sending and can be restored afterwards."""

import re

_PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
_MIN_NAME_LEN = 3
_GENERIC_WORDS = {"care", "coordinator", "senior", "samarth", "demo"}  # role words are not personal data


def mask(text: str, names: list[str] | None = None) -> tuple[str, dict[str, str]]:
    """Returns (masked_text, mapping token -> original)."""
    mapping: dict[str, str] = {}

    def token(kind: str, original: str) -> str:
        for tok, orig in mapping.items():
            if orig.lower() == original.lower() and tok.startswith(f"[{kind}_"):
                return tok
        tok = f"[{kind}_{sum(1 for t in mapping if t.startswith(f'[{kind}_')) + 1}]"
        mapping[tok] = original
        return tok

    masked = _PHONE.sub(lambda m: token("PHONE", m.group(0)), text)
    parts = {p for n in (names or []) for p in re.split(r"\s+", n.strip()) if len(p) >= _MIN_NAME_LEN and p.lower() not in _GENERIC_WORDS}
    for part in sorted(parts, key=lambda p: (-len(p), p.lower())):
        masked = re.sub(rf"\b{re.escape(part)}\b", lambda m: token("NAME", m.group(0)), masked,
                        flags=re.IGNORECASE)
    return masked, mapping


def unmask(text: str, mapping: dict[str, str]) -> str:
    for tok, original in mapping.items():
        text = text.replace(tok, original)
    return text
