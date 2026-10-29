/**
 * API Contracts matching FastAPI Backend (src/api/schemas.py)
 */

import { RiskFactor } from "./domain";

export interface ApiHealthResponse {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export interface ApiSeniorProfileSummary {
  senior_id: string;
  name?: string | null;
  age: number;
  preferred_language: string;
  city_id: string;
  living_arrangement: string;
  coordinator_id: string;
  expected_checkin_frequency: string;
  family_consent: boolean;
  current_risk_level?: string | null;
  current_risk_score?: number | null;
  last_observation_date?: string | null;
  active_alert_count?: number | null;
}

export interface ApiSeniorBaselines {
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

export interface ApiMLRiskResponse {
  senior_id: string;
  date: string;
  ml_available: boolean;
  ml_risk_score?: number | null;
  ml_risk_level?: string | null;
  probability?: number | null;
  top_feature_influences: Array<{
    feature: string;
    influence_weight: number;
    observed_value: any;
  }>;
  model_version?: string | null;
  model_architecture?: string | null;
  disclaimer: string;
}

export interface ApiSeniorProfileDetail extends ApiSeniorProfileSummary {
  baselines?: ApiSeniorBaselines | null;
  latest_risk_score?: ApiDailyRiskScoreResponse | null;
  ml_risk?: ApiMLRiskResponse | null;
  active_alerts: ApiAlertResponse[];
}

export interface ApiDailyRiskScoreResponse {
  senior_id: string;
  date: string;
  risk_score: number;
  risk_level: string;
  confidence_level: string;
  baseline_confidence: string;
  top_contributing_factors: RiskFactor[];
  recommended_action: string;
  data_quality_flags: string[];
  scoring_version: string;
}

export interface ApiAlertResponse {
  alert_id: string;
  senior_id: string;
  created_at: string;
  last_updated_at: string;
  status: string;
  severity: string;
  triggering_signals: string;
  recommended_next_step: string;
  resolution_reason?: string | null;
}

export interface ApiAlertAcknowledgeRequest {
  coordinator_id: string;
  notes?: string;
}

export interface ApiAlertResolveRequest {
  coordinator_id: string;
  resolution_reason: string;
}

export interface SeniorFilterParams {
  search?: string;
  risk_level?: string;
  city_id?: string;
  coordinator_id?: string;
  sort_by?: "risk_score" | "senior_id" | "age" | "last_observation_date";
  sort_direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface AlertFilterParams {
  status?: string;
  severity?: string;
  senior_id?: string;
  search?: string;
}

// -----------------------------------------------------------------------------
// Phase 3 Multi-Role & Operational Types
// -----------------------------------------------------------------------------

export interface StaffProfileInfo {
  employee_code: string;
  city_id?: string | null;
  specialization?: string | null;
  on_duty_status: string;
  max_active_cases: number;
}

export interface UserPublicProfile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: "ORGANIZATION_ADMIN" | "CITY_MANAGER" | "CARETAKER" | "SENIOR" | "FAMILY";
  is_active: boolean;
  is_verified: boolean;
  staff_profile?: StaffProfileInfo | null;
}

export interface CitySummary {
  city_id: string;
  name: string;
  tier: number;
  state: string;
  senior_count: number;
  caretaker_count: number;
  open_alerts_count: number;
  is_active: boolean;
}

export interface CityDetail {
  city_id: string;
  name: string;
  tier: number;
  state: string;
  is_active: boolean;
  managers: Array<{ user_id: string; full_name: string; email: string; employee_code: string }>;
  caretakers: Array<{ user_id: string; full_name: string; email: string; employee_code: string; on_duty_status: string }>;
  senior_count: number;
  open_alerts_count: number;
}

export interface StaffDetail {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  city_id?: string | null;
  city_name?: string | null;
  employee_code?: string | null;
  specialization?: string | null;
  on_duty_status?: string | null;
  active_cases_count: number;
}

export interface OperationalAlertItem {
  alert_id: string;
  senior_id: string;
  senior_name?: string | null;
  city_id?: string | null;
  severity: string;
  status: string;
  triggering_signals?: string | null;
  recommended_next_step?: string | null;
  created_at: string;
  last_updated_at: string;
  acknowledged_by?: string | null;
  resolved_by?: string | null;
  resolution_reason?: string | null;
}

export interface AdminDashboardMetrics {
  total_active_seniors: number;
  total_active_cities: number;
  total_active_caretakers: number;
  total_city_managers: number;
  open_alerts_count: number;
  unassigned_alerts_count: number;
  alerts_by_severity: Record<string, number>;
  cities_summary: CitySummary[];
  recent_alerts: OperationalAlertItem[];
  visits_scheduled_today: number;
  visits_completed_today: number;
  visits_status_note: string;
}

export interface CaretakerCaseload {
  caretaker_id: string;
  caretaker_name: string;
  email: string;
  employee_code: string;
  on_duty_status: string;
  active_senior_count: number;
}

export interface CityManagerDashboard {
  city_id: string;
  city_name: string;
  state: string;
  active_seniors_count: number;
  caretakers_count: number;
  open_alerts_count: number;
  alerts_by_severity: Record<string, number>;
  recent_alerts: OperationalAlertItem[];
  caretakers_caseload: CaretakerCaseload[];
  visits_scheduled_today: number;
  visits_completed_today: number;
  visits_status_note: string;
}

export interface ReportsSummary {
  seniors_by_city: Record<string, number>;
  seniors_by_risk_tier: Record<string, number>;
  staff_by_role: Record<string, number>;
  alerts_by_severity: Record<string, number>;
  alerts_by_status: Record<string, number>;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id?: string | null;
  action: string;
  target_entity_type: string;
  target_entity_id: string;
  before_state?: string | null;
  after_state?: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Phase 4 Caretaker Portal & Visit Management Types
// -----------------------------------------------------------------------------

export interface CareTaskItem {
  id: string;
  senior_id: string;
  visit_id?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  due_date: string;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  completion_notes?: string | null;
  incomplete_reason?: string | null;
}

export interface VisitObservationItem {
  id: string;
  visit_id: string;
  observation_type: string;
  numeric_value?: number | null;
  text_value?: string | null;
  flag_status: string;
  notes?: string | null;
  recorded_at: string;
  recorded_by_user_id?: string | null;
}

export interface VisitConcernItem {
  id: string;
  visit_id: string;
  senior_id: string;
  caretaker_user_id: string;
  category: string;
  severity: string;
  description: string;
  follow_up_needed: boolean;
  status: string;
  created_at: string;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  resolution_notes?: string | null;
}

export interface VisitSummaryItem {
  id: string;
  caretaker_user_id: string;
  caretaker_name?: string | null;
  senior_id: string;
  senior_name?: string | null;
  senior_city_id?: string | null;
  senior_address?: string | null;
  senior_phone?: string | null;
  senior_emergency_phone?: string | null;
  visit_type: string;
  visit_purpose?: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  completion_outcome?: string | null;
  summary_notes?: string | null;
  cancellation_reason?: string | null;
  follow_up_required: boolean;
  task_count: number;
  completed_task_count: number;
  concern_count: number;
}

export interface VisitDetailResponse {
  id: string;
  caretaker_user_id: string;
  caretaker_name?: string | null;
  senior_id: string;
  senior_name: string;
  senior_age: number;
  senior_city_id: string;
  senior_address?: string | null;
  senior_pin_code?: string | null;
  senior_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  baseline_risk_tier: string;
  living_arrangement: string;
  preferred_language: string;
  visit_type: string;
  visit_purpose?: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  geofence_verified: boolean;
  completion_outcome?: string | null;
  summary_notes?: string | null;
  cancellation_reason?: string | null;
  follow_up_required: boolean;
  created_at: string;
  updated_at: string;
  tasks: CareTaskItem[];
  observations: VisitObservationItem[];
  concerns: VisitConcernItem[];
}

export interface CaretakerScheduleResponse {
  total_assigned_today: number;
  completed_today: number;
  in_progress_today: number;
  pending_today: number;
  active_visit_id?: string | null;
  visits: VisitSummaryItem[];
}

export interface AssignedSeniorProfile {
  senior_id: string;
  name: string;
  age: number;
  city_id: string;
  primary_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  address?: string | null;
  baseline_risk_tier: string;
  living_arrangement: string;
  assignment_role: string;
}

export interface SeniorDirectoryItem {
  senior_id: string;
  name: string;
  age: number;
  city_id: string;
  preferred_language: string;
  living_arrangement: string;
  expected_checkin_frequency: string;
  family_consent: boolean;
  baseline_risk_tier: string;
}

// -----------------------------------------------------------------------------
// Phase 5 AI Risk Engine, Intelligent Alerts & Workflow Types
// -----------------------------------------------------------------------------

export interface RiskAssessmentResponse {
  id: string;
  senior_id: string;
  senior_name?: string | null;
  city_id?: string | null;
  assessment_date: string;
  observation_window?: string | null;
  rule_score: number;
  rule_category: string;
  ml_probability?: number | null;
  ml_risk_score?: number | null;
  ml_risk_level?: string | null;
  model_version?: string | null;
  model_architecture?: string | null;
  is_safety_tripwire: boolean;
  top_contributing_factors: Array<Record<string, any>>;
  top_feature_influences: Array<Record<string, any>>;
  data_quality_flags: string[];
  recommended_action: string;
  status: string;
  status_reason?: string | null;
  trigger_source: string;
  alert_id?: string | null;
  created_at: string;
  disclaimer: string;
}

export interface RiskAssessmentHistoryItem {
  id: string;
  senior_id: string;
  assessment_date: string;
  rule_score: number;
  rule_category: string;
  ml_probability?: number | null;
  ml_risk_score?: number | null;
  is_safety_tripwire: boolean;
  status: string;
  trigger_source: string;
  created_at: string;
}

export interface FollowUpTaskItem {
  id: string;
  alert_id: string;
  assigned_to_user_id: string;
  assigned_to_name?: string | null;
  action_type: string;
  status: string;
  notes?: string | null;
  outcome_notes?: string | null;
  due_at: string;
  completed_at?: string | null;
  created_at: string;
}

export interface AlertDetailExtendedResponse {
  id: string;
  senior_id: string;
  senior_name?: string | null;
  senior_city_id?: string | null;
  senior_address?: string | null;
  senior_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  severity: string;
  status: string;
  triggering_signals?: string | null;
  recommended_next_step?: string | null;
  assessment_id?: string | null;
  assessment?: RiskAssessmentResponse | null;
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  follow_up_required: boolean;
  follow_up_notes?: string | null;
  follow_up_tasks: FollowUpTaskItem[];
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  acknowledgement_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_reason?: string | null;
  created_at: string;
  last_updated_at: string;
}

export interface WellbeingCheckInResponse {
  id: string;
  senior_id: string;
  submitted_by_user_id: string;
  mood_score?: number | null;
  pain_level?: number | null;
  sleep_hours?: number | null;
  dietary_intake?: string | null;
  freeform_comment?: string | null;
  assessment_id?: string | null;
  created_at: string;
}

// ==========================================
// Phase 6: Family Portal & Care Transparency
// ==========================================

export interface FamilySeniorSummary {
  senior_id: string;
  name: string;
  age: number;
  city_name: string;
  relationship_type: string;
  permission_tier: string;
  authorization_status: string;
  granted_at: string;
  has_active_consent: boolean;
}

export interface FamilyUserProfileResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone_number?: string | null;
  linked_seniors: FamilySeniorSummary[];
}

export interface FamilyVisitSummary {
  id: string;
  visit_type: string;
  visit_purpose?: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  assigned_caretaker_name?: string | null;
  family_summary?: string | null;
  completion_outcome?: string | null;
}

export interface FamilyCheckInSummary {
  id: string;
  checkin_date: string;
  overall_status: string;
  reported_mood?: string | null;
  reported_pain?: string | null;
  sleep_hours?: number | null;
  meal_nutrition_status?: string | null;
  factual_notes?: string | null;
}

export interface FamilyUpdateSummary {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  message: string;
  status: string;
  action_taken?: string | null;
}

export interface FamilyCareTeamContact {
  city_name: string;
  office_phone: string;
  support_email: string;
  hours: string;
}

export interface FamilyCareSummaryResponse {
  senior_id: string;
  name: string;
  age: number;
  city_name: string;
  living_arrangement?: string | null;
  care_status: string;
  next_scheduled_visit?: FamilyVisitSummary | null;
  latest_completed_visit?: FamilyVisitSummary | null;
  latest_wellbeing_checkin?: FamilyCheckInSummary | null;
  recent_updates: FamilyUpdateSummary[];
  care_team_contact: FamilyCareTeamContact;
  disclaimer: string;
}

export interface CallbackCreateRequest {
  senior_id: string;
  category: string;
  preferred_contact_method: string;
  message: string;
}

export interface CallbackResponse {
  id: string;
  senior_id: string;
  senior_name: string;
  family_user_id: string;
  family_user_name: string;
  category: string;
  preferred_contact_method: string;
  message: string;
  status: string;
  assigned_to_user_name?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallbackUpdateRequest {
  status?: string | null;
  assigned_to_user_id?: string | null;
  resolution_notes?: string | null;
}

export interface FamilyLinkCreateRequest {
  family_user_id: string;
  senior_id: string;
  relationship_type: string;
  permission_tier?: string;
}

export interface FamilyUnlinkSelfRequest {
  reason?: string;
}

// ----------------------------------------------------------------------------
// Phase 7 Senior Citizen Portal Types
// ----------------------------------------------------------------------------

export interface SeniorVisitItem {
  id: string;
  visit_type: string;
  visit_purpose?: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  caretaker_name?: string | null;
  senior_summary?: string | null;
  completion_outcome?: string | null;
}

export interface SeniorCheckInItem {
  id: string;
  checkin_date: string;
  general_wellbeing?: string | null;
  general_wellbeing_label: string;
  concern_categories: string[];
  change_from_usual?: string | null;
  help_requested: boolean;
  notes?: string | null;
  mood_score?: number | null;
  pain_level?: number | null;
  follow_up_status?: string | null;
}

export interface SeniorCareTeamSummary {
  city_name: string;
  coordinator_name?: string | null;
  office_phone: string;
  support_email: string;
  hours: string;
}

export interface SeniorDashboardResponse {
  senior_id: string;
  senior_name: string;
  age: number;
  city_name: string;
  living_arrangement: string;
  preferred_language: string;
  next_scheduled_visit?: SeniorVisitItem | null;
  latest_completed_visit?: SeniorVisitItem | null;
  latest_checkin?: SeniorCheckInItem | null;
  care_team: SeniorCareTeamSummary;
  pending_help_requests_count: number;
  today_status_message: string;
  disclaimer: string;
}

export interface SeniorCheckInSubmissionRequest {
  general_wellbeing: string;
  concern_categories?: string[];
  change_from_usual?: string | null;
  help_requested?: boolean;
  freeform_notes?: string | null;
  mood_score?: number | null;
  pain_level?: number | null;
  sleep_hours?: number | null;
  idempotency_key?: string | null;
}

export interface SeniorCheckInSubmissionResponse {
  id: string;
  senior_id: string;
  submission_time: string;
  general_wellbeing: string;
  general_wellbeing_label: string;
  concern_categories: string[];
  help_requested: boolean;
  callback_request_id?: string | null;
  status: string;
  confirmation_message: string;
}

export interface SeniorHelpCreateRequest {
  category: string;
  preferred_contact_method?: string;
  message: string;
  idempotency_key?: string | null;
}

export interface SeniorProfileResponse {
  senior_id: string;
  user_id: string;
  name: string;
  age: number;
  city_name: string;
  preferred_language: string;
  living_arrangement: string;
  address?: string | null;
  primary_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  has_active_dpdp_consent: boolean;
  authorized_family_members: Array<{
    link_id: string;
    family_user_id: string;
    family_member_name: string;
    relationship_type: string;
    is_active: boolean;
    linked_at: string;
  }>;
}

export interface SeniorProfileUpdateRequest {
  preferred_language?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

// =============================================================================
// SamarthCare AI — API Contract (v1) Typed Definitions
// =============================================================================

export type ContractRole = "coordinator" | "senior" | "ops" | "admin" | "family";
export type ContractRiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "URGENT_REVIEW"
  | "urgent"
  | "high"
  | "rising"
  | "stable"
  | string;
export type ContractAlertStatus = "OPEN" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED";
export type ContractAlertSeverity = "MODERATE" | "HIGH" | "URGENT_REVIEW";
export type ContractFeedbackOutcome = "called" | "visited" | "doctor" | "no_action";
export type ContractLanguage = "hindi" | "hinglish" | "english";
export type ContractConsentLevel = "full" | "summary_and_urgent" | "urgent_only";
export type ContractLivingArrangement = "alone" | "with_spouse" | "with_domestic_help_or_family";
export type ContractCallKind = "ai_agent" | "phone_bridge";
export type ContractCallStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "abandoned"
  | "failed"
  | "declined"
  | "no_answer"
  | "busy";
export type ContractTranscriptStatus = "pending" | "done" | "failed" | "not_applicable";
export type ContractSpeaker = "agent" | "senior" | "coordinator";
export type ContractMedicationStatus = "taken" | "missed" | "unknown" | "pending";
export type ContractVitalMeasurementType =
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic"
  | "blood_glucose"
  | "spo2"
  | "weight"
  | "heart_rate"
  | "temperature";
export type ContractNotificationKind =
  | "medication_reminder"
  | "checkin_prompt"
  | "alert_new"
  | "alert_escalated"
  | "priority_list_updated"
  | "message_received"
  | "call_summary_ready";
export type ContractPlatform = "android" | "ios" | "web";

export interface ContractError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message?: string }> | unknown;
  };
}

export interface ContractUser {
  id: string;
  role: ContractRole | string;
  display_name: string;
  email: string;
  external_ref?: string;
  city?: string;
  team_id?: string;
}

export interface ContractAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: ContractUser;
}

