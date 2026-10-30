"""Scoring orchestration: score seniors, keep daily_risk_scores current, drive alerts and re-ranking."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFound
from app.modules.alerts import service as alert_service
from app.modules.alerts.service import AlertChange
from app.modules.risk import repository as repo
from app.modules.risk.models import DailyRiskScore
from app.modules.risk.scorer import HeuristicScorer, RiskScorer, ScoreResult
from app.modules.seniors.models import Senior

SCORERS: dict[str, type] = {"heuristic": HeuristicScorer}
BATCH_SIZE = 50


def get_scorer() -> RiskScorer:
    """The scorer named by settings.risk_scorer; register another class in SCORERS to plug it in."""
    name = get_settings().risk_scorer
    if name not in SCORERS:
        raise ValueError(f"Unknown risk scorer '{name}' (known: {', '.join(sorted(SCORERS))})")
    return SCORERS[name]()


def _score_many(scorer, db: Session, ids: list[str], on_date: date) -> dict[str, ScoreResult]:
    if hasattr(scorer, "score_many"):
        return scorer.score_many(db, ids, on_date)
    return {sid: scorer.score(db, sid, on_date) for sid in ids}


def score_senior(db: Session, senior_id: str, on_date: date, scorer: RiskScorer | None = None) -> DailyRiskScore:
    """Score one senior for `on_date` and upsert the daily_risk_scores row (no alert handling)."""
    if db.get(Senior, senior_id) is None:
        raise NotFound("Senior not found")
    scorer = scorer or get_scorer()
    result = scorer.score(db, senior_id, on_date)
    row = repo.upsert_score(db, repo.get_score(db, senior_id, on_date), senior_id, on_date, result.as_row())
    db.commit()
    return row


def score_and_alert(db: Session, senior_ids: list[str], on_date: date,
                    scorer: RiskScorer | None = None) -> dict[str, tuple[DailyRiskScore, AlertChange]]:
    """Score a batch of seniors, upsert their scores and create/update/resolve alerts. Commits."""
    scorer = scorer or get_scorer()
    out: dict[str, tuple[DailyRiskScore, AlertChange]] = {}
    for i in range(0, len(senior_ids), BATCH_SIZE):
        ids = senior_ids[i:i + BATCH_SIZE]
        results = _score_many(scorer, db, ids, on_date)
        existing = repo.get_scores(db, ids, on_date)
        rows = {sid: repo.upsert_score(db, existing.get(sid), sid, on_date, res.as_row())
                for sid, res in results.items()}
        db.flush()
        seniors = {s.senior_id: s for s in db.scalars(select(Senior).where(Senior.senior_id.in_(ids)))}
        ctx = alert_service.build_context(db, ids, on_date)
        for sid in ids:
            if sid in rows and sid in seniors:
                out[sid] = (rows[sid], alert_service.apply_score(db, seniors[sid], rows[sid], on_date, ctx))
        db.commit()
    return out


def rescore_and_rerank(db: Session, senior_id: str, on_date: date, reason: str = "post_ai_call"):
    """Re-score one senior, update their alert, and write a new priority-list revision for their
    coordinator (previous_rank set; ai_call_done forced true for this senior after an AI call).
    Returns the new PriorityList."""
    from app.modules.coordinators import service as coordinator_service  # avoids an import cycle

    senior = db.get(Senior, senior_id)
    if senior is None:
        raise NotFound("Senior not found")
    score_and_alert(db, [senior_id], on_date)
    lists = coordinator_service.build_priority_lists(
        db, on_date, reason=reason, coordinator_ids=[senior.coordinator_id],
        ai_done_seniors={senior_id} if reason == "post_ai_call" else None)
    return lists[0] if lists else None
