from datetime import timedelta

import pytest

from app.core.exceptions import NotFound
from app.modules.alerts.models import Alert
from app.modules.auth.models import User
from app.modules.coordinators.models import PriorityList
from app.modules.risk import repository as risk_repo
from app.modules.risk import service as risk_service
from app.modules.risk.models import DailyRiskScore
from app.modules.risk.scorer import LEVELS, HeuristicScorer, level_for
from tests.app.factories import make_senior, make_user
from tests.app.test_risk_support import (
    ON, activity, baseline, call, cue, fall_window, med, vital, voice_note,
)


@pytest.fixture
def senior(db_session):
    coord = make_user(db_session, "coordinator", city="Jaipur")
    s, _ = make_senior(db_session, coord)
    return s


def score(db, senior, on=ON):
    return HeuristicScorer().score(db, senior.senior_id, on)


def rules(result):
    return {f["rule_id"] for f in result.top_factors}


def test_quiet_senior_is_low(db_session, senior):
    baseline(db_session, senior)
    for i in range(3):
        activity(db_session, senior, ON - timedelta(days=i))
        vital(db_session, senior, ON - timedelta(days=i), "blood_pressure_systolic", 131)
    r = score(db_session, senior)
    assert r.risk_score == 0 and r.risk_level == "LOW" and r.top_factors == []
    assert r.scoring_version == "heuristic-0" and r.baseline_confidence == "HIGH"
    assert "Nothing unusual" in r.recommended_action


def test_level_bands():
    assert [level_for(s) for s in (0, 24, 25, 49, 50, 74, 75, 100)] == [
        "LOW", "LOW", "MODERATE", "MODERATE", "HIGH", "HIGH", "URGENT_REVIEW", "URGENT_REVIEW"]
    assert LEVELS[-1] == "URGENT_REVIEW"


def test_missed_critical_meds_and_unverified(db_session, senior):
    baseline(db_session, senior)
    med(db_session, senior, ON, "missed", "high")
    med(db_session, senior, ON - timedelta(days=1), "missed", "high")
    med(db_session, senior, ON, "unknown", "high")
    med(db_session, senior, ON, "missed", "low")  # low criticality alone does not count
    med(db_session, senior, ON, "missed", "high", sos=True)  # SOS doses are ignored
    r = score(db_session, senior)
    assert {"RULE_MISSED_CRITICAL_MEDS", "RULE_UNVERIFIED_CRITICAL_MEDS"} <= rules(r)
    f = next(f for f in r.top_factors if f["rule_id"] == "RULE_MISSED_CRITICAL_MEDS")
    assert f["points_contributed"] == 24 and "2 doses" in f["evidence"] and not f["is_safety_tripwire"]
    assert r.risk_level == "MODERATE"
    assert any("unconfirmed" in x for x in r.data_quality_flags)


def test_old_medication_events_ignored(db_session, senior):
    baseline(db_session, senior)
    med(db_session, senior, ON - timedelta(days=5), "missed", "high")
    assert score(db_session, senior).risk_score == 0


def test_vitals_outside_own_baseline(db_session, senior):
    baseline(db_session, senior)
    for i in range(3):
        vital(db_session, senior, ON - timedelta(days=i), "blood_pressure_systolic", 160)
    r = score(db_session, senior)
    f = next(f for f in r.top_factors if f["rule_id"] == "RULE_SBP_OFF_BASELINE")
    assert f["points_contributed"] == 16 and "160" in f["evidence"] and "130" in f["evidence"]
    assert f["category"] == "baseline_deviation"


def test_vitals_baseline_needs_enough_readings(db_session, senior):
    baseline(db_session, senior, sbp_n=2)
    vital(db_session, senior, ON, "blood_pressure_systolic", 160)
    r = score(db_session, senior)
    assert "RULE_SBP_OFF_BASELINE" not in rules(r)
    assert any("very few readings" in x for x in r.data_quality_flags)


def test_questionable_readings_are_not_used(db_session, senior):
    baseline(db_session, senior)
    vital(db_session, senior, ON, "blood_pressure_systolic", 190, quality="device_artifact")
    assert score(db_session, senior).risk_score == 0


