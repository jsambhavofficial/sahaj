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
}

export interface MedicationItem {
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
