"""Times speech-to-text and text-to-speech per provider, using a synthetic Hindi sentence (no real voices).

Run from backend/:  .venv/bin/python -m scripts.voice_latency [--runs 8] [--providers sarvam,bhashini]
Each provider is tested only if its keys are configured. Prints median and worst latency, never keys.
Flow per run: TTS makes the audio (timed), then that same audio is sent to the provider's STT (timed).
"""

import argparse
import statistics
import subprocess
import time

from app.core.config import get_settings
from app.integrations.bhashini.client import BhashiniClient, BhashiniSTT, BhashiniTTS
from app.integrations.sarvam.client import SarvamClient, SarvamSTT, SarvamTTS

SENTENCE = "नमस्ते जी, आज आप कैसे हैं? क्या आपने सुबह की दवाई ले ली?"


def to_16k_mono(wav: bytes) -> bytes:
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
                       input=wav, capture_output=True, check=True)
    return r.stdout


def build(name: str):
    s = get_settings()
    if name == "sarvam" and s.sarvam_api_key:
        c = SarvamClient(api_key=s.sarvam_api_key, stt_model=s.sarvam_stt_model,
                         tts_model=s.sarvam_tts_model, tts_speaker=s.sarvam_tts_speaker)
        return SarvamTTS(c), SarvamSTT(c), c
    if name == "bhashini" and s.bhashini_inference_key:
        c = BhashiniClient(user_id=s.bhashini_user_id, ulca_key=s.bhashini_api_key,
                           inference_key=s.bhashini_inference_key, tts_model=s.bhashini_tts_model)
        return BhashiniTTS(c), BhashiniSTT(c), c
    return None


def timed(fn):
    t = time.perf_counter()
    try:
        out = fn()
    except Exception as exc:  # report the failure, keep going
        return None, time.perf_counter() - t, f"{type(exc).__name__}: {str(exc)[:120]}"
    return out, time.perf_counter() - t, None


def summary(label, values, errors):
    if not values:
        print(f"  {label}: no successful runs ({errors[0] if errors else 'unknown error'})")
        return
    print(f"  {label}: median {statistics.median(values):.2f}s  worst {max(values):.2f}s  "
          f"({len(values)} ok, {len(errors)} failed)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=8)
    ap.add_argument("--providers", default="sarvam,bhashini")
    args = ap.parse_args()
    print(f"Sentence: {SENTENCE}")
    for name in args.providers.split(","):
        built = build(name.strip())
        if not built:
            print(f"{name}: skipped (keys not configured)")
            continue
        tts, stt, client = built
        print(f"{name}:")
        tts_t, stt_t, errors, heard = [], [], [], ""
        for _ in range(args.runs):
            audio, dt, err = timed(lambda: tts.synthesize(SENTENCE, "hindi"))
            if err:
                errors.append(err)
                continue
            tts_t.append(dt)
            wav = to_16k_mono(audio)
            if name == "sarvam":
                text, dt, err = timed(lambda: client.asr(wav, "hi-IN"))
            else:
                text, dt, err = timed(lambda: client.asr(wav, "hi"))
            if err:
                errors.append(err)
                continue
            stt_t.append(dt)
            heard = text
        summary("TTS", tts_t, errors)
        summary("STT", stt_t, errors)
        print(f"  last transcript: {heard}")


if __name__ == "__main__":
    main()
