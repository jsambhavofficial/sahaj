import base64
import json
import shutil
import subprocess

import httpx
import pytest

from app.integrations.audio import split_chunks
from app.integrations.bhashini.client import BhashiniClient, BhashiniError, BhashiniSTT, BhashiniTTS, language_code

CONFIG = {"pipelineResponseConfig": [{"taskType": "asr", "config": [{"serviceId": "svc/asr-hi"}]}],
          "pipelineInferenceAPIEndPoint": {"callbackUrl": "https://infer.test/pipeline",
                                           "inferenceApiKey": {"name": "Authorization", "value": "tok"}}}


def client(handler, **kw):
    return BhashiniClient(user_id="u", ulca_key="k", inference_key="fallback-tok",
                          http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None, **kw)


def routes(compute):
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        if "getModelsPipeline" in str(request.url):
            return httpx.Response(200, json=CONFIG)
        return compute(request)
    return handler, seen


def test_asr_uses_config_service_headers_and_returns_text():
    handler, seen = routes(lambda r: httpx.Response(200, json={"pipelineResponse": [{"output": [{"source": "नमस्ते"}]}]}))
    assert client(handler).asr(b"wav-bytes") == "नमस्ते"
    config_req, compute_req = seen
    assert config_req.headers["userID"] == "u" and config_req.headers["ulcaApiKey"] == "k"
    assert compute_req.headers["Authorization"] == "tok" and str(compute_req.url) == "https://infer.test/pipeline"
    body = json.loads(compute_req.content)
    task = body["pipelineTasks"][0]
    assert task["taskType"] == "asr" and task["config"]["serviceId"] == "svc/asr-hi"
    assert task["config"]["audioFormat"] == "wav" and task["config"]["samplingRate"] == 16000
    assert base64.b64decode(body["inputData"]["audio"][0]["audioContent"]) == b"wav-bytes"


def test_tts_returns_decoded_audio():
    handler, _ = routes(lambda r: httpx.Response(200, json={"pipelineResponse": [{"audio": [
        {"audioContent": base64.b64encode(b"RIFFdata").decode()}]}]}))
    assert BhashiniTTS(client(handler)).synthesize("नमस्ते", "hindi") == b"RIFFdata"


def test_gateway_errors_are_retried_then_succeed():
    calls = {"n": 0}

    def compute(request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(502, text="Bad Gateway")
        return httpx.Response(200, json={"pipelineResponse": [{"output": [{"source": "ok"}]}]})

    handler, _ = routes(compute)
    assert client(handler).asr(b"x") == "ok" and calls["n"] == 3


def test_persistent_gateway_failure_raises_clear_error():
    handler, _ = routes(lambda r: httpx.Response(502, text="Bad Gateway"))
    with pytest.raises(BhashiniError, match="unavailable"):
        client(handler).asr(b"x")


def test_bad_credentials_are_not_retried():
    calls = {"n": 0}

    def compute(request):
        calls["n"] += 1
        return httpx.Response(401, text="unauthorized")

    handler, _ = routes(compute)
    with pytest.raises(BhashiniError, match="401"):
        client(handler).asr(b"x")
    assert calls["n"] == 1


def test_config_failure_falls_back_to_known_models():
    seen = []

    def handler(request):
        seen.append(str(request.url))
        if "getModelsPipeline" in str(request.url):
            return httpx.Response(500)
        return httpx.Response(200, json={"pipelineResponse": [{"output": [{"source": "fallback ok"}]}]})

    assert client(handler).asr(b"x") == "fallback ok"
    assert seen[-1].startswith("https://dhruva-api.bhashini.gov.in/")


def test_language_codes():
    assert language_code("hinglish") == "hi" and language_code("english") == "en" and language_code(None) == "hi"


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_stereo_recording_is_split_per_channel_and_chunked():
    # 45 s stereo, no pauses: a different tone in each channel, so it is cut at the length cap
    stereo = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:d=45", "-f", "lavfi",
         "-i", "sine=f=880:d=45", "-filter_complex", "[0][1]amerge=inputs=2", "-f", "mp3", "-"],
        check=True, capture_output=True).stdout
    chunks = split_chunks(stereo, max_s=20)
    assert sorted({c.channel for c in chunks}) == [0, 1]
    assert [c.start_ms for c in chunks if c.channel == 0] == [0, 19800, 39800]
    assert all(c.wav[:4] == b"RIFF" for c in chunks)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_stt_labels_channels_and_orders_by_time():
    stereo = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:d=25", "-f", "lavfi",
         "-i", "sine=f=880:d=25", "-filter_complex", "[0][1]amerge=inputs=2", "-f", "mp3", "-"],
        check=True, capture_output=True).stdout

    class FakeClient:
        n = 0

        def asr(self, wav, language="hi", sample_rate=16000):
            FakeClient.n += 1
            return f"chunk{FakeClient.n}"

    segs = BhashiniSTT(FakeClient(), workers=1).transcribe(stereo, "hindi")
    assert [(s.start_ms, s.channel) for s in segs] == [(0, 0), (0, 1), (14800, 0), (14800, 1)]


