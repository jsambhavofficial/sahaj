/** Calls to the Sahaj backend (v1 contract), already shaped for the screens. */
import { Platform } from 'react-native';
import { request } from './http';
import {
  ZERO_VITALS, latestVitals, mapHomeDoses, mapProfile, mapRiskHistory, mapScheduleDoses, mapTodayItem,
  parseDoseId, VITAL_TYPE,
  type HomeDoseDto, type MedEventDto, type RiskHistoryDto, type RiskPoint, type ScheduleDto,
  type SeniorDetailDto, type SeniorProfile, type TodayItemDto, type VitalDto,
} from './mappers';
import type { MedicationItem, SeniorItem, SessionUser, VitalsState } from '../types';

export interface LoginResult {
  access_token: string;
  refresh_token?: string | null;
  user: SessionUser;
  senior_id?: string;
  device_token?: string;
}

// ---- sign in -------------------------------------------------------------------------------------
export const loginWithPassword = (email: string, password: string) =>
  request<LoginResult>('/auth/login', { method: 'POST', auth: false, body: { email: email.trim(), password } });

export const pairWithCode = (pairingCode: string) =>
  request<LoginResult>('/auth/senior/pair', { method: 'POST', auth: false, body: { pairing_code: pairingCode.trim() } });

export const loginWithDevice = (seniorId: string, deviceToken: string) =>
  request<LoginResult>('/auth/senior/login', { method: 'POST', auth: false, body: { senior_id: seniorId, device_token: deviceToken } });

// ---- coordinator ---------------------------------------------------------------------------------
export interface TodayResult {
  date: string;
  seniors: SeniorItem[];
  /** Everyone in the coordinator's caseload; the ranked list can be shorter. */
  caseloadTotal: number;
}

export async function fetchToday(): Promise<TodayResult> {
  const [t, caseload] = await Promise.all([
    request<{ date: string; items: TodayItemDto[] }>('/coordinators/me/today'),
    request<{ total: number }>('/coordinators/me/seniors', { query: { limit: 1 } }),
  ]);
  return { date: t.date, seniors: t.items.map(mapTodayItem), caseloadTotal: caseload.total };
}

export interface LastCall {
  startedAt: string | null;
  status: string;
  summary: string | null;
}

export interface SeniorDetailResult {
  medications: MedicationItem[];
  vitals: VitalsState;
  /** Every reading fetched (newest ~200), for the trend charts. */
  readings: VitalDto[];
  profile: SeniorProfile;
  riskHistory: RiskPoint[];
  lastCall: LastCall | null;
}

export async function fetchSeniorDetail(seniorId: string, date: string): Promise<SeniorDetailResult> {
  const [detail, meds, readings, history, calls] = await Promise.all([
    request<SeniorDetailDto>(`/seniors/${seniorId}`),
    request<{ schedules: ScheduleDto[]; recent_events: MedEventDto[] }>(`/seniors/${seniorId}/medications`),
    request<VitalDto[]>(`/seniors/${seniorId}/vitals`, { query: { limit: 200 } }),
    request<RiskHistoryDto[]>(`/seniors/${seniorId}/risk-history`, { query: { to: date, limit: 30 } }),
    request<{ items: { started_at: string | null; status: string; summary: string | null }[] }>(`/seniors/${seniorId}/calls`, { query: { limit: 1 } }),
  ]);
  const call = calls.items[0];
  return {
    medications: mapScheduleDoses(meds.schedules, meds.recent_events, date),
    vitals: latestVitals(readings),
    readings,
    profile: mapProfile(detail),
    riskHistory: mapRiskHistory(history),
    lastCall: call ? { startedAt: call.started_at, status: call.status, summary: call.summary } : null,
  };
}

export const createPairingCode = (seniorId: string) =>
  request<{ pairing_code: string; expires_in: number }>('/auth/senior/pairing-code', { method: 'POST', body: { senior_id: seniorId } });

export async function resolveAlertWithFeedback(alertId: string, reason: string): Promise<void> {
  await request(`/alerts/${alertId}/resolve`, { method: 'POST', body: { resolution_reason: reason } });
  await request(`/alerts/${alertId}/feedback`, { method: 'POST', body: { useful: true, outcome: 'called' } });
}

