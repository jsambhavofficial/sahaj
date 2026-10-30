// Tests for the mobile app's AI voice-call logic (SAHAJ_APP/src/voice). Same pattern as mobileApp.test.ts.
import { describe, it, expect } from "vitest";
import {
  jwtExpiry, parseServerEvent, tokenNeedsRefresh, voiceSocketUrl, wavSeconds, type ServerEvent,
} from "../../../SAHAJ_APP/src/voice/protocol";
import {
  callReducer, initialCallState, type CallAction, type CallState,
} from "../../../SAHAJ_APP/src/voice/callMachine";

const server = (event: ServerEvent): CallAction => ({ kind: "server", event });
const run = (actions: CallAction[], from: CallState = initialCallState) => actions.reduce(callReducer, from);
const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("voice protocol", () => {
  it("parses known events and ignores anything else", () => {
    expect(parseServerEvent('{"type":"agent_text","text":"नमस्ते"}')).toEqual({ type: "agent_text", text: "नमस्ते" });
    expect(parseServerEvent('{"type":"mystery"}')).toBeNull();
    expect(parseServerEvent("not json")).toBeNull();
    expect(parseServerEvent("null")).toBeNull();
  });

  it("builds the socket url from the API base url", () => {
    expect(voiceSocketUrl("https://x.onrender.com/api/v1/", "a b")).toBe("wss://x.onrender.com/api/v1/ws/voice-agent?token=a%20b");
    expect(voiceSocketUrl("http://192.168.1.5:8000/api/v1", "t")).toBe("ws://192.168.1.5:8000/api/v1/ws/voice-agent?token=t");
  });

  it("reads token expiry and decides when to refresh", () => {
    expect(jwtExpiry(jwt({ exp: 2000 }))).toBe(2000);
    expect(jwtExpiry("garbage")).toBeNull();
    expect(tokenNeedsRefresh(jwt({ exp: 2000 }), 1000)).toBe(false);
    expect(tokenNeedsRefresh(jwt({ exp: 1030 }), 1000)).toBe(true); // inside the 60 s margin
    expect(tokenNeedsRefresh(jwt({ exp: 900 }), 1000)).toBe(true);
    expect(tokenNeedsRefresh("garbage", 1000)).toBe(true);
  });
});

describe("wav length estimate", () => {
  it("reads the byte rate from the header", () => {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0); header.write("WAVE", 8); header.writeUInt32LE(96000, 28); // 48 kHz, 16-bit, mono
    const wav = Buffer.concat([header, Buffer.alloc(96000 * 2)]); // 2 seconds of audio
    expect(wavSeconds(wav.toString("base64"))).toBeCloseTo(2, 1);
    expect(wavSeconds("")).toBe(0);
  });
});

