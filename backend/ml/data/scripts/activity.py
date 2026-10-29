"""Daily activity + engagement, hourly activity, medication events, accelerometer windows, fall events."""
from __future__ import annotations
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import *
from vitals import _ar1, _gaps, _ts

FS = 25
WIN_S = 20
NS = FS * WIN_S


# =============================================================== daily + hourly activity
def generate_activity(seniors):
    daily, hourly = [], []
    T = N_DAYS
    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "activity")
        b = s["base"]; lat = s["lat"]; ch = lat["ch"]; cues = lat["cues"]
        spec = SCENARIOS[s["scenario"]]
        sparse = bool(spec.get("sparse"))
        steps_n = _ar1(r, T, 0.4, 0.12); sleep_n = _ar1(r, T, 0.3, 0.45)
        app_n = _ar1(r, T, 0.5, 0.25); mood_n = _ar1(r, T, 0.5, 0.25)
        off = _gaps(r, T, 0.012 if s["wearable"] else 0.008)
        if sparse:
            off |= (_gaps(r, T, 0.06) & (lat["prog"] > 0.25))
        hob_rate = sum(HOBBIES[h][4] * (0.45 if (HOBBIES[h][2] and lat["rain"][0] is not None) else 1) for h in s["hobbies"])
        part = np.clip(b["participation"] + ch["participation"], 0.2, 1)
        prev_still = None
        for d in range(T):
            avail = not off[d]
            mult = max(0.04, 1 + ch["steps"][d])
            steps = b["steps"] * mult * np.exp(steps_n[d])
            active = b["active_min"] * mult ** 1.1 * np.exp(0.6 * steps_n[d])
            sleep = np.clip(b["sleep"] + ch["sleep"][d] + sleep_n[d], 2.0, 11.0)
            sed = np.clip(b["sedentary"] + ch["sedentary"][d] + (1 - mult) * 1.5 + r.normal(0, .5), 5, 16)
            app = np.clip(b["appetite"] + ch["appetite"][d] + app_n[d], 1, 5)
            mood = np.clip(b["mood"] + ch["mood"][d] + mood_n[d], 1, 5)
            responded = r.random() < 0.55 * part[d]
            social = r.poisson(max(0.05, 2.0 * (1 + ch["social"][d]) * (0.7 if s["living"] == "alone" else 1.0)))
            outdoor_adj = 0.55 if lat["rain"][d] else 1.0
            hob = r.poisson(max(0.02, sum(HOBBIES[h][4] * (outdoor_adj if HOBBIES[h][2] else 1.0) for h in s["hobbies"]) * 0.55 *
                               max(0.0, 1 + ch["engage"][d]) * (0.3 if lat["tier"][d] >= 2 and spec["cat"] == "acute" else 1)))
            wa_mean = b["wa"] * max(0.0, 1 + ch["engage"][d])
            wa = int(r.poisson(r.gamma(2.0, wa_mean / 2.0 + 1e-6))) if wa_mean > 0 else 0
            sat = lat["dow"][d] == 5
            ev_reg = bool(sat and s["wa_user"] and r.random() < 0.6)
            ev_att = bool(ev_reg and r.random() < 0.75 * max(0.05, 1 + ch["engage"][d]))
            fam_calls = r.poisson(max(0.03, b["calls_to_family"] * (1 + ch["social"][d])))
            # ---- hourly profile
            wts = np.array([0.2, 1.0, 1.4, 1.0, 0.6, 0.5, 0.7, 0.8, 0.6, 0.5, 0.6, 1.0, 1.4, 1.1, 0.7, 0.4])  # hours 6..21
            if s["chronotype"] == "evening":
                wts = np.roll(wts, 2); wts[:2] = 0.1
            if "morning_walk" in s["hobbies"] or "yoga" in s["hobbies"]:
                wts[0] += 0.6; wts[1] += 1.0
            if "temple_visit" in s["hobbies"] or "bhajan_mandali" in s["hobbies"]:
                wts[11:13] += 0.8
            zero_p = 0.12 + 0.55 * max(0.0, 1 - mult)
            keep = r.random(16) > zero_p
            if keep.sum() == 0: keep[int(r.integers(0, 16))] = True
            w = wts * keep * r.gamma(4.0, 0.25, 16)
            share = w / w.sum()
            hsteps = steps * share
            hact = np.minimum(active * share, 55)
            if avail:
                inact_run = best = 0
                for h in range(16):
                    hourly.append((sid, (START_DATE + timedelta(days=d)).isoformat(), 6 + h, int(round(hsteps[h])),
                                   round(float(hact[h]), 1), round(float(max(0, 60 - hact[h] - 8)), 1)))
                    if hsteps[h] < 20:
                        inact_run += 1; best = max(best, inact_run)
                    else:
                        inact_run = 0
            else:
                best = np.nan
            daily.append(dict(
                senior_id=sid, date=(START_DATE + timedelta(days=d)).isoformat(), day_index=d,
                steps=int(round(steps)) if avail else np.nan, active_minutes=round(float(active), 1) if avail else np.nan,
                sedentary_hours=round(float(sed), 2) if avail else np.nan,
                max_inactive_block_hours=best if avail else np.nan,
                sleep_hours=round(float(sleep), 2) if (avail and s["wearable"]) else np.nan,
                self_reported_appetite_1to5=round(float(app), 1) if responded else np.nan,
                self_reported_mood_1to5=round(float(mood), 1) if responded else np.nan,
                social_contact_count=int(social), hobby_sessions=int(hob), whatsapp_group_messages=int(wa),
                community_event_registered=ev_reg, community_event_attended=ev_att, calls_to_family=int(fam_calls),
                motion_sensor_source="wearable_watch" if s["wearable"] else "phone_accelerometer", data_available=bool(avail)))
    daily = pd.DataFrame(daily)
    hourly = pd.DataFrame(hourly, columns=["senior_id", "date", "hour", "steps", "active_minutes", "still_minutes"])
    return daily, hourly


