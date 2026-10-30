import base64
import json

import httpx
import pytest

from app.integrations.sarvam.client import SarvamClient, SarvamError, SarvamTTS, language_code


def client(handler, **kw):
    return SarvamClient(api_key="key-123", http=httpx.Client(transport=httpx.MockTransport(handler)),
                        sleep=lambda s: None, **kw)


def test_asr_sends_multipart_with_key_and_returns_transcript():
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return httpx.Response(200, json={"transcript": " नमस्ते "})

    assert client(handler).asr(b"wav-bytes", "hi-IN") == "नमस्ते"
    req = seen[0]
    assert str(req.url) == "https://api.sarvam.ai/speech-to-text"
    assert req.headers["api-subscription-key"] == "key-123"
    assert b"saaras:v4" in req.content and b"hi-IN" in req.content and b"wav-bytes" in req.content


def test_tts_posts_json_and_decodes_audio():
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return httpx.Response(200, json={"audios": [base64.b64encode(b"RIFFdata").decode()]})

    assert SarvamTTS(client(handler, tts_speaker="shubh")).synthesize("नमस्ते", "hindi") == b"RIFFdata"
    body = json.loads(seen[0].content)
    assert body["language_code"] == "hi-IN" and body["model"] == "bulbul:v4-flash"
    assert body["speaker"] == "shubh" and body["output_audio_codec"] == "wav"


def test_tts_omits_speaker_when_unset():
    seen = []
    client(lambda r: (seen.append(r), httpx.Response(200, json={"audios": ["AA=="]}))[1]).tts("hi")
    assert "speaker" not in json.loads(seen[0].content)


def test_rate_limit_is_retried_then_succeeds():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(429) if calls["n"] < 3 else httpx.Response(200, json={"transcript": "ok"})

    assert client(handler).asr(b"x") == "ok" and calls["n"] == 3


def test_client_error_is_not_retried():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(403, text="forbidden")

    with pytest.raises(SarvamError, match="403"):
        client(handler).asr(b"x")
    assert calls["n"] == 1


def test_empty_audio_list_and_missing_key_are_errors():
    with pytest.raises(SarvamError, match="no audio"):
        client(lambda r: httpx.Response(200, json={"audios": []})).tts("hi")
    with pytest.raises(SarvamError, match="SARVAM_API_KEY"):
        SarvamClient(api_key="")


def test_language_codes():
    assert language_code("hinglish") == "hi-IN" and language_code("english") == "en-IN"
    assert language_code(None) == "hi-IN"
