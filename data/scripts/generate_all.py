"""Master orchestrator to generate the complete SamarthExtended synthetic dataset into data/raw/ and data/evaluation/."""
from __future__ import annotations
import json
import re
from pathlib import Path
from datetime import timedelta
import numpy as np
import pandas as pd

from config import *
from cohort import build_cohort, assign_medications, true_baselines, profile_tables
from latent import build_latent
from vitals import generate_vitals
from activity import generate_activity, generate_med_events, med_daily, generate_accel_and_falls
from contexts import empirical_baselines, vitals_flags, rolling_arrays
from family_gen import build_family_interactions
from text_gen import build_calls, build_voice_notes, date_of


def build_evaluation_tables(seniors, calls_df, vn_df):
    """Build evaluation ground-truth tables (quarantined from raw inputs)."""
    ep_rows, tb_rows, dgt_rows, ann_rows = [], [], [], []
    for i, s in enumerate(seniors):
        sid = s["senior_id"]
        sc = s["scenario"]
        spec = SCENARIOS[sc]
        ep = s["episode"]
        ep_rows.append(dict(
            episode_id=f"EP_{i+1:04d}", senior_id=sid, scenario_id=sc, category=s["category"],
            planted=bool(s["category"] != "stable"),
            onset_day=ep["onset"] if ep["onset"] is not None else -1,
            crisis_day=ep["crisis"] if ep["crisis"] is not None else -1,
            end_day=ep["end"] if ep["end"] is not None else -1,
            onset_date=date_of(ep["onset"]) if ep["onset"] is not None else "",
            crisis_date=date_of(ep["crisis"]) if ep["crisis"] is not None else "",
            end_date=date_of(ep["end"]) if ep["end"] is not None else "",
            severity=spec["sev"], expected_escalation=spec["esc"],
            acceptable_actions=ACCEPTABLE_ACTIONS[spec["esc"]],
            prohibited_actions=PROHIBITED_ACTIONS,
            vital_monitoring_enrolled=s["monitored"]
        ))
        tb = dict(senior_id=sid, scenario_id=sc, vital_monitoring_enrolled=s["monitored"])
        for k, v in s["base"].items():
            tb[f"true_base_{k}"] = round(float(v), 3)
        tb_rows.append(tb)

        prog = s["lat"]["prog"]
        tier = s["lat"]["tier"]
        for d in range(N_DAYS):
            dgt_rows.append(dict(
                senior_id=sid, date=date_of(d), day_index=d,
                scenario_id=sc, progression=round(float(prog[d]), 3),
                ground_truth_tier=int(tier[d])
            ))

    # Extract NLP ground-truth annotations from calls and voice notes
    aid = 0
    for _, r in calls_df.iterrows():
        if not r["extracted_cues_json"]:
            continue
        cues = json.loads(r["extracted_cues_json"])
        for c in cues:
            aid += 1
            ann_rows.append(dict(
                annotation_id=f"ANN_{aid:06d}", source_table="checkins", source_id=r["call_id"],
                senior_id=r["senior_id"], timestamp=r["call_datetime"],
                cue_type=c["cue"], cue_value=c["value"], severity=c["severity"],
                negation_status=bool(c["negation"]), temporal_context=c["temporal"],
                elicitation_mode=c["source"]
            ))
    for _, r in vn_df.iterrows():
        if r["primary_cue"]:
            aid += 1
            ann_rows.append(dict(
                annotation_id=f"ANN_{aid:06d}", source_table="senior_voice_notes", source_id=r["note_id"],
                senior_id=r["senior_id"], timestamp=r["timestamp"],
                cue_type=r["primary_cue"], cue_value="present", severity="strong" if r["urgency_flag"] else "mild",
                negation_status=False, temporal_context="current", elicitation_mode="voice_note"
            ))
    return pd.DataFrame(ep_rows), pd.DataFrame(tb_rows), pd.DataFrame(dgt_rows), pd.DataFrame(ann_rows)


