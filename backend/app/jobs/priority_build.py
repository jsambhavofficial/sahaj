"""Build (or rebuild revision 1 of) every coordinator's priority list for a date. Idempotent."""

from datetime import date

from sqlalchemy.orm import Session

from app.modules.coordinators import repository as coordinator_repo
from app.modules.coordinators import service as coordinator_service


def run(db: Session, on_date: date) -> dict:
    lists = coordinator_service.build_priority_lists(db, on_date, "morning_build")
    return {"date": on_date.isoformat(), "priority_lists": len(lists),
            "items": sum(len(coordinator_repo.items_of(db, [pl.id])[pl.id]) for pl in lists)}
