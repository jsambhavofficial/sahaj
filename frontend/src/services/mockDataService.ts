import {
  Alert,
  DailyRiskScore,
  DashboardMetrics,
  SeniorProfile,
  SeniorSummary,
} from "../types/domain";
import { AlertFilterParams, SeniorFilterParams } from "../types/api";
import {
  computeDashboardMetrics,
  MOCK_ALERTS,
  MOCK_SENIORS,
} from "../mocks/fixtures";
import { IDataService } from "./dataService";

/**
 * Deterministic In-Memory Mock Data Service.
 * Serves as the single source of truth in mock mode.
 */
export class MockDataService implements IDataService {
  readonly isMock = true;

  // Clone fixtures to keep local mutations isolated
  private seniors: SeniorProfile[];
  private alerts: Alert[];

  constructor(initialSeniors?: SeniorProfile[], initialAlerts?: Alert[]) {
    this.seniors = JSON.parse(
      JSON.stringify(initialSeniors || MOCK_SENIORS)
    ) as SeniorProfile[];
    this.alerts = JSON.parse(
      JSON.stringify(initialAlerts || MOCK_ALERTS)
    ) as Alert[];
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return computeDashboardMetrics(this.seniors, this.alerts);
  }

  async listSeniors(params?: SeniorFilterParams): Promise<SeniorSummary[]> {
    let result = this.seniors.map((s) => ({
      senior_id: s.senior_id,
      display_name: s.display_name,
      age: s.age,
      preferred_language: s.preferred_language,
      city_id: s.city_id,
      living_arrangement: s.living_arrangement,
      coordinator_id: s.coordinator_id,
      expected_checkin_frequency: s.expected_checkin_frequency,
      family_consent: s.family_consent,
      current_risk_level: s.current_risk_level,
      current_risk_score: s.current_risk_score,
      last_observation_date: s.last_observation_date,
      active_alert_count: this.alerts.filter(
        (a) =>
          a.senior_id === s.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length,
      attention_reason: s.attention_reason,
    }));

    // Filter by search query (id or display name)
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.senior_id.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q)
      );
    }

    // Filter by risk level
    if (params?.risk_level && params.risk_level !== "ALL") {
      result = result.filter(
        (s) =>
          s.current_risk_level.toUpperCase() ===
          params.risk_level?.toUpperCase()
      );
    }

    // Filter by city
    if (params?.city_id && params.city_id !== "ALL") {
      result = result.filter((s) => s.city_id === params.city_id);
    }

    // Filter by coordinator
    if (params?.coordinator_id && params.coordinator_id !== "ALL") {
      result = result.filter((s) => s.coordinator_id === params.coordinator_id);
    }

    // Deterministic sorting
    const sortBy = params?.sort_by || "risk_score";
    const dir = params?.sort_direction === "asc" ? 1 : -1;

    result.sort((a, b) => {
      if (sortBy === "risk_score") {
        // Missing scores sorted to end
        if (a.current_risk_score === null && b.current_risk_score === null)
          return 0;
        if (a.current_risk_score === null) return 1;
        if (b.current_risk_score === null) return -1;
        return (a.current_risk_score - b.current_risk_score) * dir;
      }
      if (sortBy === "age") {
        return (a.age - b.age) * dir;
      }
      if (sortBy === "senior_id") {
        return a.senior_id.localeCompare(b.senior_id) * dir;
      }
      if (sortBy === "last_observation_date") {
        if (!a.last_observation_date && !b.last_observation_date) return 0;
        if (!a.last_observation_date) return 1;
        if (!b.last_observation_date) return -1;
        return (
          a.last_observation_date.localeCompare(b.last_observation_date) * dir
        );
      }
      return 0;
    });

    if (params?.offset !== undefined && params?.limit !== undefined) {
      result = result.slice(params.offset, params.offset + params.limit);
    } else if (params?.limit !== undefined) {
      result = result.slice(0, params.limit);
    }

    return result;
  }

  async getSeniorById(seniorId: string): Promise<SeniorProfile | null> {
    const senior = this.seniors.find(
      (s) => s.senior_id.toUpperCase() === seniorId.toUpperCase()
    );
    if (!senior) return null;

    // Attach current related alerts from the mutable alert pool
    const relatedAlerts = this.alerts.filter(
      (a) => a.senior_id.toUpperCase() === seniorId.toUpperCase()
    );

    const activeCount = relatedAlerts.filter(
      (a) => a.status === "OPEN" || a.status === "ESCALATED"
    ).length;

    return {
      ...senior,
      active_alert_count: activeCount,
      related_alerts: relatedAlerts,
    };
  }

  async getSeniorRiskHistory(
    seniorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyRiskScore[]> {
    const senior = await this.getSeniorById(seniorId);
    if (!senior) return [];

    let history = [...senior.risk_history];
    if (startDate) {
      history = history.filter((h) => h.date >= startDate);
    }
    if (endDate) {
      history = history.filter((h) => h.date <= endDate);
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  }

  async listAlerts(params?: AlertFilterParams): Promise<Alert[]> {
    let result = [...this.alerts];

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.alert_id.toLowerCase().includes(q) ||
          a.senior_id.toLowerCase().includes(q) ||
          (a.senior_display_name &&
            a.senior_display_name.toLowerCase().includes(q))
      );
    }

    if (params?.status && params.status !== "ALL") {
      result = result.filter(
        (a) => a.status.toUpperCase() === params.status?.toUpperCase()
      );
    }

    if (params?.severity && params.severity !== "ALL") {
      result = result.filter(
        (a) => a.severity.toUpperCase() === params.severity?.toUpperCase()
      );
    }

    if (params?.senior_id) {
      result = result.filter(
        (a) =>
          a.senior_id.toUpperCase() === params.senior_id?.toUpperCase()
      );
    }

    // Sort newest created first
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getAlertById(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.find(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    return alert || null;
  }

  async acknowledgeAlert(
    alertId: string,
    coordinatorId: string,
    notes?: string
  ): Promise<Alert> {
    const idx = this.alerts.findIndex(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    if (idx === -1) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    const current = this.alerts[idx];
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updated: Alert = {
      ...current,
      status: "ACKNOWLEDGED",
      last_updated_at: nowStr,
      acknowledgement_notes: notes || `Acknowledged by ${coordinatorId}`,
    };

    this.alerts[idx] = updated;

    // Update active count on senior if present
    const senior = this.seniors.find((s) => s.senior_id === current.senior_id);
    if (senior) {
      senior.active_alert_count = this.alerts.filter(
        (a) =>
          a.senior_id === senior.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length;
    }

    return updated;
  }

  async resolveAlert(
    alertId: string,
    coordinatorId: string,
    resolutionReason: string
  ): Promise<Alert> {
    const idx = this.alerts.findIndex(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    if (idx === -1) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    const current = this.alerts[idx];
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updated: Alert = {
      ...current,
      status: "RESOLVED",
      last_updated_at: nowStr,
      resolution_reason: `Manual resolution by ${coordinatorId}: ${resolutionReason}`,
    };

    this.alerts[idx] = updated;

    // Update active count on senior if present
    const senior = this.seniors.find((s) => s.senior_id === current.senior_id);
    if (senior) {
      senior.active_alert_count = this.alerts.filter(
        (a) =>
          a.senior_id === senior.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length;
    }

    return updated;
  }
}

