"""Audio helpers (ffmpeg): turn a call recording into per-channel utterances.

Exotel's dual-channel recording puts each person on their own channel, so transcribing each channel
separately labels the speakers without any speaker-separation model. Each channel is cut at pauses
into short utterances (long clips lose their ending in speech-to-text), so turns interleave in time.
"""

import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

MAX_UTTERANCE_SECONDS = 15
MIN_UTTERANCE_SECONDS = 0.3
SILENCE_DB = -35
MIN_SILENCE_SECONDS = 0.6
PADDING_SECONDS = 0.2


@dataclass
class AudioChunk:
    channel: int
    start_ms: int
    wav: bytes
    channels: int = 2  # channels in the source recording (1 = no speaker separation)


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True)


def _text(cmd: list[str]) -> str:
    r = _run(cmd)
    return (r.stdout + r.stderr).decode(errors="replace")


def channel_count(path: Path) -> int:
    out = _run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
                "-of", "csv=p=0", str(path)]).stdout.decode()
    return int(out.strip() or 1)


def duration(path: Path) -> float:
    out = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out.stdout.decode().strip() or 0)


def speech_spans(path: Path, total: float) -> list[tuple[float, float]]:
    """(start, end) seconds of non-silent stretches; falls back to the whole file if no pauses are found."""
    log = _text(["ffmpeg", "-nostats", "-i", str(path), "-af",
                 f"silencedetect=noise={SILENCE_DB}dB:d={MIN_SILENCE_SECONDS}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    spans, cursor = [], 0.0
    for s, e in zip(starts, ends):
        if s > cursor:
            spans.append((cursor, s))
        cursor = e
    if len(starts) > len(ends):  # file ends in silence
        if starts[-1] > cursor:
            spans.append((cursor, starts[-1]))
    elif cursor < total:
        spans.append((cursor, total))
    return spans or [(0.0, total)]


def _split_long(start: float, end: float, max_s: float) -> list[tuple[float, float]]:
    out = []
    while end - start > max_s:
        out.append((start, start + max_s))
        start += max_s
    out.append((start, end))
    return out


def split_chunks(audio: bytes, max_s: float = MAX_UTTERANCE_SECONDS) -> list[AudioChunk]:
    """16 kHz mono WAV utterances per channel, with their start time in the call."""
    chunks: list[AudioChunk] = []
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input"
        src.write_bytes(audio)
        channels = min(channel_count(src), 2)
        for ch in range(channels):
            mono = Path(tmp) / f"ch{ch}.wav"
            af = ["-af", f"pan=mono|c0=c{ch}"] if channels > 1 else ["-ac", "1"]
            _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), *af, "-ar", "16000", str(mono)])
            total = duration(mono)
            for start, end in speech_spans(mono, total):
                for s, e in _split_long(start, end, max_s):
                    if e - s < MIN_UTTERANCE_SECONDS:
                        continue
                    s0, length = max(0.0, s - PADDING_SECONDS), (e - s) + 2 * PADDING_SECONDS
                    wav = _run(["ffmpeg", "-loglevel", "error", "-ss", f"{s0:.3f}", "-t", f"{length:.3f}",
                                "-i", str(mono), "-f", "wav", "-"]).stdout
                    chunks.append(AudioChunk(channel=ch, start_ms=int(s0 * 1000), wav=wav, channels=channels))
    return chunks


def audio_duration(audio: bytes) -> float:
    """Length in seconds; raises ValueError if ffmpeg cannot read the data as audio."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input"
        src.write_bytes(audio)
        try:
            seconds = duration(src)
            channel_count(src)
        except (subprocess.CalledProcessError, ValueError) as exc:
            raise ValueError("not readable audio") from exc
    if seconds <= 0:
        raise ValueError("empty audio")
    return seconds
