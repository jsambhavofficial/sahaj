import pytest

from app.core.safety import SAFE_FALLBACK, guard_text, is_safe


@pytest.mark.parametrize("text", [
    "You have diabetes, you should rest.",
    "You may have an infection.",
    "Please stop your blood pressure medicine for a few days.",
    "Take extra tablet tonight.",
    "Aap dawai band kar dijiye.",
    "There is nothing to worry about, you are fine.",
])
def test_unsafe_text_is_replaced(text):
    assert not is_safe(text)
    assert guard_text(text) == SAFE_FALLBACK


@pytest.mark.parametrize("text", [
    "Namaste ji, aap kaise hain aaj?",
    "Did you take your medicine on time today?",
    "Your coordinator will call you this afternoon to check how you feel.",
    "Aapne subah chakkar ki baat boli thi, ab kaisa lag raha hai?",
])
def test_safe_text_passes(text):
    assert guard_text(text) == text