# =============================================================== medications
def generate_med_events(seniors):
    rows = []
    for s in seniors:
        r = rng_for(s["senior_id"], "medevents")
        ch = s["lat"]["ch"]; cues = s["lat"]["cues"]
        for m in s["meds"]:
            if m["is_sos"]:
                for d in range(N_DAYS):
                    if cues["pain"][d] > 0.55 and r.random() < 0.5:
                        t = datetime(2026, 7, 6) + timedelta(days=d, hours=int(r.integers(8, 21)), minutes=int(r.integers(0, 60)))
                        rows.append((s["senior_id"], m["medication_id"], t.strftime("%Y-%m-%d %H:%M:%S"), "sos_taken", t.strftime("%Y-%m-%d %H:%M:%S"),
                                     "senior_app_confirmation", "self_reported"))
                continue
            for d in range(N_DAYS):
                p = np.clip(s["base"]["adherence"] + ch["adherence"][d] - (0.03 if s["lat"]["dow"][d] >= 5 else 0), 0.02, 0.995)
                for tm in m["scheduled_times"].split("|"):
                    h, mi = map(int, tm.split(":"))
                    sched = datetime(2026, 7, 6) + timedelta(days=d, hours=h, minutes=mi)
                    u = r.random()
                    if u < p:
                        status = "taken"
                        actual = sched + timedelta(minutes=float(abs(r.normal(10, 25))) if r.random() > .06 else float(r.uniform(60, 180)))
                        if s["category"] == "gradual" and s["scenario"].endswith("MED_CONFUSION") and r.random() < 0.02 * s["lat"]["prog"][d] * 10:
                            status = "double_dose"
                    else:
                        status = "missed"; actual = None
                    if s["pillbox"]:
                        src, ver = "smart_pillbox", "verified"
                    else:
                        v = r.random()
                        if v < .55: src, ver = "senior_app_confirmation", "self_reported"
                        elif v < .85: src, ver = "coordinator_call", "verified"
                        else: src, ver = "family_reported", "unverified"
                    if status == "taken" and ver != "verified" and r.random() < 0.06:
                        status, actual = "unknown", None
                    rows.append((s["senior_id"], m["medication_id"], sched.strftime("%Y-%m-%d %H:%M:%S"), status,
                                 actual.strftime("%Y-%m-%d %H:%M:%S") if actual is not None else "", src, ver))
    ev = pd.DataFrame(rows, columns=["senior_id", "medication_id", "scheduled_timestamp", "status", "actual_timestamp",
                                     "record_source", "verification_status"])
    ev = ev.sort_values(["senior_id", "scheduled_timestamp", "medication_id"]).reset_index(drop=True)
    ev.insert(0, "medication_event_id", [f"ME{i+1:07d}" for i in range(len(ev))])
    return ev


