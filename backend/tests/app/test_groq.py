import json

import httpx
import pytest

from app.integrations.groq.client import GroqError, GroqLLM


def llm(handler, **kw):
    return GroqLLM(api_key="key-123", http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None, **kw)


def test_complete_uses_bearer_header_and_returns_message_text():
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "  नमस्ते जी  "}}]})

    assert llm(handler, model="m-test").complete("be kind", "hello") == "नमस्ते जी"
    req = seen[0]
    assert str(req.url) == "https://api.groq.com/openai/v1/chat/completions" and req.headers["authorization"] == "Bearer key-123"
    body = json.loads(req.content)
    assert body["model"] == "m-test" and body["messages"][0] == {"role": "system", "content": "be kind"}
    assert body["reasoning_effort"] == "low"


def test_empty_reply_and_errors_behave():
    assert llm(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": None}, "finish_reason": "length"}]})).complete("s", "u") == ""
    with pytest.raises(GroqError, match="unavailable"):
        llm(lambda r: httpx.Response(503), attempts=2).complete("s", "u")
    with pytest.raises(GroqError, match="401"):
        llm(lambda r: httpx.Response(401, text="bad key")).complete("s", "u")
    with pytest.raises(GroqError, match="GROQ_API_KEY"):
        GroqLLM(api_key="")
