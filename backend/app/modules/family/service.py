"""Weekly family summaries: template-first, consent-gated, idempotent per (senior, week)."""

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import safety
from app.core.config import today
from app.core.exceptions import Forbidden, NotFound, AppError
from app.modules.auth import scope
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.family import repository
from app.modules.family.models import WeeklyFamilySummary
from app.modules.family.schemas import FamilySummaryOut, SummaryDetails
from app.modules.seniors.models import Senior

log = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")
LANGUAGES = ("hindi", "hinglish", "english")
CONFIRMED = ("taken", "double_dose")
SIMILAR_BAND_PCT = 10

_SAFE_BODY = "Your weekly update is ready. Your care coordinator can share details if you call them."

_T = {
    "english": {
        "head": "Weekly update for {start} to {end}.",
        "meds": "Medicines were confirmed for {done} of {total} scheduled doses ({pct}%).",
        "meds_none": "No scheduled medicine records were available this week.",
        "act": {"higher": "Daily activity was higher than the previous week.",
                "similar": "Daily activity was about the same as the previous week.",
                "lower": "Daily activity was lower than the previous week.",
                "unknown": "There was not enough activity data to compare with the previous week."},
        "checkins": "{n} check-in(s) took place this week.",
        "alerts_0": "No alerts were raised this week.",
        "alerts_n": "{n} alert(s) were raised and reviewed by the care coordinator.",
        "tail": "This is a general update, not medical advice. Please call the care coordinator with any concern.",
    },
    "hinglish": {
        "head": "{start} se {end} ka saptahik update.",
        "meds": "{total} mein se {done} dawai ke samay par dawai li gayi ({pct}%).",
        "meds_none": "Is hafte dawai ka koi record uplabdh nahi tha.",
        "act": {"higher": "Rozana gatividhi pichhle hafte se zyada thi.",
                "similar": "Rozana gatividhi pichhle hafte jaisi hi thi.",
                "lower": "Rozana gatividhi pichhle hafte se kam thi.",
                "unknown": "Pichhle hafte se tulna ke liye gatividhi ka data kam tha."},
        "checkins": "Is hafte {n} check-in hui.",
        "alerts_0": "Is hafte koi alert nahi aaya.",
        "alerts_n": "Is hafte {n} alert aaye aur care coordinator ne unhe dekha.",
        "tail": "Yeh ek aam update hai, medical salah nahi. Koi chinta ho to care coordinator ko call karein.",
    },
    "hindi": {
        "head": "{start} se {end} tak ka saptahik update.",
        "meds": "{total} mein se {done} dawai ke samay par dawai li gayi ({pct}%).",
        "meds_none": "Is hafte dawai ka koi record uplabdh nahi tha.",
        "act": {"higher": "Rozana gatividhi pichhle hafte se zyada thi.",
                "similar": "Rozana gatividhi pichhle hafte jaisi hi thi.",
                "lower": "Rozana gatividhi pichhle hafte se kam thi.",
                "unknown": "Pichhle hafte se tulna ke liye gatividhi ka data kam tha."},
        "checkins": "Is hafte {n} check-in hui.",
        "alerts_0": "Is hafte koi alert nahi aaya.",
        "alerts_n": "Is hafte {n} alert aaye aur care coordinator ne unhe dekha.",
        "tail": "Yeh ek aam jaankari hai, medical salah nahi. Koi chinta ho to care coordinator ko call karein.",
    },
}


# ---- week helpers ----

def week_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def last_complete_week(on_date: date) -> date:
    """Monday of the most recent Monday-to-Sunday week that ended before `on_date`."""
    return week_monday(on_date) - timedelta(days=7)


def _bounds(week_start: date) -> tuple[datetime, datetime]:
    start = datetime.combine(week_start, time(0), tzinfo=IST)
    return start.astimezone(timezone.utc), (start + timedelta(days=7)).astimezone(timezone.utc)


# ---- consent ----

