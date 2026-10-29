import {
  Alert,
  DailyRiskScore,
  DashboardMetrics,
  SeniorProfile,
  SeniorSummary,
} from "../types/domain";
import { AlertFilterParams, SeniorFilterParams } from "../types/api";

/**
 * Common DataService interface.
 * Decouples all UI views and components from whether data is supplied
 * by the deterministic local mock service or the future FastAPI HTTP client.
 */
export interface IDataService {
  readonly isMock: boolean;

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
    coordinatorId: string,
    notes?: string
  ): Promise<Alert>;

  resolveAlert(
    alertId: string,
    coordinatorId: string,
    resolutionReason: string
  ): Promise<Alert>;
}

