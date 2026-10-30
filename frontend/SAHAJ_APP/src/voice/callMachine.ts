/**
 * What the voice-call screen shows, as a reducer over server events and the senior's taps.
 *
 * The server sends the agent's text and audio, then `turn_done` before the phone has finished
 * playing the audio, so the senior's turn only starts once playback has finished too (`settle`).
 */
import { FATAL_ERRORS, type ServerEvent } from './protocol';

export type Phase =
  | 'idle'
  | 'connecting'
  | 'agent_speaking' // the agent's line is on screen / playing
  | 'your_turn' // waiting for the senior to tap the mic
  | 'recording'
  | 'thinking' // audio sent, waiting for the agent's reply
  | 'ended'
  | 'error';

export interface CallState {
  phase: Phase;
  agentText: string;
  transcript: string;
  summary: string | null;
  error: { code: string; message: string } | null;
  playing: boolean; // agent audio still playing
  turnDone: boolean; // the server finished its turn
  ending: boolean; // the server ended the call; settle to `ended` / `error` once audio stops
}

export const initialCallState: CallState = {
  phase: 'idle',
  agentText: '',
  transcript: '',
  summary: null,
  error: null,
  playing: false,
  turnDone: false,
  ending: false,
};

export type CallAction =
  | { kind: 'server'; event: ServerEvent }
  | { kind: 'connect' }
  | { kind: 'start_recording' }
  | { kind: 'stop_recording'; sent: boolean } // sent=false: the clip was too short to send
  | { kind: 'playback_finished' }
  | { kind: 'socket_closed'; code: number }
  | { kind: 'hang_up' }
  | { kind: 'fail'; code: string; message: string }; // the call cannot start or continue

function settle(s: CallState): CallState {
  if (s.playing || s.phase === 'ended' || s.phase === 'error') return s;
  if (s.ending) return { ...s, phase: s.error ? 'error' : 'ended' };
  if (s.turnDone) return { ...s, phase: 'your_turn' };
  return s;
}

export function callReducer(s: CallState, a: CallAction): CallState {
  switch (a.kind) {
    case 'connect':
      return { ...initialCallState, phase: 'connecting' };
    case 'start_recording':
      // the senior may start as soon as the server has finished its turn, even if the audio is still playing
      return s.phase === 'your_turn' || (s.phase === 'agent_speaking' && s.turnDone)
        ? { ...s, phase: 'recording', turnDone: false, playing: false, error: null }
        : s;
    case 'stop_recording':
      if (s.phase !== 'recording') return s;
      return a.sent
        ? { ...s, phase: 'thinking' }
        : { ...s, phase: 'your_turn', turnDone: true, error: { code: 'too_short', message: 'The recording was too short.' } };
    case 'playback_finished':
      return settle({ ...s, playing: false });
    case 'fail':
      return { ...s, phase: 'error', playing: false, error: { code: a.code, message: a.message } };
    case 'hang_up':
      return { ...s, phase: 'ended', playing: false };
    case 'socket_closed':
      if (s.phase === 'ended' || s.phase === 'error') return s;
      if (s.ending) return settle({ ...s, playing: false });
      return {
        ...s,
        phase: 'error',
        playing: false,
        error: a.code === 4401
          ? { code: 'auth', message: 'Your sign-in has expired.' }
          : { code: 'connection', message: 'The connection was lost.' },
      };
    case 'server':
      return onServer(s, a.event);
  }
}

function onServer(s: CallState, e: ServerEvent): CallState {
  switch (e.type) {
    case 'ready':
      return s;
    case 'transcript':
      return { ...s, transcript: e.text };
    case 'agent_text':
      return { ...s, phase: 'agent_speaking', agentText: e.text, turnDone: false };
    case 'agent_audio':
      return { ...s, playing: true };
    case 'turn_done':
      return settle({ ...s, turnDone: true });
    case 'error':
      if (FATAL_ERRORS.has(e.code)) return { ...s, error: { code: e.code, message: e.message }, ending: true };
      // the call goes on (e.g. no audio was received): show the message and let the senior try again
      return settle({ ...s, error: { code: e.code, message: e.message }, turnDone: true });
    case 'call_end':
      return settle({ ...s, summary: e.summary, ending: true });
  }
}
