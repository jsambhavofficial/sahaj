import json

import httpx
import pytest

from app.integrations.gemini.client import GeminiError, GeminiLLM
from app.modules.voice import agent as agent_mod
from app.modules.voice.schemas import CallContext, Stage, Turn


def llm(handler, **kw):
    return GeminiLLM(api_key="key-123", http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None, **kw)


def ok(text):
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]})


def test_complete_sends_key_in_header_and_returns_text():
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return ok("  नमस्ते जी  ")

    assert llm(handler, model="gemini-test").complete("be kind", "hello") == "नमस्ते जी"
    req = seen[0]
    assert str(req.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent"
    assert req.headers["x-goog-api-key"] == "key-123" and "key-123" not in str(req.url)
    body = json.loads(req.content)
    assert body["systemInstruction"]["parts"][0]["text"] == "be kind"
    assert body["contents"][0]["parts"][0]["text"] == "hello"


def test_blocked_or_empty_reply_is_an_empty_string():
    assert llm(lambda r: httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})).complete("s", "u") == ""
    assert llm(lambda r: httpx.Response(200, json={"candidates": [{"finishReason": "SAFETY"}]})).complete("s", "u") == ""


def test_transient_errors_are_retried_then_raise():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503, text="busy")

    with pytest.raises(GeminiError, match="unavailable"):
        llm(handler, attempts=2).complete("s", "u")
    assert calls["n"] == 2


def test_bad_request_and_missing_key_are_errors_without_retry():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(403, text="API key not valid")

    with pytest.raises(GeminiError, match="403"):
        llm(handler).complete("s", "u")
    assert calls["n"] == 1
    with pytest.raises(GeminiError, match="GEMINI_API_KEY"):
        GeminiLLM(api_key="")


def test_agent_falls_back_to_the_scripted_line_when_the_model_fails():
    class Broken:
        def complete(self, system, user):
            raise GeminiError("down")

    ctx = CallContext(language="hindi")
    reply = agent_mod.LLMAgent(Broken(), "hindi", ctx, []).say(Stage("question", 1, 4), [])
    assert reply == agent_mod.ScriptedAgent("hindi", ctx).say(Stage("question", 1, 4), [])


def test_factory_uses_gemini_only_with_a_key(monkeypatch):
    from app.core.config import get_settings
    from app.integrations import factory
    from app.integrations.stub.providers import StubLLM
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear(); factory.get_llm.cache_clear()
    assert isinstance(factory.get_llm(), StubLLM)
    monkeypatch.setenv("GEMINI_API_KEY", "abc")
    get_settings.cache_clear(); factory.get_llm.cache_clear()
    assert isinstance(factory.get_llm(), GeminiLLM)


def test_llm_agent_never_repeats_a_question_and_moves_to_the_next_topic():
    ctx = CallContext(language="hindi")
    phrases = agent_mod.load_phrases("hindi")
    # the model keeps asking about the day's health, which the opening already asked
    class Repeats:
        def complete(self, system, user):
            return "सर में दर्द सुनकर खेद है। " + phrases["questions"][0]
    ag = agent_mod.LLMAgent(Repeats(), "hindi", ctx, [])
    history = [Turn("agent", "नमस्ते जी। " + phrases["questions"][0]), Turn("senior", "सर में दर्द है")]
    reply = ag.say(Stage("question", 1, 7), history)
    assert phrases["questions"][1] in reply and phrases["questions"][0] not in reply  # next unasked topic
    # once every topic has been asked, it ends with the generic question instead of looping
    history += [Turn("agent", q) for q in phrases["questions"][1:]]
    assert phrases["more"] in ag.say(Stage("question", 5, 7), history)


def test_only_the_first_question_is_kept():
    two = "सर में दर्द की बात सुनकर खेद है। यह दर्द अभी भी है? यह दर्द कब से शुरू हुआ?"
    assert agent_mod._one_question(two) == "सर में दर्द की बात सुनकर खेद है। यह दर्द अभी भी है?"
    assert agent_mod._one_question("ठीक है जी।") == "ठीक है जी।"
