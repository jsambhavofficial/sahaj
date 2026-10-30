"""Named background jobs, runnable on a schedule or on demand via POST /admin/jobs/{name}/run.

Every job is a function `run(db: Session, on_date: date) -> dict` that is idempotent (safe to
run twice for the same date) and returns a small JSON-serialisable summary.
"""

from datetime import date
from importlib import import_module
from typing import Callable

from sqlalchemy.orm import Session

# name -> "module:function"
JOBS: dict[str, str] = {
    "nightly_scoring": "app.jobs.nightly_scoring:run",
    "priority_build": "app.jobs.priority_build:run",
    "reminders": "app.jobs.reminders:run",
    "family_summaries": "app.jobs.weekly_family_summary:run",
}


def get_job(name: str) -> Callable[[Session, date], dict]:
    module, func = JOBS[name].split(":")
    return getattr(import_module(module), func)


def run_job(name: str, db: Session, on_date: date) -> dict:
    if name not in JOBS:
        raise KeyError(name)
    return get_job(name)(db, on_date)
