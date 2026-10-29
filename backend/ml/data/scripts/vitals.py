"""Measurement-level vitals time series (monitored seniors) + sparse coordinator-visit readings.

Signal structure follows what PhysioNet-style bedside / home data show: circadian offsets,
day-to-day AR(1) wander, BP-HR coupling, left-skewed SpO2 with a 100% ceiling, device
dropouts, cold-finger artifacts. Priors are population-informed, not copied from real records.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import *


def _ar1(r, T, rho, sd):
    e = np.zeros(T)
    for i in range(1, T):
        e[i] = rho * e[i - 1] + r.normal(0, sd * np.sqrt(1 - rho ** 2))
    return e


def _ts(day, hour, minute):
    d = datetime(START_DATE.year, START_DATE.month, START_DATE.day) + timedelta(days=int(day), hours=int(hour), minutes=int(minute))
    return d.strftime("%Y-%m-%d %H:%M:%S")


def _gaps(r, T, p_start=0.015):
    """Boolean mask: True where device is dead (battery / forgot / travelling)."""
    off = np.zeros(T, bool)
    d = 0
    while d < T:
        if r.random() < p_start:
            L = int(r.integers(2, 6))
            off[d:d + L] = True
            d += L
        d += 1
    return off


def generate_vitals(seniors):
    rows = []
    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "vitals")
        T = N_DAYS
        b = s["base"]; lat = s["lat"]; ch = lat["ch"]; cues = lat["cues"]
        spec = SCENARIOS[s["scenario"]]
        sparse = bool(spec.get("sparse"))
        if not s["monitored"]:
            # coordinator home visit about every 4 weeks: BP/pulse, SpO2, weight
            d = int(r.integers(5, 25))
            while d < T:
                hr_ = int(r.integers(10, 17)); mn = int(r.integers(0, 60))
                sbp = b["sbp"] + ch["sbp"][d] + r.normal(0, 7)
                dbp = b["dbp"] + ch["dbp"][d] + r.normal(0, 4.5)
                hr = b["hr"] + ch["hr"][d] + r.normal(0, 4)
                for typ, val, unit, src in (("blood_pressure_systolic", sbp, "mmHg", "coordinator_device"),
                                            ("blood_pressure_diastolic", dbp, "mmHg", "coordinator_device"),
                                            ("heart_rate", hr, "bpm", "coordinator_device"),
                                            ("spo2", min(100, b["spo2"] + ch["spo2"][d] + r.normal(0, .6)), "%", "coordinator_device"),
                                            ("weight", b["wt"] + ch["wt"][d] + r.normal(0, .4), "kg", "coordinator_device")):
                    rows.append((sid, _ts(d, hr_, mn), typ, round(float(val), 1 if typ == "weight" else 0), unit, "resting", src, "valid"))
                d += int(r.integers(24, 33))
            continue

        devs = s["devices"]
        sbp_sh = _ar1(r, T, 0.5, 4.5); dbp_sh = _ar1(r, T, 0.5, 3.0); hr_sh = _ar1(r, T, 0.5, 2.5)
        wt_sh = _ar1(r, T, 0.9, 0.5); glu_sh = _ar1(r, T, 0.4, 7); tmp_sh = _ar1(r, T, 0.3, 0.15)
        gaps = {d_: _gaps(r, T, 0.02 if sparse else 0.012) for d_ in ("bp_monitor", "pulse_oximeter", "smart_scale", "glucometer", "thermometer")}
        dil = s["diligence"]
        wk = lat["dow"] >= 5
        for d in range(T):
            monitor_mult = np.clip(1 + ch["monitor"][d], 0.1, 1.2) * (0.6 if (sparse and lat["prog"][d] > 0.3) else 1.0)
            wkm = 0.85 if wk[d] else 1.0
            unwell = max(cues["dizziness"][d], cues["headache"][d], cues["chest_discomfort"][d], cues["breathlessness"][d])
            # ---------------- BP + HR
            if "bp_monitor" in devs and not gaps["bp_monitor"][d]:
                p = (0.45 + 0.5 * dil + (0.08 if ("hypertension" in s["conditions"] or "chf" in s["conditions"]) else 0)) * monitor_mult * wkm
                p = min(0.98, p + (0.35 if unwell > 0.5 else 0))
                if r.random() < p:
                    n = 1 + (r.random() < 0.40)
                    for k in range(n):
                        morning = k == 0
                        hour = int(np.clip(r.normal(8, .8), 6, 10)) if morning else int(r.integers(18, 21))
                        mn = int(r.integers(0, 60))
                        circ_s = 3 if morning else -2; circ_h = -1 if morning else 2
                        standing = r.random() < (0.35 if spec.get("ortho") and lat["prog"][d] > 0.2 else 0.08)
                        ortho_drop = -(15 * min(1, lat["prog"][d] * 1.3) if spec.get("ortho") else 3) if standing else 0
                        sbp = b["sbp"] + ch["sbp"][d] + sbp_sh[d] + circ_s + ortho_drop + r.normal(0, 5)
                        dbp = b["dbp"] + ch["dbp"][d] + dbp_sh[d] + 0.4 * circ_s + 0.5 * ortho_drop + r.normal(0, 3.2)
                        hr = b["hr"] + ch["hr"][d] + hr_sh[d] + circ_h + (8 if standing else 0) + 0.12 * (sbp - b["sbp"]) + r.normal(0, 3)
                        if spec.get("arrhythmia") and lat["prog"][d] > 0.3:
                            hr += r.normal(0, 14 * lat["prog"][d])
                        q = "valid"
                        if r.random() < 0.02:  # loose cuff / talking / moving
                            sbp += r.choice([-1, 1]) * r.uniform(18, 32); dbp += r.choice([-1, 1]) * r.uniform(8, 16); q = "questionable"
                        ctx = "standing" if standing else "resting"
                        t = _ts(d, hour, mn)
                        rows.append((sid, t, "blood_pressure_systolic", round(float(sbp)), "mmHg", ctx, "home_bp_monitor", q))
                        rows.append((sid, t, "blood_pressure_diastolic", round(float(dbp)), "mmHg", ctx, "home_bp_monitor", q))
                        rows.append((sid, t, "heart_rate", round(float(np.clip(hr, 38, 170))), "bpm", ctx, "home_bp_monitor", q))
            # ---------------- SpO2
            if "pulse_oximeter" in devs and not gaps["pulse_oximeter"][d]:
                p = (0.30 + 0.45 * dil) * monitor_mult * wkm
                p = min(0.98, p + (0.45 if cues["breathlessness"][d] > 0.4 else 0))
                if r.random() < p:
                    hour = int(r.integers(7, 21)); mn = int(r.integers(0, 60))
                    v = b["spo2"] + ch["spo2"][d] - abs(r.normal(0, 0.5)) + r.normal(0, 0.35)
                    q = "valid"; ctx = "resting"
                    if r.random() < 0.10:
                        ctx = "after_activity"; v -= r.uniform(0.5, 2.0)
                    if r.random() < 0.025:  # cold finger / nail polish / motion
                        v -= r.uniform(4, 9); q = "device_artifact"
                    rows.append((sid, _ts(d, hour, mn), "spo2", round(float(min(100, v))), "%", ctx, "pulse_oximeter", q))
            # ---------------- weight
            if "smart_scale" in devs and not gaps["smart_scale"][d]:
                if r.random() < (0.30 + 0.25 * dil) * monitor_mult:
                    v = b["wt"] + ch["wt"][d] + wt_sh[d] + r.normal(0, 0.35)
                    rows.append((sid, _ts(d, int(r.integers(6, 9)), int(r.integers(0, 60))), "weight", round(float(v), 1), "kg",
                                 "fasting", "smart_scale", "valid"))
            # ---------------- glucose
            if "glucometer" in devs and not gaps["glucometer"][d]:
                if r.random() < (0.25 + 0.7 * dil) * monitor_mult * wkm:
                    v = b["glu_f"] + ch["glu"][d] + glu_sh[d] + r.normal(0, 0.06 * b["glu_f"])
                    q = "valid"
                    if r.random() < 0.01: v += r.choice([-1, 1]) * r.uniform(35, 70); q = "questionable"
                    rows.append((sid, _ts(d, int(r.integers(6, 8)), int(r.integers(0, 60))), "blood_glucose", round(float(max(38, v))), "mg/dL",
                                 "fasting", "glucometer", q))
                if r.random() < 0.30 * monitor_mult:
                    v = b["glu_pp"] + ch["glu"][d] + glu_sh[d] + r.normal(0, 0.09 * b["glu_pp"])
                    rows.append((sid, _ts(d, int(r.integers(11, 15)), int(r.integers(0, 60))), "blood_glucose", round(float(max(45, v))), "mg/dL",
                                 "post_meal", "glucometer", "valid"))
            # ---------------- temperature (taken mainly when feeling unwell)
            if "thermometer" in devs and not gaps["thermometer"][d]:
                feverish = cues["fever"][d] > 0.3 or ch["temp"][d] > 0.5 or cues["weakness"][d] > 0.6
                if r.random() < (0.75 if feverish else 0.05):
                    eve = r.random() < 0.5
                    v = b["temp"] + ch["temp"][d] + tmp_sh[d] + (0.35 if eve else -0.2) + r.normal(0, 0.2)
                    rows.append((sid, _ts(d, int(r.integers(18, 21)) if eve else int(r.integers(7, 10)), int(r.integers(0, 60))),
                                 "temperature", round(float(v), 1), "degF", "oral_resting", "thermometer", "valid"))
    df = pd.DataFrame(rows, columns=["senior_id", "timestamp", "measurement_type", "measurement_value", "unit",
                                     "measurement_context", "measurement_source", "quality_status"])
    df = df.sort_values(["senior_id", "timestamp", "measurement_type"]).reset_index(drop=True)
    df.insert(0, "measurement_id", [f"M{i+1:07d}" for i in range(len(df))])
    return df
