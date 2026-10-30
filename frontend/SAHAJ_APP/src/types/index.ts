export type UserRole = 'coordinator' | 'senior';
export type Language = 'hi' | 'en';

export interface SeniorItem {
  senior_id: string;
  display_name: string;
  age: number;
  gender?: string;
  city: string;
  preferred_language: string;
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT_REVIEW';
  avatarInitials: string;
  avatarColor: string;
  reasons?: string[];
  suggested_action?: string;
  /** Open alert for this senior, if any (coordinators resolve it from the call-notes screen). */
  alert_id?: string | null;
  ai_call_done?: boolean;
}

export interface MedicationItem {
  /**
   * One id per dose, not per medicine: `<medication_id>|<scheduled_at>` (see doseId in api/mappers).
   * A medicine taken twice a day is two items, and confirming one must not mark the other.
   */
  medication_id: string;
  drug_name: string;
  dosage: string;
  scheduled_at: string;
  time_slot: string;
  status: 'taken' | 'pending' | 'missed';
  indication?: string;
}

export interface VitalsState {
  bpSystolic: number;
  bpDiastolic: number;
  sugar: number;
  spo2: number;
  pulse: number;
  weight: number;
}

export interface SessionUser {
  id: string;
  role: string;
  display_name: string;
  email?: string | null;
  external_ref?: string | null;
  city?: string | null;
}

export type AuthStatus = 'booting' | 'signedOut' | 'signingIn' | 'signedIn';
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';
