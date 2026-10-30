/**
 * The voice-agent WebSocket protocol (backend/docs/api-contract.md, section 4) as plain functions,
 * so it can be tested without a socket or a phone.
 */

export type ServerEvent =
  | { type: 'ready'; call_id: string }
  | { type: 'transcript'; text: string }
  | { type: 'agent_text'; text: string }
  | { type: 'agent_audio'; format: string; base64: string }
  | { type: 'turn_done' }
  | { type: 'call_end'; call_id: string; summary: string | null }
  | { type: 'error'; code: string; message: string };

const KNOWN = new Set(['ready', 'transcript', 'agent_text', 'agent_audio', 'turn_done', 'call_end', 'error']);

/** Parses one text frame from the server; returns null for anything that is not a known event. */
export function parseServerEvent(raw: string): ServerEvent | null {
  try {
    const data = JSON.parse(raw);
    return data && typeof data.type === 'string' && KNOWN.has(data.type) ? (data as ServerEvent) : null;
  } catch {
    return null;
  }
}

/** http(s)://host/api/v1 -> ws(s)://host/api/v1/ws/voice-agent?token=... */
export function voiceSocketUrl(apiBaseUrl: string, token: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '').replace(/^http/, 'ws');
  return `${base}/ws/voice-agent?token=${encodeURIComponent(token)}`;
}

/** Expiry (seconds since 1970) read from a JWT's payload, or null if it cannot be read. */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** True when the token is missing its expiry, already expired, or about to expire. */
export function tokenNeedsRefresh(token: string, nowSec: number = Date.now() / 1000, marginSec = 60): boolean {
  const exp = jwtExpiry(token);
  return exp === null || exp - nowSec < marginSec;
}

/** Server error codes after which the server ends the call itself. */
export const FATAL_ERRORS = new Set(['stt_error', 'llm_error', 'tts_error']);

/**
 * Approximate length in seconds of a base64 WAV, from its byte rate (header bytes 28-31) and total size.
 * Used as a safety net in case the player never reports that it finished.
 */
export function wavSeconds(base64: string): number {
  try {
    const head = atob(base64.slice(0, 48));
    const byteRate = head.charCodeAt(28) + head.charCodeAt(29) * 256 + head.charCodeAt(30) * 65536 + head.charCodeAt(31) * 16777216;
    const bytes = Math.floor((base64.length * 3) / 4);
    return byteRate > 0 ? Math.max(0, (bytes - 44) / byteRate) : 0;
  } catch {
    return 0;
  }
}