export interface ContractSeniorPairingCodeResponse {
  pairing_code: string;
  expires_in: number;
}

export interface ContractSeniorPairResponse extends ContractAuthLoginResponse {
  senior_id: string;
  device_token: string;
}

export interface ContractDeviceResponse {
  id: string;
  platform: ContractPlatform | string;
  app_version?: string;
  created_at: string;
}

export interface ContractPaginatedList<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Section 3: Coordinator App
export interface PriorityListSenior {
  senior_id: string;
  display_name: string;
  age: number;
  city: string;
  preferred_language: ContractLanguage | string;
}

export interface PriorityListItem {
  rank: number;
  previous_rank?: number | null;
  senior: PriorityListSenior;
  risk_score: number;
  risk_level: ContractRiskLevel;
  reasons: string[];
  suggested_action: string;
  alert_id?: string | null;
  ai_call_done: boolean;
}

export interface PriorityListResponse {
  date: string;
  revision: number;
  reason: string;
  generated_at: string;
  items: PriorityListItem[];
}

export interface CoordinatorCaseloadItem {
  senior_id: string;
  display_name: string;
  age: number;
  city: string;
  preferred_language: ContractLanguage | string;
  living_arrangement: ContractLivingArrangement | string;
  risk_score: number | null;
  risk_level: ContractRiskLevel | null;
  open_alert_id?: string | null;
  last_contact_at?: string | null;
}

