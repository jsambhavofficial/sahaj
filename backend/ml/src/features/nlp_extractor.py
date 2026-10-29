"""Rule-based clinical dialogue NLP extractor for Hindi, English, and Hinglish check-in notes."""

from dataclasses import dataclass
import re
from typing import List, Dict, Any, Optional


@dataclass
class ClinicalCue:
    category: str
    status: str  # "present", "absent", "uncertain"
    temporal: str  # "current", "historical"
    negation_detected: bool
    uncertainty_detected: bool
    confidence: float
    raw_match: str


class ClinicalNLPExtractor:
    """
    Transparent, lightweight clinical cue extractor designed for older-adult
    multilingual check-in notes (Hindi, Hinglish, English).
    Recognizes explicit negation, historical symptoms, uncertainty, and active concerns.
    """

    # Category keywords / patterns across languages
    CATEGORIES = {
        "fall": [
            r"\b(fall|fell|slip|slipped|tripped)\b",
            r"(गिर पड़|गिर ग|फिसल|चोट आई)",
            r"\b(gir|slip|phisal|girna)\b",
        ],
        "weakness": [
            r"\b(weakness|fatigue|exhausted|tired|frail|lack of energy|low on energy|stamina)\b",
            r"(कमजोरी|सुस्ती|थकावट|थकान|कमज़ोरी)",
            r"\b(kamzori|thakaan|thakan|fatigue|weakness|sust|exhausted)\b",
        ],
        "dizziness": [
            r"\b(dizzy|dizziness|lightheaded|vertigo|unsteady|off-balance|loss of balance)\b",
            r"(चक्कर|सिर चकरा|संतुलन बिगड़)",
            r"\b(chakkar|chakar|dizzy|unsteady|lightheaded|off-balance)\b",
        ],
        "pain": [
            r"\b(pain|ache|aching|stiff|stiffness|sore|discomfort)\b",
            r"(दर्द|अकड़न|पीड़ा)",
            r"\b(dard|pain|stiffness|ache|dukh|takleef)\b",
        ],
        "low_appetite": [
            r"\b(appetite|eating less|skipped meal|not hungry|poor appetite)\b",
            r"(भूख|खाने का मन|खाना नहीं|स्वाद नहीं)",
            r"\b(bhookh|bhuk|appetite|khana nahi|khana skip)\b",
        ],
        "poor_sleep": [
            r"\b(sleep|insomnia|sleepless|restless|woke up|sleep disruption)\b",
            r"(नींद|सो नहीं|बेचैनी|करवटें)",
            r"\b(neend|nind|sleep|insomnia|restless|jagte rahe)\b",
        ],
        "confusion": [
            r"\b(confusion|confused|disoriented|forgot|forgetting|memory)\b",
            r"(भ्रम|उलझन|भूल गए|याद नहीं)",
            r"\b(confusion|confused|disoriented|bhool|bhol|yaad nahi)\b",
        ],
        "medication_issue": [
            r"\b(missed dose|missed tablet|medication issue|forgot medicine|pillbox)\b",
            r"(दवा छूट|गोली छूट|दवाई की डिब्बी|दवाइयों में उलझन)",
            r"\b(medicine miss|dawa miss|strip confuse|tablet miss)\b",
        ],
        "low_mood": [
            r"\b(lonely|loneliness|low mood|depressed|sad|tearful|isolated)\b",
            r"(अकेलापन|उदास|मन भारी|रोने का मन)",
            r"\b(akelapan|udas|man bhari|low mood|lonely)\b",
        ],
        "no_new_concern": [
            r"\b(all good|feeling fine|doing well|no complaint|normal|fresh)\b",
            r"(सब ठीक|कुशल मंगल|सामान्य|अच्छा लग रहा)",
            r"\b(sab theek|sab badiya|badhiya|fine|normal|all good|kushal)\b",
        ],
        "recovery": [
            r"\b(recovering|improving|rebounded|better now|improved)\b",
            r"(काफी सुधार|बेहतर|आसानी हो रही)",
            r"\b(sudhar|better|manageable|theek ho gaya|energetic)\b",
        ],
    }

    # Negation patterns
    NEGATION_PATTERNS = [
        r"\b(no|not|denies|denied|without|free of|pain-free|\w+-free|zero|none)\b",
        r"(नहीं|ना|मुक्त|कोई नहीं)",
        r"\b(nahi|nahin|na|koi nahi|no)\b",
    ]

    # Historical context patterns
    HISTORICAL_PATTERNS = [
        r"\b(last week|last month|two weeks ago|previously|in the past|resolved|had experienced)\b",
        r"(पिछले हफ्ते|दो हफ्ते पहले|पिछले महीने|पहले|बीते दिन)",
        r"\b(last week|last month|pichhle|pichle|pehle|purana)\b",
    ]

    # Uncertainty patterns
    UNCERTAINTY_PATTERNS = [
        r"\b(maybe|perhaps|unsure|not sure|possibly|uncertain)\b",
        r"(शायद|पता नहीं|संभवतः|लगता है)",
        r"\b(shayad|lagta hai|sure nahi|dhyan nahi|yaad nahi)\b",
    ]

    def __init__(self):
        # Precompile regexes
        self.category_compiled = {
            cat: [re.compile(p, re.IGNORECASE) for p in patterns]
            for cat, patterns in self.CATEGORIES.items()
        }
        self.neg_compiled = [re.compile(p, re.IGNORECASE) for p in self.NEGATION_PATTERNS]
        self.hist_compiled = [re.compile(p, re.IGNORECASE) for p in self.HISTORICAL_PATTERNS]
        self.unc_compiled = [re.compile(p, re.IGNORECASE) for p in self.UNCERTAINTY_PATTERNS]

    def extract_cues(self, text: str) -> List[ClinicalCue]:
        """Extracts structured clinical cues from a single dialogue or note."""
        if not text or not isinstance(text, str):
            return []

        cues: List[ClinicalCue] = []

        # Split text into sentences for localized scope analysis
        sentences = re.split(r"[।\.\!\?\n]+", text)

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            clauses = [c.strip() for c in re.split(r"[,;]|\b(?:but|lekin|par|however)\b", sentence, flags=re.IGNORECASE) if c and c.strip()]
            active_negation = False

            for clause in clauses:
                if re.match(r"^(but|lekin|par|however)$", clause, re.IGNORECASE):
                    active_negation = False
                    continue

                clause_neg = any(p.search(clause) for p in self.neg_compiled)
                if clause_neg:
                    active_negation = True

                is_historical = any(p.search(clause) for p in self.hist_compiled)
                if is_historical or any(w in clause.lower() for w in ["theek", "normal", "fine", "better"]):
                    active_negation = False

                is_negated = clause_neg or active_negation
                is_uncertain = any(p.search(clause) for p in self.unc_compiled)

                for cat, patterns in self.category_compiled.items():
                    matched_str = None
                    for p in patterns:
                        m = p.search(clause)
                        if m:
                            matched_str = m.group(0)
                            break

                    if matched_str:
                        if is_negated:
                            status = "absent"
                        elif is_uncertain:
                            status = "uncertain"
                        else:
                            status = "present"

                        temporal = "historical" if is_historical else "current"

                        confidence = 0.95
                        if is_uncertain:
                            confidence = 0.75

                        cues.append(ClinicalCue(
                            category=cat,
                            status=status,
                            temporal=temporal,
                            negation_detected=is_negated,
                            uncertainty_detected=is_uncertain,
                            confidence=confidence,
                            raw_match=matched_str,
                        ))

        return cues


