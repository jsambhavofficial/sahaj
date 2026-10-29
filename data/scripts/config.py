"""Global configuration, catalogs and scenario table for the Samarth Extended generator.

Everything here is synthetic. Distributions are informed by published geriatric /
Indian epidemiology ranges and PhysioNet-style signal structure, NOT copied from any
real patient record.
"""
from __future__ import annotations
import hashlib
from datetime import date
from pathlib import Path

import numpy as np

# ------------------------------------------------------------------ paths
SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPTS_DIR.parent
RAW_DIR = DATA_DIR / "raw"
EVAL_DIR = DATA_DIR / "evaluation"

# ------------------------------------------------------------------ cohort / time
MASTER_SEED = 2026
N_SENIORS = 250
START_DATE = date(2026, 7, 6)          # a Monday
N_DAYS = 98                            # 14 full weeks  (90+ days)
BASELINE_DAYS = 28                     # empirical baseline window; no planted onset before day 30
FRAC_VITAL_MONITORED = 0.70            # 175 monitored / 75 not monitored
FAMILIES_PER_COORDINATOR = 2           # per Samarth ops note
N_COORDINATORS = N_SENIORS // FAMILIES_PER_COORDINATOR   # 125
CALLS_PER_WEEK = 2

CITIES = ["Delhi", "Gurugram", "Noida", "Lucknow", "Jaipur", "Pune", "Bengaluru", "Chandigarh", "Indore"]
FAMILY_LOCATIONS = (["Same city"] * 20 + ["Mumbai", "Bengaluru", "Hyderabad", "Gurugram", "Pune", "Chennai"] * 8 +
                    ["USA", "UK", "Canada", "Australia", "Dubai"] * 7)

FESTIVALS = {  # date -> (english, hindi greeting)
    date(2026, 8, 15): ("Independence Day", "स्वतंत्रता दिवस की शुभकामनाएँ"),
    date(2026, 8, 28): ("Raksha Bandhan", "रक्षाबंधन की शुभकामनाएँ"),
    date(2026, 9, 4): ("Janmashtami", "जन्माष्टमी की शुभकामनाएँ"),
    date(2026, 9, 14): ("Ganesh Chaturthi", "गणेश चतुर्थी की शुभकामनाएँ"),
    date(2026, 10, 11): ("Navratri", "नवरात्रि की शुभकामनाएँ"),
}


def senior_seed(sid: str) -> int:
    h = hashlib.sha256(f"{MASTER_SEED}:{sid}".encode()).digest()
    return int.from_bytes(h[:4], "big") & 0x7FFFFFFF


def rng_for(sid: str, stream: str) -> np.random.Generator:
    h = hashlib.sha256(f"{MASTER_SEED}:{sid}:{stream}".encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], "big"))


# ------------------------------------------------------------------ names (roman, devanagari)
MALE_FIRST = [("Ramesh", "रमेश"), ("Suresh", "सुरेश"), ("Mahesh", "महेश"), ("Rajendra", "राजेंद्र"),
              ("Harish", "हरीश"), ("Mohan", "मोहन"), ("Anil", "अनिल"), ("Vijay", "विजय"), ("Prakash", "प्रकाश"),
              ("Dinesh", "दिनेश"), ("Subhash", "सुभाष"), ("Om Prakash", "ओम प्रकाश"), ("Gopal", "गोपाल"),
              ("Narendra", "नरेंद्र"), ("Surendra", "सुरेंद्र"), ("Ashok", "अशोक"), ("Sunil", "सुनील"),
              ("Rakesh", "राकेश"), ("Jagdish", "जगदीश"), ("Balbir", "बलबीर"), ("Kailash", "कैलाश"),
              ("Ram Avtar", "राम अवतार"), ("Shyam", "श्याम"), ("Devendra", "देवेंद्र"), ("Hari Om", "हरि ओम")]
