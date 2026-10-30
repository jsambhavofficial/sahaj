"""Load the synthetic cohort (ml/data/raw) into the database.

    python -m app.db.seed            # refuses if data already exists
    python -m app.db.seed --reset    # truncates all data tables first

Risk scores, alerts and priority lists are NOT seeded here: they come from the risk model.
Ground-truth files in ml/data/evaluation are never loaded.
"""

import argparse
import hashlib
import json
import os
import re
import secrets
import uuid
from datetime import timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from sqlalchemy import JSON, text

from app.core.database import get_sessionmaker
from app.core.security import hash_password
from app.db.models import (
    AccelerometerWindow, Base, Call, CallTurn, DailyActivity, FamilyInteraction, FamilyLink,
    MedicationEvent, MedicationSchedule, Message, NlpCue, Senior, SeniorBaseline,
    SeniorCondition, SeniorContact, SeniorHealthProfile, User, Vital,
)

BACKEND = Path(__file__).resolve().parents[2]
RAW = BACKEND / "ml" / "data" / "raw"
CREDENTIALS_FILE = BACKEND / ".seed_credentials.txt"
IST = ZoneInfo("Asia/Kolkata")
EXTRACTOR_VERSION = "dataset_v2"
RELATIONS = {"son", "daughter", "daughter_in_law", "grandchild", "nephew_niece"}


def read(name: str) -> pd.DataFrame:
    return pd.read_csv(RAW / name)


def ts(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series).dt.tz_localize(IST)


def rows(df: pd.DataFrame, int_cols=()) -> list[dict]:
    df = df.copy()
    for c in int_cols:
        df[c] = df[c].astype("Int64")
    df = df.astype(object).where(pd.notna(df), None)
    return df.to_dict("records")


def pipe(value) -> list[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)) or value == "none":
        return []
    return [v for v in str(value).split("|") if v and v != "none"]


def bulk(session, model, data: list[dict]) -> None:
    """Stream rows with COPY (one round trip per table instead of one per batch)."""
    if data:
        table = model.__table__
        cols = list(dict.fromkeys(k for r in data for k in r))
        json_cols = {c.name for c in table.columns if isinstance(c.type, JSON)}
        dbapi = session.connection().connection
        with dbapi.cursor() as cur, cur.copy(
            f"COPY {table.name} ({', '.join(cols)}) FROM STDIN"
        ) as copy:
            for r in data:
                copy.write_row([json.dumps(r.get(c), default=str) if c in json_cols and r.get(c) is not None
                                else r.get(c) for c in cols])
    print(f"  {model.__tablename__:<24}{len(data):>8}")


def fake_phone(senior_id: str) -> str:
    """Deliberately invalid (+91 0000...) so a demo call can never reach a real person."""
    n = int(hashlib.sha1(senior_id.encode()).hexdigest()[:8], 16) % 1_000_000
    return f"+910000{n:06d}"