export const startCoordinatorCall = (seniorId: string) =>
  request('/calls/connect', { method: 'POST', body: { senior_id: seniorId, recording_consent: true, initiator: 'coordinator' } });

// ---- senior --------------------------------------------------------------------------------------
export interface HomeResult {
  greeting: string;
  language: string;
  medications: MedicationItem[];
  /** The assigned coordinator's dialable number, or null if none is on file. */
  coordinatorPhone: string | null;
  /** The server's 'today' (YYYY-MM-DD); readings are stamped with it so they count towards today's score. */
  date: string;
}

export async function fetchHome(): Promise<HomeResult> {
  const h = await request<{ greeting_name: string; language: string; medications_today: HomeDoseDto[]; date: string; coordinator?: { phone: string | null } | null }>('/me/home');
  return { greeting: h.greeting_name, language: h.language, medications: mapHomeDoses(h.medications_today), coordinatorPhone: h.coordinator?.phone ?? null, date: h.date };
}

export function confirmDose(doseIdValue: string): Promise<{ status: string; actual_at: string }> {
  const { medicationId, scheduledAt } = parseDoseId(doseIdValue);
  return request(`/me/medications/${encodeURIComponent(medicationId)}/confirm`, { method: 'POST', body: { scheduled_at: scheduledAt } });
}

/** Local clock time in India (the server's scoring day is IST), e.g. 14:05:09. */
const istClock = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(11, 19);

/**
 * Saves readings to POST /me/vitals. They are stamped with the server's `day` so they fall inside the day
 * being scored (the demo date is not the phone's date). Only the last request asks the backend to re-score.
 */
export async function postVitals(changed: Partial<VitalsState>, day: string): Promise<void> {
  const readings = (Object.entries(changed) as [keyof VitalsState, number][]).filter(([f, v]) => v && v !== ZERO_VITALS[f]);
  for (const [i, [field, value]] of readings.entries()) {
    await request('/me/vitals', {
      method: 'POST',
      query: { rescore: i === readings.length - 1 ? 'true' : 'false' },
      body: { measurement_type: VITAL_TYPE[field], value, measured_at: `${day}T${istClock()}+05:30` },
    });
  }
}

export const postReport = (text: string, language: 'hindi' | 'english') =>
  request('/me/report', { method: 'POST', body: { text, language } });

export const startSeniorCall = () =>
  request('/me/call-coordinator', { method: 'POST', body: { recording_consent: true } });

export interface VoiceNoteResponse {
  id: string;
  senior_id: string;
  kind: string;
  audio_url?: string | null;
  transcript?: string | null;
  language: string;
  duration_sec?: number | null;
  created_at: string;
}

export async function sendSeniorVoiceNote(
  audioUri: string,
  durationSec: number,
  language: 'hindi' | 'english' | 'hinglish' = 'hindi',
  fileName: string = 'voicenote.m4a',
  mimeType: string = 'audio/m4a'
): Promise<VoiceNoteResponse> {
  const ext = audioUri.split('.').pop()?.toLowerCase();
  const validExt = ext === 'wav' ? 'wav' : ext === 'mp3' ? 'mp3' : ext === 'aac' ? 'aac' : 'm4a';
  const finalName = fileName.includes('.') ? fileName : `voicenote.${validExt}`;
  const finalType = validExt === 'wav' ? 'audio/wav' : validExt === 'mp3' ? 'audio/mpeg' : (mimeType || 'audio/m4a');

  const formData = new FormData();
  if (Platform.OS === 'web' || audioUri.startsWith('blob:') || audioUri.startsWith('data:')) {
    const res = await fetch(audioUri);
    const blob = await res.blob();
    formData.append('audio', blob, finalName);
  } else {
    formData.append('audio', {
      uri: audioUri,
      name: finalName,
      type: finalType,
    } as unknown as Blob);
  }
  formData.append('language', language);
  formData.append('duration_sec', String(Math.max(1, Math.round(durationSec))));

  return request<VoiceNoteResponse>('/me/messages', {
    method: 'POST',
    body: formData,
  });
}