def test_steps_and_sleep_drop(db_session, senior):
    baseline(db_session, senior)
    for i in range(3):
        activity(db_session, senior, ON - timedelta(days=i), steps=1600, sleep=4.0)
    r = score(db_session, senior)
    assert {"RULE_STEPS_DROP", "RULE_SLEEP_DROP"} <= rules(r)
    steps = next(f for f in r.top_factors if f["rule_id"] == "RULE_STEPS_DROP")
    assert "40%" in steps["evidence"] and steps["points_contributed"] == 24


def test_missing_activity_is_a_data_flag_not_a_drop(db_session, senior):
    baseline(db_session, senior)
    for i in range(3):
        activity(db_session, senior, ON - timedelta(days=i), steps=None, sleep=None, available=False)
    r = score(db_session, senior)
    assert r.risk_score == 0
    assert any("No step data" in x for x in r.data_quality_flags)


def test_cues_current_only_and_dated_by_source(db_session, senior):
    baseline(db_session, senior)
    recent = call(db_session, senior, ON - timedelta(days=1))
    old = call(db_session, senior, ON - timedelta(days=20))
    cue(db_session, senior, recent, "weakness")
    cue(db_session, senior, recent, "pain", negated=True, value="absent")
    cue(db_session, senior, recent, "low_mood", temporal="historical")
    cue(db_session, senior, recent, "loneliness", uncertain=True)
    cue(db_session, senior, old, "dizziness")  # too old
    r = score(db_session, senior)
    assert rules(r) == {"RULE_CUE_WEAKNESS"}
    assert "weakness" in r.top_factors[0]["evidence"] and "call" in r.top_factors[0]["evidence"]


def test_voice_note_cue_and_urgency(db_session, senior):
    baseline(db_session, senior)
    vn = voice_note(db_session, senior, ON, urgency=True)
    cue(db_session, senior, vn, "breathlessness", source_type="message")
    r = score(db_session, senior)
    assert {"RULE_CUE_BREATHLESSNESS", "RULE_URGENCY_FLAG"} <= rules(r)


def test_urgent_call_and_missed_checkins(db_session, senior):
    baseline(db_session, senior)
    call(db_session, senior, ON, urgency=True)
    call(db_session, senior, ON, status="no_answer", hour=11)
    r = score(db_session, senior)
    assert "RULE_URGENCY_FLAG" in rules(r) and "RULE_MISSED_CHECKINS" not in rules(r)
    call(db_session, senior, ON - timedelta(days=1), status="no_answer")
    r = score(db_session, senior)
    assert "RULE_MISSED_CHECKINS" in rules(r)
    assert any("unanswered" in x for x in r.data_quality_flags)


def test_fall_sensor_is_a_tripwire(db_session, senior):
    baseline(db_session, senior)
    fall_window(db_session, senior, ON)
    r = score(db_session, senior)
    assert r.risk_score >= 75 and r.risk_level == "URGENT_REVIEW" and r.confidence_level == "HIGH"
    assert r.top_factors[0]["is_safety_tripwire"] and r.top_factors[0]["rule_id"] == "RULE_FALL_SENSOR"
    assert "safe" in r.recommended_action


def test_reported_fall_and_severe_vitals_are_tripwires(db_session, senior):
    baseline(db_session, senior)
    c = call(db_session, senior, ON)
    cue(db_session, senior, c, "fall")
    vital(db_session, senior, ON, "spo2", 88)
    r = score(db_session, senior)
    assert {"RULE_FALL_REPORTED", "RULE_SEVERE_SPO2"} <= rules(r)
    assert all(f["is_safety_tripwire"] for f in r.top_factors[:2])
    assert r.risk_level == "URGENT_REVIEW"


def test_no_leakage_from_future_data(db_session, senior):
    baseline(db_session, senior)
    for i in range(1, 4):
        d = ON + timedelta(days=i)
        fall_window(db_session, senior, d)
        med(db_session, senior, d, "missed", "high")
        activity(db_session, senior, d, steps=100)
        vital(db_session, senior, d, "spo2", 80)
        call(db_session, senior, d, urgency=True)
    assert score(db_session, senior).risk_score == 0


