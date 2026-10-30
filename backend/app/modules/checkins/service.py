from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.modules.auth import scope
from app.modules.auth.models import User
from app.modules.checkins import repository
from app.modules.seniors.service import audit_read, date_bounds, require_staff


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def cues(db: Session, user: User, senior_id: str, date_from: date | None, date_to: date | None,
         limit: int) -> list[dict]:
    """Cues for a senior, newest first, timed by when their source happened."""
    require_staff(user)
    scope.require_senior_access(db, user, senior_id)
    start, end = date_bounds(date_from, date_to)
    rows = repository.list_cues(db, senior_id)
    times = repository.source_times(db, rows)
    out = []
    for c in rows:
        at = times.get((c.source_type, str(c.source_id)), c.created_at)
        if (start and _aware(at) < start) or (end and _aware(at) >= end):
            continue
        out.append({"cue_type": c.cue_type, "cue_value": c.cue_value,
                    "temporal_context": c.temporal_context, "negated": bool(c.negated),
                    "uncertain": bool(c.uncertain), "source_type": c.source_type, "at": at})
    out.sort(key=lambda r: _aware(r["at"]), reverse=True)
    audit_read(db, user, "view_cues", senior_id)
    return out[:limit]