FEMALE_FIRST = [("Sushila", "सुशीला"), ("Kamla", "कमला"), ("Savitri", "सावित्री"), ("Shanti", "शांति"),
                ("Sarla", "सरला"), ("Usha", "उषा"), ("Meena", "मीना"), ("Sudha", "सुधा"), ("Kiran", "किरण"),
                ("Prem Lata", "प्रेम लता"), ("Geeta", "गीता"), ("Sunita", "सुनीता"), ("Vimla", "विमला"),
                ("Lalita", "ललिता"), ("Radha", "राधा"), ("Pushpa", "पुष्पा"), ("Asha", "आशा"),
                ("Nirmala", "निर्मला"), ("Indira", "इंदिरा"), ("Rajni", "रजनी"), ("Manju", "मंजू"),
                ("Shobha", "शोभा"), ("Kusum", "कुसुम"), ("Urmila", "उर्मिला"), ("Santosh", "संतोष")]
SURNAMES = [("Sharma", "शर्मा"), ("Verma", "वर्मा"), ("Gupta", "गुप्ता"), ("Singh", "सिंह"), ("Mishra", "मिश्रा"),
            ("Agarwal", "अग्रवाल"), ("Joshi", "जोशी"), ("Kapoor", "कपूर"), ("Malhotra", "मल्होत्रा"),
            ("Chopra", "चोपड़ा"), ("Yadav", "यादव"), ("Tiwari", "तिवारी"), ("Pandey", "पांडे"),
            ("Saxena", "सक्सेना"), ("Bansal", "बंसल"), ("Mehta", "मेहता"), ("Rao", "राव"), ("Khanna", "खन्ना"),
            ("Bhatia", "भाटिया"), ("Chauhan", "चौहान"), ("Srivastava", "श्रीवास्तव"), ("Jain", "जैन")]
FAMILY_M = [("Rohan", "रोहन"), ("Amit", "अमित"), ("Sandeep", "संदीप"), ("Vikram", "विक्रम"), ("Rahul", "राहुल"),
            ("Manish", "मनीष"), ("Nitin", "नितिन"), ("Ankit", "अंकित"), ("Arjun", "अर्जुन"), ("Karan", "करण")]
FAMILY_F = [("Neha", "नेहा"), ("Priya", "प्रिया"), ("Anjali", "अंजलि"), ("Pooja", "पूजा"), ("Kavita", "कविता"),
            ("Swati", "स्वाति"), ("Ritu", "ऋतु"), ("Shweta", "श्वेता"), ("Meera", "मीरा"), ("Divya", "दिव्या")]
COORD_F = [("Anita", "अनीता"), ("Ritika", "रितिका"), ("Sneha", "स्नेहा"), ("Deepa", "दीपा"), ("Kavya", "काव्या"),
           ("Jyoti", "ज्योति"), ("Pallavi", "पल्लवी"), ("Nisha", "निशा"), ("Rekha", "रेखा"), ("Seema", "सीमा")]
COORD_M = [("Pankaj", "पंकज"), ("Mohit", "मोहित"), ("Rajesh", "राजेश"), ("Varun", "वरुण"), ("Sachin", "सचिन"),
           ("Tarun", "तरुण"), ("Naveen", "नवीन"), ("Gaurav", "गौरव")]

# ------------------------------------------------------------------ conditions
# p = probability among seniors who have >=1 chronic condition. 27% of cohort has none.
P_NO_CONDITION = 0.27
CONDITIONS = {
    "hypertension":              dict(p=0.50, cat="physical"),
    "type2_diabetes":            dict(p=0.38, cat="physical"),
    "dyslipidemia":              dict(p=0.25, cat="physical"),
    "osteoarthritis":            dict(p=0.22, cat="physical"),
    "hypothyroidism":            dict(p=0.12, cat="physical"),
    "copd_asthma":               dict(p=0.11, cat="physical"),
    "cataract_low_vision":       dict(p=0.12, cat="physical"),
    "osteoporosis":              dict(p=0.10, cat="physical"),
    "prior_stroke":              dict(p=0.07, cat="physical"),
    "chf":                       dict(p=0.07, cat="physical"),
    "ckd":                       dict(p=0.05, cat="physical"),
    "old_ortho_surgery":         dict(p=0.06, cat="physical"),
    "depression_anxiety":        dict(p=0.15, cat="mental"),
    "mild_cognitive_impairment": dict(p=0.11, cat="mental"),
}