export interface ContractSeniorDetail {
  senior_id: string;
  display_name: string;
  age: number;
  gender?: string;
  city: string;
  living_arrangement: ContractLivingArrangement | string;
  preferred_language: ContractLanguage | string;
  communication_style?: string;
  family_consent_level?: ContractConsentLevel | string;
  conditions?: Array<{ category: string; condition: string }>;
  health_profile?: {
    cognitive_status?: string;
    fall_risk_level?: string;
    mobility_aid?: string;
    hobbies?: string[];
    [key: string]: any;
  };
  baseline?: Record<string, any>;
  contact?: { phone?: string };
}

export interface ContractRiskHistoryItem {
  date: string;
  risk_score: number;
  risk_level: ContractRiskLevel;
  top_factors: Array<{
    rule_id: string;
    category: string;
    evidence: string;
    window: string;
    points_contributed: number;
    is_safety_tripwire: boolean;
  }>;
  recommended_action: string;
  scoring_version?: string;
}

export interface ContractVitalItem {
  measurement_id: string;
  measured_at: string;
  measurement_type: ContractVitalMeasurementType | string;
  value: number;
  unit: string;
  context?: string;
  source?: string;
  quality_status?: string;
}

export interface ContractMedicationScheduleItem {
  medication_id: string;
  drug_name: string;
  dosage: string;
  indication: string;
  times_per_day: number;
  scheduled_times: string[];
  criticality: string;
  is_active: boolean;
}

