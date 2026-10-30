"""Collects what the voice agent is told before a call. Never includes the senior's name or phone."""

from datetime import date

from sqlalchemy.orm import Session

from app.integrations.masking import mask
from app.modules.seniors.models import Senior
from app.modules.voice import repository as repo
from app.modules.voice.schemas import CallContext

_FACTOR_KEYS = ("label", "factor", "name", "reason", "description", "feature")


def _factor_text(factor) -> str | None:
    if isinstance(factor, str):
        return factor
    if isinstance(factor, dict):
        for key in _FACTOR_KEYS:
            if isinstance(factor.get(key), str):
                return factor[key]
    return None


def build_context(db: Session, senior: Senior, language: str, day: date, *, full_name: str | None = None) -> CallContext:
    profile = repo.get_profile(db, senior.senior_id)
    items = repo.open_memory_items(db, senior.senior_id)
    factors = [t for t in (_factor_text(f) for f in repo.latest_risk_factors(db, senior.senior_id, day)) if t][:3]
    ctx = CallContext(
        language=language,
        age=senior.age,
        living_arrangement=senior.living_arrangement,
        last_call_summary=repo.last_summary(db, senior.senior_id),
        open_memory_items=[{"kind": i.kind, "content": i.content} for i in items],
        risk_factors_today=factors,
        missed_medicines_today=repo.missed_medicine_names(db, senior.senior_id, day),
        recent_vitals=[{"type": v.measurement_type, "value": float(v.value), "unit": v.unit,
                        "measured_at": v.measured_at.date().isoformat()} for v in repo.recent_vitals(db, senior.senior_id, day)],
        hobbies=list(profile.hobbies or []) if profile else [],
        background=profile.usual_activity_summary if profile else None,
    )
    return _scrub(ctx, full_name)


def _scrub(ctx: CallContext, full_name: str | None) -> CallContext:
    """Defence in depth: replace any name or phone that slipped into free text with a token."""
    names = [full_name] if full_name else []

    def clean(text: str | None) -> str | None:
        return mask(text, names)[0] if text else text

    ctx.last_call_summary = clean(ctx.last_call_summary)
    ctx.background = clean(ctx.background)
    ctx.open_memory_items = [{**i, "content": clean(i["content"])} for i in ctx.open_memory_items]
    ctx.risk_factors_today = [clean(f) for f in ctx.risk_factors_today]
    ctx.hobbies = [clean(h) for h in ctx.hobbies]
    return ctx


def render_context(ctx: CallContext) -> str:
    """Plain text block for the LLM prompt (empty string when there is nothing to say)."""
    lines: list[str] = []
    if ctx.age:
        lines.append(f"Age: {ctx.age}. Lives: {(ctx.living_arrangement or 'unknown').replace('_', ' ')}.")
    if ctx.last_call_summary:
        lines.append(f"Last call summary: {ctx.last_call_summary}")
    for item in ctx.open_memory_items:
        lines.append(f"Open item ({item['kind']}): {item['content']}")
    if ctx.risk_factors_today:
        lines.append("Today's concerns: " + "; ".join(ctx.risk_factors_today))
    if ctx.missed_medicines_today:
        lines.append("Medicines marked missed today: " + ", ".join(ctx.missed_medicines_today))
    for v in ctx.recent_vitals:
        lines.append(f"Recent {v['type'].replace('_', ' ')}: {v['value']:g} {v['unit']} ({v['measured_at']})")
    if ctx.hobbies:
        lines.append("Enjoys: " + ", ".join(h.replace("_", " ") for h in ctx.hobbies))
    if ctx.background:
        lines.append(f"Background: {ctx.background}")
    return "\n".join(lines)