def med_daily(ev, sched):
    crit = sched.set_index("medication_id")["criticality"].to_dict()
    e = ev[ev.status != "sos_taken"].copy()
    e["date"] = e.scheduled_timestamp.str[:10]
    e["critical"] = e.medication_id.map(crit).eq("high")
    g = e.groupby(["senior_id", "date"])
    out = g.agg(scheduled_doses=("status", "size"), taken_doses=("status", lambda x: int(x.isin(["taken", "double_dose"]).sum())),
                missed_doses=("status", lambda x: int((x == "missed").sum())), unknown_doses=("status", lambda x: int((x == "unknown").sum())),
                double_doses=("status", lambda x: int((x == "double_dose").sum()))).reset_index()
    cm = e[(e.status == "missed") & e.critical].groupby(["senior_id", "date"]).size().rename("critical_doses_missed").reset_index()
    out = out.merge(cm, how="left", on=["senior_id", "date"]).fillna({"critical_doses_missed": 0})
    out["critical_doses_missed"] = out["critical_doses_missed"].astype(int)
    return out


# =============================================================== accelerometer
def _unit(v):
    return v / (np.linalg.norm(v) + 1e-9)


def _rot(axis, deg):
    a = _unit(np.asarray(axis, float)); th = np.deg2rad(deg)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * K @ K


def _tilted_gravity(r, max_deg):
    az = r.uniform(0, 2 * np.pi)
    ax = np.array([np.cos(az), np.sin(az), 0.0])
    return _rot(ax, r.uniform(0, max_deg)) @ np.array([0, 0, 1.0])


def _horizontal_g(r, g):
    ax = _unit(np.cross(g, r.normal(size=3)))
    return _rot(ax, r.uniform(65, 100)) @ g


def _pos_signal(kind, r, frail, g):
    """Return (N,3) steady-state acceleration for activity `kind` in sensor frame with gravity vector g."""
    t = np.arange(NS) / FS
    u = _unit(g); v = _unit(np.cross(u, r.normal(size=3))); w = np.cross(u, v)
    x = np.tile(g, (NS, 1)).astype(float)
    if kind in ("walking", "stairs", "fast_walk"):
        f = r.normal(1.3 if frail else 1.65, .12) if kind == "walking" else (1.25 if kind == "stairs" else r.normal(2.0, .1))
        A = (0.18 if frail else 0.28) * (1.5 if kind != "walking" else 1) * r.uniform(.85, 1.15)
        x += A * np.sin(2 * np.pi * f * t)[:, None] * u + 0.4 * A * np.sin(np.pi * f * t + r.uniform(0, 6))[:, None] * v \
            + 0.5 * A * np.sin(2 * np.pi * f * t + r.uniform(0, 6))[:, None] * w
    elif kind == "standing":
        x += 0.02 * np.sin(2 * np.pi * 0.3 * t)[:, None] * v
    return x