export interface ContractMedicationHistoryEvent {
  scheduled_at: string;
  status: ContractMedicationStatus;
  actual_at?: string | null;
  record_source?: string;
}

export interface ContractMedicationsResponse {
  schedules: ContractMedicationScheduleItem[];
  adherence: {
    last_7d_pct: number;
    last_30d_pct: number;
    missed_critical_7d: number;
  };
  recent_events: ContractMedicationHistoryEvent[];
}

export interface ContractActivityItem {
  date: string;
  steps: number;
  active_minutes: number;
  sleep_hours: number;
  appetite_level: number;
  mood_level: number;
  social_contact_count: number;
  data_available: boolean;
}

export interface ContractCallTurn {
  turn_index: number;
  speaker: ContractSpeaker;
  text: string;
  offset_ms: number;
}

export interface ContractCallCue {
  cue_type: string;
  cue_value: string;
  temporal_context?: string;
  negated?: boolean;
  uncertain?: boolean;
}

export interface ContractCallObject {
  id: string;
  senior_id: string;
  kind: ContractCallKind;
  status: ContractCallStatus;
  transcript_status: ContractTranscriptStatus;
  started_at?: string | null;
  ended_at?: string | null;
  duration_sec?: number | null;
  recording_stored: boolean;
  recording_expires_at?: string | null;
  summary?: string | null;
  urgency_flag: boolean;
  turns: ContractCallTurn[];
  cues: ContractCallCue[];
}