def summarize_extracted_cues(cues: List[ClinicalCue]) -> Dict[str, Any]:
    """
    Summarizes multiple cues from a time window into clean feature indicators.
    Deduplicates repeated mentions to prevent unbounded score inflation.
    """
    summary = {
        "cue_fall_current": False,
        "cue_fall_historical": False,
        "cue_weakness_current": False,
        "cue_dizziness_current": False,
        "cue_pain_current": False,
        "cue_low_appetite_current": False,
        "cue_poor_sleep_current": False,
        "cue_confusion_current": False,
        "cue_medication_issue_current": False,
        "cue_low_mood_current": False,
        "cue_no_new_concern_count": 0,
        "cue_recovery_count": 0,
        "cue_negated_count": 0,
        "cue_uncertain_count": 0,
        "distinct_concerns_count": 0,
    }

    active_categories = set()

    for cue in cues:
        if cue.negation_detected:
            summary["cue_negated_count"] += 1
            continue

        if cue.uncertainty_detected:
            summary["cue_uncertain_count"] += 1

        if cue.category == "no_new_concern":
            summary["cue_no_new_concern_count"] += 1
            continue

        if cue.category == "recovery":
            summary["cue_recovery_count"] += 1
            continue

        if cue.category == "fall":
            if cue.temporal == "historical":
                summary["cue_fall_historical"] = True
            elif cue.status == "present":
                summary["cue_fall_current"] = True
                active_categories.add("fall")
            continue

        if cue.temporal == "current" and cue.status in ["present", "uncertain"]:
            key = f"cue_{cue.category}_current"
            if key in summary:
                summary[key] = True
                active_categories.add(cue.category)

    summary["distinct_concerns_count"] = len(active_categories)
    return summary
