from app.core.config import get_settings
from app.jobs import scheduler


def test_disabled_by_default_does_nothing(monkeypatch):
    monkeypatch.setattr(get_settings(), "scheduler_enabled", False)
    assert scheduler.start_scheduler() is None
    scheduler.stop_scheduler()


def test_enabled_registers_expected_jobs(monkeypatch):
    monkeypatch.setattr(get_settings(), "scheduler_enabled", True)
    try:
        sched = scheduler.start_scheduler()
        assert sched is not None and sched.running
        jobs = {j.id: str(j.trigger) for j in sched.get_jobs()}
        assert set(jobs) == {"nightly", "reminders", "weekly_family"}
        assert "hour='2'" in jobs["nightly"] and "minute='0'" in jobs["nightly"]
        assert "minutes=5" in jobs["reminders"].replace("0:05:00", "minutes=5") or "0:05:00" in jobs["reminders"]
        assert "day_of_week='mon'" in jobs["weekly_family"] and "hour='8'" in jobs["weekly_family"]
        assert scheduler.start_scheduler() is sched  # idempotent
    finally:
        scheduler.stop_scheduler()


def test_nightly_runs_scoring_then_priority(monkeypatch):
    calls = []
    monkeypatch.setattr(scheduler, "_run_registry_job", calls.append)
    scheduler.nightly()
    assert calls == ["nightly_scoring", "priority_build"]


def test_reminders_tick_swallows_errors(monkeypatch):
    def boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(scheduler, "get_sessionmaker", boom)
    scheduler.reminders_tick()  # must not raise
    scheduler._run_registry_job("nightly_scoring")  # must not raise either