def summary_allowed(db: Session, senior: Senior) -> bool:
    """Senior-level consent allows summaries and at least one family member consented to them."""
    if not scope.family_allows(senior.family_consent_level, "summary_and_urgent"):
        return False
    return any(scope.family_allows(link.consent_level, "summary_and_urgent")
               for link in repository.consenting_links(db, senior.senior_id))


def effective_level(senior: Senior, link_level: str) -> str:
    """The stricter of the senior's own consent level and the family member's."""
    a, b = senior.family_consent_level, link_level
    return a if scope.CONSENT_ORDER[a] <= scope.CONSENT_ORDER[b] else b


# ---- generation ----

def compute_details(db: Session, senior_id: str, week_start: date) -> SummaryDetails:
    start, end = _bounds(week_start)
    counts = repository.medication_status_counts(db, senior_id, start, end)
    total = sum(n for s, n in counts.items() if s != "sos_taken")
    done = sum(counts.get(s, 0) for s in CONFIRMED)
    this_week = repository.avg_steps(db, senior_id, week_start, week_start + timedelta(days=7))
    prev_week = repository.avg_steps(db, senior_id, week_start - timedelta(days=7), week_start)
    change, trend = None, "unknown"
    if this_week is not None and prev_week:
        change = round((this_week - prev_week) / prev_week * 100)
        trend = "higher" if change > SIMILAR_BAND_PCT else "lower" if change < -SIMILAR_BAND_PCT else "similar"
    return SummaryDetails(
        doses_scheduled=total, doses_confirmed=done,
        adherence_pct=round(done / total * 100) if total else None,
        steps_change_pct=change, activity_trend=trend,
        checkins=repository.count_checkins(db, senior_id, start, end),
        alerts=repository.count_alerts(db, senior_id, start, end))


def summary_language(db: Session, senior: Senior) -> str:
    lang = (repository.latest_family_language(db, senior.senior_id) or "").lower()
    return lang if lang in LANGUAGES else (
        senior.preferred_language if senior.preferred_language in LANGUAGES else "hinglish")


def render_summary(db: Session, senior: Senior, week_start: date) -> tuple[str, str]:
    """(language, body_text) from real data using fixed templates. Never raises on empty data."""
    lang = summary_language(db, senior)
    t, d = _T[lang], compute_details(db, senior.senior_id, week_start)
    parts = [t["head"].format(start=week_start.strftime("%d %b"),
                              end=(week_start + timedelta(days=6)).strftime("%d %b")),
             t["meds"].format(done=d.doses_confirmed, total=d.doses_scheduled, pct=d.adherence_pct)
             if d.doses_scheduled else t["meds_none"],
             t["act"][d.activity_trend], t["checkins"].format(n=d.checkins),
             t["alerts_n"].format(n=d.alerts) if d.alerts else t["alerts_0"], t["tail"]]
    return lang, safety.guard_text(" ".join(parts), fallback=_SAFE_BODY)


def generate_weekly_summary(db: Session, senior_id: str, week_start: date) -> WeeklyFamilySummary | None:
    """Create (once) the summary for the Monday-based week; None if consent does not allow it.

    Re-running returns the existing row unchanged.
    """
    week_start = week_monday(week_start)
    existing = repository.get_summary(db, senior_id, week_start)
    if existing is not None:
        return existing
    senior = db.get(Senior, senior_id)
    if senior is None:
        raise NotFound("Senior not found")
    if not summary_allowed(db, senior):
        return None
    lang, body = render_summary(db, senior, week_start)
    try:
        with db.begin_nested():
            row = repository.add_summary(db, WeeklyFamilySummary(
                senior_id=senior_id, week_start=week_start, body_text=body, language=lang,
                generated_by="template"))
    except IntegrityError:  # a concurrent run created it first
        return repository.get_summary(db, senior_id, week_start)
    db.commit()
    return row


# ---- delivery ----

class MessageProvider(Protocol):
    def send(self, recipient_user_id: str, text: str) -> bool:
        """Deliver `text` (SMS/WhatsApp in production). True if accepted."""


