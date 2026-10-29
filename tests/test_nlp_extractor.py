"""Tests for clinical NLP extraction: negation, historical context, uncertainty, and multilingual notes."""

import pytest
from src.features.nlp_extractor import ClinicalNLPExtractor, summarize_extracted_cues


@pytest.fixture
def extractor():
    return ClinicalNLPExtractor()


def test_negation_not_treated_as_positive(extractor):
    # Hindi
    hindi_note = "मुझे किसी तरह का कोई दर्द या कमजोरी नहीं है, बिल्कुल ठीक हूँ।"
    cues = extractor.extract_cues(hindi_note)
    summary = summarize_extracted_cues(cues)
    assert summary["cue_pain_current"] is False, "Negated pain was incorrectly flagged as positive current pain!"
    assert summary["cue_weakness_current"] is False, "Negated weakness was incorrectly flagged as positive!"
    assert summary["cue_negated_count"] > 0

    # Hinglish
    hinglish_note = "Mujhe koi dard nahi hai, feeling fresh."
    cues_hing = extractor.extract_cues(hinglish_note)
    sum_hing = summarize_extracted_cues(cues_hing)
    assert sum_hing["cue_pain_current"] is False
    assert sum_hing["cue_negated_count"] > 0

    # English
    english_note = "Denies any chest pain, shortness of breath, or dizziness today."
    cues_en = extractor.extract_cues(english_note)
    sum_en = summarize_extracted_cues(cues_en)
    assert sum_en["cue_pain_current"] is False
    assert sum_en["cue_dizziness_current"] is False


def test_historical_symptom_not_treated_as_current(extractor):
    # Hinglish
    note = "Last week fall hua tha but abhi balance normal hai."
    cues = extractor.extract_cues(note)
    summary = summarize_extracted_cues(cues)
    assert summary["cue_fall_historical"] is True
    assert summary["cue_fall_current"] is False, "Historical fall was incorrectly treated as an acute current fall!"

    # English
    note_en = "Had experienced severe back ache two weeks ago, currently pain-free."
    cues_en = extractor.extract_cues(note_en)
    sum_en = summarize_extracted_cues(cues_en)
    assert sum_en["cue_pain_current"] is False


def test_uncertainty_handling(extractor):
    note = "Shayad chakkar aa rahe hain, sure nahi hoon."
    cues = extractor.extract_cues(note)
    assert any(c.uncertainty_detected for c in cues)
    summary = summarize_extracted_cues(cues)
    assert summary["cue_uncertain_count"] > 0


def test_positive_acute_fall(extractor):
    note = "Senior reported a slip and fall incident near the bathroom this morning."
    cues = extractor.extract_cues(note)
    summary = summarize_extracted_cues(cues)
    assert summary["cue_fall_current"] is True


def test_repeated_mentions_bounded(extractor):
    repeated_note = (
        "Weakness lag rahi hai. Bahut zyada weakness hai. "
        "Walking karte waqt weakness feel hoti hai. "
        "Weakness ki wajah se so rahe the."
    )
    cues = extractor.extract_cues(repeated_note)
    summary = summarize_extracted_cues(cues)
    # Distinct concerns must be capped at 1 for weakness, not 4
    assert summary["cue_weakness_current"] is True
    assert summary["distinct_concerns_count"] == 1