export interface ContractCueRecord {
  cue_type: string;
  cue_value: string;
  temporal_context?: string;
  negated?: boolean;
  uncertain?: boolean;
  source_type?: string;
  at: string;
}

export interface ContractMemoryItem {
  id: string;
  kind: string;
  content: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  follow_up_after?: string | null;
}

export interface ContractFamilyInteractionItem {
  interaction_id: string;
  at: string;
  channel: string;
  category: string;
  family_message: string;
  coordinator_reply_en?: string | null;
  counselor_summary?: string | null;
  suggested_action?: string | null;
  escalation_needed: boolean;
}

export interface ContractAlertEvent {
  at: string;
  from_status: ContractAlertStatus;
  to_status: ContractAlertStatus;
  actor: string;
  note?: string | null;
}

export interface ContractAlertObject {
  alert_id: string;
  senior_id: string;
  status: ContractAlertStatus;
  severity: ContractAlertSeverity;
  created_at: string;
  last_updated_at: string;
  triggering_signals: string[];
  recommended_next_step: string;
  resolution_reason?: string | null;
  assigned_to?: string | null;
  events: ContractAlertEvent[];
}

export interface ContractAlertFeedbackRequest {
  useful: boolean;
  outcome: ContractFeedbackOutcome;
  comment?: string;
}