def run_all(raw_dir: Path = RAW_DIR, eval_dir: Path = EVAL_DIR):
    raw_dir.mkdir(parents=True, exist_ok=True)
    eval_dir.mkdir(parents=True, exist_ok=True)

    print("1/7 Building cohort (250 seniors, 250 family members, 125 coordinators)...")
    seniors, families, coords = build_cohort()
    med_sched_rows = assign_medications(seniors)
    true_baselines(seniors)
    profiles_df, health_df, conds_df, events_df, fam_df, coord_df = profile_tables(seniors, families, coords)
    med_sched_df = pd.DataFrame(med_sched_rows)

    print("2/7 Building 98-day latent health & well-being trajectories...")
    build_latent(seniors)

    print("3/7 Generating PhysioNet-styled longitudinal vitals...")
    vitals_df = generate_vitals(seniors)

    print("4/7 Generating activity, engagement, medications, accelerometer windows & falls...")
    daily_act_df, hourly_act_df = generate_activity(seniors)
    med_events_df = generate_med_events(seniors)
    med_daily_df = med_daily(med_events_df, med_sched_df)
    accel_meta_df, accel_arr, fall_events_df = generate_accel_and_falls(seniors)

    print("5/7 Computing empirical personal baselines (days 0-27) & rolling flags...")
    emp_base_df = empirical_baselines(seniors, vitals_df, daily_act_df, med_daily_df)
    vflags = vitals_flags(seniors, vitals_df, emp_base_df)
    roll = rolling_arrays(seniors, daily_act_df, med_daily_df, emp_base_df)

    print("6/7 Generating family inputs, check-in call transcripts, bot question plans & voice notes (Roman script)...")
    fam_obs_df, fam_concern_days = build_family_interactions(seniors, vflags, roll)
    medarr = {}
    for sid, g in med_daily_df.groupby("senior_id"):
        miss = np.zeros(N_DAYS); unk = np.zeros(N_DAYS)
        for d_, m, u in zip(pd.to_datetime(g.date), g.missed_doses, g.unknown_doses):
            i = (d_ - pd.Timestamp(START_DATE)).days
            miss[i] = m; unk[i] = u
        medarr[sid] = dict(miss=miss, unk=unk)
    calls_df, plans_df = build_calls(seniors, vflags, roll, medarr, fam_concern_days)
    vn_df = build_voice_notes(seniors, vflags)

    # Merge rich health history & recent events into senior_baselines.csv
    ev_by_sid = {}
    for _, r in events_df.iterrows():
        ev_by_sid.setdefault(r["senior_id"], []).append(
            f"{r['event_type']}:{r['detail']} ({r['event_date']})"
        )
    rich_cols = health_df[[
        "senior_id", "physical_conditions", "mental_health_conditions", "n_chronic_conditions",
        "cognitive_status", "anxiety_tendency", "grief_status", "loneliness_risk",
        "falls_last_12_months", "hospitalisations_last_12_months", "fall_risk_level",
        "mobility_aid", "equipment_tags", "hobbies", "usual_wake_time", "usual_sleep_time",
        "usual_activity_summary"
    ]].copy()
    rich_cols["recent_health_events"] = rich_cols["senior_id"].map(lambda x: " | ".join(ev_by_sid.get(x, [])) or "none")
    emp_base_df = rich_cols.merge(emp_base_df, on="senior_id", how="left")

    print("7/7 Building evaluation ground-truth tables & saving files...")
    ep_df, tb_df, dgt_df, ann_df = build_evaluation_tables(seniors, calls_df, vn_df)

    raw_tables = {
        "senior_profiles.csv": profiles_df,
        "senior_baselines.csv": emp_base_df,
        "medication_schedules.csv": med_sched_df,
        "medication_events.csv": med_events_df,
        "vitals.csv": vitals_df,
        "daily_activity.csv": daily_act_df,
        "accelerometer_windows_meta.csv": accel_meta_df,
        "checkins.csv": calls_df,
        "senior_voice_notes.csv": vn_df,
        "family_observations.csv": fam_obs_df,
    }

    dev_re = re.compile(r"[\u0900-\u097F]")
    for fname, df in raw_tables.items():
        p = raw_dir / fname
        df.to_csv(p, index=False, encoding="utf-8")
        txt = p.read_text(encoding="utf-8")
        assert not dev_re.search(txt), f"Devanagari found in {fname}!"
        print(f"  [raw] {fname:<34} rows={len(df):>8,}  cols={df.shape[1]:>2}")

    np.savez_compressed(raw_dir / "accelerometer_windows.npz", windows=accel_arr, window_ids=accel_meta_df["window_id"].to_numpy())
    print(f"  [raw] {'accelerometer_windows.npz':<34} shape={accel_arr.shape}")

    eval_tables = {
        "decline_episodes.csv": ep_df,
        "senior_true_baselines.csv": tb_df,
        "daily_ground_truth.csv": dgt_df,
        "nlp_annotations.csv": ann_df,
    }
    for fname, df in eval_tables.items():
        p = eval_dir / fname
        df.to_csv(p, index=False, encoding="utf-8")
        print(f"  [eval] {fname:<33} rows={len(df):>8,}  cols={df.shape[1]:>2}")

    print("Done! All tables generated and verified (zero Devanagari, 100% Roman script).")


