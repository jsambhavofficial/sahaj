"""One voice-agent call, driven turn by turn. Synchronous on purpose: the WebSocket router runs each step in
a worker thread, and tests can drive a session without a socket.

Every method returns the list of events (dicts) to send to the client.
"""

import base64
import logging
import time
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings, today
from app.core.safety import guard_text
from app.integrations import factory
from app.modules.auth.audit import audit
from app.modules.auth.models import User
from app.modules.checkins import nlp
from app.modules.seniors.models import Senior
from app.modules.voice import agent as agent_mod
from app.modules.voice import context_builder, summarizer
from app.modules.voice import repository as repo
from app.modules.voice.models import Call
from app.modules.voice.schemas import Stage, Turn

log = logging.getLogger(__name__)

MAX_EMPTY_REPLIES = 2      # re-asks in a row before moving on
MAX_SENIOR_TURNS = 14      # hard stop for a runaway call


def _now() -> datetime:
    return datetime.now().astimezone()


class ProviderFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


class VoiceSession:
    def __init__(self, db: Session, user: User, senior: Senior, full_name: str | None, rescore):
        self.db, self.user, self.senior = db, user, senior
        self.names = [full_name] if full_name else []
        self._rescore = rescore            # callable(db, senior_id, day, reason), never raises
        self.call: Call | None = None
        self.finished = False
        self.language = senior.preferred_language
        self.history: list[Turn] = []
        self.senior_turns: list[tuple[str, list[dict]]] = []
        self.answered = 0
        self.empty_in_row = 0
        self.urgent = False
        self.total = 0
        self._turn_index = 0
        self._t0 = time.monotonic()
        self._started_at = _now()
        self.day = today()

    # ---------------------------------------------------------------- lifecycle
    def start(self, language: str | None) -> list[dict]:
        if self.call is not None:
            return [self._error("already_started", "The call has already started")]
        chosen = language or self.senior.preferred_language or "hinglish"
        # The voice engines read Devanagari properly but mangle Roman-letter Hindi, so a Hinglish senior is
        # spoken to in Hindi script (they still reply in whatever mix they like; speech-to-text returns Devanagari).
        self.language = "hindi" if chosen == "hinglish" else chosen
        self.stt, self.tts, self.llm = factory.get_stt(), factory.get_tts(), factory.get_llm()
        ctx = context_builder.build_context(self.db, self.senior, self.language, self.day,
                                            full_name=self.names[0] if self.names else None)
        self.ctx = ctx
        self.agent = agent_mod.select_agent(self.llm, self.language, ctx, self.names)
        self.total = agent_mod.question_count(self.language)
        self._started_at = _now()
        self._t0 = time.monotonic()
        self.call = repo.add_call(
            self.db, kind="ai_agent", senior_id=self.senior.senior_id, coordinator_id=self.senior.coordinator_id,
            initiated_by_user_id=self.user.id, provider="in_app", status="in_progress", started_at=self._started_at,
            language=self.language, objective="daily_wellbeing", transcript_status="pending",
            context_snapshot={"context": ctx.to_dict(), "system_prompt": f"system_{self.language}.txt",
                              "agent": self.agent.name, "questions": self.total},
            model_info={"agent": self.agent.name, "llm": type(self.llm).__name__,
                        "stt": type(self.stt).__name__, "tts": type(self.tts).__name__})
        audit(self.db, self.user, "voice_call.start", self.senior.senior_id, {"call_id": str(self.call.id)})
        self.db.commit()
        events = [{"type": "ready", "call_id": str(self.call.id)}]
        try:
            events += self._speak(self._say(Stage("opening", 0, self.total)))
        except ProviderFailure as e:
            events += self._fail(e)
        return events

    def handle_utterance(self, audio: bytes) -> list[dict]:
        if self.call is None:
            return [self._error("not_started", "Send a start message first")]
        if self.finished:
            return [self._error("call_ended", "The call has already ended")]
        if not audio:
            return [self._error("no_audio", "No audio was received for this utterance")]
        try:
            text, confidence = self._transcribe(audio)
            if not text:
                return self._handle_silence()
            self.empty_in_row = 0
            events = [{"type": "transcript", "text": text}]
            cues = nlp.extract_cues(text)
            urgent = agent_mod.detect_urgent(text, cues)
            self._record("senior", text, confidence=confidence, cues={"items": cues})
            self.senior_turns.append((text, cues))
            self.answered += 1
            if urgent:
                events += self._on_urgent()
                return events + self.finish("completed", "urgent")
            if self.answered >= self.total or len(self.senior_turns) >= MAX_SENIOR_TURNS:
                events += self._speak(self._say(Stage("goodbye", self.total, self.total)))
                return events + self.finish("completed", "finished")
            return events + self._speak(self._say(Stage("question", self.answered, self.total)))
        except ProviderFailure as e:
            return self._fail(e)

    def end_call(self) -> list[dict]:
        if self.call is None:
            return [self._error("not_started", "Send a start message first")]
        if self.finished:
            return []
        return self.finish("abandoned", "hung_up")

    def finish(self, status: str, reason: str) -> list[dict]:
        """Save everything and return the call_end event. Safe to call once; later calls do nothing."""
        if self.finished or self.call is None:
            return []
        self.finished = True
        call, db = self.call, self.db
        now = _now()
        all_cues = [c for _, cues in self.senior_turns for c in cues]
        try:
            repo.add_nlp_cues(db, call.id, call.senior_id, all_cues, nlp.EXTRACTOR_VERSION)
            facts = summarizer.update_memory(db, call, self.senior_turns, self.ctx, urgent=self.urgent,
                                             now=now, day=self.day)
            fallback = summarizer.rule_based_summary(self.language, self.answered, facts, self.ctx,
                                                     urgent=self.urgent, ended_early=status != "completed")
            transcript = [("Agent" if t.speaker == "agent" else "Senior", t.text) for t in self.history]
            call.summary = summarizer.summarize(self.llm, self.language, transcript, fallback, self.names) \
                if status != "failed" else fallback
            call.sentiment = summarizer.sentiment(all_cues, self.urgent)
            call.call_insights = {"questions_answered": self.answered, "questions_total": self.total,
                                  "urgent": self.urgent, "end_reason": reason,
                                  "cue_types": sorted({c["cue_type"] for c in all_cues if c["cue_value"] == "present"})}
            if self.senior_turns:
                repo.add_checkin(db, call, " ".join(t for t, _ in self.senior_turns), self._started_at)
        except Exception:
            log.exception("voice call post-processing failed")
            db.rollback()
            call = db.merge(call)
            call.summary = "AI wellbeing call ended; the summary could not be generated."
        call.status = status
        call.ended_at = now
        call.duration_sec = int(time.monotonic() - self._t0)
        call.transcript_status = "done"
        call.processed_at = now
        audit(db, self.user, "voice_call.end", call.senior_id,
              {"call_id": str(call.id), "status": status, "reason": reason, "urgent": self.urgent})
        db.commit()
        self._rescore(db, call.senior_id, self.day, "post_ai_call")
        return [{"type": "call_end", "call_id": str(call.id), "summary": call.summary}]

    # ---------------------------------------------------------------- one turn
    def _transcribe(self, audio: bytes) -> tuple[str, float | None]:
        try:
            segments = self.stt.transcribe(audio, self.language)
        except Exception as e:
            log.warning("STT failed: %s", type(e).__name__)
            raise ProviderFailure("stt_error", "Speech recognition is not available right now") from e
        spoken = [s for s in segments if (s.text or "").strip() and s.speaker != "coordinator"]
        text = " ".join(s.text.strip() for s in spoken)
        confs = [s.confidence for s in spoken if s.confidence is not None]
        return text, (sum(confs) / len(confs) if confs else None)

    def _handle_silence(self) -> list[dict]:
        self.empty_in_row += 1
        phrases = agent_mod.load_phrases(self.language)
        if self.empty_in_row <= MAX_EMPTY_REPLIES:
            return self._speak(phrases["retry"])
        self.empty_in_row = 0
        self.answered += 1  # move on rather than loop forever
        if self.answered >= self.total:
            return self._speak(self._say(Stage("goodbye", self.total, self.total))) + self.finish("completed", "finished")
        return self._speak(self._say(Stage("question", self.answered, self.total)))

    def _on_urgent(self) -> list[dict]:
        self.urgent = True
        self.call.urgency_flag = True
        self.db.commit()
        self._rescore(self.db, self.call.senior_id, self.day, "new_alert")
        return self._speak(agent_mod.load_phrases(self.language)["urgent"])

    def _say(self, stage: Stage) -> str:
        try:
            text = self.agent.say(stage, self.history)
        except Exception as e:
            log.warning("LLM failed: %s", type(e).__name__)
            raise ProviderFailure("llm_error", "The assistant is not available right now") from e
        return guard_text(text, agent_mod.load_phrases(self.language)["safe_fallback"])

    def _speak(self, text: str) -> list[dict]:
        """Record the agent's line and return agent_text, agent_audio and turn_done."""
        self._record("agent", text)
        events = [{"type": "agent_text", "text": text}]
        try:
            wav = self.tts.synthesize(text, self.language, get_settings().voice_agent_gender)
        except Exception as e:
            log.warning("TTS failed: %s", type(e).__name__)
            raise ProviderFailure("tts_error", "Speech output is not available right now") from e
        events.append({"type": "agent_audio", "format": "wav", "base64": base64.b64encode(wav).decode()})
        events.append({"type": "turn_done"})
        return events

    def _fail(self, failure: ProviderFailure) -> list[dict]:
        """Polite fallback line (spoken if the voice still works), error event, then end the call."""
        text = agent_mod.load_phrases(self.language)["fallback"]
        events: list[dict] = []
        if self.call is not None and not self.finished:
            self._record("agent", text)
        events.append({"type": "agent_text", "text": text})
        if failure.code != "tts_error":
            try:
                wav = self.tts.synthesize(text, self.language, get_settings().voice_agent_gender)
                events.append({"type": "agent_audio", "format": "wav", "base64": base64.b64encode(wav).decode()})
            except Exception:
                pass
        events.append(self._error(failure.code, failure.message))
        return events + self.finish("failed", failure.code)

    # ---------------------------------------------------------------- helpers
    def _record(self, speaker: str, text: str, *, confidence: float | None = None, cues: dict | None = None) -> None:
        self.history.append(Turn(speaker, text))
        repo.add_turn(self.db, self.call.id, self._turn_index, speaker, text, language=self.language,
                      offset_ms=int((time.monotonic() - self._t0) * 1000), at=_now(),
                      confidence=confidence, cues=cues)
        self._turn_index += 1
        self.db.commit()

    @staticmethod
    def _error(code: str, message: str) -> dict:
        return {"type": "error", "code": code, "message": message}