export interface ContractMessageSender {
  user_id: string;
  role: ContractRole | string;
  display_name: string;
}

export interface ContractMessageItem {
  id: string;
  senior_id: string;
  sender: ContractMessageSender;
  kind: "text" | "voice_note";
  body: string;
  audio_url?: string;
  transcript?: string;
  summary?: string;
  language?: ContractLanguage | string;
  created_at: string;
  delivered_at?: string;
  read_at?: string | null;
}

export interface ContractNotificationItem {
  id: string;
  kind: ContractNotificationKind | string;
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduled_for?: string;
  sent_at?: string;
  read_at?: string | null;
}

// Section 4: Senior App
export interface SeniorMedicationToday {
  medication_id: string;
  drug_name: string;
  dosage: string;
  scheduled_at: string;
  status: ContractMedicationStatus;
}

export interface SeniorHomeResponse {
  greeting_name: string;
  language: ContractLanguage | string;
  date: string;
  medications_today: SeniorMedicationToday[];
  last_message?: ContractMessageItem | null;
  next_checkin?: {
    at: string;
    kind: "ai_call" | "visit" | "phone_call" | string;
  } | null;
}

// Section 5: Ops Web Dashboard
export interface OpsOverviewResponse {
  open_alerts: number;
  alerts_in_range: number;
  median_minutes_to_ack: number | null;
  median_minutes_to_resolve: number | null;
  useful_share: number | null;
  ai_call_completion_rate: number;
  seniors_covered: number;
  seniors_total: number;
}

