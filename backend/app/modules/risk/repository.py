"""Risk queries: batch loading of the evidence a scorer needs, and daily_risk_scores upserts.

Everything here is read with explicit upper bounds (end of the scoring day, India time) so that
no data after `on_date` can leak into a score.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.modules.alerts.models import Alert
from app.modules.checkins.models import Checkin, NlpCue
from app.modules.medications.models import MedicationEvent, MedicationSchedule
from app.modules.messages.models import Message
from app.modules.risk.models import DailyRiskScore
from app.modules.seniors.models import Senior, SeniorBaseline
from app.modules.vitals.models import AccelerometerWindow, DailyActivity, Vital
from app.modules.voice.models import Call

IST = ZoneInfo("Asia/Kolkata")
LOOKBACK_DAYS = 7  # the widest window any rule uses (inclusive of the scoring day)


def day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=IST)


def to_ist_date(dt: datetime) -> date:
    """Calendar date in India time. Naive datetimes (SQLite) are already India wall-clock."""
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(IST).date()


@dataclass
class VitalReading:
    type: str
    value: float
    day: date


@dataclass
class MedDose:
    status: str
    verification: str | None
    criticality: str | None
    day: date


@dataclass
class CallRow:
    kind: str
    status: str
    urgency: bool
    day: date


@dataclass
class CueHit:
    cue_type: str
    day: date
    source_type: str  # call / message / checkin
    source_id: str


@dataclass
class SeniorData:
    """All evidence for one senior, up to and including the scoring day."""

    senior_id: str
    on_date: date
    baseline: SeniorBaseline | None = None
    activity: list[DailyActivity] = field(default_factory=list)
    vitals: list[VitalReading] = field(default_factory=list)
    doses: list[MedDose] = field(default_factory=list)
    calls: list[CallRow] = field(default_factory=list)
    missed_checkin_days: list[date] = field(default_factory=list)  # 'missed_call' check-ins
    urgent_message_days: list[date] = field(default_factory=list)
    cues: list[CueHit] = field(default_factory=list)
    fall_days: list[date] = field(default_factory=list)  # accelerometer fall windows


def load_senior_data(db: Session, senior_ids: list[str], on_date: date) -> dict[str, SeniorData]:
    """Load evidence for many seniors with one query per table (window: last 7 days)."""
    out = {sid: SeniorData(senior_id=sid, on_date=on_date) for sid in senior_ids}
    if not senior_ids:
        return out
    first_day = on_date - timedelta(days=LOOKBACK_DAYS - 1)
    start, end = day_start(first_day), day_start(on_date + timedelta(days=1))

    for b in db.scalars(select(SeniorBaseline).where(SeniorBaseline.senior_id.in_(senior_ids))):
        out[b.senior_id].baseline = b

    for a in db.scalars(select(DailyActivity).where(
            DailyActivity.senior_id.in_(senior_ids), DailyActivity.date >= first_day,
            DailyActivity.date <= on_date)):
        out[a.senior_id].activity.append(a)

    for sid, mtype, value, at in db.execute(
            select(Vital.senior_id, Vital.measurement_type, Vital.value, Vital.measured_at).where(
                Vital.senior_id.in_(senior_ids), Vital.measured_at >= start, Vital.measured_at < end,
                Vital.quality_status == "valid")):
        out[sid].vitals.append(VitalReading(mtype, float(value), to_ist_date(at)))

    for sid, status, ver, crit, at in db.execute(
            select(MedicationEvent.senior_id, MedicationEvent.status,
                   MedicationEvent.verification_status, MedicationSchedule.criticality,
                   MedicationEvent.scheduled_at)
            .join(MedicationSchedule, MedicationSchedule.medication_id == MedicationEvent.medication_id)
            .where(MedicationEvent.senior_id.in_(senior_ids), MedicationEvent.scheduled_at >= start,
                   MedicationEvent.scheduled_at < end, MedicationSchedule.is_sos.is_(False),
                   MedicationEvent.status.in_(("taken", "missed", "unknown")))):
        out[sid].doses.append(MedDose(status, ver, crit, to_ist_date(at)))

    # Source day for every call / message / check-in in the window (cues are dated by their source).
    source_day: dict[str, tuple[str, date]] = {}
    for cid, sid, kind, status, urgent, at in db.execute(
            select(Call.id, Call.senior_id, Call.kind, Call.status, Call.urgency_flag, Call.started_at)
            .where(Call.senior_id.in_(senior_ids), Call.started_at >= start, Call.started_at < end)):
        day = to_ist_date(at)
        out[sid].calls.append(CallRow(kind, status, bool(urgent), day))
        source_day[str(cid)] = ("call", day)
    for mid, sid, kind, urgent, at in db.execute(
            select(Message.id, Message.senior_id, Message.kind, Message.urgency_flag, Message.created_at)
            .where(Message.senior_id.in_(senior_ids), Message.created_at >= start,
                   Message.created_at < end)):
        day = to_ist_date(at)
        if urgent and kind == "voice_note":
            out[sid].urgent_message_days.append(day)
        source_day[str(mid)] = ("message", day)
    for cid, sid, channel, at in db.execute(
            select(Checkin.checkin_id, Checkin.senior_id, Checkin.channel, Checkin.at)
            .where(Checkin.senior_id.in_(senior_ids), Checkin.at >= start, Checkin.at < end)):
        day = to_ist_date(at)
        if channel == "missed_call":
            out[sid].missed_checkin_days.append(day)
        source_day[str(cid)] = ("checkin", day)

    if source_day:
        for cue in db.scalars(select(NlpCue).where(
                NlpCue.senior_id.in_(senior_ids), NlpCue.cue_value == "present",
                NlpCue.negated.is_(False), NlpCue.uncertain.is_(False))):
            hit = source_day.get(cue.source_id)
            if hit is None or cue.temporal_context == "historical":
                continue
            out[cue.senior_id].cues.append(CueHit(cue.cue_type, hit[1], hit[0], cue.source_id))

    for sid, at in db.execute(
            select(AccelerometerWindow.senior_id, AccelerometerWindow.window_start).where(
                AccelerometerWindow.senior_id.in_(senior_ids), AccelerometerWindow.label == "fall",
                AccelerometerWindow.window_start >= start, AccelerometerWindow.window_start < end)):
        out[sid].fall_days.append(to_ist_date(at))
    return out


def scorable_senior_ids(db: Session, on_date: date, coordinator_id=None) -> list[str]:
    """Active seniors already enrolled on `on_date`."""
    q = select(Senior.senior_id).where(Senior.is_active.is_(True)).order_by(Senior.senior_id)
    q = q.where((Senior.enrollment_date.is_(None)) | (Senior.enrollment_date <= on_date))
    if coordinator_id is not None:
        q = q.where(Senior.coordinator_id == coordinator_id)
    return list(db.scalars(q))


def get_scores(db: Session, senior_ids: list[str], on_date: date) -> dict[str, DailyRiskScore]:
    if not senior_ids:
        return {}
    rows = db.scalars(select(DailyRiskScore).where(
        DailyRiskScore.senior_id.in_(senior_ids), DailyRiskScore.date == on_date))
    return {r.senior_id: r for r in rows}


def get_score(db: Session, senior_id: str, on_date: date) -> DailyRiskScore | None:
    return db.get(DailyRiskScore, (senior_id, on_date))


def upsert_score(db: Session, existing: DailyRiskScore | None, senior_id: str, on_date: date,
                 fields: dict) -> DailyRiskScore:
    if existing is None:
        existing = DailyRiskScore(senior_id=senior_id, date=on_date, **fields)
        db.add(existing)
    else:
        for k, v in fields.items():
            setattr(existing, k, v)
        existing.computed_at = datetime.now().astimezone()
    return existing


def recent_scores(db: Session, senior_ids: list[str], on_date: date, days: int) -> dict[str, list[DailyRiskScore]]:
    """Scores for the `days` calendar days ending on `on_date`, newest first."""
    out: dict[str, list[DailyRiskScore]] = {sid: [] for sid in senior_ids}
    if not senior_ids:
        return out
    rows = db.scalars(select(DailyRiskScore).where(
        and_(DailyRiskScore.senior_id.in_(senior_ids), DailyRiskScore.date <= on_date,
             DailyRiskScore.date > on_date - timedelta(days=days))).order_by(DailyRiskScore.date.desc()))
    for r in rows:
        out[r.senior_id].append(r)
    return out


def open_alert_ids(db: Session, senior_ids: list[str]) -> dict[str, str]:
    """senior_id -> alert_id of the senior's unresolved alert (newest if several)."""
    out: dict[str, str] = {}
    if not senior_ids:
        return out
    rows = db.execute(select(Alert.senior_id, Alert.alert_id).where(
        Alert.senior_id.in_(senior_ids), Alert.status != "RESOLVED").order_by(Alert.created_at))
    for sid, aid in rows:
        out[sid] = aid
    return out