# (drug, dose, times, criticality, indication)
MEDS_BY_CONDITION = {
    "hypertension": [("Amlodipine", "5 mg", ["08:00"], "high", "blood pressure"),
                     ("Telmisartan", "40 mg", ["08:00"], "high", "blood pressure")],
    "type2_diabetes": [("Metformin", "500 mg", ["09:00", "21:00"], "medium", "diabetes"),
                       ("Glimepiride", "1 mg", ["07:30"], "high", "diabetes")],
    "dyslipidemia": [("Atorvastatin", "10 mg", ["21:30"], "low", "cholesterol")],
    "prior_stroke": [("Ecosprin (Aspirin)", "75 mg", ["14:00"], "high", "stroke prevention")],
    "chf": [("Furosemide", "20 mg", ["08:00"], "high", "heart failure"),
            ("Carvedilol", "3.125 mg", ["08:00", "20:00"], "high", "heart failure")],
    "copd_asthma": [("Budesonide+Formoterol inhaler", "2 puffs", ["08:30", "20:30"], "high", "breathing")],
    "hypothyroidism": [("Thyroxine", "50 mcg", ["06:30"], "medium", "thyroid")],
    "depression_anxiety": [("Escitalopram", "5 mg", ["09:00"], "medium", "mood")],
    "mild_cognitive_impairment": [("Donepezil", "5 mg", ["21:00"], "medium", "memory")],
    "osteoporosis": [("Calcium + Vitamin D3", "1 tab", ["14:30"], "low", "bones")],
}
HEALTHY_SUPPLEMENT = ("Multivitamin", "1 tab", ["09:00"], "low", "general wellness")

# ------------------------------------------------------------------ hobbies
# key: (en, hi, outdoor, social, base sessions/day, peak hour)
HOBBIES = {
    "morning_walk":    ("morning walk", "सुबह की सैर", True, False, 0.85, 6),
    "bhajan_mandali":  ("bhajan mandali", "भजन मंडली", False, True, 0.30, 17),
    "gardening":       ("gardening", "बागवानी", True, False, 0.55, 7),
    "reading":         ("reading", "अख़बार/किताब पढ़ना", False, False, 0.80, 11),
    "classical_music": ("music", "संगीत सुनना", False, False, 0.65, 19),
    "card_games":      ("card games with friends", "दोस्तों के साथ ताश", False, True, 0.35, 16),
    "temple_visit":    ("temple visit", "मंदिर जाना", True, True, 0.55, 18),
    "yoga":            ("yoga", "योग", False, False, 0.55, 6),
    "carrom":          ("carrom", "कैरम", False, True, 0.30, 17),
    "cooking":         ("cooking", "खाना बनाना", False, False, 0.60, 12),
    "grandkids_call":  ("video call with grandchildren", "पोते-पोतियों से वीडियो कॉल", False, True, 0.50, 20),
}