class StubMessageProvider:
    """Records deliveries in memory (`.sent`). Logs only counts, never message text or contacts."""

    def __init__(self):
        self.sent: list[dict] = []

    def send(self, recipient_user_id: str, text: str) -> bool:
        self.sent.append({"recipient_user_id": recipient_user_id, "text": text})
        log.info("family message accepted by stub provider")
        return True


@lru_cache
def get_message_provider() -> MessageProvider:
    return StubMessageProvider()


def deliver_summary(db: Session, summary: WeeklyFamilySummary,
                    provider: MessageProvider | None = None) -> bool:
    """Send to consenting family members (summary level or above); sets `sent_at`. Idempotent."""
    if summary.sent_at is not None:
        return False
    senior = db.get(Senior, summary.senior_id)
    if senior is None or not summary_allowed(db, senior):
        return False
    provider = provider or get_message_provider()
    ok = False
    for link in repository.consenting_links(db, summary.senior_id):
        if scope.family_allows(effective_level(senior, link.consent_level), "summary_and_urgent"):
            ok = provider.send(str(link.family_user_id), summary.body_text) or ok
    if ok:
        summary.sent_at = datetime.now(timezone.utc)
        db.commit()
    return ok


def run_weekly(db: Session, on_date: date, provider: MessageProvider | None = None) -> dict:
    week_start = last_complete_week(on_date)
    out = {"week_start": week_start.isoformat(), "generated": 0, "existing": 0,
           "skipped_no_consent": 0, "delivered": 0}
    for senior in repository.active_seniors(db):
        had = repository.get_summary(db, senior.senior_id, week_start) is not None
        summary = generate_weekly_summary(db, senior.senior_id, week_start)
        if summary is None:
            out["skipped_no_consent"] += 1
            continue
        out["existing" if had else "generated"] += 1
        if deliver_summary(db, summary, provider):
            out["delivered"] += 1
    return out


# ---- reads ----

def _out(db: Session, summary: WeeklyFamilySummary, *, with_details: bool) -> FamilySummaryOut:
    return FamilySummaryOut(
        senior_id=summary.senior_id, week_start=summary.week_start, language=summary.language,
        body_text=summary.body_text, generated_by=summary.generated_by, sent_at=summary.sent_at,
        details=compute_details(db, summary.senior_id, summary.week_start) if with_details else None)


def _find(db: Session, senior_id: str, week: date | None) -> WeeklyFamilySummary:
    week_start = week_monday(week) if week else last_complete_week(today())
    summary = repository.get_summary(db, senior_id, week_start)
    if summary is None:
        raise NotFound("No family summary for that week")
    return summary


def staff_summary(db: Session, user: User, senior_id: str, week: date | None) -> FamilySummaryOut:
    senior = scope.require_senior_access(db, user, senior_id)
    summary = _find(db, senior.senior_id, week)
    audit(db, user, "family_summary.read", senior_id=senior.senior_id,
          detail={"week_start": summary.week_start.isoformat()})
    db.commit()
    return _out(db, summary, with_details=True)


def family_summary(db: Session, user: User, senior_id: str | None, week: date | None) -> FamilySummaryOut:
    links = repository.links_for_family_user(db, user.id)
    if senior_id is None:
        if not links:
            raise Forbidden("No linked senior")
        if len(links) > 1:
            raise AppError("senior_id is required when several seniors are linked",
                           code="validation_error", status_code=422)
        senior_id = links[0].senior_id
    level = scope.family_consent_level(db, user, senior_id)  # Forbidden without consent
    senior = db.get(Senior, senior_id)
    level = effective_level(senior, level)
    if not scope.family_allows(level, "summary_and_urgent"):
        raise Forbidden("Weekly summaries are not shared at your consent level")
    summary = _find(db, senior_id, week)
    audit(db, user, "family_summary.read", senior_id=senior_id,
          detail={"week_start": summary.week_start.isoformat(), "consent": level})
    db.commit()
    return _out(db, summary, with_details=scope.family_allows(level, "full"))

