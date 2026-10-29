"""Check-in call plans + multi-turn transcripts + objective coordinator notes + senior voice notes.

All dialogue is Roman-script Hindi/Hinglish (no Devanagari). Pipeline per call:
 1. choose OBJECTIVE from observed context  ->  2. list POINTS to communicate  ->  3. choose QUESTIONS
 (each with provenance)  ->  4. compose dialogue (slow, simple, warm, 'aap')  ->  5. tone checks.
Senior replies are sampled from the hidden latent state, personality (stoic / talkative) and recent events.
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import *
from lexicon import *
from cohort import RECENT_EVENTS

T = N_DAYS
URGENT_STRONG = {"chest_discomfort", "fall", "breathlessness", "dizziness", "confusion", "fever", "headache"}
FAM_REL_HI = {"son": "bete", "daughter": "beti", "daughter_in_law": "bahu", "grandchild": "pote-poti", "nephew_niece": "bhatije-bhatiji"}
HINGLISH_SWAP = {"dawai": "medicine", "dawaiyaan": "medicines", "sair": "walk", "bukhaar": "fever", "kamzori": "weakness",
                 "neend": "sleep", "bhookh": "appetite", "dard": "pain", "chakkar": "dizziness"}

TONE_CHECK = dict(language="Hindi in Roman script (Hinglish), no jargon", pace="slow, one idea per sentence", complexity="simple words, short sentences",
                  register="respectful 'aap', warm, unhurried", avoid="medical jargon, panic words, dose advice, diagnosis")


def date_of(d):
    return (START_DATE + timedelta(days=int(d))).isoformat()


def hon(s):
    return f"{s['surname'][0]} ji"


def rel_label(fam, lang="hinglish"):
    r = fam["relation"]
    if lang == "english":
        return {"son": "Dad", "daughter": "Dad"}.get(r, "Dad")  # overwritten per gender below
    return r


def senior_rel(s, lang="hinglish"):
    """How the family refers to the senior in messages."""
    r = s["family"]["relation"]; g = s["gender"]
    if lang == "english":
        return {"son": "Dad" if g == "M" else "Mom", "daughter": "Dad" if g == "M" else "Mom",
                "daughter_in_law": "Papa ji" if g == "M" else "Mummy ji", "grandchild": "Grandpa" if g == "M" else "Grandma",
                "nephew_niece": "Uncle" if g == "M" else "Aunty"}[r]
    return {"son": "Papa" if g == "M" else "Mummy", "daughter": "Papa" if g == "M" else "Mummy",
            "daughter_in_law": "Papa ji" if g == "M" else "Mummy ji", "grandchild": "Dada ji" if g == "M" else "Dadi ji",
            "nephew_niece": "Chacha ji" if g == "M" else "Chachi ji"}[r]


def med_arrays(med_daily_df):
    out = {}
    for sid, g in med_daily_df.groupby("senior_id"):
        miss = np.zeros(T); unk = np.zeros(T)
        for d_, m, u in zip(pd.to_datetime(g.date), g.missed_doses, g.unknown_doses):
            i = (d_ - pd.Timestamp(START_DATE)).days
            miss[i] = m; unk[i] = u
        out[sid] = dict(miss=miss, unk=unk)
    return out


def mention_level(cue, x, s, r, spontaneous=False):
    stoic = s["stoic"]
    if cue == "fall" and any(f.get("silent") for f in s["falls"]):
        x = x * 0.08
    if x >= 0.2:
        p = x * (0.5 if stoic else 1.0) * (0.55 if spontaneous else 1.0)
        if cue in ("low_mood", "loneliness", "confusion") and stoic:
            p *= 0.7
    else:
        p = 0.0 if spontaneous else 0.02
    if r.random() < p:
        return "strong" if x >= 0.55 else "mild"
    if not spontaneous and 0.12 <= x < 0.4 and CB[cue]["hist"] and r.random() < 0.3:
        return "hist"
    return None


def hinglishify(text, r, p=0.45):
    out = []
    for w in text.split(" "):
        core = w.strip(".,?!").lower()
        if core in HINGLISH_SWAP and r.random() < p:
            tail = w[len(w.rstrip(".,?!")):]
            out.append(HINGLISH_SWAP[core] + tail)
        else:
            out.append(w)
    return " ".join(out)


def build_calls(seniors, flags, roll, medarr, fam_concern):
    plans, calls, mem_all = [], [], {}
    cid = 0
    for s in seniors:
        sid = s["senior_id"]
        r = rng_for(sid, "calls")
        lat = s["lat"]; ch = lat["ch"]; cues = lat["cues"]
        cg, sg = s["coordinator"]["gender"], s["gender"]
        cname = s["coordinator"]["first"]
        fam = s["family"]
        child = "beta" if fam["relation"] == "son" else "beti" if fam["relation"] in ("daughter", "daughter_in_law") else "bachcha"
        addr = "beti" if cg == "F" else "beta"
        H = hon(s)
        mem = dict(cues=[], asked=set(), last_date=None)
        call_idx = 0
        slot_days = s["slot_days"]
        part = np.clip(s["base"]["participation"] + ch["participation"], 0.2, 1)
        spec = SCENARIOS[s["scenario"]]
        for w in range(N_DAYS // 7):
            for wd in slot_days:
                d = w * 7 + wd
                if d >= T:
                    continue
                cid += 1
                call_id = f"CALL_{cid:05d}"
                hour = s["slot_hour"]; minute = int(r.integers(0, 55))
                ts = f"{date_of(d)} {hour:02d}:{minute:02d}:00"
                u = r.random()
                answered = u < min(0.97, part[d] * 0.97 + 0.02)
                if not answered:
                    calls.append(dict(call_id=call_id, senior_id=sid, coordinator_id=s["coordinator"]["coordinator_id"], call_datetime=ts,
                                      day_index=d, call_status="no_answer", duration_sec=0, objective="", transcript="", senior_word_count=0,
                                      senior_turns=0, senior_terse_reply_ratio=np.nan, complaint_flag=False, senior_query_flag=False,
                                      extracted_cues_json="[]", medication_report="", medication_report_mismatch=False,
                                      hobby_engagement="not_asked", sentiment="", urgency_flag=False,
                                      objective_note_en=f"Call {date_of(d)} {hour:02d}:{minute:02d}: no answer after 3 rings; retry scheduled next day. "
                                                        f"Consecutive unanswered scheduled calls tracked for engagement trend.",
                                      transcript_status="none", language_style=s["lang"]))
                    continue
                brief = r.random() < 0.12
                call_idx += 1
                # --------------------------------------------------- observed context
                fl = flags[sid][d]
                rr = roll[sid]
                eng = rr["engage_ratio7"][d]; stp = rr["steps_ratio7"][d]
                miss7, crit7, unk7 = rr["missed7"][d], rr["crit7"][d], rr["unk7"][d]
                recent_miss = medarr.get(sid, dict(miss=np.zeros(T)))["miss"][max(0, d - 1):d + 1].sum() if sid in medarr else 0
                recent_unk = medarr.get(sid, dict(unk=np.zeros(T)))["unk"][max(0, d - 1):d + 1].sum() if sid in medarr else 0
                has_meds = any(not m["is_sos"] for m in s["meds"])
                # events still active
                live_events = []
                for ei, ev in enumerate(s["events"]):
                    tau = RECENT_EVENTS[ev["type"]]["tau"]
                    if ev["t0"] <= d and np.exp(-(d - ev["t0"]) / tau) > 0.25 and (d - ev["t0"]) <= 30:
                        live_events.append((ei, ev))
                # falls within last 5 days
                recent_fall = any(0 <= d - f["day"] <= 5 for f in s["falls"] if f["day"] >= -3)
                # --------------------------------------------------- 1. objective
                mem_strong = [c for c in mem["cues"] if c[2] == "strong"]
                if mem_strong or recent_fall:
                    objective = "follow_up_acute"
                elif live_events:
                    objective = "post_event_followup"
                elif has_meds and (crit7 >= 2 or miss7 >= 3):
                    objective = "medication_verification"
                elif fl:
                    objective = "vitals_followup"
                elif eng < 0.5 and not np.isnan(eng):
                    objective = "engagement_checkin"
                elif fam_concern.get(sid, set()) & set(range(d - 4, d + 1)) and fam["consent"] == "full":
                    objective = "address_family_concern"
                else:
                    objective = "routine_wellbeing"
                # --------------------------------------------------- 3. questions with provenance
                qs, used = [], set()
                max_q = 2 if brief else 5

                def addq(domain, kind, topic, why):
                    key = (kind, topic if not isinstance(topic, dict) else topic["i"])
                    if key in used or len(qs) >= max_q:
                        return
                    used.add(key); qs.append(dict(domain=domain, kind=kind, topic=topic, why=why))

                if mem_strong:
                    for (dd, cue, sev) in mem_strong[:2]:
                        addq("physical_discomfort", "cue", cue, f"Follow-up: {CUE_EN[cue]} reported ({sev}) on {date_of(dd)}")
                if recent_fall and "fall" not in [q["topic"] for q in qs]:
                    addq("physical_discomfort", "cue", "fall", "Fall in last 5 days (sensor / report) - ask about injury & fear of walking")
                for ei, ev in live_events[:1]:
                    addq("post_event_followup", "event", dict(i=ei, ev=ev), f"Recent event: {ev['detail']} on {date_of(ev['t0'])}")
                if fl:
                    M = {"bp_high": ["headache", "dizziness"], "bp_low": ["dizziness", "weakness"], "bp_low_standing": ["dizziness"],
                         "hr_high": ["chest_discomfort", "weakness"], "spo2_low": ["breathlessness"], "weight_up": ["swelling", "breathlessness"],
                         "weight_down": ["low_appetite"], "temp_high": ["fever", "weakness"], "glu_high": ["urinary", "weakness"],
                         "glu_low": ["weakness", "dizziness"]}
                    for f in sorted(fl):
                        for cue in M.get(f, [])[:2]:
                            addq("vitals_followup", "cue", cue, f"Device reading flag '{f}' in last 2 days (asking about symptoms; no interpretation shared)")
                if has_meds:
                    why = (f"Adherence check: {int(miss7)} missed / {int(unk7)} unverified doses in last 7 days" if (miss7 or unk7)
                           else "Routine adherence check")
                    qs.insert(0, dict(domain="routine_meds", kind="med", topic="meds", why=why)) if len(qs) < max_q or True else None
                    qs = qs[:max_q]
                    used.add(("med", "meds"))
                if has_meds and crit7 >= 2:
                    addq("routine_meds", "cue", "medication_issue", f"{int(crit7)} critical-medicine doses missed in last 7 days")
                if (not np.isnan(eng)) and eng < 0.55:
                    hb = str(r.choice(s["hobbies"]))
                    addq("engagement_hobbies", "hobby", hb, f"Engagement at {int(max(0, eng) * 100)}% of own baseline (hobby/WhatsApp)")
                    addq("mood_wellbeing", "cue", "low_mood", "Engagement drop from own baseline - screening mood")
                    addq("mood_wellbeing", "cue", "loneliness", "Engagement drop from own baseline - screening loneliness")
                # chronic-condition driven rotation
                chron = []
                if "osteoarthritis" in s["conditions"]: chron.append(("pain", "Baseline condition: osteoarthritis"))
                if "copd_asthma" in s["conditions"] or "chf" in s["conditions"]: chron.append(("breathlessness", "Baseline condition: respiratory/cardiac"))
                if "mild_cognitive_impairment" in s["conditions"]: chron.append(("confusion", "Baseline condition: mild cognitive impairment"))
                if "depression_anxiety" in s["conditions"]: chron.append(("low_mood", "Baseline condition: depression/anxiety"))
                if "chf" in s["conditions"]: chron.append(("swelling", "Baseline condition: heart failure (fluid)"))
                if chron:
                    cue, why = chron[call_idx % len(chron)]
                    addq("physical_discomfort" if cue not in ("low_mood", "confusion") else "mood_wellbeing", "cue", cue, why)
                pool = ["pain", "weakness", "poor_sleep", "low_appetite"]
                addq("physical_discomfort", "cue", pool[call_idx % 4], "Routine rotating physical check")
                addq("mood_wellbeing", "cue", ["low_mood", "loneliness"][call_idx % 2] if s["living"] != "alone" else "loneliness",
                     "Routine mood / loneliness screening" + (" (lives alone)" if s["living"] == "alone" else ""))
                if call_idx % (4 if (s["fall_risk"] == "high" or s["age"] > 78) else 6) == 0:
                    addq("physical_discomfort", "cue", "fall", f"Periodic fall screening (fall-risk {s['fall_risk']})")
                if "hypertension" in s["conditions"] and call_idx % 5 == 0:
                    addq("physical_discomfort", "cue", "dizziness", "Periodic dizziness screening (hypertension on medicines)")
                addq("engagement_hobbies", "hobby", s["hobbies"][call_idx % len(s["hobbies"])], "Routine hobby / engagement check")
                if call_idx % 3 == 0:
                    addq("caregiver_notes", "family", "family", "Periodic family-contact check")
                # --------------------------------------------------- 2. points to communicate
                points = ["Greet warmly, introduce self, ask permission to talk", f"State call objective: {objective}"]
                if has_meds:
                    points.append("Remind to take medicines on time (no dose advice; doctor decides any change)")
                if any(q["kind"] == "hobby" for q in qs):
                    points.append("Encourage usual hobbies / social contact")
                points.append("Reassure: Samarth is available; confirm next call day")
                if objective in ("follow_up_acute", "vitals_followup"):
                    points.append("If symptoms worsen: doctor / 112; coordinator informs family with consent")
                # --------------------------------------------------- 4. dialogue
                turns = []
                terse_p = float(np.clip(0.50 - 0.55 * s["talkative"] - 0.8 * ch["words"][d] + (0.25 if (s["base"]["mood"] + ch["mood"][d]) < 3.2 else 0), 0.03, 0.9))
                if brief: terse_p = max(terse_p, 0.6)

                def C(t, **kw):
                    turns.append(("COORDINATOR", fmt(t, cg, hon=H, cname=cname, **kw)))

                def S(t, **kw):
                    x = fmt(t, sg, addr=addr, child=child, **kw)
                    if s["lang"] == "hinglish":
                        x = hinglishify(x, r)
                    turns.append(("SENIOR", x))

                def terse_or(txt):
                    if r.random() < terse_p:
                        S(str(r.choice(TERSE)))
                        return True
                    S(txt); return False

                C(str(r.choice(GREET_OPEN)))
                S(str(r.choice(GREET_REPLY_TERSE if r.random() < terse_p else GREET_REPLY)))
                obj_txt = OBJ_OPEN[objective]
                issue = CUE_HI[mem_strong[0][1]] if mem_strong else (CUE_HI["fall"] if recent_fall else "tabiyat")
                C(obj_txt, issue=issue, fam_rel=FAM_REL_HI[fam["relation"]])
                if s["talkative"] > 0.55 and r.random() < 0.45 and not brief:
                    S(str(r.choice(SMALLTALK))); C(str(r.choice(SMALLTALK_ACK)))
                ext = []   # extracted cues
                n_terse = 0; n_ans = 0
                med_report = ""; mismatch = False; hob_eng = "not_asked"
                asked_topics = set()
                # spontaneous strong mention of unasked cues
                asked_cues = {q["topic"] for q in qs if q["kind"] == "cue"}
                if not brief:
                    for cue in CUES:
                        x = cues[cue][d]
                        if cue not in asked_cues and x >= 0.6 and not s["stoic"] and s["talkative"] > 0.4:
                            lv = mention_level(cue, x, s, r, spontaneous=True)
                            if lv == "strong":
                                S("Waise beta, " + str(r.choice(CB[cue]["pos_s"])))
                                C(str(r.choice(CB[cue]["ack_s"])))
                                ext.append(dict(cue=cue, value="present", severity="strong", negation=False, temporal="current", source="spontaneous"))
                                asked_cues.add(cue)
                                break
                for q in qs:
                    k = q["kind"]
                    if k == "med":
                        C(str(r.choice(MED_Q)))
                        state = "missed" if recent_miss > 0 else ("unknown" if recent_unk > 0 else "taken")
                        if state == "missed" and cues["confusion"][d] > 0.5 and r.random() < 0.4:
                            state_say, mismatch = "taken", True
                        else:
                            state_say = state
                        n_ans += 1
                        if state_say == "taken": 
                            terse_or(str(r.choice(MED_TAKEN))); C(str(r.choice(MED_ACK_OK)))
                        elif state_say == "missed":
                            S(str(r.choice(MED_MISSED))); C(str(r.choice(MED_ACK_MISS)))
                        else:
                            S(str(r.choice(MED_UNSURE))); C(str(r.choice(MED_ACK_MISS)))
                        med_report = f"senior_said_{state_say}|logged_{state}"
                    elif k == "cue":
                        cue = q["topic"]; x = cues[cue][d]
                        C(str(r.choice(CB[cue]["q"])))
                        n_ans += 1
                        lv = mention_level(cue, x, s, r)
                        if lv in ("mild", "strong"):
                            bank = CB[cue]["pos_s" if lv == "strong" else "pos_m"]
                            if lv == "mild" and r.random() < terse_p:
                                S("Haan, thoda."); n_terse += 1
                            else:
                                S(str(r.choice(bank)))
                            C(str(r.choice(CB[cue]["ack_s" if lv == "strong" else "ack_m"])))
                            ext.append(dict(cue=cue, value="present", severity=lv, negation=False, temporal="current", source="asked"))
                        elif lv == "hist":
                            S(str(r.choice(CB[cue]["hist"]))); C(str(r.choice(SMALLTALK_ACK)))
                            ext.append(dict(cue=cue, value="present", severity="mild", negation=False, temporal="historical", source="asked"))
                        else:
                            if r.random() < terse_p:
                                S("Nahi, theek hai."); n_terse += 1
                            else:
                                S(str(r.choice(CB[cue]["neg"])))
                            C(str(r.choice(OK_ACK)))
                            ext.append(dict(cue=cue, value="absent", severity="none", negation=True, temporal="current", source="asked"))
                    elif k == "hobby":
                        hq = HOBBY_BANK[q["topic"]]
                        C(hq[0]); n_ans += 1
                        engaged = ch["engage"][d] > -0.35 and lat["tier"][d] < 3
                        if engaged:
                            terse_or(hq[1]); hob_eng = "engaged"
                        else:
                            S(hq[2]); hob_eng = "withdrawn"; C("Achha ji. Kabhi mann ho toh zaroor jaiyega, aapko achha lagega.")
                    elif k == "event":
                        ev = q["topic"]["ev"]
                        eq = EVENT_Q[ev["type"]]
                        C(eq[0]); n_ans += 1
                        f_now = np.exp(-(d - ev["t0"]) / RECENT_EVENTS[ev["type"]]["tau"])
                        if f_now < 0.45:
                            S(eq[1]); C(str(r.choice(SMALLTALK_ACK)))
                            temporal = "historical"
                        else:
                            S(eq[2]); C("Samajh sakta{|i} hoon ji. Aap aaram se rahiye, main dhyan rakhoonga{|i}.".replace("{|i}", "") if cg == "M" else "Samajh sakti hoon ji. Aap aaram se rahiye, main dhyan rakhoongi.")
                            temporal = "current"
                        main = list(RECENT_EVENTS[ev["type"]]["cues"])[0]
                        ext.append(dict(cue=main, value="present", severity="mild", negation=False, temporal=temporal, source="event_followup"))
                    elif k == "family":
                        C(f"Aapke {FAM_REL_HI[fam['relation']]} se aajkal baat hoti rehti hai? Woh kaise hain?"); n_ans += 1
                        if ch["social"][d] > -0.3:
                            terse_or("Haan beta, kal phone aaya tha, bahut der baat hui."); C("Ye toh bahut achhi baat hai ji.")
                        else:
                            S("Kai din se phone nahi aaya, wo log vyast rehte hain."); C("Main unhe aapki yaad dila doonga{|i}." if False else fmt("Main unhe aapki yaad dila {doonga|doongi}. Aap fikar mat kijiye.", cg))
                            ext.append(dict(cue="loneliness", value="present", severity="mild", negation=False, temporal="current", source="family_contact"))
                complaint = query = False
                if r.random() < 0.06 and not brief:
                    a, b = SENIOR_COMPLAINTS[int(r.integers(0, len(SENIOR_COMPLAINTS)))]
                    S(a); C(b); complaint = True
                elif r.random() < 0.12 and not brief:
                    a, b = SENIOR_QUERIES[int(r.integers(0, len(SENIOR_QUERIES)))]
                    S(a); C(b); query = True
                # recap
                recap = []
                if has_meds: recap.append("dawaiyaan samay par lena")
                if any(e["value"] == "present" and e["temporal"] == "current" for e in ext): recap.append("aaram karna aur tabiyat par nazar rakhna")
                if any(e["severity"] == "strong" for e in ext): recap.append(f"main aapke {FAM_REL_HI[fam['relation']]} ko bata dunga{'' if cg=='M' else ''}".replace("dunga", "dunga" if cg == "M" else "dungi"))
                if not recap: recap.append("sab theek chal raha hai")
                nxt_day = next((x for x in sorted(slot_days) if x > d % 7), sorted(slot_days)[0])
                C(str(r.choice(CLOSE_OPEN)), recap=", ".join(recap), nxt=f"{DAYS_HI[nxt_day]} ko")
                S(str(r.choice(CLOSE_REPLY)))
                # --------------------------------------------------- 5. outputs
                sen_lines = [t for sp, t in turns if sp == "SENIOR"]
                words = int(sum(len(t.split()) for t in sen_lines))
                tot_words = sum(len(t.split()) for _, t in turns)
                dur = int(tot_words / 1.9 + 5 * len(turns) + r.normal(0, 8))
                n_terse_all = sum(1 for t in sen_lines if t.rstrip(".") in [x.rstrip(".") for x in TERSE + ["Haan, thoda", "Nahi, theek hai", "Haan, theek hain", "Hmm, haan"]])
                transcript = "\n".join(f"{sp}: {t}" for sp, t in turns)
                mood_true = s["base"]["mood"] + ch["mood"][d]
                maxc = max([cues[c][d] for c in CUES if c not in ("loneliness",)] + [0])
                sentiment = ("distressed" if (mood_true < 2.7 or cues["low_mood"][d] > 0.7) else
                             "low" if (mood_true < 3.5 or any(e["severity"] == "strong" for e in ext)) else
                             "positive" if (mood_true >= 4.0 and maxc < 0.3) else "neutral")
                urgent = any((e["severity"] == "strong" and e["cue"] in URGENT_STRONG and e["temporal"] == "current") for e in ext)
                present = [e for e in ext if e["value"] == "present" and e["temporal"] == "current"]
                denies = [e for e in ext if e["value"] == "absent"]
                tm = f"{hour:02d}:{minute:02d}"
                note = (f"Call {date_of(d)} {tm} (answered, {dur//60}m{dur%60:02d}s). Objective: {objective.replace('_', ' ')}. "
                        + ("Reports: " + "; ".join(f"{CUE_EN[e['cue']]} ({e['severity']}, {e['source']})" for e in present) + ". " if present else "No new symptoms reported. ")
                        + ("Denies: " + ", ".join(CUE_EN[e["cue"]] for e in denies) + ". " if denies else "")
                        + (f"Medication: {med_report.replace('|', ', ').replace('_', ' ')}" + (" (REPORT MISMATCH with log)" if mismatch else "") + ". " if med_report else "")
                        + (f"Engagement: hobbies {hob_eng}. " if hob_eng != "not_asked" else "")
                        + f"Tone: {sentiment}; terse replies {n_terse_all}/{len(sen_lines)}. "
                        + ("Flags: " + ", ".join(sorted(fl)) + ". " if fl else "")
                        + ("Complaint about coordinator pace/timing recorded. " if complaint else "")
                        + ("PLAN: same-day follow-up; family to be informed (consent: " + fam["consent"] + "); advise clinician review. No medication change advised."
                           if urgent else "PLAN: continue scheduled check-ins; escalate if symptoms persist. No medication change advised."))
                # update memory
                mem["cues"] = [(d, e["cue"], e["severity"]) for e in ext if e["value"] == "present" and e["temporal"] == "current" and e["severity"] in ("strong",)]
                calls.append(dict(call_id=call_id, senior_id=sid, coordinator_id=s["coordinator"]["coordinator_id"], call_datetime=ts, day_index=d,
                                  call_status="answered_brief" if brief else "answered", duration_sec=max(30, dur), objective=objective,
                                  transcript=transcript, senior_word_count=words, senior_turns=len(sen_lines),
                                  senior_terse_reply_ratio=round(n_terse_all / max(1, len(sen_lines)), 2), complaint_flag=complaint,
                                  senior_query_flag=query, extracted_cues_json=json.dumps(ext), medication_report=med_report,
                                  medication_report_mismatch=mismatch, hobby_engagement=hob_eng, sentiment=sentiment, urgency_flag=urgent,
                                  objective_note_en=note, transcript_status="synthetic_verified", language_style=s["lang"]))
                plans.append(dict(call_id=call_id, senior_id=sid, call_datetime=ts, objective=objective,
                                  communication_points_json=json.dumps(points),
                                  planned_questions_json=json.dumps([dict(domain=q["domain"], kind=q["kind"],
                                                                          topic=(q["topic"] if not isinstance(q["topic"], dict) else q["topic"]["ev"]["type"]),
                                                                          provenance=q["why"]) for q in qs]),
                                  tone_checklist_json=json.dumps(TONE_CHECK), n_questions=len(qs)))
        mem_all[sid] = mem
    return pd.DataFrame(calls), pd.DataFrame(plans)


# ============================================================================== voice notes
def build_voice_notes(seniors, flags):
    rows = []
    nid = 0
    for s in seniors:
        sid = s["senior_id"]; r = rng_for(sid, "voice")
        lat = s["lat"]; ch = lat["ch"]; cues = lat["cues"]
        sg = s["gender"]
        child = "beta"
        has_meds = [m for m in s["meds"] if not m["is_sos"]]
        for d in range(N_DAYS):
            dt = START_DATE + timedelta(days=d)
            cat = None; cue_main = ""; text = None
            eng = max(0.05, 1 + ch["engage"][d])
            base_p = (0.012 + 0.05 * s["talkative"]) * eng
            if dt in FESTIVALS and r.random() < 0.15 + 0.5 * s["talkative"]:
                cat, text = "festival_greeting", str(r.choice(VN_GREET)).replace("{fest}", FESTIVALS[dt][0] + " ki shubhkamnayein")
            else:
                strong = [(cues[c][d], c) for c in CUES if cues[c][d] >= 0.5 and c not in ("loneliness",) and CB[c]["voice"]]
                if strong and not s["stoic"] and r.random() < 0.28:
                    x, c = max(strong)
                    if c == "fall" and any(f.get("silent") for f in s["falls"]): c = None
                    if c:
                        cat, cue_main, text = "symptom_report", c, str(r.choice(CB[c]["voice"]))
                if cat is None and flags[sid][d] & {"bp_high", "bp_low"} and r.random() < 0.25:
                    cat = "bp_reading_report"; text = str(r.choice(VN_BP)).replace("{sbp}", str(int(s["base"]["sbp"] + ch["sbp"][d] + r.normal(0, 4)))).replace("{dbp}", str(int(s["base"]["dbp"] + ch["dbp"][d] + r.normal(0, 3))))
                if cat is None and cues["loneliness"][d] > 0.5 and r.random() < 0.12 * s["talkative"] * 3:
                    cat, cue_main, text = "loneliness_share", "loneliness", str(r.choice(VN_LONELY))
                if cat is None and has_meds and r.random() < 0.010:
                    m = has_meds[int(r.integers(0, len(has_meds)))]
                    cat, cue_main, text = "medicine_refill_request", "medication_issue", str(r.choice(VN_REFILL)).replace("{drug}", m["drug_name"])
                if cat is None and r.random() < base_p:
                    pick = r.random()
                    if pick < 0.5: cat, text = "general_chat_hobby", str(r.choice(VN_CHAT))
                    elif pick < 0.8: cat, text = "appointment_or_report_query", str(r.choice(VN_QUERY))
                    else: cat, text = "complaint_or_feedback", str(r.choice(VN_COMPLAINT))
            if cat is None:
                continue
            text = fmt(text, sg)
            if s["lang"] == "hinglish":
                text = hinglishify(text, r)
            nid += 1
            noise = str(r.choice(["quiet_room", "tv_in_background", "street_noise", "kitchen_noise"], p=[.5, .25, .13, .12]))
            conf = float(np.clip(r.normal(0.90 if noise == "quiet_room" else 0.80, 0.06) - (0.05 if s["age"] > 80 else 0), 0.5, 0.98))
            toks = text.split(" ")
            out = []
            for t in toks:
                if r.random() < (1 - conf) * 0.35:
                    if r.random() < 0.5: out.append("[unclear]")
                    continue
                out.append(t)
            hour = int(r.choice([7, 8, 9, 10, 12, 15, 17, 18, 20, 21], p=[.08, .1, .12, .12, .08, .1, .1, .12, .1, .08]))
            strong_cue = cue_main in URGENT_STRONG and cat == "symptom_report"
            rows.append(dict(note_id=f"VN_{nid:05d}", senior_id=sid, timestamp=f"{dt.isoformat()} {hour:02d}:{int(r.integers(0, 60)):02d}:00",
                             day_index=d, duration_sec=int(len(toks) / 2.2 + 3 + r.normal(0, 1.5)), category=cat, primary_cue=cue_main,
                             transcript=" ".join(out), stt_confidence=round(conf, 2), background_noise=noise,
                             urgency_flag=bool(strong_cue), language_style=s["lang"], audio_available=False,
                             transcript_status="synthetic_with_stt_noise"))
    return pd.DataFrame(rows)