def make_window(kind, r, frail=False, device="wearable"):
    """kind: walking|stairs|sitting|standing|lying|sit_to_stand|hard_sit|stumble|device_drop|fall_*"""
    t = np.arange(NS) / FS
    noise_sd = 0.012 if device == "wearable" else 0.018
    g = _tilted_gravity(r, 35 if device == "wearable" else 55)
    meta = dict(impact_time_s=np.nan)
    if kind in ("walking", "stairs", "fast_walk", "standing"):
        x = _pos_signal(kind, r, frail, g)
    elif kind == "sitting":
        g2 = _rot(np.cross(g, r.normal(size=3)), r.uniform(5, 20)) @ g
        x = _pos_signal("none", r, frail, g2)
        x += 0.01 * np.sin(2 * np.pi * 0.25 * t)[:, None] * _unit(np.cross(g2, [1, 0, 0.2]))
    elif kind == "lying":
        x = _pos_signal("none", r, frail, _horizontal_g(r, g))
    elif kind == "sit_to_stand":
        gs = _rot(np.cross(g, r.normal(size=3)), r.uniform(10, 25)) @ g
        ts = r.uniform(6, 11)
        a = 1 / (1 + np.exp(-(t - ts) * 4))[:, None]
        x = (1 - a) * gs + a * g
        x += (0.35 * np.exp(-((t - ts) ** 2) / 0.4))[:, None] * _unit(g)
    elif kind in ("hard_sit", "stumble"):
        base = _pos_signal("walking" if kind == "stumble" else "standing", r, frail, g)
        ti = r.uniform(7, 11); meta["impact_time_s"] = ti
        peak = r.uniform(1.8, 2.7) if kind == "hard_sit" else r.uniform(1.6, 2.4)
        spike = peak * np.exp(-((t - ti) ** 2) / (2 * 0.05 ** 2))
        x = base + spike[:, None] * _unit(g)
        if kind == "stumble":
            x += (0.6 * np.exp(-((t - ti - .3) ** 2) / 0.05) * np.sin(2 * np.pi * 3 * (t - ti)))[:, None] * _unit(np.cross(g, [0, 1, 0]))
        else:  # settles into sitting orientation (small tilt change, stays still)
            gs = _rot(np.cross(g, r.normal(size=3)), r.uniform(10, 35)) @ g
            a = (t > ti + .2).astype(float)[:, None]
            x = (1 - a) * x + a * (gs + r.normal(0, .01, (NS, 3)))
    elif kind == "device_drop":
        ti = r.uniform(5, 10); meta["impact_time_s"] = ti
        gp = _horizontal_g(r, g) if r.random() < .5 else _tilted_gravity(r, 80)
        x = np.tile(g, (NS, 1)).astype(float)                        # resting before (not worn / on table)
        peak = r.uniform(3.5, 8.0)
        spike = peak * np.exp(-((t - ti) ** 2) / (2 * 0.03 ** 2)) + 1.5 * np.abs(np.sin(2 * np.pi * 9 * (t - ti))) * np.exp(-(t - ti) / 0.25) * (t > ti)
        x = x + spike[:, None] * _unit(r.normal(size=3))
        a = (t > ti + .5).astype(float)[:, None]
        x = (1 - a) * x + a * gp
    elif kind.startswith("fall_"):
        ftype = kind[5:]
        pre = {"bed": "lying", "chair": "sitting", "syncope": "standing"}.get(ftype, "walking" if r.random() < .75 else "standing")
        if pre == "lying":
            x = _pos_signal("none", r, frail, _horizontal_g(r, g))
        elif pre == "sitting":
            x = _pos_signal("none", r, frail, _rot(np.cross(g, r.normal(size=3)), 12) @ g)
        else:
            x = _pos_signal(pre, r, frail, g)
        tf = r.uniform(7, 10.5); meta["impact_time_s"] = tf + 0.35
        ff = (t > tf) & (t < tf + 0.35)
        x[ff] *= r.uniform(0.2, 0.5)                                   # free-fall: |a| drops
        peak = {"forward": (3.0, 5.5), "backward": (3.5, 6.0), "lateral": (2.8, 4.5), "slip": (3.0, 5.0), "syncope": (2.2, 3.5),
                "bed": (1.8, 2.6), "chair": (2.0, 3.2)}[ftype]
        P = r.uniform(*peak)
        ti = tf + 0.35
        d1 = _unit(g + r.normal(0, .5, 3))
        spike = P * np.exp(-((t - ti) ** 2) / (2 * 0.05 ** 2)) + 0.35 * P * np.exp(-(t - ti) / 0.2) * np.abs(np.sin(2 * np.pi * 8 * (t - ti))) * (t > ti)
        x = x + spike[:, None] * d1
        # new resting orientation: lying (not for bed falls — already horizontal)
        g_new = g if ftype == "bed" else _horizontal_g(r, g)
        if ftype == "bed":
            g_new = _horizontal_g(r, g)
        a = (t > ti + 0.35).astype(float)[:, None]
        post_still = r.uniform(7, 12) if r.random() < .6 else r.uniform(2, 6)
        post = np.tile(g_new, (NS, 1)).astype(float)
        resume = t > ti + post_still
        post[resume] += (0.25 * np.sin(2 * np.pi * 1.1 * t[resume]))[:, None] * _unit(np.cross(g_new, [0, 0, 1]))  # trying to get up
        x = (1 - a) * x + a * post
        meta["post_still_true_s"] = float(post_still)
    else:
        raise ValueError(kind)
    x = x + r.normal(0, noise_sd, x.shape)
    return x.astype(np.float32), meta


def window_features(x, meta):
    svm = np.linalg.norm(x, axis=1)
    i_pk = int(np.argmax(svm)); peak = float(svm[i_pk])
    lo = max(0, i_pk - FS); mn = float(svm[lo:i_pk + 1].min())
    pre_std = float(svm[:min(i_pk, 5 * FS)].std()) if i_pk > 5 else float(svm[:5 * FS].std())
    first = x[:4 * FS].mean(0); last = x[-4 * FS:].mean(0)
    ang = float(np.degrees(np.arccos(np.clip(np.dot(_unit(first), _unit(last)), -1, 1))))
    # post-impact stillness: consecutive seconds (after impact+1s) with 1s rolling std < 0.06 g
    still = 0; run = 0
    for sec in range(int((i_pk / FS) + 1), WIN_S):
        seg = svm[sec * FS:(sec + 1) * FS]
        if len(seg) == FS and seg.std() < 0.06:
            run += 1; still = max(still, run)
        else:
            run = 0
    jerk = float(np.abs(np.diff(svm)).max() * FS)
    return dict(peak_g=round(peak, 2), min_g_before_peak=round(mn, 2), pre_impact_std_g=round(pre_std, 3),
                orientation_change_deg=round(ang, 1), post_impact_still_s=int(still), max_jerk_g_per_s=round(jerk, 1))


