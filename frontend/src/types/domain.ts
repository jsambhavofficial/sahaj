/**
 * Domain Models for SamarthCare AI Early Warning & Decision Support System
 * All models are strictly typed and match existing Phase 1/Phase 2 data contracts.
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "URGENT_REVIEW";

export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED";

export type PreferredLanguage = "hindi" | "hinglish" | "english";

export type LivingArrangement = "alone" | "with_spouse" | "with_family";

export interface RiskFactor {
  rule_id: string;
  category: string;
  evidence: string;
  window: string;
  points_contributed: number;
  is_safety_tripwire: boolean;
}

export interface SeniorSummary {
  senior_id: string;
  display_name: string;
  age: number;
  preferred_language: PreferredLanguage;
  city_id: string;
  living_arrangement: LivingArrangement;
  coordinator_id: string;
  expected_checkin_frequency: string;
  family_consent: boolean;
  current_risk_level: RiskLevel;
  current_risk_score: number | null;
  last_observation_date: string | null;
  active_alert_count: number;
  attention_reason?: string | null;
}

export interface SeniorBaselines {
  senior_id: string;
  baseline_bp_systolic: number;
  baseline_bp_diastolic: number;
  baseline_blood_glucose: number;
  baseline_glucose_context: string;
  baseline_spo2: number;
  baseline_weight: number;
  baseline_steps: number;
  baseline_active_minutes: number;
  baseline_sleep_hours: number;
  baseline_appetite_level: number;
  baseline_mood_level: number;
  baseline_med_adherence_tendency: number;
}

export interface VitalObservation {
  measurement_id: string;
  senior_id: string;
  timestamp: string;
  measurement_type: string;
  measurement_value: number;
  unit: string;
  measurement_context: string;
  quality_status: string;
}

export interface ActivitySummary {
  date: string;
  steps: number;
  active_minutes: number;
  sleep_hours: number;
  sleep_quality?: string;
}

export interface MedicationScheduleItem {
  schedule_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  adherence_rate_pct: number;
}

export interface CheckInSummary {
  checkin_id: string;
  date: string;
  language: PreferredLanguage;
  checkin_type: string;
  transcript_summary: string;
  sentiment?: "positive" | "neutral" | "concerning" | "negative";
  extracted_symptoms?: string[];
}

export interface DailyRiskScore {
  senior_id: string;
  date: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence_level: "LOW" | "MEDIUM" | "HIGH";
  baseline_confidence: "LOW" | "MEDIUM" | "HIGH";
  top_contributing_factors: RiskFactor[];
  recommended_action: string;
  data_quality_flags: string[];
  scoring_version: string;
}

export interface MLRiskInfluence {
  feature: string;
  influence_weight: number;
  observed_value: any;
}

export interface MLRiskSummary {
  senior_id: string;
  date: string;
  ml_available: boolean;
  ml_risk_score?: number | null;
  ml_risk_level?: RiskLevel | null;
  probability?: number | null;
  top_feature_influences: MLRiskInfluence[];
  model_version?: string | null;
  model_architecture?: string | null;
  disclaimer: string;
}

export interface SeniorProfile extends SeniorSummary {
  baselines?: SeniorBaselines | null;
  latest_risk_score?: DailyRiskScore | null;
  ml_risk?: MLRiskSummary | null;
  risk_history: DailyRiskScore[];
  recent_vitals: VitalObservation[];
  recent_activity: ActivitySummary[];
  medications: MedicationScheduleItem[];
  recent_checkins: CheckInSummary[];
  related_alerts: Alert[];
}

export interface Alert {
  alert_id: string;
  senior_id: string;
  senior_display_name?: string;
  created_at: string;
  last_updated_at: string;
  status: AlertStatus;
  severity: RiskLevel;
  triggering_signals: string;
  recommended_next_step: string;
  resolution_reason?: string | null;
  acknowledgement_notes?: string | null;
}

export interface DashboardMetrics {
  total_seniors: number;
  by_risk_level: {
    LOW: number;
    MODERATE: number;
    HIGH: number;
    URGENT_REVIEW: number;
  };
  active_alerts_count: number;
  acknowledged_alerts_count: number;
  resolved_alerts_count: number;
  escalated_alerts_count: number;
  overdue_checkins_count: number;
  is_mock_data: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  status_code?: number;
  details?: unknown;
}

