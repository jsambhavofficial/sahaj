/**
 * Runs one AI wellbeing call: connects the WebSocket, records the senior's reply, plays the agent's
 * audio, and feeds everything through `callReducer`. Push-to-talk by tap: tap once to start talking,
 * tap again to send.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
  type RecordingOptions,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { API_BASE_URL } from '../api/contract';
import { ensureAccessToken } from '../api/http';
import { messageOf } from '../api/mappers';
import { callReducer, initialCallState } from './callMachine';
import { parseServerEvent, voiceSocketUrl, wavSeconds } from './protocol';

/** Mono 16 kHz AAC in an .m4a file: small to upload, and the backend converts it with ffmpeg. */
const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
};
const MIN_CLIP_MS = 600; // shorter than this is a mis-tap, not an answer
const CHUNK_BYTES = 256 * 1024;

export function useVoiceCall() {
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const recorder = useAudioRecorder(RECORDING);
  const socket = useRef<WebSocket | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const clipCount = useRef(0);
  const lastClip = useRef<File | null>(null);
  const recordStartedAt = useRef(0);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayback = useCallback(() => {
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    try {
      player.current?.pause();
    } catch {
      /* the player may already be released */
    }
  }, []);

  const playAgentAudio = useCallback((base64: string) => {
    try {
      lastClip.current?.delete();
    } catch {
      /* already gone */
    }
    const file = new File(Paths.cache, `agent-${++clipCount.current}.wav`);
    file.create({ overwrite: true });
    file.write(base64, { encoding: 'base64' });
    lastClip.current = file;
    player.current?.replace({ uri: file.uri });
    player.current?.play();
    // Safety net: some platforms never report that playback finished, which would leave the mic locked.
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    playbackTimer.current = setTimeout(() => dispatch({ kind: 'playback_finished' }), (wavSeconds(base64) + 1.5) * 1000);
  }, []);

  const start = useCallback(async () => {
    dispatch({ kind: 'connect' });
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        dispatch({ kind: 'fail', code: 'no_permission', message: 'The microphone is switched off for this app.' });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!player.current) {
        player.current = createAudioPlayer(null);
        player.current.addListener('playbackStatusUpdate', (s) => {
          if (!s.didJustFinish) return;
          if (playbackTimer.current) clearTimeout(playbackTimer.current);
          dispatch({ kind: 'playback_finished' });
        });
      }
      const token = await ensureAccessToken();
      const ws = new WebSocket(voiceSocketUrl(API_BASE_URL, token));
      socket.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'start' }));
      ws.onmessage = (m) => {
        if (typeof m.data !== 'string') return;
        const event = parseServerEvent(m.data);
        if (!event) return;
        if (event.type === 'agent_audio') {
          try {
            playAgentAudio(event.base64);
          } catch {
            // Could not play the sound; the words are still on screen, so carry on without audio.
            dispatch({ kind: 'server', event });
            dispatch({ kind: 'playback_finished' });
            return;
          }
        }
        dispatch({ kind: 'server', event });
      };
      ws.onclose = (e) => dispatch({ kind: 'socket_closed', code: e.code });
      ws.onerror = () => {};
    } catch (e) {
      dispatch({ kind: 'fail', code: 'connection', message: messageOf(e) });
    }
  }, [playAgentAudio]);

  const startTalking = useCallback(async () => {
    stopPlayback();
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordStartedAt.current = Date.now();
      dispatch({ kind: 'start_recording' });
    } catch (e) {
      dispatch({ kind: 'server', event: { type: 'error', code: 'recorder', message: messageOf(e) } });
    }
  }, [recorder, stopPlayback]);

  const stopTalking = useCallback(async () => {
    const ws = socket.current;
    try {
      const duration = Date.now() - recordStartedAt.current; // wall clock: the recorder's own figure can be 0 on some platforms
      await recorder.stop();
      const uri = recorder.uri;
      if (!ws || ws.readyState !== WebSocket.OPEN || !uri || duration < MIN_CLIP_MS) {
        dispatch({ kind: 'stop_recording', sent: false });
        return;
      }
      const bytes = await new File(uri).bytes();
      for (let i = 0; i < bytes.length; i += CHUNK_BYTES) ws.send(bytes.slice(i, i + CHUNK_BYTES));
      ws.send(JSON.stringify({ type: 'end_utterance' }));
      dispatch({ kind: 'stop_recording', sent: true });
    } catch (e) {
      dispatch({ kind: 'server', event: { type: 'error', code: 'recorder', message: messageOf(e) } });
      dispatch({ kind: 'stop_recording', sent: false });
    }
  }, [recorder]);

  const hangUp = useCallback(() => {
    stopPlayback();
    const ws = socket.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'end_call' }));
    dispatch({ kind: 'hang_up' });
    // give the server a moment to save the call, then close
    setTimeout(() => ws?.close(), 800);
  }, [stopPlayback]);

  useEffect(
    () => () => {
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
      socket.current?.close();
      try {
        if (recorder.getStatus().isRecording) void recorder.stop();
        player.current?.remove();
      } catch {
        /* already released */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { state, start, startTalking, stopTalking, hangUp };
}
