"""Weekly family summaries: generate for the week ending before `on_date`, then deliver."""

from datetime import date

from sqlalchemy.orm import Session

from app.modules.family import service


def run(db: Session, on_date: date) -> dict:
    return service.run_weekly(db, on_date)