# ------------------------------------------------------------------ scenarios
# shape: 'none' | 'ramp' (ramp to crisis, hold, optional recover) | 'bell' | 'step'
# effects are peak magnitudes at prog=1. cues are peak latent intensities at prog=1.
# onset ranges respect day>=30 so days 0-27 form a clean empirical baseline.
SCENARIOS = {
    # ---------------- stable
    "SCEN_STABLE_ACTIVE": dict(cat="stable", count=45, shape="none", sev="none", esc="routine_monitoring", vitals=False),
    "SCEN_STABLE_SEDENTARY": dict(cat="stable", count=45, shape="none", sev="none", esc="routine_monitoring", vitals=False),
    "SCEN_STABLE_MILD_FLUCTUATION": dict(cat="stable", count=35, shape="none", sev="none", esc="routine_monitoring", vitals=False),
    # ---------------- intermittent (self-limiting)
    "SCEN_INTERMITTENT_SLEEP_DISRUPTION": dict(cat="intermittent", count=10, shape="bell", onset=(32, 80), dur=(3, 6), sev="mild",
        esc="care_coordinator_followup", vitals=False,
        eff=dict(sleep=-2.5, mood=-0.6, steps=-0.12), cues=dict(poor_sleep=0.8, weakness=0.2)),
    "SCEN_INTERMITTENT_PAIN_FLARE": dict(cat="intermittent", count=10, shape="bell", onset=(32, 80), dur=(3, 7), sev="mild",
        esc="care_coordinator_followup", vitals=False, req=["osteoarthritis"],
        eff=dict(steps=-0.35, sbp=9, hr=3, sleep=-0.5, mood=-0.3), cues=dict(pain=0.8)),
    "SCEN_INTERMITTENT_MED_OMISSION": dict(cat="intermittent", count=8, shape="bell", onset=(35, 80), dur=(2, 4), sev="mild",
        esc="care_coordinator_followup", vitals=False,
        eff=dict(adherence=-0.65, sbp=8, glu=18), cues=dict(medication_issue=0.7, confusion=0.2)),
    "SCEN_INTERMITTENT_VIRAL_FEVER": dict(cat="intermittent", count=6, shape="bell", onset=(32, 80), dur=(3, 5), sev="mild",
        esc="care_coordinator_followup", vitals=False,
        eff=dict(temp=2.0, hr=10, spo2=-0.8, steps=-0.5, appetite=-1.0), cues=dict(fever=0.9, weakness=0.7, headache=0.3)),
    "SCEN_INTERMITTENT_GI_UPSET": dict(cat="intermittent", count=6, shape="bell", onset=(32, 80), dur=(2, 4), sev="mild",
        esc="care_coordinator_followup", vitals=False,
        eff=dict(appetite=-1.5, wt=-0.8, steps=-0.2), cues=dict(low_appetite=0.8, weakness=0.4)),
    # ---------------- gradual
    "SCEN_GRADUAL_CHF_FLUID_RETENTION": dict(cat="gradual", count=8, shape="ramp", onset=(32, 62), ramp=(8, 14), hold=(6, 14), rec=(5, 9), sev="severe",
        esc="immediate_clinical_escalation", vitals=True, req=["chf"],
        eff=dict(wt=2.8, hr=12, spo2=-4.5, sbp=6, steps=-0.35, sleep=-0.8, mood=-0.3),
        cues=dict(breathlessness=0.9, swelling=0.8, weakness=0.5, poor_sleep=0.5)),
    "SCEN_GRADUAL_SILENT_UTI_DRIFT": dict(cat="gradual", count=8, shape="ramp", onset=(32, 70), ramp=(4, 9), hold=(4, 8), rec=(3, 6), sev="moderate",
        esc="immediate_clinical_escalation", vitals=True,
        eff=dict(temp=1.8, hr=14, sbp=-10, glu=20, steps=-0.3, mood=-0.6, appetite=-1.0),
        cues=dict(confusion=0.8, weakness=0.8, low_appetite=0.6, urinary=0.4, poor_sleep=0.4)),
    "SCEN_GRADUAL_POSTFALL_FEAR_SPIRAL": dict(cat="gradual", count=6, shape="ramp", onset=(32, 62), ramp=(10, 18), hold=(30, 40), rec=(0, 0), sev="moderate",
        esc="urgent_family_notification", vitals=False, fall_at_onset=True,
        eff=dict(steps=-0.65, mood=-1.0, social=-0.5, engage=-0.6, sedentary=3.0),
        cues=dict(fall=0.9, pain=0.5, loneliness=0.5, low_mood=0.6, dizziness=0.2)),
    "SCEN_GRADUAL_DEPRESSIVE_WITHDRAWAL": dict(cat="gradual", count=10, shape="ramp", onset=(30, 58), ramp=(18, 30), hold=(40, 60), rec=(0, 0), sev="moderate",
        esc="urgent_family_notification", vitals=False, req=["depression_anxiety?"],
        eff=dict(mood=-1.8, appetite=-1.0, sleep=-1.0, steps=-0.35, social=-0.7, engage=-0.8, monitor=-0.5, adherence=-0.15, words=-0.6),
        cues=dict(low_mood=0.9, loneliness=0.8, poor_sleep=0.6, low_appetite=0.5)),
    "SCEN_GRADUAL_COGNITIVE_MED_CONFUSION": dict(cat="gradual", count=8, shape="ramp", onset=(30, 55), ramp=(25, 38), hold=(40, 60), rec=(0, 0), sev="moderate",
        esc="urgent_family_notification", vitals=False, req=["mild_cognitive_impairment?"],
        eff=dict(adherence=-0.45, mood=-0.5, steps=-0.15, engage=-0.4, participation=-0.25),
        cues=dict(confusion=0.8, medication_issue=0.9)),
    "SCEN_GRADUAL_MOBILITY_DECLINE": dict(cat="gradual", count=4, shape="ramp", onset=(30, 55), ramp=(25, 38), hold=(40, 60), rec=(0, 0), sev="moderate",
        esc="urgent_family_notification", vitals=False,
        eff=dict(steps=-0.6, mood=-0.6, sedentary=2.0), cues=dict(pain=0.6, weakness=0.8)),
    "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS": dict(cat="gradual", count=4, shape="ramp", onset=(30, 52), ramp=(28, 36), hold=(40, 60), rec=(0, 0), sev="severe",
        esc="urgent_family_notification", vitals=False,
        eff=dict(wt=-4.5, appetite=-2.0, steps=-0.25, mood=-0.4), cues=dict(low_appetite=0.9, weakness=0.5)),
    "SCEN_GRADUAL_RESPIRATORY_DECONDITIONING": dict(cat="gradual", count=4, shape="ramp", onset=(30, 55), ramp=(20, 30), hold=(40, 60), rec=(0, 0), sev="moderate",
        esc="urgent_family_notification", vitals=True,
        eff=dict(spo2=-4.5, hr=8, steps=-0.3, sleep=-0.4), cues=dict(breathlessness=0.8, weakness=0.5, poor_sleep=0.4)),
    "SCEN_GRADUAL_DECLINE_WITH_RECOVERY": dict(cat="gradual", count=4, shape="ramp", onset=(32, 50), ramp=(12, 16), hold=(2, 4), rec=(18, 24), sev="moderate",
        esc="care_coordinator_followup", vitals=False,
        eff=dict(steps=-0.5, mood=-0.6, sleep=-0.5), cues=dict(weakness=0.6, pain=0.4, low_mood=0.3)),
    "SCEN_GRADUAL_MASKED_SPARSE_DECLINE": dict(cat="gradual", count=4, shape="ramp", onset=(32, 55), ramp=(22, 30), hold=(40, 60), rec=(0, 0), sev="moderate",
        esc="care_coordinator_followup", vitals=True, stoic=True, sparse=True,
        eff=dict(steps=-0.5, appetite=-1.2, wt=-3.0, mood=-1.0, monitor=-0.6, engage=-0.5),
        cues=dict(low_appetite=0.8, weakness=0.7, low_mood=0.6)),
    # ---------------- acute
    "SCEN_ACUTE_FALL_INCIDENT": dict(cat="acute", count=7, shape="step", onset=(34, 85), hold=(2, 3), rec=(10, 14), sev="severe",
        esc="immediate_clinical_escalation", vitals=False, fall_at_onset=True,
        eff=dict(steps=-0.85, mood=-0.8, hr=6, sedentary=3.0), cues=dict(fall=0.95, pain=0.9, dizziness=0.3)),
    "SCEN_ACUTE_FALL_UNREPORTED_SILENT": dict(cat="acute", count=3, shape="step", onset=(34, 85), hold=(1, 2), rec=(6, 9), sev="moderate",
        esc="care_coordinator_followup", vitals=False, fall_at_onset=True, stoic=True, silent_fall=True,
        eff=dict(steps=-0.4, mood=-0.3), cues=dict(fall=0.9, pain=0.6)),
    "SCEN_ACUTE_HYPERTENSIVE_CRISIS": dict(cat="acute", count=5, shape="ramp", onset=(36, 82), ramp=(3, 4), hold=(3, 5), rec=(4, 6), sev="critical",
        esc="immediate_clinical_escalation", vitals=True, req=["hypertension"],
        eff=dict(sbp=45, dbp=24, hr=8, sleep=-0.5), cues=dict(headache=0.8, dizziness=0.7, weakness=0.3)),
    "SCEN_ACUTE_ORTHOSTATIC_DIZZINESS": dict(cat="acute", count=4, shape="step", onset=(34, 80), hold=(5, 9), rec=(4, 6), sev="severe",
        esc="immediate_clinical_escalation", vitals=True, req=["hypertension"], ortho=True,
        eff=dict(sbp=-26, dbp=-12, hr=10, steps=-0.4), cues=dict(dizziness=0.9, weakness=0.5)),
    "SCEN_ACUTE_HYPOGLYCEMIA_EPISODES": dict(cat="acute", count=3, shape="bell", onset=(36, 80), dur=(4, 7), sev="severe",
        esc="immediate_clinical_escalation", vitals=True, req=["type2_diabetes"],
        eff=dict(glu=-48, appetite=-1.0, hr=5), cues=dict(weakness=0.7, dizziness=0.7, confusion=0.3)),
    "SCEN_ACUTE_CHEST_PAIN_ARRHYTHMIA": dict(cat="acute", count=3, shape="step", onset=(36, 82), hold=(3, 5), rec=(5, 8), sev="critical",
        esc="immediate_clinical_escalation", vitals=True, arrhythmia=True,
        eff=dict(hr=25, sbp=8, spo2=-2, steps=-0.4),
        cues=dict(chest_discomfort=0.9, breathlessness=0.5, dizziness=0.4)),
}
assert sum(s["count"] for s in SCENARIOS.values()) == N_SENIORS, sum(s["count"] for s in SCENARIOS.values())