describe("voice call state machine", () => {
  const greeting: CallAction[] = [
    { kind: "connect" },
    server({ type: "ready", call_id: "c1" }),
    server({ type: "agent_text", text: "Namaste" }),
    server({ type: "agent_audio", format: "wav", base64: "AA==" }),
    server({ type: "turn_done" }),
  ];

  it("waits for the audio to finish before the senior's turn", () => {
    let s = run(greeting);
    expect(s.phase).toBe("agent_speaking");
    expect(s.agentText).toBe("Namaste");
    s = callReducer(s, { kind: "playback_finished" });
    expect(s.phase).toBe("your_turn");
  });

  it("goes your_turn -> recording -> thinking -> next agent line", () => {
    let s = run([...greeting, { kind: "playback_finished" }, { kind: "start_recording" }]);
    expect(s.phase).toBe("recording");
    s = callReducer(s, { kind: "stop_recording", sent: true });
    expect(s.phase).toBe("thinking");
    s = run([
      server({ type: "transcript", text: "theek hoon" }),
      server({ type: "agent_text", text: "Khana khaya?" }),
      server({ type: "agent_audio", format: "wav", base64: "AA==" }),
      server({ type: "turn_done" }),
      { kind: "playback_finished" },
    ], s);
    expect(s).toMatchObject({ phase: "your_turn", transcript: "theek hoon", agentText: "Khana khaya?" });
  });

  it("returns to the senior's turn when the clip was too short to send", () => {
    const s = run([...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: false }]);
    expect(s.phase).toBe("your_turn");
  });

  it("cannot start recording until the server has finished its turn", () => {
    const early = run(greeting.slice(0, 4)); // text + audio, no turn_done yet
    expect(callReducer(early, { kind: "start_recording" }).phase).toBe("agent_speaking");
  });

  it("can start recording once the server is done, even if the audio is still playing", () => {
    expect(run([...greeting, { kind: "start_recording" }]).phase).toBe("recording");
  });

  it("a clip that was too short says so instead of silently resetting", () => {
    const s = run([...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: false }]);
    expect(s).toMatchObject({ phase: "your_turn", error: { code: "too_short" } });
  });

  it("ends only after the goodbye has been played, keeping the summary", () => {
    let s = run([
      ...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: true },
      server({ type: "agent_text", text: "Dhanyavaad" }),
      server({ type: "agent_audio", format: "wav", base64: "AA==" }),
      server({ type: "turn_done" }),
      server({ type: "call_end", call_id: "c1", summary: "All well" }),
    ]);
    expect(s.phase).toBe("agent_speaking");
    s = callReducer(s, { kind: "playback_finished" });
    expect(s).toMatchObject({ phase: "ended", summary: "All well" });
  });

  it("a recoverable error keeps the call going", () => {
    const s = run([
      ...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: true },
      server({ type: "error", code: "no_audio", message: "No audio was received" }),
    ]);
    expect(s.phase).toBe("your_turn");
    expect(s.error?.code).toBe("no_audio");
    expect(callReducer(s, { kind: "start_recording" }).error).toBeNull();
  });

  it("a provider failure plays the apology, then shows the error", () => {
    let s = run([
      ...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: true },
      server({ type: "agent_text", text: "Maaf kijiye" }),
      server({ type: "agent_audio", format: "wav", base64: "AA==" }),
      server({ type: "error", code: "stt_error", message: "Speech recognition is not available" }),
      server({ type: "call_end", call_id: "c1", summary: "ended early" }),
    ]);
    expect(s.phase).toBe("agent_speaking");
    s = callReducer(s, { kind: "playback_finished" });
    expect(s.phase).toBe("error");
    expect(s.error?.code).toBe("stt_error");
  });

  it("a provider failure with no audio goes straight to the error", () => {
    const s = run([
      ...greeting, { kind: "playback_finished" }, { kind: "start_recording" }, { kind: "stop_recording", sent: true },
      server({ type: "agent_text", text: "Maaf kijiye" }),
      server({ type: "error", code: "tts_error", message: "Speech output is not available" }),
      server({ type: "call_end", call_id: "c1", summary: null }),
    ]);
    expect(s.phase).toBe("error");
  });

  it("maps a dropped connection to an error, and 4401 to a sign-in problem", () => {
    expect(run([{ kind: "connect" }, { kind: "socket_closed", code: 1006 }]).error?.code).toBe("connection");
    expect(run([{ kind: "connect" }, { kind: "socket_closed", code: 4401 }]).error?.code).toBe("auth");
  });

  it("a normal close after the call ended changes nothing", () => {
    const ended = run([...greeting, { kind: "playback_finished" }, { kind: "hang_up" }]);
    expect(callReducer(ended, { kind: "socket_closed", code: 1000 })).toEqual(ended);
  });

  it("fail goes straight to the error screen", () => {
    const s = run([{ kind: "connect" }, { kind: "fail", code: "no_permission", message: "off" }]);
    expect(s).toMatchObject({ phase: "error", error: { code: "no_permission" } });
  });
});
