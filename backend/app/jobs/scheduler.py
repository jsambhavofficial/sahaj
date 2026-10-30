"""In-process APScheduler (single instance). Does nothing unless SCHEDULER_ENABLED=true.

The lead calls start_scheduler()/stop_scheduler() from the app lifespan. Each task opens its own
DB session and never lets an exception escape (one failing job must not stop the others).
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import get_settings, today
from app.core.database import get_sessionmaker

log = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

_scheduler: BackgroundScheduler | None = None


def _run_registry_job(name: str) -> None:
    from app.jobs.registry import run_job

    try:
        with get_sessionmaker()() as db:
            log.info("job %s finished: %s", name, run_job(name, db, today()))
    except Exception:
        log.exception("job %s failed", name)


def nightly() -> None:
    """Scoring first, then the priority lists that depend on it."""
    _run_registry_job("nightly_scoring")
    _run_registry_job("priority_build")


def reminders_tick() -> None:
    from app.jobs import reminders
    from app.modules.notifications import service as notifications

    try:
        with get_sessionmaker()() as db:
            created = reminders.process_due(db, datetime.now(IST))
            sent = notifications.send_pending(db)
            log.info("reminders tick: %s, pushes sent: %s", created, sent)
    except Exception:
        log.exception("reminders tick failed")


def weekly_family() -> None:
    _run_registry_job("family_summaries")


def build_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone=IST)
    sched.add_job(nightly, CronTrigger(hour=2, minute=0, timezone=IST), id="nightly",
                  coalesce=True, max_instances=1, misfire_grace_time=3600)
    sched.add_job(reminders_tick, IntervalTrigger(minutes=5), id="reminders",
                  coalesce=True, max_instances=1)
    sched.add_job(weekly_family, CronTrigger(day_of_week="mon", hour=8, minute=0, timezone=IST),
                  id="weekly_family", coalesce=True, max_instances=1, misfire_grace_time=3600)
    return sched


def start_scheduler() -> BackgroundScheduler | None:
    global _scheduler
    if not get_settings().scheduler_enabled:
        return None
    if _scheduler is None:
        _scheduler = build_scheduler()
        _scheduler.start()
        log.info("scheduler started")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
