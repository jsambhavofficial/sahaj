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
}

export async function fetchHome(): Promise<HomeResult> {
  const h = await request<{ greeting_name: string; language: string; medications_today: HomeDoseDto[] }>('/me/home');
  return { greeting: h.greeting_name, language: h.language, medications: mapHomeDoses(h.medications_today) };
}

export function confirmDose(doseIdValue: string): Promise<{ status: string; actual_at: string }> {
  const { medicationId, scheduledAt } = parseDoseId(doseIdValue);
  return request(`/me/medications/${encodeURIComponent(medicationId)}/confirm`, { method: 'POST', body: { scheduled_at: scheduledAt } });
}

export async function postVitals(changed: Partial<VitalsState>): Promise<void> {
  for (const [field, value] of Object.entries(changed) as [keyof VitalsState, number][]) {
    if (!value || value === ZERO_VITALS[field]) continue;
    await request('/me/vitals', { method: 'POST', body: { measurement_type: VITAL_TYPE[field], value } });
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


// ---- notifications & device push tokens --------------------------------------------------
export interface AppNotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduled_for?: string;
  sent_at?: string;
  read_at?: string | null;
}

export const getNotifications = (unreadOnly: boolean = false) =>
  request<{ items: AppNotificationItem[]; total: number }>(/notifications?unread=);

export const markNotificationRead = (id: string) =>
  request<{ ok: boolean }>(/notifications//read, { method: 'POST' });

export const markAllNotificationsRead = () =>
  request<{ ok: boolean; marked_count: number }>('/notifications/read-all', { method: 'POST' });

export const registerMobileDevice = (token: string, platform: 'android' | 'ios' = 'android') =>
  request<{ id: string; platform: string }>('/devices', {
    method: 'POST',
    body: { platform, token, app_version: '2.0.0-mobile' },
  });