def prune_existing_raw(raw_dir: Path = RAW_DIR):
    """Merge senior_health_history & recent_health_events into senior_baselines.csv and remove DB-only files."""
    hh_p = raw_dir / "senior_health_history.csv"
    ev_p = raw_dir / "recent_health_events.csv"
    sb_p = raw_dir / "senior_baselines.csv"
    if hh_p.exists() and sb_p.exists():
        health_df = pd.read_csv(hh_p)
        emp_base_df = pd.read_csv(sb_p)
        if "physical_conditions" not in emp_base_df.columns:
            ev_by_sid = {}
            if ev_p.exists():
                events_df = pd.read_csv(ev_p)
                for _, r in events_df.iterrows():
                    ev_by_sid.setdefault(r["senior_id"], []).append(
                        f"{r['event_type']}:{r['detail']} ({r['event_date']})"
                    )
            rich_cols = health_df[[
                "senior_id", "physical_conditions", "mental_health_conditions", "n_chronic_conditions",
                "cognitive_status", "anxiety_tendency", "grief_status", "loneliness_risk",
                "falls_last_12_months", "hospitalisations_last_12_months", "fall_risk_level",
                "mobility_aid", "equipment_tags", "hobbies", "usual_wake_time", "usual_sleep_time",
                "usual_activity_summary"
            ]].copy()
            rich_cols["recent_health_events"] = rich_cols["senior_id"].map(
                lambda x: " | ".join(ev_by_sid.get(x, [])) or "none"
            )
            emp_base_df = rich_cols.merge(emp_base_df, on="senior_id", how="left")
            emp_base_df.to_csv(sb_p, index=False, encoding="utf-8")
            print(f"Updated senior_baselines.csv -> shape={emp_base_df.shape}")

    to_delete = [
        "coordinators.csv", "family_members.csv", "medication_daily.csv",
        "hourly_activity.csv", "fall_events.csv", "senior_conditions.csv",
        "recent_health_events.csv", "senior_health_history.csv", "checkin_question_plans.csv"
    ]
    for fname in to_delete:
        p = raw_dir / fname
        if p.exists():
            p.unlink()
            print(f"Removed {fname}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--prune":
        prune_existing_raw()
    elif len(sys.argv) > 1:
        base = Path(sys.argv[1])
        run_all(base / "raw", base / "evaluation")
    else:
        run_all()
