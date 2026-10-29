"""Cohort construction: profiles, families, coordinators, conditions, medications,
recent events and ground-truth scenario allocation."""
from __future__ import annotations
import json
import numpy as np
import pandas as pd

from config import *


def _pick(rng, seq):
    return seq[int(rng.integers(0, len(seq)))]


# --------------------------------------------------------------------------
# recent-event catalogue: peak effects at the event moment, decaying exp(-(t-t0)/tau)
RECENT_EVENTS = {
    "fever": dict(tau=1.5, eff=dict(temp=1.6, hr=8, steps=-0.4, appetite=-1.0), cues=dict(fever=0.8, weakness=0.5),
                  t0=lambda r: -1, detail=["viral fever (one day ago)", "fever with body ache (one day ago)"]),
    "surgery": dict(tau=20, eff=dict(steps=-0.55, mood=-0.3, hr=2), cues=dict(pain=0.6, weakness=0.4),
                    t0=lambda r: -int(r.integers(7, 31)),
                    detail=["knee replacement", "cataract surgery", "hernia repair", "hip fracture fixation",
                            "gallbladder removal", "pacemaker implantation"]),
    "minor_fall": dict(tau=6, eff=dict(steps=-0.45, mood=-0.3), cues=dict(fall=0.8, pain=0.5),
                       t0=lambda r: -int(r.integers(3, 11)), detail=["slipped in bathroom", "tripped on carpet", "lost balance getting out of bed"]),
    "chest_pain_scare": dict(tau=8, eff=dict(hr=3, sbp=4, steps=-0.2, mood=-0.3), cues=dict(chest_discomfort=0.5),
                             t0=lambda r: -int(r.integers(3, 10)), detail=["chest pain episode; ER visit, ECG normal"]),
    "cold_cough": dict(tau=4, eff=dict(temp=0.6, spo2=-0.5, steps=-0.25), cues=dict(weakness=0.4, breathlessness=0.2),
                       t0=lambda r: -int(r.integers(2, 7)), detail=["cold and cough"]),
    "bereavement": dict(tau=40, eff=dict(mood=-1.0, appetite=-0.6, sleep=-0.7, social=-0.3, engage=-0.4),
                        cues=dict(low_mood=0.7, loneliness=0.6, poor_sleep=0.4),
                        t0=lambda r: -int(r.integers(10, 51)), detail=["death of a close friend", "death of a sibling", "death of spouse"]),
    "hospital_discharge": dict(tau=12, eff=dict(spo2=-1.0, steps=-0.5, appetite=-0.8), cues=dict(weakness=0.6, breathlessness=0.4),
                               t0=lambda r: -int(r.integers(5, 16)), detail=["discharged after pneumonia"]),
    "minor_fall_in_window": dict(tau=5, eff=dict(steps=-0.45, mood=-0.3), cues=dict(fall=0.8, pain=0.5),
                                 t0=lambda r: int(r.integers(35, 91)), detail=["slipped in bathroom", "tripped on carpet", "lost balance on stairs"]),
}
EVENT_PROBS = [("fever", .05), ("surgery", .03), ("minor_fall", .04), ("chest_pain_scare", .02),
               ("cold_cough", .04), ("bereavement", .03), ("hospital_discharge", .02)]


