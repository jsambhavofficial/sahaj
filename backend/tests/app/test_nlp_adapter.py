import pytest

from app.modules.checkins.nlp import extract_cues


def cues(*utterances):
    return {(c["cue_type"], c["cue_value"]) for c in extract_cues(list(utterances))}


def test_symptoms_stay_present_when_a_later_utterance_has_na_inside_a_word():
    # "खाना" contains "ना"; it used to flip both earlier symptoms to absent
    got = cues("नमस्ते बेटा सुबह से थोड़ा चक्कर आ रहा है और कमज़ोरी भी लग रही है",
               "हां दवाई ले ली है लेकिन खाना कम खाया आज")
    assert ("dizziness", "present") in got and ("weakness", "present") in got
    assert ("dizziness", "absent") not in got and ("weakness", "absent") not in got


def test_real_negation_still_negates():
    assert ("dizziness", "absent") in cues("मुझे चक्कर नहीं आ रहा है")


def test_contrast_word_ends_the_negation():
    got = cues("चक्कर नहीं है लेकिन कमज़ोरी है")
    assert ("dizziness", "absent") in got and ("weakness", "present") in got


def test_utterances_do_not_leak_negation_into_each_other():
    got = cues("मुझे दर्द नहीं है", "थोड़ा चक्कर आ रहा है")
    assert ("pain", "absent") in got and ("dizziness", "present") in got


def test_romanised_and_english_still_work():
    assert ("dizziness", "present") in cues("Thoda chakkar aa raha hai")
    assert ("pain", "absent") in cues("no pain today")


def test_empty_input():
    assert extract_cues([]) == [] and extract_cues("") == []