def test_iitm_tts_model_uses_its_pipeline_and_male_voice():
    tts_config = {"pipelineResponseConfig": [{"taskType": "tts", "config": [
        {"serviceId": "Bhashini/IITM/TTS", "supportedVoices": ["male"]}]}],
        "pipelineInferenceAPIEndPoint": CONFIG["pipelineInferenceAPIEndPoint"]}
    seen = []

    def handler(request):
        seen.append(request)
        if "getModelsPipeline" in str(request.url):
            return httpx.Response(200, json=tts_config)
        return httpx.Response(200, json={"pipelineResponse": [{"audio": [
            {"audioContent": base64.b64encode(b"RIFFx").decode()}]}]})

    c = BhashiniClient(user_id="u", ulca_key="k", inference_key="t", tts_model="iitm",
                       http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None)
    assert BhashiniTTS(c).synthesize("नमस्ते", "hindi", gender="female") == b"RIFFx"
    assert json.loads(seen[0].content)["pipelineRequestConfig"]["pipelineId"] == "660fa5bec7fb5b0328229016"
    task = json.loads(seen[1].content)["pipelineTasks"][0]["config"]
    assert task["serviceId"] == "Bhashini/IITM/TTS" and task["gender"] == "male"


def test_unknown_tts_model_is_rejected():
    with pytest.raises(BhashiniError, match="Unknown TTS model"):
        BhashiniClient(user_id="u", ulca_key="k", inference_key="t", tts_model="nope")


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_pauses_split_utterances_and_interleave_speakers():
    """A speaks 0-2 s, B speaks 3-5 s, A speaks again 6-8 s: three utterances in time order."""
    def tone(freq, start, length=2):
        return ["-f", "lavfi", "-t", "9", "-i",
                f"sine=f={freq}:d={length},adelay={start * 1000}|{start * 1000},apad=whole_dur=9"]
    stereo = subprocess.run(
        ["ffmpeg", "-loglevel", "error", *tone(440, 0), *tone(660, 6), *tone(880, 3),
         "-filter_complex", "[0][1]amix=inputs=2:normalize=0[l];[l][2]amerge=inputs=2", "-f", "mp3", "-"],
        check=True, capture_output=True).stdout
    chunks = sorted(split_chunks(stereo), key=lambda c: c.start_ms)
    assert [(c.channel, round(c.start_ms / 1000)) for c in chunks] == [(0, 0), (1, 3), (0, 6)]


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_mono_recording_has_no_speaker_labels():
    mono = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:d=3", "-f", "wav", "-"],
                          check=True, capture_output=True).stdout

    class FakeClient:
        def asr(self, wav, language="hi", sample_rate=16000):
            return "bol raha hoon"

    segs = BhashiniSTT(FakeClient(), workers=1).transcribe(mono, "hindi")
    assert segs and all(s.speaker == "unknown" and s.channel is None for s in segs)