def build_cohort():
    master = np.random.default_rng(MASTER_SEED)
    ids = [f"S{i+1:04d}" for i in range(N_SENIORS)]
    seniors = []
    monitored_flags = np.zeros(N_SENIORS, bool)
    monitored_flags[master.permutation(N_SENIORS)[: int(round(N_SENIORS * FRAC_VITAL_MONITORED))]] = True

    for i, sid in enumerate(ids):
        r = rng_for(sid, "profile")
        gender = "M" if r.random() < 0.5 else "F"
        first = _pick(r, MALE_FIRST if gender == "M" else FEMALE_FIRST)
        sur = _pick(r, SURNAMES)
        age = int(np.clip(r.normal(73, 6.5), 62, 90))
        marital = r.choice(["married", "widowed"], p=[0.62, 0.38] if age < 78 else [0.45, 0.55])
        living = ("alone" if r.random() < (0.42 if marital == "widowed" else 0.05) else
                  "with_spouse" if marital == "married" else "with_domestic_help_or_family")
        if marital == "married" and living == "alone":
            living = "with_spouse"
        # conditions
        conds = []
        if r.random() > P_NO_CONDITION:
            mult = 1.2 if age >= 78 else 1.0
            while not conds:
                conds = [c for c, v in CONDITIONS.items() if r.random() < min(0.95, v["p"] * mult)]
        s = dict(
            senior_id=sid, idx=i, gender=gender, first=first, surname=sur, age=age, marital=marital, living=living,
            city=_pick(r, CITIES), lang=r.choice(["hindi", "hinglish"], p=[0.6, 0.4]),
            monitored=bool(monitored_flags[i]), conditions=conds,
            talkative=float(r.beta(2.5, 2.5)), stoic=bool(r.random() < 0.25),
            wearable=bool(r.random() < 0.55), diligence=float(r.beta(5, 2)),
            wa_user=bool(r.random() < 0.85),
            hobbies=list(r.choice(list(HOBBIES), size=int(r.integers(2, 5)), replace=False)),
            chronotype=r.choice(["morning", "evening"], p=[0.7, 0.3]),
            smartphone=True,
        )
        seniors.append(s)

    # ---------------- scenario allocation
    sc_list = []
    for sc, spec in SCENARIOS.items():
        sc_list += [sc] * spec["count"]
    master.shuffle(sc_list)
    unassigned_M = [s for s in seniors if s["monitored"]]
    unassigned_N = [s for s in seniors if not s["monitored"]]
    assign = {}

    def take(pool, sc, k, prefer=None):
        hard = [c.rstrip("?") for c in SCENARIOS[sc].get("req", []) if not c.endswith("?")]
        soft = [c.rstrip("?") for c in SCENARIOS[sc].get("req", [])]
        for _ in range(k):
            if not pool:
                raise RuntimeError(f"pool exhausted for {sc}")
            pool.sort(key=lambda s: (-sum(c in s["conditions"] for c in soft), master.random()))
            s = pool.pop(0)
            assign[s["senior_id"]] = sc
            for c in hard:
                if c not in s["conditions"]:
                    s["conditions"].append(c)
            if any(c.endswith("?") for c in SCENARIOS[sc].get("req", [])):
                for c in soft:
                    if c not in s["conditions"] and master.random() < 0.5:
                        s["conditions"].append(c)

    vital_scs = [sc for sc, sp in SCENARIOS.items() if sp.get("vitals")]
    for sc in vital_scs:
        take(unassigned_M, sc, SCENARIOS[sc]["count"])
    # guarantee 15 behaviour-only planted declines among NON-monitored seniors
    beh = ["SCEN_GRADUAL_DEPRESSIVE_WITHDRAWAL"] * 5 + ["SCEN_GRADUAL_COGNITIVE_MED_CONFUSION"] * 3 + \
          ["SCEN_GRADUAL_POSTFALL_FEAR_SPIRAL"] * 3 + ["SCEN_GRADUAL_MOBILITY_DECLINE"] * 2 + ["SCEN_GRADUAL_APPETITE_WEIGHT_LOSS"] * 2
    left = {sc: SCENARIOS[sc]["count"] for sc in SCENARIOS}
    for sc in vital_scs:
        left[sc] = 0
    for sc in beh:
        take(unassigned_N, sc, 1)
        left[sc] -= 1
    rest = [sc for sc, k in left.items() for _ in range(k)]
    master.shuffle(rest)
    pool = unassigned_M + unassigned_N
    for sc in rest:
        take(pool, sc, 1)
    assert len(assign) == N_SENIORS

    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "episode")
        sc = assign[sid]
        spec = SCENARIOS[sc]
        s["scenario"] = sc
        s["category"] = spec["cat"]
        if spec.get("stoic"):
            s["stoic"] = True
        ep = dict(shape=spec["shape"], onset=None, crisis=None, end=None, ramp=0, hold=0, rec=0)
        if spec["shape"] != "none":
            if spec["shape"] == "bell":
                dur = int(r.integers(spec["dur"][0], spec["dur"][1] + 1))
                onset = int(r.integers(*spec["onset"]))
                ep.update(onset=onset, crisis=onset + dur // 2, end=onset + dur - 1, ramp=dur // 2 + 1, hold=0, rec=dur - dur // 2 - 1, dur=dur)
            else:
                onset = int(r.integers(spec["onset"][0], spec["onset"][1] + 1))
                ramp = int(r.integers(*spec["ramp"])) if spec["shape"] == "ramp" else 0
                hold = int(r.integers(spec["hold"][0], spec["hold"][1] + 1))
                rec = int(r.integers(spec["rec"][0], spec["rec"][1] + 1)) if spec["rec"][1] > 0 else 0
                crisis = onset + ramp
                if crisis > N_DAYS - 8:  # leave room to observe after the crisis
                    shift = crisis - (N_DAYS - 8)
                    onset = max(30, onset - shift)
                    crisis = onset + ramp
                end = (N_DAYS - 1) if rec == 0 else min(N_DAYS - 1, crisis + hold + rec)
                ep.update(onset=onset, crisis=crisis, end=end, ramp=ramp, hold=hold, rec=rec)
        s["episode"] = ep

    # ---------------- recent events
    for s in seniors:
        r = rng_for(s["senior_id"], "events")
        evs = []
        for name, p in EVENT_PROBS:
            if r.random() < p and not (s["category"] == "acute" and name in ("minor_fall",)):
                spec = RECENT_EVENTS[name]
                evs.append(dict(type=name, t0=spec["t0"](r), detail=_pick(r, spec["detail"])))
        s["events"] = evs
    # background in-window minor falls (frail seniors weighted)
    risk = np.array([1.0 + 1.0 * ("osteoarthritis" in s["conditions"]) + 1.0 * ("prior_stroke" in s["conditions"]) +
                     0.8 * ("osteoporosis" in s["conditions"]) + 0.04 * (s["age"] - 70) for s in seniors])
    risk = np.clip(risk, 0.2, None)
    elig = [i for i, s in enumerate(seniors) if s["category"] == "stable" or s["category"] == "intermittent"]
    pick = master.choice(elig, size=12, replace=False, p=risk[elig] / risk[elig].sum())
    for i in pick:
        r = rng_for(seniors[i]["senior_id"], "bgfall")
        spec = RECENT_EVENTS["minor_fall_in_window"]
        seniors[i]["events"].append(dict(type="minor_fall_in_window", t0=spec["t0"](r), detail=_pick(r, spec["detail"])))

    # ---------------- families
    families = []
    for s in seniors:
        r = rng_for(s["senior_id"], "family")
        rel = r.choice(["son", "daughter", "daughter_in_law", "grandchild", "nephew_niece"], p=[.44, .40, .08, .05, .03])
        if rel in ("son", "nephew_niece") and r.random() < .5 or rel == "grandchild" and r.random() < .5:
            fn = _pick(r, FAMILY_M); fg = "M"
        else:
            fn = _pick(r, FAMILY_F); fg = "F"
        if rel == "son": fn, fg = _pick(r, FAMILY_M), "M"
        if rel in ("daughter", "daughter_in_law"): fn, fg = _pick(r, FAMILY_F), "F"
        loc = _pick(r, FAMILY_LOCATIONS)
        fam = dict(family_id=f"F{s['idx']+1:04d}", senior_id=s["senior_id"], name=f"{fn[0]} {s['surname'][0]}",
                   name_hi=f"{fn[1]} {s['surname'][1]}", first=fn[0], first_hi=fn[1], gender=fg, relation=rel, location=loc,
                   abroad=loc in ("USA", "UK", "Canada", "Australia", "Dubai"),
                   lang=r.choice(["hinglish", "english", "hindi"], p=[.55, .30, .15]),
                   contact_style=r.choice(["daily", "few_per_week", "weekend_only"], p=[.25, .45, .30]),
                   anxiety=float(r.beta(2, 3)),
                   consent=r.choice(["full", "summary_and_urgent", "urgent_only"], p=[.70, .22, .08]))
        s["family"] = fam
        families.append(fam)

    # ---------------- coordinators (2 families each), grouped by city
    order = sorted(seniors, key=lambda s: (s["city"], s["senior_id"]))
    coords = []
    for k in range(N_COORDINATORS):
        r = rng_for(f"COORD{k}", "coord")
        g = "F" if r.random() < 0.68 else "M"
        nm = _pick(r, COORD_F if g == "F" else COORD_M)
        sur = _pick(r, SURNAMES)
        members = order[2 * k: 2 * k + 2]
        c = dict(coordinator_id=f"COORD_{k+1:03d}", name=f"{nm[0]} {sur[0]}", name_hi=nm[1], first=nm[0], gender=g,
                 city=members[0]["city"], years_experience=int(r.integers(1, 12)),
                 languages="Hindi, English", empathy_style="warm_slow_clear",
                 caseload_families=len(members))
        coords.append(c)
        for m in members:
            m["coordinator"] = c
    return seniors, families, coords


def assign_medications(seniors):
    sched = []
    for s in seniors:
        r = rng_for(s["senior_id"], "meds")
        meds = []
        for c in s["conditions"]:
            for k, m in enumerate(MEDS_BY_CONDITION.get(c, [])):
                if c in ("hypertension", "type2_diabetes") and k == 1 and r.random() < 0.5:
                    continue
                if c == "mild_cognitive_impairment" and r.random() < 0.3:
                    continue
                meds.append((c,) + m)
        if not s["conditions"] and r.random() < 0.4:
            meds.append(("healthy",) + HEALTHY_SUPPLEMENT)
        s["meds"] = []
        for j, (c, drug, dose, times, crit, ind) in enumerate(meds):
            start = START_DATE - pd.Timedelta(days=int(r.integers(60, 1500)))
            row = dict(medication_id=f"MED_{s['senior_id']}_{j+1:02d}", senior_id=s["senior_id"], drug_name=drug, dose=dose,
                       indication=ind, linked_condition=c, criticality=crit, times_per_day=len(times),
                       scheduled_times="|".join(times), start_date=start, end_date="", active=True,
                       prescribed_by=("treating physician"), is_sos=False)
            s["meds"].append(row)
            sched.append(row)
        if "osteoarthritis" in s["conditions"]:
            row = dict(medication_id=f"MED_{s['senior_id']}_{len(s['meds'])+1:02d}", senior_id=s["senior_id"], drug_name="Paracetamol",
                       dose="650 mg", indication="joint pain (as needed)", linked_condition="osteoarthritis", criticality="low",
                       times_per_day=0, scheduled_times="", start_date=START_DATE - pd.Timedelta(days=400), end_date="",
                       active=True, prescribed_by="treating physician", is_sos=True)
            s["meds"].append(row)
            sched.append(row)
    return sched


def true_baselines(seniors):
    """Per-senior generative priors (ground truth, stored in evaluation/, not exposed as raw input)."""
    for s in seniors:
        r = rng_for(s["senior_id"], "baseline")
        c = s["conditions"]; age = s["age"]
        sbp = r.normal(122 + 0.35 * (age - 70), 7) + (10 if "hypertension" in c else 0)
        sbp = float(np.clip(sbp, 105, 160))
        dbp = float(np.clip(74 + 0.3 * (sbp - 122) + r.normal(0, 4), 60, 95))
        hr = float(np.clip(r.normal(72, 6) + (4 if "chf" in c else 0), 56, 92))
        spo2 = float(np.clip(r.normal(93.8, 1.0), 90, 96)) if "copd_asthma" in c else float(np.clip(r.normal(96.9, .8), 94, 99))
        temp = float(r.normal(97.9, .3))
        wt = float(np.clip(r.normal(70 if s["gender"] == "M" else 60, 9), 42, 100))
        d = "type2_diabetes" in c
        glu_f = float(np.clip(r.normal(126, 20), 90, 190)) if d else float(np.clip(r.normal(96, 8), 78, 118))
        glu_pp = glu_f + (r.normal(48, 15) if d else r.normal(24, 10))
        steps = r.normal(3600, 1300) - 40 * max(0, age - 70)
        for cc, pen in (("osteoarthritis", 800), ("prior_stroke", 900), ("chf", 700), ("copd_asthma", 500)):
            if cc in c: steps -= pen
        if "morning_walk" in s["hobbies"]: steps += 800
        steps *= {"SCEN_STABLE_SEDENTARY": 0.55, "SCEN_STABLE_ACTIVE": 1.25}.get(s["scenario"], 1.0)
        steps = float(np.clip(steps, 900, 8500))
        mood = float(np.clip(r.normal(4.1, .4) - (0.9 if "depression_anxiety" in c else 0), 1.8, 5))
        adh = float(np.clip(r.beta(24, 2) - (0.06 if "mild_cognitive_impairment" in c else 0), 0.7, 0.995))
        wa = float(np.clip(r.lognormal(1.2, 0.6), 0.5, 20)) if s["wa_user"] else 0.0
        s["base"] = dict(sbp=sbp, dbp=dbp, hr=hr, spo2=spo2, temp=temp, wt=wt, glu_f=float(glu_f), glu_pp=float(glu_pp),
                         steps=steps, active_min=float(np.clip(steps / 70 + r.normal(0, 6), 12, 120)),
                         sleep=float(np.clip(r.normal(6.9, .7), 5, 8.8)), sedentary=float(np.clip(r.normal(9.5, 1.2), 6.5, 13)),
                         appetite=float(np.clip(r.normal(4.2, .35), 2.8, 5)), mood=mood, adherence=adh,
                         participation=float(np.clip(r.beta(20, 3), 0.7, 0.99)), wa=wa,
                         calls_to_family=float(np.clip(r.normal(0.6, .3), 0.1, 2)),
                         words=float(60 + s["talkative"] * 160), family_anxiety=s["family"]["anxiety"])
    return seniors


def profile_tables(seniors, families, coords):
    rows, health, conds, evrows, fam_rows = [], [], [], [], []
    slots = [(1, 4), (0, 3), (2, 5), (1, 5), (0, 4), (2, 4)]
    for s in seniors:
        r = rng_for(s["senior_id"], "ops")
        slot = slots[int(r.integers(0, len(slots)))]
        hour = int(r.choice([10, 11, 15, 16], p=[.3, .25, .25, .2]))
        s["slot_days"] = slot; s["slot_hour"] = hour
        devs = []
        if s["monitored"]:
            devs = ["bp_monitor"]
            if r.random() < .65: devs.append("pulse_oximeter")
            if r.random() < .55: devs.append("smart_scale")
            if "type2_diabetes" in s["conditions"] and r.random() < .92: devs.append("glucometer")
            if r.random() < .80: devs.append("thermometer")
        s["devices"] = devs
        s["pillbox"] = bool(r.random() < 0.3)
        rows.append(dict(
            senior_id=s["senior_id"], full_name=f"{s['first'][0]} {s['surname'][0]}",
            gender=s["gender"], age=s["age"], marital_status=s["marital"], city=s["city"], living_arrangement=s["living"],
            preferred_language=s["lang"], communication_style=("talkative" if s["talkative"] > .62 else "reserved" if s["talkative"] < .38 else "moderate"),
            uses_whatsapp=s["wa_user"], coordinator_id=s["coordinator"]["coordinator_id"], family_id=s["family"]["family_id"],
            vital_monitoring_enrolled=s["monitored"], vital_devices="|".join(devs),
            motion_sensor_source=("wearable_watch" if s["wearable"] else "phone_accelerometer"), smart_pillbox=s["pillbox"],
            checkin_days_of_week="|".join(["Mon Tue Wed Thu Fri Sat Sun".split()[d] for d in slot]), checkin_preferred_hour=hour,
            family_consent_level=s["family"]["consent"], enrollment_date=START_DATE, observation_end_date=START_DATE + pd.Timedelta(days=N_DAYS - 1)))
        falls12 = int(r.poisson(0.25 + .4 * ("osteoarthritis" in s["conditions"]) + .4 * ("prior_stroke" in s["conditions"])))
        aid = "walking_stick" if (("osteoarthritis" in s["conditions"] or "prior_stroke" in s["conditions"]) and r.random() < .6) else "none"
        if s["age"] > 82 and aid == "none" and r.random() < .3: aid = "walker"
        fr = "high" if (falls12 >= 2 or aid == "walker" or "prior_stroke" in s["conditions"]) else "moderate" if (falls12 == 1 or s["age"] > 78 or aid != "none") else "low"
        lonely = "high" if (s["living"] == "alone" and r.random() < .55) else "medium" if s["living"] == "alone" else "low"
        pc = ", ".join(c for c in s["conditions"] if CONDITIONS[c]["cat"] == "physical") or "none"
        mc = ", ".join(c for c in s["conditions"] if CONDITIONS[c]["cat"] == "mental") or "none"
        health.append(dict(
            senior_id=s["senior_id"], physical_conditions=pc, mental_health_conditions=mc, n_chronic_conditions=len(s["conditions"]),
            cognitive_status=("mci_diagnosed" if "mild_cognitive_impairment" in s["conditions"] else "normal"),
            anxiety_tendency=("high" if "depression_anxiety" in s["conditions"] and r.random() < .5 else "typical"),
            grief_status=("recent_bereavement" if any(e["type"] == "bereavement" for e in s["events"]) else "none"),
            loneliness_risk=lonely, falls_last_12_months=falls12, hospitalisations_last_12_months=int(r.poisson(.15 + .1 * len(s["conditions"]))),
            fall_risk_level=fr, mobility_aid=aid,
            equipment_tags=("|".join(t for t in ["oxygen_concentrator" if ("copd_asthma" in s["conditions"] and r.random() < .35) else "",
                                              "hospital_bed" if r.random() < .02 else "", "bathroom_grab_bars" if r.random() < .3 else ""] if t) or "none"),
            hobbies="|".join(s["hobbies"]), usual_wake_time=("05:30" if s["chronotype"] == "morning" else "07:30"),
            usual_sleep_time=("21:30" if s["chronotype"] == "morning" else "23:00"), usual_activity_summary=", ".join(HOBBIES[h][0] for h in s["hobbies"]),
            allergies=r.choice(["none", "none", "none", "penicillin", "sulfa"])))
        s["fall_risk"] = fr
        for c in s["conditions"]:
            conds.append(dict(senior_id=s["senior_id"], condition=c, category=CONDITIONS[c]["cat"],
                              diagnosed_year=int(2026 - r.integers(1, 15)), status="controlled" if r.random() < .7 else "partially_controlled",
                              source="synthetic"))
        for e in s["events"]:
            t0 = e["t0"]
            evrows.append(dict(senior_id=s["senior_id"], event_type=e["type"].replace("_in_window", ""), event_date=START_DATE + pd.Timedelta(days=t0),
                               day_offset_from_enrollment=t0, detail=e["detail"],
                               status=("occurred_before_enrollment" if t0 < 0 else "occurred_during_observation")))
    for f in families:
        fam_rows.append(dict(family_id=f["family_id"], senior_id=f["senior_id"], name=f["name"], relation=f["relation"],
                             gender=f["gender"], location=f["location"], lives_abroad=f["abroad"], preferred_language=f["lang"],
                             contact_style=f["contact_style"], data_sharing_consent=f["consent"]))
    coord_rows = [dict(coordinator_id=c["coordinator_id"], name=c["name"], gender=c["gender"], city=c["city"],
                       years_experience=c["years_experience"], languages=c["languages"], caseload_families=c["caseload_families"])
                  for c in coords]
    return (pd.DataFrame(rows), pd.DataFrame(health), pd.DataFrame(conds), pd.DataFrame(evrows),
            pd.DataFrame(fam_rows), pd.DataFrame(coord_rows))
