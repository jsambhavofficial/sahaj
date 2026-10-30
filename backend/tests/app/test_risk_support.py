"""Data builders shared by the risk, alert and priority-list tests (no tests in here)."""

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.modules.checkins.models import NlpCue
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.messages.models import Message
from app.modules.seniors.models import SeniorBaseline
from app.modules.vitals.models import AccelerometerWindow, DailyActivity, Vital
from app.modules.voice.models import Call

IST = ZoneInfo("Asia/Kolkata")
ON = date(2026, 10, 11)
_n = iter(range(1, 10**6))


def at(d: date, hour=10) -> datetime:
    return datetime(d.year, d.month, d.day, hour, 0, tzinfo=IST)


def baseline(db, senior, **kw):
    vals = dict(sbp_median=130.0, sbp_iqr=4.0, sbp_n=20, dbp_median=80.0, dbp_iqr=3.0, dbp_n=20,
                hr_median=72.0, hr_iqr=4.0, hr_n=20, spo2_median=97.0, spo2_iqr=1.0, spo2_n=20,
                steps_median=4000.0, sleep_hours_median=7.0, appetite_self_report=4.0,
                mood_self_report=4.0, vitals_baseline_confidence="HIGH")
    vals.update(kw)
    db.add(SeniorBaseline(senior_id=senior.senior_id, **vals))
    db.commit()


def activity(db, senior, d, steps=4000.0, sleep=7.0, appetite=4.0, mood=4.0, available=True):
    db.add(DailyActivity(senior_id=senior.senior_id, date=d, steps=steps, sleep_hours=sleep,
                         appetite_level=appetite, mood_level=mood, data_available=available))
    db.commit()


def vital(db, senior, d, vtype, value, quality="valid", hour=9):
    db.add(Vital(measurement_id=f"M{next(_n)}", senior_id=senior.senior_id, measured_at=at(d, hour),
                 measurement_type=vtype, value=value, unit="x", source="device", quality_status=quality))
    db.commit()


def med(db, senior, d, status="missed", criticality="high", verification="verified", sos=False):
    mid = f"MED{next(_n)}"
    db.add(MedicationSchedule(medication_id=mid, senior_id=senior.senior_id, drug_name="Drug",
                              dosage="1", criticality=criticality, start_date=date(2026, 1, 1),
                              times_per_day=1, scheduled_times=["08:00"], is_sos=sos))
    db.flush()
    db.add(MedicationEvent(medication_event_id=f"E{next(_n)}", senior_id=senior.senior_id,
                           medication_id=mid, scheduled_at=at(d, 8), status=status,
                           record_source="smart_pillbox", verification_status=verification))
    db.commit()


def call(db, senior, d, *, status="completed", urgency=False, kind="phone_bridge", hour=10):
    c = Call(kind=kind, senior_id=senior.senior_id, provider="import", status=status,
             urgency_flag=urgency, started_at=at(d, hour))
    db.add(c)
    db.commit()
    return c


def voice_note(db, senior, d, *, urgency=False):
    m = Message(senior_id=senior.senior_id, sender_user_id=senior.user_id, kind="voice_note",
                urgency_flag=urgency, created_at=at(d))
    db.add(m)
    db.commit()
    return m


def cue(db, senior, source, cue_type, *, source_type="call", value="present", negated=False,
        temporal="current", uncertain=False):
    db.add(NlpCue(source_type=source_type, source_id=str(source.id), senior_id=senior.senior_id,
                  cue_type=cue_type, cue_value=value, temporal_context=temporal, negated=negated,
                  uncertain=uncertain))
    db.commit()


def fall_window(db, senior, d):
    db.add(AccelerometerWindow(window_id=f"W{next(_n)}", senior_id=senior.senior_id,
                               window_start=at(d, 3), label="fall"))
    db.commit()
