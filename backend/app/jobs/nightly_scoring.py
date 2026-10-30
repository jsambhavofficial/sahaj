"""Nightly job: score every active senior, upsert scores, create/update/resolve alerts and
build revision 1 of every coordinator's priority list. Idempotent for a given date."""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.modules.coordinators import service as coordinator_service
from app.modules.risk import repository as risk_repo
from app.modules.risk import service as risk_service

logger = logging.getLogger(__name__)


def run(db: Session, on_date: date, build_lists: bool = True) -> dict:
    ids = risk_repo.scorable_senior_ids(db, on_date)
    results = risk_service.score_and_alert(db, ids, on_date)
    counts: dict[str, int] = {}
    levels: dict[str, int] = {}
    for score, change in results.values():
        levels[score.risk_level] = levels.get(score.risk_level, 0) + 1
        if change.action:
            counts[change.action] = counts.get(change.action, 0) + 1
    summary = {"date": on_date.isoformat(), "seniors_scored": len(results), "levels": levels,
               "alerts": counts}
    if build_lists:
        lists = coordinator_service.build_priority_lists(db, on_date, "morning_build")
        summary["priority_lists"] = len(lists)
    logger.info("nightly_scoring %s", summary)
    return summary