def test_no_data_has_low_confidence_and_no_baseline_flag(db_session, senior):
    r = score(db_session, senior)
    assert r.risk_level == "LOW" and r.confidence_level == "LOW" and r.baseline_confidence == "NONE"
    assert any("baseline" in x for x in r.data_quality_flags)


def test_evidence_never_diagnoses(db_session, senior):
    baseline(db_session, senior)
    fall_window(db_session, senior, ON)
    vital(db_session, senior, ON, "blood_pressure_systolic", 185)
    med(db_session, senior, ON, "missed", "high")
    r = score(db_session, senior)
    text = " ".join(f["evidence"] for f in r.top_factors).lower() + r.recommended_action.lower()
    for bad in ("diagnos", "hypertens", "stroke", "infection", "increase the dose", "stop taking"):
        assert bad not in text


def test_score_many_matches_single_and_is_batched(db_session, senior):
    baseline(db_session, senior)
    fall_window(db_session, senior, ON)
    other = make_senior(db_session, make_user(db_session, "coordinator"))[0]
    many = HeuristicScorer().score_many(db_session, [senior.senior_id, other.senior_id], ON)
    assert many[senior.senior_id].as_row() == score(db_session, senior).as_row()
    assert many[other.senior_id].risk_score == 0


def test_score_senior_upserts_one_row(db_session, senior):
    baseline(db_session, senior)
    row = risk_service.score_senior(db_session, senior.senior_id, ON)
    assert row.risk_score == 0
    med(db_session, senior, ON, "missed", "high")
    again = risk_service.score_senior(db_session, senior.senior_id, ON)
    assert again.risk_score == 12
    assert db_session.query(DailyRiskScore).count() == 1
    with pytest.raises(NotFound):
        risk_service.score_senior(db_session, "S_NOPE", ON)


def test_get_scorer_is_configurable(monkeypatch):
    assert isinstance(risk_service.get_scorer(), HeuristicScorer)
    from app.core import config

    monkeypatch.setattr(config.get_settings(), "risk_scorer", "nope")
    with pytest.raises(ValueError):
        risk_service.get_scorer()

    class Fixed:
        def score(self, db, senior_id, on_date):
            return HeuristicScorer().score(db, senior_id, on_date)

    monkeypatch.setitem(risk_service.SCORERS, "fixed", Fixed)
    monkeypatch.setattr(config.get_settings(), "risk_scorer", "fixed")
    assert isinstance(risk_service.get_scorer(), Fixed)


def test_scorable_ids_skip_inactive_and_not_yet_enrolled(db_session, senior):
    a, _ = make_senior(db_session, make_user(db_session, "coordinator"))
    b, _ = make_senior(db_session, make_user(db_session, "coordinator"))
    a.is_active = False
    b.enrollment_date = ON + timedelta(days=1)
    db_session.commit()
    assert risk_repo.scorable_senior_ids(db_session, ON) == [senior.senior_id]


def test_rescore_and_rerank_post_ai_call(db_session, senior, monkeypatch):
    baseline(db_session, senior)
    other, _ = make_senior(db_session, db_session.get(User, senior.coordinator_id))
    calls = []
    monkeypatch.setattr("app.modules.alerts.service.safe_notify", lambda *a, **k: calls.append(a[2]))
    monkeypatch.setattr("app.modules.coordinators.service.safe_notify", lambda *a, **k: calls.append(a[2]))
    from app.modules.coordinators import service as cs

    first = cs.build_priority_lists(db_session, ON)[0]
    assert first.revision == 1 and first.reason == "morning_build"
    # the AI call surfaces a fall for `other`: score jumps and the list is re-ranked
    fall_window(db_session, other, ON)
    pl = risk_service.rescore_and_rerank(db_session, other.senior_id, ON)
    assert pl.revision == 2 and pl.reason == "post_ai_call"
    items = cs.repo.items_of(db_session, [pl.id])[pl.id]
    assert items[0].senior_id == other.senior_id and items[0].rank == 1
    assert items[0].previous_rank in (1, 2) and items[0].ai_call_done is True
    assert items[0].alert_id is not None
    assert db_session.query(Alert).count() == 1
    assert "alert_new" in calls and "priority_list_updated" in calls
    assert db_session.query(PriorityList).count() == 2
