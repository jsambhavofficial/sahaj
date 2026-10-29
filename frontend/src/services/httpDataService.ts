import {
  Alert,
  DailyRiskScore,
  DashboardMetrics,
  RiskLevel,
  SeniorProfile,
  SeniorSummary,
} from "../types/domain";
import {
  AlertFilterParams,
  ApiAlertResponse,
  ApiDailyRiskScoreResponse,
  ApiHealthResponse,
  ApiSeniorProfileSummary,
  ApiSeniorProfileDetail,
  SeniorFilterParams,
} from "../types/api";
import { ApiClient, defaultApiClient } from "./apiClient";
import { IDataService } from "./dataService";

/**
 * HTTP Data Service implementing IDataService for the FastAPI backend.
 */
export class HttpDataService implements IDataService {
  readonly isMock = false;
  private client: ApiClient;

  constructor(client: ApiClient = defaultApiClient) {
    this.client = client;
  }

  async checkHealth(): Promise<ApiHealthResponse> {
    return this.client.get<ApiHealthResponse>("/health");
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // When live API is enabled, dashboard metrics are aggregated from /seniors and /alerts
    const [seniors, alerts] = await Promise.all([
      this.listSeniors({ limit: 200 }),
      this.listAlerts(),
    ]);

    const byRisk: Record<string, number> = {
      LOW: 0,
      MODERATE: 0,
      HIGH: 0,
      URGENT_REVIEW: 0,
    };

    seniors.forEach((s) => {
      if (s.current_risk_level && byRisk[s.current_risk_level] !== undefined) {
        byRisk[s.current_risk_level]++;
      }
    });

    const activeCount = alerts.filter(
      (a) => a.status === "OPEN" || a.status === "ESCALATED"
    ).length;
    const ackCount = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
    const resCount = alerts.filter((a) => a.status === "RESOLVED").length;
    const escCount = alerts.filter((a) => a.status === "ESCALATED").length;

    const overdueCount = seniors.filter(
      (s) => !s.last_observation_date || s.current_risk_score === null
    ).length;

    return {
      total_seniors: seniors.length,
      by_risk_level: {
        LOW: byRisk["LOW"] || 0,
        MODERATE: byRisk["MODERATE"] || 0,
        HIGH: byRisk["HIGH"] || 0,
        URGENT_REVIEW: byRisk["URGENT_REVIEW"] || 0,
      },
      active_alerts_count: activeCount,
      acknowledged_alerts_count: ackCount,
      resolved_alerts_count: resCount,
      escalated_alerts_count: escCount,
      overdue_checkins_count: overdueCount,
      is_mock_data: false,
    };
  }

  async listSeniors(params?: SeniorFilterParams): Promise<SeniorSummary[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    if (params?.coordinator_id)
      query.set("coordinator_id", params.coordinator_id);
    if (params?.city_id) query.set("city_id", params.city_id);
    if (params?.risk_level) query.set("risk_level", params.risk_level);
    if (params?.search) query.set("search", params.search);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_direction) query.set("sort_direction", params.sort_direction);

    const qs = query.toString() ? `?${query.toString()}` : "";
    const rawSeniors = await this.client.get<ApiSeniorProfileSummary[]>(
      `/seniors${qs}`
    );

