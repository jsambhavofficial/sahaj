"""Family inputs (Hinglish & English), warm objective-first family replies, and objective counselor notes.

All generated text is strictly in Roman script (English and Hinglish/Roman-Hindi).
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
from datetime import timedelta

from config import *
from lexicon import *
from text_gen import date_of, hon, senior_rel, URGENT_STRONG

T = N_DAYS


def _warm_family_reply(s, d, fam, cat, cue_main, fl, miss7, crit7, lang):
    """Warm, objective-state-first reply to family member (English and Roman-Hindi/Hinglish).
    Rule: State objective facts first, then provide calm context & non-overstepping next steps, never hide truth.
    """
    fname = fam["first"]
    H = hon(s)
    sname = f"{s['first'][0]} ji"
    consent = fam["consent"]

    # Determine objective state summary from observed signals
    facts_en, facts_hi = [], []
    if fl:
        if "bp_high" in fl:
            sbp_est = int(s["base"]["sbp"] + s["lat"]["ch"]["sbp"][d])
            dbp_est = int(s["base"]["dbp"] + s["lat"]["ch"]["dbp"][d])
            facts_en.append(f"the recent blood pressure reading was elevated at {sbp_est}/{dbp_est} mmHg (usual baseline ~{int(s['base']['sbp'])}/{int(s['base']['dbp'])})")
            facts_hi.append(f"haal ki BP reading {sbp_est}/{dbp_est} mmHg aayi hai (uninka normal baseline ~{int(s['base']['sbp'])}/{int(s['base']['dbp'])} rehta hai)")
        if "bp_low" in fl or "bp_low_standing" in fl:
            sbp_est = int(s["base"]["sbp"] + s["lat"]["ch"]["sbp"][d])
            facts_en.append(f"a lower-than-usual systolic BP reading of {sbp_est} mmHg was logged")
            facts_hi.append(f"BP reading normal se thodi kam ({sbp_est} mmHg) darj hui hai")
        if "spo2_low" in fl:
            sp = int(s["base"]["spo2"] + s["lat"]["ch"]["spo2"][d])
            facts_en.append(f"oxygen saturation dipped to {sp}% (baseline ~{int(s['base']['spo2'])}%)")
            facts_hi.append(f"oxygen reading {sp}% aayi hai (normal ~{int(s['base']['spo2'])}%)")
        if "weight_up" in fl:
            facts_en.append("body weight has increased by ~2 kg over the past week")
            facts_hi.append("pichle ek hafte mein wazan lagbhag 2 kg badha hai")
        if "weight_down" in fl:
            facts_en.append("body weight has dropped by ~2.5 kg compared to baseline")
            facts_hi.append("wazan baseline se lagbhag 2.5 kg kam hua hai")
        if "temp_high" in fl:
            facts_en.append("a mild fever (~99.8-100.4 F) was recorded")
            facts_hi.append("halka bukhaar (~99.8-100.4 F) record hua hai")
        if "glu_high" in fl or "glu_low" in fl:
            facts_en.append("blood glucose readings showed a noticeable fluctuation from baseline")
            facts_hi.append("blood sugar reading mein baseline se badlaav dekha gaya hai")

    if cue_main:
        facts_en.append(f"{sname} also mentioned {CUE_EN[cue_main]}")
        facts_hi.append(f"{sname} ne {CUE_HI[cue_main]} ke baare mein bhi bataya")

    if crit7 >= 1 or miss7 >= 2:
        facts_en.append(f"{int(miss7)} scheduled medicine doses were missed over the last 7 days")
        facts_hi.append(f"pichle 7 dinon mein {int(miss7)} baar dawai ki dose chhooti hai")

    tier = int(s["lat"]["tier"][d])
    urgent = tier >= 3 or (cue_main in URGENT_STRONG and s["lat"]["cues"][cue_main][d] >= 0.65)

    if consent == "urgent_only" and not urgent and cat not in ("logistics_request", "coordinator_feedback"):
        en = (f"Hi {fname}, thank you for checking in on {sname}. Per {sname}'s sharing preferences, "
              f"routine details are kept private, and there are no urgent safety alerts right now. "
              f"We would notify you immediately if anything urgent arises.")
        hi = (f"Namaste {fname} ji, {sname} ke baare mein poochhne ke liye shukriya. Unki privacy preference ke anusaar "
              f"routine baatein private rakhi gayi hain, aur abhi koi emergency ya gambhir khatra nahi hai. "
              f"Koi bhi zaroori baat hone par hum turant aapko batayenge.")
        return en, hi, "continue_routine_monitoring"

    if cat == "coordinator_feedback":
        en = (f"Hi {fname}, thank you for sharing this feedback honestly. Objective update: we have noted {sname}'s "
              f"preference regarding call pace and timing, updated the coordinator instructions to speak slowly in simple Hindi "
              f"at the preferred hour, and will verify comfort on the next call.")
        hi = (f"Namaste {fname} ji, ye feedback dene ke liye dhanyavaad. Humne {sname} ki baat note kar li hai — "
              f"ab coordinator unke pasandida samay par hi call karenge aur bilkul aaram se, dheere-dheere baat karenge.")
        return en, hi, "adjust_coordinator_call_style_and_timing"

    if cat == "logistics_request":
        en = (f"Hi {fname}, noted! Objective status: {sname} is stable at home today. We have logged the appointment/lab request "
              f"and our coordinator will arrange the cab/visit and confirm with {sname} a day prior.")
        hi = (f"Namaste {fname} ji, bilkul note kar liya hai! Aaj {sname} ghar par theek hain. Humne doctor visit/test ka "
              f"intezaam schedule mein daal diya hai aur ek din pehle {sname} ko yaad dila denge.")
        return en, hi, "coordinate_logistics_and_confirm"

    if facts_en:
        obj_en = "; ".join(facts_en)
        obj_hi = "; ".join(facts_hi)
        if urgent:
            en = (f"Hi {fname}, sharing an important update on {sname}. Objective status today: {obj_en}. "
                  f"Right now {sname} is resting comfortably at home and our Care Coordinator has spoken with them directly. "
                  f"To be safe and not overstep, we have not altered any medication doses — we recommend a same-day clinician review "
                  f"and can coordinate the doctor consultation or home visit immediately.")
            hi = (f"Namaste {fname} ji, {sname} ke baare mein ek zaroori update dena tha. Aaj ki objective sthiti: {obj_hi}. "
                  f"Ghabraiye mat, abhi {sname} ghar par aaram se hain aur hamare coordinator ne unse baat ki hai. "
                  f"Bina doctor ki salaah ke humne kisi dawai mein badlaav nahi kiya hai — hum aaj hi doctor se dikhane ki salaah dete hain "
                  f"aur usmein poori madad karenge.")
            act = "same_day_clinician_review_and_family_coordination"
        else:
            en = (f"Hi {fname}, sharing a calm update on {sname}. Objective observation: {obj_en}. "
                  f"Otherwise {sname} is comfortable at home and conversing normally. We are keeping a close watch, "
                  f"encouraging gentle hydration/rest and regular medicine timing, and will follow up on the next check-in call "
                  f"(or help schedule a routine doctor visit if this persists).")
            hi = (f"Namaste {fname} ji, {sname} ka haal-chaal share kar rahe hain. Aaj ki jankari: {obj_hi}. "
                  f"Baaki {sname} ghar par aaram se hain aur baat-cheet theek se hui. Hum is par dhyan rakh rahe hain, "
                  f"samay par dawai aur aaram ke liye keh diya hai, aur agle call mein dobara check karenge.")
            act = "coordinator_followup_and_monitor_trend"
    else:
        en = (f"Hi {fname}, happy to share a reassuring update on {sname}. Objective status: vitals and daily routine are "
              f"within {sname}'s personal baseline, and medication adherence is on track. {sname} sounded comfortable on our recent check-in.")
        hi = (f"Namaste {fname} ji, {sname} ke baare mein achhi khabar hai. Unki readings aur roz ki dincharya unke normal baseline "
              f"ke andar hain, aur dawaiyaan bhi samay par chal rahi hain. Haal ke check-in call par unse achhi baat hui.")
        act = "continue_routine_monitoring"
    return en, hi, act


def build_family_interactions(seniors, flags, roll):
    rows = []
    fam_concern_days = {s["senior_id"]: set() for s in seniors}
    fid = 0
    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "fam_int")
        fam = s["family"]
        lat = s["lat"]; ch = lat["ch"]; cues = lat["cues"]
        rel_h = senior_rel(s, "hinglish")
        rel_e = senior_rel(s, "english")
        lang = fam["lang"]  # hinglish, english, hindi (in roman)
        base_prob = {"daily": 0.14, "few_per_week": 0.09, "weekend_only": 0.06}[fam["contact_style"]]

        for d in range(T):
            tier = int(lat["tier"][d])
            p = base_prob + (0.12 if tier >= 2 else 0.04 if tier == 1 else 0.0) + 0.04 * fam["anxiety"]
            if r.random() > p:
                continue
            fid += 1
            fl = flags[sid][d]
            rr = roll[sid]
            miss7, crit7 = rr["missed7"][d], rr["crit7"][d]

            # Pick category and message based on senior's state
            active_cues = [(cues[c][d], c) for c in CUES if cues[c][d] >= 0.45]
            cue_main = ""
            use_en = (lang == "english") or (lang == "hinglish" and r.random() < 0.25)

            if active_cues and r.random() < 0.65:
                _, cue_main = max(active_cues)
                cat = "health_or_wellbeing_observation"
                bank = CB[cue_main]["fam_e" if use_en else "fam_h"]
                msg = str(r.choice(bank)).replace("{rel}", rel_e if use_en else rel_h)
                fam_concern_days[sid].add(d)
            elif (crit7 >= 1 or miss7 >= 2) and r.random() < 0.55:
                cat = "medication_concern"
                cue_main = "medication_issue"
                msg = str(r.choice(FAM_MED_E if use_en else FAM_MED_H)).replace("{rel}", rel_e if use_en else rel_h)
                fam_concern_days[sid].add(d)
            else:
                pick = r.random()
                if pick < 0.22:
                    cat = "question_for_coordinator"
                    msg = str(r.choice(FAM_Q_E if use_en else FAM_Q_H)).replace("{rel}", rel_e if use_en else rel_h)
                elif pick < 0.36:
                    cat = "logistics_request"
                    msg = str(r.choice(FAM_LOG_E if use_en else FAM_LOG_H)).replace("{rel}", rel_e if use_en else rel_h)
                elif pick < 0.46:
                    cat = "coordinator_feedback"
                    msg = str(r.choice(FAM_COMPLAINT_E if use_en else FAM_COMPLAINT_H)).replace("{rel}", rel_e if use_en else rel_h)
                elif pick < 0.56 and fam["anxiety"] > 0.45:
                    cat = "anxious_check"
                    msg = str(r.choice(FAM_ANX_E if use_en else FAM_ANX_H)).replace("{rel}", rel_e if use_en else rel_h)
                    fam_concern_days[sid].add(d)
                elif pick < 0.63:
                    cat = "privacy_or_handling_note"
                    msg = str(r.choice(FAM_WITHHOLD_E if use_en else FAM_WITHHOLD_H)).replace("{rel}", rel_e if use_en else rel_h)
                elif pick < 0.78:
                    cat = "status_update_request"
                    msg = str(r.choice(FAM_UPDATE_E if use_en else FAM_UPDATE_H)).replace("{rel}", rel_e if use_en else rel_h)
                elif pick < 0.90:
                    cat = "positive_observation"
                    msg = str(r.choice(FAM_GENERIC_POS_E if use_en else FAM_GENERIC_POS_H)).replace("{rel}", rel_e if use_en else rel_h)
                else:
                    cat = "appreciation"
                    msg = str(r.choice(FAM_THANKS_E if use_en else FAM_THANKS_H)).replace("{rel}", rel_e if use_en else rel_h)

            reply_en, reply_hi, action = _warm_family_reply(s, d, fam, cat, cue_main, fl, miss7, crit7, lang)
            hour = int(r.integers(8, 22)); mn = int(r.integers(0, 60))
            ts = f"{date_of(d)} {hour:02d}:{mn:02d}:00"
            channel = str(r.choice(["whatsapp_message", "phone_call", "app_message"], p=[0.60, 0.25, 0.15]))
            counselor_note = (f"Family input ({fam['relation']}, {fam['location']}) via {channel} on {date_of(d)}: category={cat}"
                              + (f", reported_cue={cue_main}" if cue_main else "")
                              + (f", active_vital_flags={','.join(sorted(fl))}" if fl else "")
                              + f", missed_doses_7d={int(miss7)} (critical={int(crit7)}). "
                              + f"Recommended evidence-based action: {action} (non-clinical; no medication dose change).")

            rows.append(dict(
                interaction_id=f"FAM_{fid:05d}", senior_id=sid, family_id=fam["family_id"],
                coordinator_id=s["coordinator"]["coordinator_id"], timestamp=ts, day_index=d,
                channel=channel, observer_relation=fam["relation"], message_language="english" if use_en else "hinglish",
                category=cat, primary_cue=cue_main, family_message=msg,
                coordinator_warm_reply_en=reply_en, coordinator_warm_reply_hi_roman=reply_hi,
                objective_counselor_summary=counselor_note, suggested_action=action,
                escalation_needed=bool(tier >= 2 or cue_main in URGENT_STRONG),
                consent_level=fam["consent"]
            ))
    return pd.DataFrame(rows), fam_concern_days
