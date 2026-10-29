/**
 * Common DataService interface.
 * Decouples all UI views and components from whether data is supplied
 * by the deterministic local mock service or the future FastAPI HTTP client.
 */
import {
  Alert,
  DailyRiskScore,
  DashboardMetrics,
  SeniorProfile,
  SeniorSummary,
} from "../types/domain";
import {
  AlertFilterParams,
  SeniorFilterParams,
  PriorityListResponse,
  CoordinatorCaseloadItem,
  ContractPaginatedList,
  ContractSeniorDetail,
  ContractRiskHistoryItem,
  ContractVitalItem,
  ContractMedicationsResponse,
  ContractActivityItem,
  ContractCallObject,
  ContractCueRecord,
  ContractMemoryItem,
  ContractFamilyInteractionItem,
  ContractAlertObject,
  ContractAlertFeedbackRequest,
  ContractMessageItem,
  ContractNotificationItem,
  SeniorHomeResponse,
  OpsOverviewResponse,
  OpsAlertVolumeItem,
  OpsResponseTimesItem,
  OpsAlertOutcomesItem,
  OpsAlertPrecisionItem,
  OpsCoordinatorItem,
  OpsCityItem,
  OpsDailyReportItem,
  AdminJobRunResponse,
  FamilyWeeklySummaryResponse,
} from "../types/api";

/**
 * Common DataService interface.
 * Implements the SamarthCare AI API Contract (v1).
 * Decouples all UI views and components from whether data is supplied
 * by the deterministic local mock service or the live FastAPI HTTP client.
 */
export interface IDataService {
  readonly isMock: boolean;

  // Legacy & Compatibility Methods
  getDashboardMetrics(): Promise<DashboardMetrics>;
  listSeniors(params?: SeniorFilterParams): Promise<SeniorSummary[]>;
  getSeniorById(seniorId: string): Promise<SeniorProfile | null>;
  getSeniorRiskHistory(
    seniorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyRiskScore[]>;
  listAlerts(params?: AlertFilterParams): Promise<Alert[]>;
  getAlertById(alertId: string): Promise<Alert | null>;
  acknowledgeAlert(
    alertId: string,
    coordinatorId?: string,
    notes?: string
  ): Promise<Alert | ContractAlertObject>;
  resolveAlert(
    alertId: string,
    coordinatorId?: string,
    resolutionReason?: string,
    notes?: string
  ): Promise<Alert | ContractAlertObject>;

  // --- API Contract (v1) Coordinator Methods ---
  getCoordinatorToday(date?: string): Promise<PriorityListResponse>;
  getCoordinatorSeniors(params?: {
    q?: string;
    risk_level?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>>;
  getContractSeniorDetail(seniorId: string): Promise<ContractSeniorDetail>;
  getSeniorContractRiskHistory(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractRiskHistoryItem[]>;
  getSeniorVitals(
    seniorId: string,
    type?: string,
    from?: string,
    to?: string
  ): Promise<ContractVitalItem[]>;
  getSeniorMedications(seniorId: string): Promise<ContractMedicationsResponse>;
  getSeniorActivity(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractActivityItem[]>;
  getSeniorCalls(seniorId: string): Promise<ContractCallObject[]>;
  getSeniorMessages(
    seniorId: string,
    limit?: number,
    before?: string
  ): Promise<ContractPaginatedList<ContractMessageItem>>;
  getSeniorCues(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractCueRecord[]>;
  getSeniorMemory(seniorId: string): Promise<ContractMemoryItem[]>;
  getSeniorFamilyInteractions(
    seniorId: string
  ): Promise<ContractFamilyInteractionItem[]>;

  // --- Alerts Contract Methods ---
  escalateAlert(
    alertId: string,
    note: string
  ): Promise<ContractAlertObject>;
  submitAlertFeedback(
    alertId: string,
    feedback: ContractAlertFeedbackRequest
  ): Promise<any>;

  // --- Calls & Messages ---
  connectCall(
    seniorId: string,
    recordingConsent?: boolean,
    initiator?: string
  ): Promise<ContractCallObject>;
  getCall(callId: string): Promise<ContractCallObject>;
  processCall(callId: string): Promise<any>;
  sendMessage(
    seniorId: string,
    body: string,
    audioBlob?: Blob,
    language?: string
  ): Promise<ContractMessageItem>;
  markMessageRead(messageId: string): Promise<void>;
  getNotifications(
    unreadOnly?: boolean
  ): Promise<{ items: ContractNotificationItem[] }>;
  markNotificationRead(id: string): Promise<void>;

  // --- Senior App (/me/*) ---
  getSeniorHome(): Promise<SeniorHomeResponse>;
  confirmSeniorMedication(
    medicationId: string,
    scheduledAt: string
  ): Promise<{ status: string; actual_at: string }>;
  logSeniorVital(vital: {
    measurement_type: string;
    value: number;
    unit: string;
    measured_at?: string;
  }): Promise<any>;
  submitSeniorReport(
    text: string,
    language?: string
  ): Promise<{ checkin_id: string }>;
  callCoordinatorFromSenior(): Promise<ContractCallObject>;

  // --- Ops Web Dashboard (/ops/* & /admin/*) ---
  getOpsOverview(params?: {
    from?: string;
    to?: string;
    city?: string;
    coordinator_id?: string;
  }): Promise<OpsOverviewResponse>;
  getOpsAlertsVolume(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertVolumeItem[]>;
  getOpsAlertsResponseTimes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsResponseTimesItem[]>;
  getOpsAlertsOutcomes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertOutcomesItem[]>;
  getOpsAlertsPrecision(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertPrecisionItem[]>;
  getOpsCoordinators(params?: {
    city?: string;
  }): Promise<OpsCoordinatorItem[]>;
  getOpsCoordinatorDetail(id: string): Promise<any>;
  getOpsSeniors(params?: {
    city?: string;
    risk_level?: string;
    coordinator_id?: string;
    consent_level?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>>;
  getOpsCities(): Promise<OpsCityItem[]>;
  getOpsDailyReports(date?: string): Promise<OpsDailyReportItem[]>;
  runAdminJob(jobName: string, date?: string): Promise<AdminJobRunResponse>;

  // --- Family ---
  getFamilyWeeklySummary(week?: string): Promise<FamilyWeeklySummaryResponse>;
  getSeniorFamilySummary(
    seniorId: string,
    week?: string
  ): Promise<FamilyWeeklySummaryResponse>;
}


