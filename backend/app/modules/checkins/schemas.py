from datetime import datetime

from pydantic import BaseModel


class CueOut(BaseModel):
    cue_type: str
    cue_value: str
    temporal_context: str | None = None
    negated: bool
    uncertain: bool
    source_type: str
    at: datetime