def generate_accel_and_falls(seniors):
    """Returns (meta_df, windows_array, fall_events_df)."""
    wins, meta, falls_out = [], [], []
    wid = 0
    fid = 0
    frail = lambda s: s["fall_risk"] == "high" or s["age"] > 80

    def add(sid, kind, label, ts, r, s, source, fall_type="", fall_event_id=""):
        nonlocal wid
        dev = "wearable" if s["wearable"] else "phone"
        x, m = make_window(kind, r, frail(s), dev)
        f = window_features(x, m)
        wid += 1
        wins.append(x)
        meta.append(dict(window_id=f"W{wid:05d}", senior_id=sid, window_start=ts, duration_s=WIN_S, sample_rate_hz=FS, label=label,
                         activity_type=kind if not kind.startswith("fall_") else "fall", fall_type=fall_type, fall_event_id=fall_event_id,
                         device="wrist_wearable" if s["wearable"] else "phone_in_pocket", source=source, **f))
        return f"W{wid:05d}"

    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "accel")
        # routine ADL windows
        kinds = ["walking", "sitting", "standing", "lying", "sit_to_stand", "stairs", "fast_walk"]
        pk = np.array([.28, .2, .12, .1, .15, .08, .07])
        for _ in range(8):
            d = int(r.integers(0, N_DAYS)); h = int(r.integers(7, 22))
            add(sid, str(r.choice(kinds, p=pk)), "non_fall", _ts(d, h, int(r.integers(0, 60))), r, s, "adl")
        # hard negatives
        if r.random() < (0.55 if frail(s) else 0.25):
            add(sid, "stumble", "non_fall_near_fall", _ts(int(r.integers(0, N_DAYS)), int(r.integers(7, 21)), 5), r, s, "near_fall")
        if r.random() < 0.18:
            add(sid, "hard_sit", "non_fall", _ts(int(r.integers(0, N_DAYS)), int(r.integers(7, 21)), 5), r, s, "hard_negative")
        if r.random() < 0.12:
            add(sid, "device_drop", "non_fall", _ts(int(r.integers(0, N_DAYS)), int(r.integers(7, 21)), 5), r, s, "hard_negative_drop")
        # falls
        for f in s["falls"]:
            fid += 1
            eid = f"FALL_{fid:04d}"
            d = f["day"]
            hour = int(r.integers(6, 23)); mn = int(r.integers(0, 60))
            ftype = f["type"]
            detected = bool(r.random() < (0.92 if s["wearable"] else 0.7)) and d >= 0
            win = ""
            if d >= 0:
                fk = {"slip": "fall_slip", "trip": "fall_forward", "forward": "fall_forward", "backward": "fall_backward",
                      "lateral": "fall_lateral"}.get(ftype, "fall_forward")
                if r.random() < .08: fk = "fall_syncope"
                if hour >= 22 or hour < 7: fk = "fall_bed" if r.random() < .5 else fk
                if detected:
                    win = add(sid, fk, "fall", _ts(d, hour, mn), r, s, f["source"], fall_type=fk[5:], fall_event_id=eid)
            silent = f.get("silent", False)
            if silent:
                rep = "sensor_only"
            elif f["source"] == "recent_event":
                rep = r.choice(["senior_checkin", "family", "not_reported"], p=[.5, .3, .2])
            else:
                rep = r.choice(["senior_checkin", "family", "not_reported"], p=[.65, .25, .10])
            f["event_id"] = eid; f["hour"] = hour; f["minute"] = mn; f["reported_by"] = str(rep)
            falls_out.append(dict(fall_event_id=eid, senior_id=sid, event_datetime=_ts(d, hour, mn) if d >= 0 else
                                  (datetime(2026, 7, 6) + timedelta(days=d, hours=hour, minutes=mn)).strftime("%Y-%m-%d %H:%M:%S"),
                                  day_index=d, fall_type=ftype, injury_level=f["injury"], source=f["source"], detail=f["detail"],
                                  detected_by_sensor=bool(win), window_id=win, reported_to_samarth_by=str(rep),
                                  within_observation_window=d >= 0))
    arr = np.stack(wins).astype(np.float32)
    return pd.DataFrame(meta), arr, pd.DataFrame(falls_out)
