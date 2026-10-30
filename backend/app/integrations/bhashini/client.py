"""Bhashini (government of India) speech services: ASR and TTS through the pipeline API.

Flow: a config call (auth server) returns the model service ids plus the inference URL and token;
a compute call to that URL does the work. If the config call fails we fall back to known defaults.
"""

import base64
import logging
import time

import httpx

logger = logging.getLogger(__name__)

CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
PIPELINE_ID = "64392f96daac500b55c543cd"  # "Initial Pipeline Models": ASR, translation, TTS
# TTS models: name -> (pipeline id, fallback service id). IITM has a male voice only.
TTS_MODELS = {
    "ai4bharat": (PIPELINE_ID, "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4"),
    "iitm": ("660fa5bec7fb5b0328229016", "Bhashini/IITM/TTS"),
}
DEFAULT_CALLBACK = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
DEFAULT_SERVICES = {
    ("asr", "hi"): "ai4bharat/conformer-hi-gpu--t4",
    ("tts", "hi"): "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4",
}
RETRY_STATUSES = {502, 503, 504}
LANGUAGE_CODES = {"hindi": "hi", "hinglish": "hi", "english": "en"}


class BhashiniError(Exception):
    pass


def language_code(language: str | None) -> str:
    return LANGUAGE_CODES.get((language or "hindi").lower(), "hi")


class BhashiniClient:
    def __init__(self, *, user_id: str, ulca_key: str, inference_key: str,
                 http: httpx.Client | None = None, sleep=time.sleep, attempts: int = 3,
                 tts_model: str = "ai4bharat"):
        self.user_id, self.ulca_key, self.inference_key = user_id, ulca_key, inference_key
        self.http = http or httpx.Client(timeout=60)
        self.sleep, self.attempts = sleep, attempts
        if tts_model not in TTS_MODELS:
            raise BhashiniError(f"Unknown TTS model '{tts_model}' (use one of {sorted(TTS_MODELS)})")
        self.tts_model = tts_model
        self._config: dict[tuple[str, str], dict] = {}

    def _service(self, task: str, lang: str) -> dict:
        key = (task, lang)
        if key not in self._config:
            try:
                self._config[key] = self._fetch_config(task, lang)
            except Exception as exc:
                logger.warning("Bhashini config call failed (%s); using defaults", exc)
                service = TTS_MODELS[self.tts_model][1] if task == "tts" else DEFAULT_SERVICES.get(key)
                if not service:
                    raise BhashiniError(f"No model known for {task}/{lang}") from exc
                return {"service_id": service, "url": DEFAULT_CALLBACK, "voices": None,
                        "auth": ("Authorization", self.inference_key)}
        return self._config[key]

    def _fetch_config(self, task: str, lang: str) -> dict:
        pipeline_id = TTS_MODELS[self.tts_model][0] if task == "tts" else PIPELINE_ID
        r = self.http.post(CONFIG_URL, headers={"userID": self.user_id, "ulcaApiKey": self.ulca_key},
                           json={"pipelineTasks": [{"taskType": task, "config": {"language": {"sourceLanguage": lang}}}],
                                 "pipelineRequestConfig": {"pipelineId": pipeline_id}})
        r.raise_for_status()
        data = r.json()
        endpoint = data["pipelineInferenceAPIEndPoint"]
        auth = endpoint["inferenceApiKey"]
        model = data["pipelineResponseConfig"][0]["config"][0]
        return {"service_id": model["serviceId"], "voices": model.get("supportedVoices"),
                "url": endpoint["callbackUrl"], "auth": (auth["name"], auth["value"])}

    def _compute(self, svc: dict, body: dict) -> dict:
        last = ""
        for attempt in range(self.attempts):
            try:
                r = self.http.post(svc["url"], headers={svc["auth"][0]: svc["auth"][1]}, json=body)
            except httpx.TransportError as exc:
                last = f"network error: {exc}"
            else:
                if r.status_code == 200:
                    return r.json()
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUSES:
                    raise BhashiniError(f"Bhashini request failed: {last} {r.text[:150]}")
            if attempt < self.attempts - 1:
                self.sleep(2 ** attempt)
        raise BhashiniError(f"Bhashini is unavailable ({last})")

    def asr(self, wav: bytes, language: str = "hi", sample_rate: int = 16000) -> str:
        svc = self._service("asr", language)
        body = {"pipelineTasks": [{"taskType": "asr", "config": {
                    "language": {"sourceLanguage": language}, "serviceId": svc["service_id"],
                    "audioFormat": "wav", "samplingRate": sample_rate}}],
                "inputData": {"audio": [{"audioContent": base64.b64encode(wav).decode()}]}}
        out = self._compute(svc, body)["pipelineResponse"][0]["output"]
        return (out[0].get("source") or "").strip() if out else ""

    def tts(self, text: str, language: str = "hi", gender: str = "female") -> bytes:
        svc = self._service("tts", language)
        if svc.get("voices") and gender not in svc["voices"]:
            gender = svc["voices"][0]  # e.g. the IITM model only has a male voice
        body = {"pipelineTasks": [{"taskType": "tts", "config": {
                    "language": {"sourceLanguage": language}, "serviceId": svc["service_id"], "gender": gender}}],
                "inputData": {"input": [{"source": text}], "audio": [{"audioContent": None}]}}
        audio = self._compute(svc, body)["pipelineResponse"][0]["audio"][0]["audioContent"]
        return base64.b64decode(audio)


class BhashiniSTT:
    """Transcribes each utterance of each channel (in parallel) and interleaves them by time."""

    def __init__(self, client: BhashiniClient, workers: int = 4):
        self.client, self.workers = client, workers

    def transcribe(self, audio: bytes, language: str | None):
        from concurrent.futures import ThreadPoolExecutor

        from app.integrations.audio import split_chunks
        from app.integrations.base import Segment

        lang = language_code(language)
        chunks = split_chunks(audio)
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            texts = list(pool.map(lambda c: self.client.asr(c.wav, lang), chunks))
        segments = [Segment(text=text, start_ms=c.start_ms, channel=c.channel if c.channels > 1 else None,
                            speaker=None if c.channels > 1 else "unknown")
                    for c, text in zip(chunks, texts) if text]
        return sorted(segments, key=lambda s: (s.start_ms or 0, s.channel or 0))


class BhashiniTTS:
    def __init__(self, client: BhashiniClient):
        self.client = client

    def synthesize(self, text: str, language: str | None = "hindi", gender: str = "female") -> bytes:
        from app.integrations.audio import to_pcm16_wav

        return to_pcm16_wav(self.client.tts(text, language_code(language), gender))
