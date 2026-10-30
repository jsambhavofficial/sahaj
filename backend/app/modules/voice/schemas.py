"""Messages of the voice-agent WebSocket (see docs/api-contract.md, section 4) and internal DTOs."""

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel

Language = Literal["hindi", "hinglish", "english"]


class StartMessage(BaseModel):
    type: Literal["start"]
    language: Language | None = None  # defaults to the senior's preferred language


class SimpleMessage(BaseModel):
    type: Literal["end_utterance", "end_call"]


@dataclass
class Stage:
    """What the agent has to say next."""
    kind: Literal["opening", "question", "goodbye"]
    index: int = 0   # 0-based question number for kind == "question" (opening asks question 0)
    total: int = 4


@dataclass
class Turn:
    speaker: Literal["agent", "senior"]
    text: str


@dataclass
class CallContext:
    """Everything the agent is told. Stored verbatim in calls.context_snapshot. No name or phone."""
    language: str
    age: int | None = None
    living_arrangement: str | None = None
    last_call_summary: str | None = None
    open_memory_items: list[dict] = field(default_factory=list)
    risk_factors_today: list[str] = field(default_factory=list)
    missed_medicines_today: list[str] = field(default_factory=list)
    recent_vitals: list[dict] = field(default_factory=list)
    hobbies: list[str] = field(default_factory=list)
    background: str | None = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}

    @property
    def has_open_symptom(self) -> bool:
        return any(i.get("kind") in ("symptom", "mood") for i in self.open_memory_items)


@dataclass
class MemoryOp:
    action: Literal["create", "touch", "resolve"]
    kind: str
    content: str