def main(reset: bool) -> None:
    Session = get_sessionmaker()
    with Session() as s:
        if s.execute(text("select count(*) from users")).scalar():
            if not reset:
                raise SystemExit("Database already has data. Re-run with --reset to replace it.")
            tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
            s.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
            print("Existing data truncated.")

        password = os.environ.get("SEED_DEMO_PASSWORD") or secrets.token_urlsafe(10)
        pw_hash = hash_password(password)

        profiles, baselines = read("senior_profiles.csv"), read("senior_baselines.csv")
        sids = profiles.senior_id.tolist()

        # ---- users -------------------------------------------------------------------
        coord_city = profiles.groupby("coordinator_id").city.agg(lambda c: c.mode().iloc[0])
        users, coord_uid, senior_uid, family_uid = [], {}, {}, {}
        for ref, city in coord_city.items():
            coord_uid[ref] = uuid.uuid4()
            users.append(dict(id=coord_uid[ref], role="coordinator", external_ref=ref,
                              display_name=f"Care Coordinator {ref[-3:]}",
                              email=f"{ref.lower()}@demo.samarth.local", phone=fake_phone(ref),
                              password_hash=pw_hash, city=city, team_id=f"TEAM_{city.upper()}"))
        for role in ("ops", "admin"):
            users.append(dict(id=uuid.uuid4(), role=role, external_ref=f"DEMO_{role.upper()}",
                              display_name=f"Demo {role}", email=f"{role}@demo.samarth.local",
                              password_hash=pw_hash))
        for sid in sids:
            senior_uid[sid] = uuid.uuid4()
            users.append(dict(id=senior_uid[sid], role="senior", external_ref=sid, display_name=sid))
        for i, fid in enumerate(profiles.family_id.unique()):
            family_uid[fid] = uuid.uuid4()
            demo = i < 3
            users.append(dict(id=family_uid[fid], role="family", external_ref=fid,
                              display_name=f"Family {fid}",
                              email=f"family.{fid.lower()}@demo.samarth.local" if demo else None,
                              password_hash=pw_hash if demo else None))
        print("Loading:")
        bulk(s, User, users)

        # ---- seniors and profile tables ---------------------------------------------
        seniors = []
        for r in rows(profiles, int_cols=["age", "checkin_preferred_hour"]):
            seniors.append(dict(
                senior_id=r["senior_id"], gender=r["gender"], age=r["age"],
                marital_status=r["marital_status"], city=r["city"],
                living_arrangement=r["living_arrangement"], preferred_language=r["preferred_language"],
                communication_style=r["communication_style"], uses_whatsapp=bool(r["uses_whatsapp"]),
                coordinator_id=coord_uid[r["coordinator_id"]], user_id=senior_uid[r["senior_id"]],
                family_id=r["family_id"], family_consent_level=r["family_consent_level"],
                vital_monitoring_enrolled=bool(r["vital_monitoring_enrolled"]),
                vital_devices=pipe(r["vital_devices"]), motion_sensor_source=r["motion_sensor_source"],
                smart_pillbox=bool(r["smart_pillbox"]), checkin_days_of_week=pipe(r["checkin_days_of_week"]),
                checkin_preferred_hour=r["checkin_preferred_hour"],
                enrollment_date=pd.to_datetime(r["enrollment_date"]).date(),
                observation_end_date=pd.to_datetime(r["observation_end_date"]).date()))
        bulk(s, Senior, seniors)
        bulk(s, SeniorContact, [dict(senior_id=r["senior_id"], full_name=r["full_name"],
                                     phone=fake_phone(r["senior_id"])) for r in rows(profiles)])

        conditions = []
        for r in rows(baselines):
            for cat, col in (("physical", "physical_conditions"), ("mental_health", "mental_health_conditions")):
                for cond in [c.strip() for c in str(r[col]).split(",")]:
                    if cond and cond != "none":
                        conditions.append(dict(id=uuid.uuid4(), senior_id=r["senior_id"],
                                               category=cat, condition=cond))
        bulk(s, SeniorCondition, conditions)

        health = []
        for r in rows(baselines, int_cols=["falls_last_12_months", "hospitalisations_last_12_months"]):
            health.append(dict(
                senior_id=r["senior_id"], cognitive_status=r["cognitive_status"],
                anxiety_tendency=r["anxiety_tendency"], grief_status=r["grief_status"],
                loneliness_risk=r["loneliness_risk"], falls_last_12_months=r["falls_last_12_months"],
                hospitalisations_last_12_months=r["hospitalisations_last_12_months"],
                fall_risk_level=r["fall_risk_level"], mobility_aid=r["mobility_aid"],
                equipment_tags=pipe(r["equipment_tags"]), hobbies=pipe(r["hobbies"]),
                usual_wake_time=r["usual_wake_time"], usual_sleep_time=r["usual_sleep_time"],
                usual_activity_summary=r["usual_activity_summary"],
                recent_health_events=r["recent_health_events"]))
        bulk(s, SeniorHealthProfile, health)

        num = baselines[["senior_id"] + [c for c in baselines.columns if c.startswith("baseline_")
                                         or c == "vitals_baseline_confidence"]].copy()
        num.columns = ["senior_id"] + [
            c if c in ("baseline_window_days", "vitals_baseline_confidence") else c.removeprefix("baseline_")
            for c in num.columns[1:]]
        int_cols = [c for c in num.columns if c.endswith("_n")]
        bulk(s, SeniorBaseline, rows(num, int_cols=int_cols))

        # ---- medications --------------------------------------------------------------
        sched = read("medication_schedules.csv")
        sched_rows = []
        for r in rows(sched, int_cols=["times_per_day"]):
            sched_rows.append(dict(
                medication_id=r["medication_id"], senior_id=r["senior_id"], drug_name=r["drug_name"],
                dosage=r["dose"], indication=r["indication"], linked_condition=r["linked_condition"],
                criticality=r["criticality"], start_date=pd.to_datetime(r["start_date"]).date(),
                end_date=pd.to_datetime(r["end_date"]).date() if r["end_date"] else None,
                times_per_day=r["times_per_day"], scheduled_times=pipe(r["scheduled_times"]),
                is_sos=bool(r["is_sos"]), prescribed_by=r["prescribed_by"], is_active=bool(r["active"])))
        bulk(s, MedicationSchedule, sched_rows)

        ev = read("medication_events.csv")
        ev["scheduled_timestamp"], ev["actual_timestamp"] = ts(ev.scheduled_timestamp), ts(ev.actual_timestamp)
        bulk(s, MedicationEvent, rows(ev.rename(columns={
            "scheduled_timestamp": "scheduled_at", "actual_timestamp": "actual_at"})))

        # ---- signals ------------------------------------------------------------------
        v = read("vitals.csv")
        v["timestamp"] = ts(v.timestamp)
        bulk(s, Vital, rows(v.rename(columns={"timestamp": "measured_at", "measurement_value": "value",
                                              "measurement_context": "context",
                                              "measurement_source": "source"})))
        a = read("daily_activity.csv")
        a["date"] = pd.to_datetime(a.date).dt.date
        a = a.rename(columns={"self_reported_appetite_1to5": "appetite_level",
                              "self_reported_mood_1to5": "mood_level"})
        bulk(s, DailyActivity, rows(a, int_cols=["day_index", "social_contact_count", "hobby_sessions",
                                                 "whatsapp_group_messages", "calls_to_family"]))

        w = read("accelerometer_windows_meta.csv")
        w["window_start"] = ts(w.window_start)
        w["source"] = w.source.where(~w.source.str.startswith("SCEN_"), "fall_event")  # no scenario ids
        npz_keys = set(np.load(RAW / "accelerometer_windows.npz").files)
        w["waveform_ref"] = [f"accelerometer_windows.npz:{k}" if k in npz_keys else None for k in w.window_id]
        bulk(s, AccelerometerWindow, rows(w, int_cols=["sample_rate_hz"]))

        # ---- coordinator calls: calls + transcript turns + cues -----------------------
        c = read("checkins.csv")
        c["call_datetime"] = ts(c.call_datetime)
        status_map = {"answered": "completed", "answered_brief": "completed", "no_answer": "no_answer"}
        calls, turns, cues = [], [], []
        for r in rows(c, int_cols=["duration_sec", "day_index", "senior_word_count", "senior_turns"]):
            cid = uuid.uuid4()
            start = r["call_datetime"]
            has_tx = r["transcript"] is not None
            calls.append(dict(
                id=cid, external_ref=r["call_id"], kind="phone_bridge", senior_id=r["senior_id"],
                coordinator_id=coord_uid[r["coordinator_id"]], provider="import",
                status=status_map[r["call_status"]], started_at=start,
                ended_at=start + timedelta(seconds=r["duration_sec"] or 0), duration_sec=r["duration_sec"],
                language=r["language_style"], objective=r["objective"], sentiment=r["sentiment"],
                urgency_flag=bool(r["urgency_flag"]), recording_consent=False,
                transcript_status="done" if has_tx else "not_applicable", summary=r["objective_note_en"],
                call_insights={k: r[k] for k in (
                    "call_status", "day_index", "senior_word_count", "senior_turns",
                    "senior_terse_reply_ratio", "complaint_flag", "senior_query_flag", "medication_report",
                    "medication_report_mismatch", "hobby_engagement")},
                model_info={"source": "synthetic_dataset"}))
            if has_tx:
                parts = re.split(r"(?m)^(COORDINATOR|SENIOR):\s*", r["transcript"])
                for i, (who, said) in enumerate(zip(parts[1::2], parts[2::2])):
                    turns.append(dict(id=uuid.uuid4(), call_id=cid, turn_index=i,
                                      speaker=who.lower(), text=said.strip(), language=r["language_style"]))
            for cue in json.loads(r["extracted_cues_json"] or "[]"):
                cues.append(dict(id=uuid.uuid4(), source_type="call", source_id=str(cid),
                                 senior_id=r["senior_id"], cue_type=cue["cue"], cue_value=cue["value"],
                                 severity=cue.get("severity"), cue_origin=cue.get("source"),
                                 temporal_context=cue.get("temporal"), negated=bool(cue.get("negation")),
                                 uncertain=False, extractor_version=EXTRACTOR_VERSION))
        bulk(s, Call, calls)
        bulk(s, CallTurn, turns)

        # ---- senior voice notes -> messages (+ cue from primary_cue) ------------------
        n = read("senior_voice_notes.csv")
        n["timestamp"] = ts(n.timestamp)
        msgs = []
        for r in rows(n, int_cols=["duration_sec"]):
            mid = uuid.uuid4()
            msgs.append(dict(id=mid, external_ref=r["note_id"], senior_id=r["senior_id"],
                             sender_user_id=senior_uid[r["senior_id"]], kind="voice_note",
                             category=r["category"], urgency_flag=bool(r["urgency_flag"]),
                             duration_sec=r["duration_sec"], stt_confidence=r["stt_confidence"],
                             transcript=r["transcript"], language=r["language_style"],
                             created_at=r["timestamp"]))
            if r["primary_cue"]:
                cues.append(dict(id=uuid.uuid4(), source_type="message", source_id=str(mid),
                                 senior_id=r["senior_id"], cue_type=r["primary_cue"], cue_value="present",
                                 negated=False, uncertain=False, extractor_version=EXTRACTOR_VERSION))
        bulk(s, Message, msgs)
        bulk(s, NlpCue, cues)

        # ---- family -------------------------------------------------------------------
        f = read("family_observations.csv")
        f["timestamp"] = ts(f.timestamp)
        fam = []
        for r in rows(f):
            fam.append(dict(
                interaction_id=r["interaction_id"], senior_id=r["senior_id"], family_id=r["family_id"],
                coordinator_id=coord_uid[r["coordinator_id"]], family_user_id=family_uid[r["family_id"]],
                at=r["timestamp"], channel=r["channel"], observer_relation=r["observer_relation"],
                message_language=r["message_language"], category=r["category"],
                primary_cue=r["primary_cue"], family_message=r["family_message"],
                coordinator_reply_en=r["coordinator_warm_reply_en"],
                coordinator_reply_hi_roman=r["coordinator_warm_reply_hi_roman"],
                counselor_summary=r["objective_counselor_summary"], suggested_action=r["suggested_action"],
                escalation_needed=bool(r["escalation_needed"]), consent_level=r["consent_level"]))
        bulk(s, FamilyInteraction, fam)

        main_relation = f.groupby("senior_id").observer_relation.agg(lambda x: x.mode().iloc[0])
        links = []
        for r in rows(profiles):
            rel = main_relation.get(r["senior_id"])
            links.append(dict(id=uuid.uuid4(), family_user_id=family_uid[r["family_id"]],
                              senior_id=r["senior_id"], relationship=rel if rel in RELATIONS else "other",
                              consent_level=r["family_consent_level"], consent_given=True))
        bulk(s, FamilyLink, links)

        s.commit()

    CREDENTIALS_FILE.write_text(
        "Demo logins for the seeded synthetic data (not real people). Same password for all:\n"
        f"password: {password}\n\n"
        "coordinator: coord_001@demo.samarth.local ... (one per COORD_xxx)\n"
        "ops:         ops@demo.samarth.local\n"
        "admin:       admin@demo.samarth.local\n"
        "family:      family.f0001@demo.samarth.local (also f0002, f0003)\n"
        "senior:      no password; device-token login (user rows have external_ref = senior id)\n")
    CREDENTIALS_FILE.chmod(0o600)
    print(f"Done. Demo credentials written to {CREDENTIALS_FILE.name} (gitignored).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="truncate all data tables first")
    main(parser.parse_args().reset)
