/**
 * Pure functions that turn backend (v1 contract) responses into the shapes the screens use.
 * No React Native imports, so they can be unit tested anywhere.
 */
import type { MedicationItem, SeniorItem, VitalsState } from '../types';

const IST_OFFSET_MIN = 330;
const AVATAR_COLORS = ['#2B6CB0', '#4F46E5', '#0D6B58', '#B45309', '#9333EA', '#BE185D'];

export const ZERO_VITALS: VitalsState = { bpSystolic: 0, bpDiastolic: 0, sugar: 0, spo2: 0, pulse: 0, weight: 0 };

export const NO_SENIOR: SeniorItem = {
  senior_id: '',
  display_name: '—',
  age: 0,
  city: '',
  preferred_language: 'hindi',
  risk_score: 0,
  risk_level: 'LOW',
  avatarInitials: '–',
  avatarColor: '#94A3B8',
};

export function initialsOf(name: string): string {
  const parts = name.replace(/\bji\b/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColorOf(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ---- coordinator: the ranked "who needs attention today" list ---------------------------------
export interface TodayItemDto {
  rank: number;
  senior: { senior_id: string; display_name?: string | null; age?: number; city?: string; preferred_language?: string };
  risk_score: number;
  risk_level: SeniorItem['risk_level'];
  reasons?: string[];
  suggested_action?: string;
  alert_id?: string | null;
  ai_call_done?: boolean;
}

export function mapTodayItem(item: TodayItemDto): SeniorItem {
  const name = item.senior.display_name || item.senior.senior_id;
  return {
    senior_id: item.senior.senior_id,
    display_name: name,
    age: item.senior.age ?? 0,
    city: item.senior.city ?? '',
    preferred_language: item.senior.preferred_language ?? 'hindi',
    risk_score: item.risk_score,
    risk_level: item.risk_level,
    avatarInitials: initialsOf(name),
    avatarColor: avatarColorOf(item.senior.senior_id),
    reasons: item.reasons ?? [],
    suggested_action: item.suggested_action,
    alert_id: item.alert_id ?? null,
    ai_call_done: Boolean(item.ai_call_done),
  };
}

// ---- medicines ----------------------------------------------------------------------------------
export function doseId(medicationId: string, scheduledAt: string): string {
  return `${medicationId}|${scheduledAt}`;
}

export function parseDoseId(id: string): { medicationId: string; scheduledAt: string } {
  const i = id.indexOf('|');
  return i < 0 ? { medicationId: id, scheduledAt: '' } : { medicationId: id.slice(0, i), scheduledAt: id.slice(i + 1) };
}

/** Wall-clock hour/minute in India for an ISO timestamp, whatever offset it carries. */
export function istClock(iso: string): { hour: number; minute: number } {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { hour: 0, minute: 0 };
  const d = new Date(t + IST_OFFSET_MIN * 60000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

export function timeSlotOf(iso: string): string {
  const { hour, minute } = istClock(iso);
  const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${part} (${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'})`;
}

export function doseStatus(raw: string | undefined): MedicationItem['status'] {
  switch (raw) {
    case 'taken':
    case 'double_dose':
    case 'sos_taken':
      return 'taken';
    case 'missed':
      return 'missed';
    default:
      return 'pending'; // pending, or recorded but not confirmed ("unknown")
  }
}

export interface HomeDoseDto {
  medication_id: string;
  drug_name: string;
  dosage: string;
  scheduled_at: string;
  status?: string;
  indication?: string;
}

/** The senior's own "medicines today" list from GET /me/home. */
export function mapHomeDoses(doses: HomeDoseDto[]): MedicationItem[] {
  return doses
    .map((d) => ({
      medication_id: doseId(d.medication_id, d.scheduled_at),
      drug_name: d.drug_name,
      dosage: d.dosage,
      scheduled_at: d.scheduled_at,
      time_slot: timeSlotOf(d.scheduled_at),
      status: doseStatus(d.status),
      indication: d.indication,
    }))
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
}

export interface ScheduleDto {
  medication_id: string;
  drug_name: string;
  dosage: string;
  indication?: string;
  scheduled_times: string[]; // "08:00"
  is_active: boolean;
}
export interface MedEventDto {
  medication_id: string;
  scheduled_at: string;
  status: string;
}

/** A coordinator's view of one senior's doses for `date` (YYYY-MM-DD), joined with what was recorded. */
export function mapScheduleDoses(schedules: ScheduleDto[], events: MedEventDto[], date: string): MedicationItem[] {
  const recorded = new Map<string, string>();
  events.forEach((e) => recorded.set(`${e.medication_id}@${Date.parse(e.scheduled_at)}`, e.status));
  const items: MedicationItem[] = [];
  schedules
    .filter((s) => s.is_active)
    .forEach((s) =>
      s.scheduled_times.forEach((hhmm) => {
        const scheduledAt = `${date}T${hhmm}:00+05:30`;
        const status = recorded.get(`${s.medication_id}@${Date.parse(scheduledAt)}`);
        items.push({
          medication_id: doseId(s.medication_id, scheduledAt),
          drug_name: s.drug_name,
          dosage: s.dosage,
          scheduled_at: scheduledAt,
          time_slot: timeSlotOf(scheduledAt),
          status: doseStatus(status),
          indication: s.indication,
        });
      })
    );
  return items.sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
}

// ---- vitals -------------------------------------------------------------------------------------
export interface VitalDto {
  measured_at: string;
  measurement_type: string;
  value: number;
  quality_status?: string;
}

const VITAL_FIELD: Record<string, keyof VitalsState> = {
  blood_pressure_systolic: 'bpSystolic',
  blood_pressure_diastolic: 'bpDiastolic',
  blood_glucose: 'sugar',
  spo2: 'spo2',
  heart_rate: 'pulse',
  weight: 'weight',
};

export const VITAL_TYPE: Record<keyof VitalsState, string> = {
  bpSystolic: 'blood_pressure_systolic',
  bpDiastolic: 'blood_pressure_diastolic',
  sugar: 'blood_glucose',
  spo2: 'spo2',
  pulse: 'heart_rate',
  weight: 'weight',
};

/** Latest good reading of each kind. Faulty-device readings are ignored; missing kinds stay 0. */
export function latestVitals(vitals: VitalDto[]): VitalsState {
  const out: VitalsState = { ...ZERO_VITALS };
  const seenAt: Partial<Record<keyof VitalsState, number>> = {};
  vitals.forEach((v) => {
    const field = VITAL_FIELD[v.measurement_type];
    if (!field || v.quality_status === 'device_artifact') return;
    const at = Date.parse(v.measured_at);
    if (seenAt[field] === undefined || at > (seenAt[field] as number)) {
      seenAt[field] = at;
      out[field] = Math.round(Number(v.value) * 10) / 10;
    }
  });
  return out;
}

// ---- errors -------------------------------------------------------------------------------------
export function messageOf(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';
}

// ====================================================================================================
// Risk presentation
// ====================================================================================================
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT_REVIEW';

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High', URGENT_REVIEW: 'Urgent review',
};
const RISK_PALETTE: Record<RiskLevel, { fg: string; bg: string; stroke: string }> = {
  LOW: { fg: '#047857', bg: '#D1FAE5', stroke: '#10B981' },
  MODERATE: { fg: '#B45309', bg: '#FEF3C7', stroke: '#F59E0B' },
  HIGH: { fg: '#C2410C', bg: '#FFEDD5', stroke: '#EA580C' },
  URGENT_REVIEW: { fg: '#B91C1C', bg: '#FEE2E2', stroke: '#DC2626' },
};
export const levelLabel = (level: string): string => RISK_LABEL[level as RiskLevel] ?? level;
export const levelPalette = (level: string) => RISK_PALETTE[level as RiskLevel] ?? RISK_PALETTE.LOW;

/** Dashboard groups: what needs attention now, what to watch, and what is fine. */
export type RiskGroup = 'critical' | 'moderate' | 'low';
export const riskGroupOf = (level: string): RiskGroup =>
  level === 'URGENT_REVIEW' || level === 'HIGH' ? 'critical' : level === 'MODERATE' ? 'moderate' : 'low';

export interface RiskPoint {
  date: string;
  score: number;
  level: string;
}

export interface RiskHistoryDto {
  date: string;
  risk_score: number;
  risk_level: string;
}
export const mapRiskHistory = (rows: RiskHistoryDto[]): RiskPoint[] =>
  rows.map((r) => ({ date: r.date, score: r.risk_score, level: r.risk_level })).sort((a, b) => a.date.localeCompare(b.date));

/** Average score of the latest 7 days against the 7 before. null until there are enough days to say. */
export function riskTrend(history: RiskPoint[]): { delta: number; text: string } | null {
  if (history.length < 8) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const avg = (rows: RiskPoint[]) => rows.reduce((s, r) => s + r.score, 0) / rows.length;
  const recent = sorted.slice(-7);
  const before = sorted.slice(-14, -7);
  if (before.length === 0) return null;
  const delta = Math.round(avg(recent) - avg(before));
  if (delta === 0) return { delta, text: 'No change from last week' };
  return { delta, text: `${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'higher' : 'lower'} than last week` };
}

// ====================================================================================================
// Senior profile (GET /seniors/{id})
// ====================================================================================================
export interface SeniorDetailDto {
  gender?: string | null;
  living_arrangement?: string | null;
  conditions?: { category?: string; condition: string }[];
  baseline?: Record<string, number | string | null> | null;
}

export interface SeniorProfile {
  gender: string | null;
  living: string;
  conditions: string[];
  baseline: { sbp: number | null; dbp: number | null; sugar: number | null; spo2: number | null; weight: number | null };
}

const LIVING: Record<string, string> = {
  alone: 'Lives alone',
  with_spouse: 'Lives with spouse',
  with_domestic_help_or_family: 'Lives with family or domestic help',
  with_family: 'Lives with family',
};
export const livingLabel = (code?: string | null): string => (code ? LIVING[code] ?? code.replace(/_/g, ' ') : 'Living arrangement not recorded');

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const ACRONYMS = new Set(['chf', 'copd', 'ckd', 'mci', 'cad', 'bph', 'uti']);
const titleCase = (s: string) =>
  s.split('_').map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w)).join(' ').replace(/^./, (c) => c.toUpperCase());

export function mapProfile(d: SeniorDetailDto): SeniorProfile {
  const b = d.baseline ?? {};
  return {
    gender: d.gender ? (d.gender === 'F' ? 'Female' : d.gender === 'M' ? 'Male' : titleCase(d.gender)) : null,
    living: livingLabel(d.living_arrangement),
    conditions: (d.conditions ?? []).map((c) => titleCase(c.condition)),
    baseline: {
      sbp: num(b.sbp_median), dbp: num(b.dbp_median), sugar: num(b.glucose_fasting_median),
      spo2: num(b.spo2_median), weight: num(b.weight_kg_median),
    },
  };
}

// ====================================================================================================
// Vital readings -> chart
// ====================================================================================================
export type VitalKind = 'BP' | 'Sugar' | 'SpO2' | 'Pulse' | 'Weight';
export const VITAL_KINDS: VitalKind[] = ['BP', 'Sugar', 'SpO2', 'Pulse', 'Weight'];

const KIND: Record<VitalKind, { types: string[]; unit: string; title: string; names: [string, string?] }> = {
  BP: { types: ['blood_pressure_systolic', 'blood_pressure_diastolic'], unit: 'mmHg', title: 'Blood Pressure (mmHg)', names: ['Systolic', 'Diastolic'] },
  Sugar: { types: ['blood_glucose'], unit: 'mg/dL', title: 'Blood Sugar (mg/dL)', names: ['Sugar'] },
  SpO2: { types: ['spo2'], unit: '%', title: 'Oxygen level, SpO₂ (%)', names: ['SpO₂'] },
  Pulse: { types: ['heart_rate'], unit: 'bpm', title: 'Pulse (bpm)', names: ['Pulse'] },
  Weight: { types: ['weight'], unit: 'kg', title: 'Weight (kg)', names: ['Weight'] },
};
export const vitalKindInfo = (k: VitalKind) => KIND[k];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The calendar day (YYYY-MM-DD) of a timestamp in India. */
export function istDay(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}
export function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`.trim();
}
/** e.g. "27 Apr, 5:42 PM" in India time. */
export function formatWhen(iso: string): string {
  const { hour, minute } = istClock(iso);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${shortDay(istDay(iso))}, ${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export interface SeriesPoint {
  day: string;
  label: string;
  a: number;
  b?: number;
}

/** Daily averages of the chosen vital over the most recent `days` days that have readings. */
export function vitalSeries(vitals: VitalDto[], kind: VitalKind, days = 7): SeriesPoint[] {
  const { types } = KIND[kind];
  const byDay = new Map<string, { a: number[]; b: number[] }>();
  vitals.forEach((v) => {
    if (v.quality_status === 'device_artifact') return;
    const slot = types.indexOf(v.measurement_type);
    if (slot < 0) return;
    const day = istDay(v.measured_at);
    if (!day) return;
    const entry = byDay.get(day) ?? { a: [], b: [] };
    entry[slot === 0 ? 'a' : 'b'].push(Number(v.value));
    byDay.set(day, entry);
  });
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return Array.from(byDay.entries())
    .filter(([, e]) => e.a.length > 0)
    .sort(([x], [y]) => x.localeCompare(y))
    .slice(-days)
    .map(([day, e]) => ({
      day,
      label: shortDay(day),
      a: Math.round(mean(e.a) * 10) / 10,
      ...(types.length > 1 && e.b.length > 0 ? { b: Math.round(mean(e.b) * 10) / 10 } : {}),
    }));
}

export interface Reading {
  at: string;
  text: string;
}
/** The latest individual readings of the chosen vital, newest first. */
export function recentReadings(vitals: VitalDto[], kind: VitalKind, n = 5): Reading[] {
  const { types, unit } = KIND[kind];
  const primary = vitals
    .filter((v) => v.measurement_type === types[0] && v.quality_status !== 'device_artifact')
    .sort((x, y) => Date.parse(y.measured_at) - Date.parse(x.measured_at))
    .slice(0, n);
  return primary.map((v) => {
    let text = `${Math.round(Number(v.value) * 10) / 10}`;
    if (types.length > 1) {
      const pair = vitals.find((o) => o.measurement_type === types[1] && o.measured_at === v.measured_at);
      if (pair) text = `${text}/${Math.round(Number(pair.value) * 10) / 10}`;
    }
    return { at: formatWhen(v.measured_at), text: `${text} ${unit}` };
  });
}

export interface ChartGeometry {
  width: number;
  height: number;
  ticks: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  a: { d: string; dots: { x: number; y: number }[] };
  b: { d: string; dots: { x: number; y: number }[] } | null;
  plot: { left: number; right: number };
}

export function chartGeometry(points: SeriesPoint[], width = 320, height = 170): ChartGeometry | null {
  if (points.length === 0) return null;
  const left = 38, right = 12, top = 10, bottom = 26;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const values = points.flatMap((p) => (p.b !== undefined ? [p.a, p.b] : [p.a]));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;
  const y = (v: number) => top + plotH * (1 - (v - min) / (max - min));
  const x = (i: number) => (points.length === 1 ? left + plotW / 2 : left + (plotW * i) / (points.length - 1));
  const round = max - min > 20 ? 0 : 1;
  const ticks = [3, 2, 1, 0].map((k) => {
    const value = min + ((max - min) * k) / 3;
    return { y: y(value), label: value.toFixed(round) };
  });
  const line = (pick: (p: SeriesPoint) => number) => {
    const dots = points.map((p, i) => ({ x: x(i), y: y(pick(p)) }));
    return { d: dots.map((q, i) => `${i === 0 ? 'M' : 'L'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' '), dots };
  };
  return {
    width, height, plot: { left, right: width - right },
    ticks,
    xLabels: points.map((p, i) => ({ x: x(i), label: p.label })),
    a: line((p) => p.a),
    b: points.some((p) => p.b !== undefined) ? line((p) => p.b ?? p.a) : null,
  };
}

// ====================================================================================================
// Misc
// ====================================================================================================
export function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** Pairing codes are 6 digits; people type them with spaces or dashes, so keep only the digits (at most 6). */
export function pairingDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** "482915" -> "482 915", for reading out and for the input box. */
export function formatPairingCode(raw: string): string {
  const d = pairingDigits(raw);
  return d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
}
