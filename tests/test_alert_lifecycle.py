"""Tests for alert lifecycle policy: creation, deduplication, escalation, and resolution."""

import pytest
from src.risk_engine.alert_policy import AlertLifecyclePolicy


@pytest.fixture
def policy():
    return AlertLifecyclePolicy(alert_threshold=50, resolution_days_required=3)


def test_new_alert_creation_and_duplicate_suppression(policy):
    # Day 1: Score crosses threshold -> New Alert created
    alt1 = policy.process_daily_score(
        senior_id="S0001",
        date_str="2026-02-01",
        risk_score=65,
        risk_level="HIGH",
        top_factors=[{"evidence": "Sustained steps drop", "is_safety_tripwire": False}],
        recommended_action="Coordinator follow-up."
    )
    assert alt1 is not None
    assert alt1.status == "OPEN"
    assert alt1.severity == "HIGH"
    assert len(policy.all_alert_events) == 1

    # Day 2: Score remains HIGH -> Duplicate alert is suppressed!
    alt2 = policy.process_daily_score(
        senior_id="S0001",
        date_str="2026-02-02",
        risk_score=68,
        risk_level="HIGH",
        top_factors=[{"evidence": "Sustained steps drop", "is_safety_tripwire": False}],
        recommended_action="Coordinator follow-up."
    )
    assert alt2 is None, "Duplicate alert was not suppressed for ongoing high risk!"
    assert len(policy.all_alert_events) == 1  # Still 1 unique alert event

    # Day 3: Risk escalates to URGENT_REVIEW -> Alert escalates
    alt3 = policy.process_daily_score(
        senior_id="S0001",
        date_str="2026-02-03",
        risk_score=85,
        risk_level="URGENT_REVIEW",
        top_factors=[{"evidence": "Acute fall reported", "is_safety_tripwire": True}],
        recommended_action="Immediate fall protocol."
    )
    assert alt3 is not None
    assert alt3.status == "ESCALATED"
    assert alt3.severity == "URGENT_REVIEW"


def test_alert_resolution_on_sustained_improvement(policy):
    # Create open alert
    policy.process_daily_score(
        senior_id="S0002",
        date_str="2026-02-01",
        risk_score=60,
        risk_level="HIGH",
        top_factors=[{"evidence": "Poor sleep and weakness"}],
        recommended_action="Follow up."
    )
    assert "S0002" in policy.active_alerts

    # Day 2: Low score (1 day) -> Not yet resolved
    policy.process_daily_score("S0002", "2026-02-02", 20, "LOW", [], "Routine.")
    assert "S0002" in policy.active_alerts

    # Day 3: Low score (2 days) -> Not yet resolved
    policy.process_daily_score("S0002", "2026-02-03", 18, "LOW", [], "Routine.")
    assert "S0002" in policy.active_alerts

    # Day 4: Low score (3 consecutive days) -> RESOLVED!
    policy.process_daily_score("S0002", "2026-02-04", 15, "LOW", [], "Routine.")
    assert "S0002" not in policy.active_alerts
    assert len(policy.closed_alerts) == 1
    assert policy.closed_alerts[0].status == "RESOLVED"

