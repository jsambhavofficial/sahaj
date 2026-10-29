"""Daily latent health / well-being state per senior.

This is the causal layer: every downstream table (vitals, activity, medication, calls,
voice notes, family messages) is generated FROM these arrays, so cross-modal signals
are consistent and the ground truth is exact.
"""
from __future__ import annotations
import numpy as np

from config import *
from cohort import RECENT_EVENTS

CH = ["sbp", "dbp", "hr", "spo2", "temp", "wt", "glu", "steps", "sleep", "appetite", "mood", "social",
      "engage", "monitor", "adherence", "words", "participation", "sedentary"]

CHRONIC_CUE_BASE = {"osteoarthritis": ("pain", 0.30), "depression_anxiety": ("low_mood", 0.25),
                    "copd_asthma": ("breathlessness", 0.20), "chf": ("swelling", 0.15),
                    "mild_cognitive_impairment": ("confusion", 0.12), "prior_stroke": ("weakness", 0.20)}


def progression(ep, T):
    t = np.arange(T, dtype=float)
    p = np.zeros(T)
    if ep["shape"] == "none":
        return p
    on, cr, end = ep["onset"], ep["crisis"], ep["end"]
    if ep["shape"] == "bell":
        sig = max(0.8, ep["dur"] / 3.0)
        p = np.exp(-((t - cr) ** 2) / (2 * sig ** 2))
        p[(t < on) | (t > end)] = 0
        return p
    if ep["shape"] == "ramp":
        ramp = max(1, ep["ramp"])
        p = np.where(t < on, 0, np.clip((t - on) / ramp, 0, 1))
        post = t > cr + ep["hold"]
    else:  # step
        p = np.where(t >= on, 1.0, 0.0)
        post = t > on + ep["hold"]
    if ep["rec"] > 0:
        dec = np.clip(1 - (t - (cr + ep["hold"] if ep["shape"] == "ramp" else on + ep["hold"])) / ep["rec"], 0, 1)
        p = np.where(post, np.minimum(p, dec), p)
    return p


def event_factor(ev, T):
    t = np.arange(T, dtype=float)
    spec = RECENT_EVENTS[ev["type"]]
    f = np.exp(-(t - ev["t0"]) / spec["tau"])
    f[t < ev["t0"]] = 0.0
    return f


def build_latent(seniors):
    T = N_DAYS
    # city-level rain days (shared confounder for outdoor activity)
    rr = np.random.default_rng(MASTER_SEED + 7)
    rain = {c: (rr.random(T) < 0.28) for c in CITIES}

    for s in seniors:
        r = rng_for(s["senior_id"], "latent")
        spec = SCENARIOS[s["scenario"]]
        ep = s["episode"]
        prog = progression(ep, T)
        ch = {k: np.zeros(T) for k in CH}
        cues = {c: np.zeros(T) for c in CUES}
        eff = spec.get("eff", {})
        for k, v in eff.items():
            if k in ch:
                ch[k] += v * prog
        for c, v in spec.get("cues", {}).items():
            cues[c] = 1 - (1 - cues[c]) * (1 - v * prog)
        scen_cue = {c: v.copy() for c, v in cues.items()}

        # recent / background events
        ev_f = np.zeros(T)
        falls = []
        for ev in s["events"]:
            f = event_factor(ev, T)
            ev_f = np.maximum(ev_f, f)
            es = RECENT_EVENTS[ev["type"]]
            for k, v in es["eff"].items():
                ch[k] += v * f
            for c, v in es["cues"].items():
                cues[c] = 1 - (1 - cues[c]) * (1 - v * f)
            if ev["type"] in ("minor_fall", "minor_fall_in_window"):
                falls.append(dict(day=ev["t0"], type=str(r.choice(["slip", "trip", "lateral", "backward"])),
                                  injury=str(r.choice(["none", "bruise", "bruise", "sprain"], p=[.3, .4, .15, .15])),
                                  source="recent_event" if ev["t0"] < 0 else "background_in_window",
                                  detail=ev["detail"]))
        if spec.get("fall_at_onset"):
            inj = "fracture_suspected" if spec["sev"] == "severe" and r.random() < 0.35 else r.choice(["bruise", "sprain", "bruise", "none"])
            falls.append(dict(day=ep["onset"], type=str(r.choice(["slip", "forward", "backward", "lateral"])), injury=str(inj),
                              source=s["scenario"], detail="scenario fall", silent=bool(spec.get("silent_fall"))))
        s["falls"] = falls

        # chronic cue baselines with AR(1) noise
        for cond, (cue, b) in CHRONIC_CUE_BASE.items():
            if cond in s["conditions"]:
                e = np.zeros(T)
                for i in range(1, T):
                    e[i] = 0.7 * e[i - 1] + r.normal(0, 0.07)
                cues[cue] = 1 - (1 - cues[cue]) * (1 - np.clip(b + e, 0, 1))
        if s["living"] == "alone":
            cues["loneliness"] = 1 - (1 - cues["loneliness"]) * (1 - 0.15)

        # single-day blips (normal life): bad night, low-step day
        nb = int(r.integers(4, 8)) if s["scenario"] == "SCEN_STABLE_MILD_FLUCTUATION" else int(r.integers(1, 4))
        blips = r.choice(np.arange(3, T), size=nb, replace=False)
        for d in blips:
            if r.random() < .5:
                ch["steps"][d] += -0.35
            else:
                ch["sleep"][d] += -1.6
                cues["poor_sleep"][d] = max(cues["poor_sleep"][d], 0.5)
        s["blip_days"] = [int(d) for d in blips]

        # routine weekly structure & rain for outdoor-hobby seniors
        dow = np.array([(START_DATE.weekday() + d) % 7 for d in range(T)])
        outdoor = any(HOBBIES[h][2] for h in s["hobbies"])
        rain_eff = np.where(rain[s["city"]], -0.18 if outdoor else -0.05, 0.0)
        ch["steps"] += rain_eff
        ch["steps"] += np.where(dow == 6, -0.05, 0)

        for c in CUES:
            cues[c] = np.clip(cues[c], 0, 1)
        s["lat"] = dict(prog=prog, ch=ch, cues=cues, scen_cue=scen_cue, event_f=ev_f, rain=rain[s["city"]], dow=dow)

        # ground-truth tier per day
        tier = np.zeros(T, int)  # 0 stable 1 watch 2 concern 3 urgent
        tier[(prog > 0.15) | (ev_f > 0.5)] = 1
        tier[prog >= 0.5] = 2
        if spec["esc"] == "immediate_clinical_escalation":
            tier[prog >= 0.7] = 3
        elif spec["esc"] == "care_coordinator_followup":
            tier[prog >= 0.5] = 1 + (spec["cat"] == "gradual")
        s["lat"]["tier"] = tier
    return seniors