    return rawSeniors.map((s) => ({
      senior_id: s.senior_id,
      display_name: `Senior ${s.senior_id}`,
      age: s.age,
      preferred_language: s.preferred_language as any,
      city_id: s.city_id,
      living_arrangement: s.living_arrangement as any,
      coordinator_id: s.coordinator_id,
      expected_checkin_frequency: s.expected_checkin_frequency,
      family_consent: s.family_consent,
      current_risk_level: (s.current_risk_level as RiskLevel) || "LOW",
      current_risk_score: s.current_risk_score !== undefined ? s.current_risk_score : null,
      last_observation_date: s.last_observation_date || null,
      active_alert_count: s.active_alert_count || 0,
      attention_reason: null,
    }));
  }

  async getSeniorById(seniorId: string): Promise<SeniorProfile | null> {
    try {
      const detail = await this.client.get<ApiSeniorProfileDetail>(`/seniors/${seniorId}`);
      if (!detail) return null;

      const riskHistory = await this.client
        .get<ApiDailyRiskScoreResponse[]>(`/seniors/${seniorId}/risk-history`)
        .catch(() => []);

      const profile: SeniorProfile = {
        senior_id: detail.senior_id,
        display_name: `Senior ${detail.senior_id}`,
        age: detail.age,
        preferred_language: detail.preferred_language as any,
        city_id: detail.city_id,
        living_arrangement: detail.living_arrangement as any,
        coordinator_id: detail.coordinator_id,
        expected_checkin_frequency: detail.expected_checkin_frequency,
        family_consent: detail.family_consent,
        current_risk_level:
          (detail.latest_risk_score?.risk_level as RiskLevel) ||
          (detail.current_risk_level as RiskLevel) ||
          "LOW",
        current_risk_score: detail.latest_risk_score
          ? detail.latest_risk_score.risk_score
          : detail.current_risk_score ?? null,
        last_observation_date: detail.latest_risk_score
          ? detail.latest_risk_score.date
          : detail.last_observation_date ?? null,
        active_alert_count:
          detail.active_alert_count ?? (detail.active_alerts ? detail.active_alerts.length : 0),
        attention_reason: detail.latest_risk_score?.recommended_action || null,
        baselines: (detail.baselines as any) || null,
        latest_risk_score: detail.latest_risk_score
          ? ({
              ...detail.latest_risk_score,
              risk_level: detail.latest_risk_score.risk_level as RiskLevel,
              confidence_level: detail.latest_risk_score.confidence_level as any,
              baseline_confidence: detail.latest_risk_score.baseline_confidence as any,
            } as DailyRiskScore)
          : null,
        ml_risk: detail.ml_risk
          ? {
              ...detail.ml_risk,
              ml_risk_score: detail.ml_risk.ml_risk_score ?? null,
              probability: detail.ml_risk.probability ?? null,
              ml_risk_level: (detail.ml_risk.ml_risk_level as RiskLevel) || null,
            }
          : null,
        risk_history: (riskHistory || []).map(
          (h) =>
            ({
              ...h,
              risk_level: h.risk_level as RiskLevel,
              confidence_level: h.confidence_level as any,
              baseline_confidence: h.baseline_confidence as any,
            } as DailyRiskScore)
        ),
        recent_vitals: [],
        recent_activity: [],
        medications: [],
        recent_checkins: [],
        related_alerts: (detail.active_alerts || []).map((a) => ({
          alert_id: a.alert_id,
          senior_id: a.senior_id,
          senior_display_name: `Senior ${a.senior_id}`,
          created_at: a.created_at,
          last_updated_at: a.last_updated_at,
          status: a.status as any,
          severity: a.severity as any,
          triggering_signals: a.triggering_signals,
          recommended_next_step: a.recommended_next_step,
          resolution_reason: a.resolution_reason || null,
        })),
      };

      return profile;
    } catch {
      return null;
    }
  }

  async getSeniorRiskHistory(
    seniorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyRiskScore[]> {
    const query = new URLSearchParams();
    if (startDate) query.set("start_date", startDate);
    if (endDate) query.set("end_date", endDate);
    const qs = query.toString() ? `?${query.toString()}` : "";

    const history = await this.client.get<ApiDailyRiskScoreResponse[]>(
      `/seniors/${seniorId}/risk-history${qs}`
    );
    return (history || []) as unknown as DailyRiskScore[];
  }

  async listAlerts(params?: AlertFilterParams): Promise<Alert[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL")
      query.set("status", params.status);
    if (params?.severity && params.severity !== "ALL")
      query.set("severity", params.severity);

    const qs = query.toString() ? `?${query.toString()}` : "";
    const rawAlerts = await this.client.get<ApiAlertResponse[]>(`/alerts${qs}`);

    let results: Alert[] = rawAlerts.map((a) => ({
      alert_id: a.alert_id,
      senior_id: a.senior_id,
      senior_display_name: `Senior ${a.senior_id}`,
      created_at: a.created_at,
      last_updated_at: a.last_updated_at,
      status: a.status as any,
      severity: a.severity as any,
      triggering_signals: a.triggering_signals,
      recommended_next_step: a.recommended_next_step,
      resolution_reason: a.resolution_reason || null,
    }));

    if (params?.senior_id) {
      results = results.filter((a) => a.senior_id === params.senior_id);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      results = results.filter(
        (a) =>
          a.alert_id.toLowerCase().includes(q) ||
          a.senior_id.toLowerCase().includes(q)
      );
    }

    return results;
  }

  async getAlertById(alertId: string): Promise<Alert | null> {
    try {
      const raw = await this.client.get<ApiAlertResponse>(`/alerts/${alertId}`);
      return {
        alert_id: raw.alert_id,
        senior_id: raw.senior_id,
        senior_display_name: `Senior ${raw.senior_id}`,
        created_at: raw.created_at,
        last_updated_at: raw.last_updated_at,
        status: raw.status as any,
        severity: raw.severity as any,
        triggering_signals: raw.triggering_signals,
        recommended_next_step: raw.recommended_next_step,
        resolution_reason: raw.resolution_reason || null,
      };
    } catch {
      return null;
    }
  }

  async acknowledgeAlert(
    alertId: string,
    coordinatorId: string,
    notes?: string
  ): Promise<Alert> {
    const raw = await this.client.post<ApiAlertResponse>(
      `/alerts/${alertId}/acknowledge`,
      {
        coordinator_id: coordinatorId,
        notes: notes || "Acknowledged via web dashboard",
      }
    );

    return {
      alert_id: raw.alert_id,
      senior_id: raw.senior_id,
      senior_display_name: `Senior ${raw.senior_id}`,
      created_at: raw.created_at,
      last_updated_at: raw.last_updated_at,
      status: raw.status as any,
      severity: raw.severity as any,
      triggering_signals: raw.triggering_signals,
      recommended_next_step: raw.recommended_next_step,
      resolution_reason: raw.resolution_reason || null,
      acknowledgement_notes: notes,
    };
  }

  async resolveAlert(
    alertId: string,
    coordinatorId: string,
    resolutionReason: string
  ): Promise<Alert> {
    const raw = await this.client.post<ApiAlertResponse>(
      `/alerts/${alertId}/resolve`,
      {
        coordinator_id: coordinatorId,
        resolution_reason: resolutionReason,
      }
    );

    return {
      alert_id: raw.alert_id,
      senior_id: raw.senior_id,
      senior_display_name: `Senior ${raw.senior_id}`,
      created_at: raw.created_at,
      last_updated_at: raw.last_updated_at,
      status: raw.status as any,
      severity: raw.severity as any,
      triggering_signals: raw.triggering_signals,
      recommended_next_step: raw.recommended_next_step,
      resolution_reason: raw.resolution_reason,
    };
  }
}

