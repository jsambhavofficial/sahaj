"""Observed-data context: empirical personal baselines (days 0-27), rolling flags, observed risk facts.

Everything here is computed ONLY from generated raw tables (what a real system could see),
never from hidden latent truth.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from config import *

T = N_DAYS


def _day(series_ts):
    return (pd.to_datetime(series_ts).dt.normalize() - pd.Timestamp(START_DATE)).dt.days


def empirical_baselines(seniors, vitals, daily, med_daily_df):
    v = vitals.copy()
    v["day"] = _day(v.timestamp)
    vv = v[(v.quality_status == "valid") & (v.day < BASELINE_DAYS)]
    key = {"blood_pressure_systolic": "sbp", "blood_pressure_diastolic": "dbp", "heart_rate": "hr", "spo2": "spo2",
           "weight": "weight_kg", "temperature": "temp_f"}
    rows = {s["senior_id"]: dict(senior_id=s["senior_id"]) for s in seniors}
    for typ, nm in key.items():
        g = vv[vv.measurement_type == typ].groupby("senior_id").measurement_value
        med, q1, q3, n = g.median(), g.quantile(.25), g.quantile(.75), g.size()
        for sid in med.index:
            rows[sid][f"baseline_{nm}_median"] = round(float(med[sid]), 1)
            rows[sid][f"baseline_{nm}_iqr"] = round(float(q3[sid] - q1[sid]), 1)
            rows[sid][f"baseline_{nm}_n"] = int(n[sid])
    for ctx in ("fasting", "post_meal"):
        g = vv[(vv.measurement_type == "blood_glucose") & (vv.measurement_context == ctx)].groupby("senior_id").measurement_value
        for sid in g.median().index:
            rows[sid][f"baseline_glucose_{ctx}_median"] = round(float(g.median()[sid]), 0)
    d = daily[daily.day_index < BASELINE_DAYS]
    agg = d.groupby("senior_id").agg(
        baseline_steps_median=("steps", "median"), baseline_active_minutes_median=("active_minutes", "median"),
        baseline_sedentary_hours_median=("sedentary_hours", "median"), baseline_sleep_hours_median=("sleep_hours", "median"),
        baseline_max_inactive_block_hours=("max_inactive_block_hours", "median"),
        baseline_hobby_sessions_per_day=("hobby_sessions", "mean"), baseline_whatsapp_msgs_per_day=("whatsapp_group_messages", "mean"),
        baseline_calls_to_family_per_day=("calls_to_family", "mean"), baseline_appetite_self_report=("self_reported_appetite_1to5", "mean"),
        baseline_mood_self_report=("self_reported_mood_1to5", "mean"),
        baseline_community_attendance_rate=("community_event_attended", "mean"),
        baseline_data_availability=("data_available", "mean")).round(2)
    out = pd.DataFrame(rows.values()).merge(agg.reset_index(), on="senior_id", how="left")
    m = med_daily_df[med_daily_df.date < (START_DATE + pd.Timedelta(days=BASELINE_DAYS)).isoformat()]
    ad = m.groupby("senior_id").apply(lambda x: x.taken_doses.sum() / max(1, x.scheduled_doses.sum()), include_groups=False).rename("baseline_med_adherence_rate").round(3)
    out = out.merge(ad.reset_index(), on="senior_id", how="left")
    conf = []
    for s in seniors:
        r = out[out.senior_id == s["senior_id"]].iloc[0]
        n = r.get("baseline_sbp_n", 0)
        conf.append("NONE" if not s["monitored"] else "HIGH" if n >= 20 else "MEDIUM" if n >= 8 else "LOW")
    out["vitals_baseline_confidence"] = conf
    out["baseline_window_days"] = f"0-{BASELINE_DAYS-1}"
    return out


def vitals_flags(seniors, vitals, base):
    """flags[sid][day] -> set of strings from readings on days d-2..d-1 (valid quality only)."""
    v = vitals[vitals.quality_status == "valid"].copy()
    v["day"] = _day(v.timestamp)
    b = base.set_index("senior_id")
    flags = {s["senior_id"]: [set() for _ in range(T)] for s in seniors}
    for sid, g in v.groupby("senior_id"):
        if sid not in b.index:
            continue
        bb = b.loc[sid]
        ev = {}  # day -> set
        for typ, val, day, ctx in zip(g.measurement_type, g.measurement_value, g.day, g.measurement_context):
            f = set()
            if typ == "blood_pressure_systolic":
                base_s = bb.get("baseline_sbp_median", 125)
                if val >= max(160, base_s + 25): f.add("bp_high")
                if val <= min(100, base_s - 22) and ctx != "standing": f.add("bp_low")
                if ctx == "standing" and val <= base_s - 25: f.add("bp_low_standing")
            elif typ == "heart_rate":
                if val >= max(105, bb.get("baseline_hr_median", 72) + 18): f.add("hr_high")
            elif typ == "spo2":
                if val <= min(92, bb.get("baseline_spo2_median", 97) - 3): f.add("spo2_low")
            elif typ == "weight":
                d_ = val - bb.get("baseline_weight_kg_median", val)
                if d_ >= 1.8: f.add("weight_up")
                if d_ <= -2.5: f.add("weight_down")
            elif typ == "temperature":
                if val >= 99.5: f.add("temp_high")
            elif typ == "blood_glucose":
                if val >= 220: f.add("glu_high")
                if val <= 70: f.add("glu_low")
            if f:
                ev.setdefault(int(day), set()).update(f)
        for d in range(T):
            for k in (1, 2):
                if d - k in ev:
                    flags[sid][d] |= ev[d - k]
    return flags


def rolling_arrays(seniors, daily, med_daily_df, base):
    """Per senior: steps_ratio7, engage_ratio7, med_missed7, med_crit7, med_unknown7 arrays (length T)."""
    out = {}
    b = base.set_index("senior_id")
    md = med_daily_df.copy()
    md["day"] = _day(md.date)
    for s in seniors:
        sid = s["senior_id"]
        d = daily[daily.senior_id == sid].sort_values("day_index")
        bs = b.loc[sid]
        steps = d.steps.to_numpy(float)
        eng = (d.hobby_sessions.to_numpy(float) / max(0.2, bs["baseline_hobby_sessions_per_day"]) * 0.5 +
               d.whatsapp_group_messages.to_numpy(float) / max(0.5, bs["baseline_whatsapp_msgs_per_day"]) * 0.5) \
            if bs["baseline_whatsapp_msgs_per_day"] > 0.3 else d.hobby_sessions.to_numpy(float) / max(0.2, bs["baseline_hobby_sessions_per_day"])
        sr = np.full(T, np.nan); er = np.full(T, np.nan)
        for t in range(T):
            lo = max(0, t - 6)
            sr[t] = np.nanmean(steps[lo:t + 1]) / max(1.0, bs["baseline_steps_median"]) if not np.all(np.isnan(steps[lo:t + 1])) else np.nan
            er[t] = np.mean(eng[lo:t + 1])
        m = md[md.senior_id == sid].sort_values("day")
        miss = np.zeros(T); crit = np.zeros(T); unk = np.zeros(T)
        for _, r in m.iterrows():
            miss[r.day] = r.missed_doses; crit[r.day] = r.critical_doses_missed; unk[r.day] = r.unknown_doses
        csum = lambda a: np.array([a[max(0, t - 6):t + 1].sum() for t in range(T)])
        out[sid] = dict(steps_ratio7=sr, engage_ratio7=er, missed7=csum(miss), crit7=csum(crit), unk7=csum(unk))
    return out