export interface OpsAlertVolumeItem {
  day: string;
  city: string;
  severity: ContractAlertSeverity;
  status: ContractAlertStatus;
  alerts: number;
}

export interface OpsResponseTimesItem {
  alert_id: string;
  city: string;
  coordinator_id: string;
  severity: ContractAlertSeverity;
  created_at: string;
  minutes_to_ack: number | null;
  minutes_to_resolve: number | null;
}

export interface OpsAlertOutcomesItem {
  city: string;
  resolution_reason: string;
  useful: boolean | null;
  outcome: ContractFeedbackOutcome | null;
  alerts: number;
}

export interface OpsAlertPrecisionItem {
  city: string;
  week_start: string;
  rated_alerts: number;
  useful_alerts: number;
  precision: number | null;
}

export interface OpsCoordinatorItem {
  coordinator_id: string;
  display_name: string;
  city: string;
  caseload: number;
  open_alerts: number;
  alerts_handled: number;
  calls: number;
  messages_sent: number;
}

export interface OpsCityItem {
  city: string;
  seniors: number;
  coordinators: number;
  open_alerts: number;
  avg_risk: number;
  high_risk_count: number;
}

export interface OpsDailyReportItem {
  coordinator: {
    coordinator_id: string;
    display_name: string;
    city: string;
  };
  items: PriorityListItem[];
}

export interface AdminJobRunResponse {
  job: string;
  date?: string;
  status: string;
  job_name?: string;
  triggered_at?: string;
  task_id?: string;
}

// Section 6: Family
export interface FamilyWeeklySummaryResponse {
  senior_id: string;
  week_start: string;
  language: ContractLanguage | string;
  body_text: string;
  generated_by: string;
}

// Section 7: System
export interface SystemHealthResponse {
  status: string;
  environment?: string;
  database?: string;
}