ACCEPTABLE_ACTIONS = {
    "routine_monitoring": "continue routine check-ins; no action",
    "care_coordinator_followup": "coordinator follow-up call within 24-48h; verify reading/symptom; encourage routine; update family if persists",
    "urgent_family_notification": "same-day warm family notification with objective facts; suggest booking a doctor visit; coordinator follow-up call within 24h",
    "immediate_clinical_escalation": "same-day escalation to clinician / emergency pathway as appropriate; call family immediately; coordinator stays on line",
}
PROHIBITED_ACTIONS = ("never advise starting/stopping/changing any medicine dose; never diagnose; "
                      "never tell the family everything is fine when objective data show a concern; "
                      "never share with family beyond consent")

CUES = ["pain", "weakness", "low_appetite", "poor_sleep", "low_mood", "loneliness", "confusion", "dizziness",
        "breathlessness", "fall", "fever", "swelling", "headache", "chest_discomfort", "urinary", "medication_issue"]


# ---- Roman-only policy: all generated text/outputs are in Roman script (no Devanagari).
# Name tuples keep (roman, roman) so legacy [1] lookups stay Roman; festival greetings are English.
for _nm in ('MALE_FIRST', 'FEMALE_FIRST', 'SURNAMES', 'FAMILY_M', 'FAMILY_F', 'COORD_F', 'COORD_M'):
    globals()[_nm] = [(a, a) for a, _ in globals()[_nm]]
HOBBIES = {k: (v[0], v[0]) + tuple(v[2:]) for k, v in HOBBIES.items()}
FESTIVALS = {d: (e, 'Happy ' + e) for d, (e, _) in FESTIVALS.items()}
