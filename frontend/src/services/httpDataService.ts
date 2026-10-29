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
import { ApiClient, defaultApiClient } from "./apiClient";
import { IDataService } from "./dataService";

/**
 * HTTP Data Service implementing IDataService for the FastAPI backend.
 * Fully complies with SamarthCare AI API Contract (v1).
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
    const rawSeniors = await this.client.get<any>(`/seniors${qs}`);
    const items: ApiSeniorProfileSummary[] = Array.isArray(rawSeniors)
      ? rawSeniors
      : rawSeniors?.items || [];

    return items.map((s) => ({
      senior_id: s.senior_id,
      display_name: s.name || `Senior ${s.senior_id}`,
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
        display_name: detail.name || `Senior ${detail.senior_id}`,
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
    if (startDate) query.set("from", startDate);
    if (endDate) query.set("to", endDate);
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
    if (params?.senior_id)
      query.set("senior_id", params.senior_id);

    const qs = query.toString() ? `?${query.toString()}` : "";
    const rawAlerts = await this.client.get<any>(`/alerts${qs}`);
    const items: ApiAlertResponse[] = Array.isArray(rawAlerts)
      ? rawAlerts
      : rawAlerts?.items || [];

    let results: Alert[] = items.map((a) => ({
      alert_id: a.alert_id,
      senior_id: a.senior_id,
      senior_display_name: `Senior ${a.senior_id}`,
      created_at: a.created_at,
      last_updated_at: a.last_updated_at,
      status: a.status as any,
      severity: a.severity as any,
      triggering_signals: Array.isArray(a.triggering_signals)
        ? (a.triggering_signals as string[]).join("; ")
        : a.triggering_signals || "",
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
      const raw = await this.client.get<any>(`/alerts/${alertId}`);
      return {
        alert_id: raw.alert_id,
        senior_id: raw.senior_id,
        senior_display_name: `Senior ${raw.senior_id}`,
        created_at: raw.created_at,
        last_updated_at: raw.last_updated_at,
        status: raw.status as any,
        severity: raw.severity as any,
        triggering_signals: Array.isArray(raw.triggering_signals)
          ? raw.triggering_signals.join("; ")
          : raw.triggering_signals || "",
        recommended_next_step: raw.recommended_next_step,
        resolution_reason: raw.resolution_reason || null,
      };
    } catch {
      return null;
    }
  }

  async acknowledgeAlert(
    alertId: string,
    coordinatorId?: string,
    notes?: string
  ): Promise<Alert> {
    const payload: Record<string, any> = {
      note: notes || "Acknowledged via dashboard",
    };
    if (coordinatorId) {
      payload.coordinator_id = coordinatorId;
    }

    const raw = await this.client.post<any>(
      `/alerts/${alertId}/acknowledge`,
      payload
    );

    return {
      alert_id: raw.alert_id || alertId,
      senior_id: raw.senior_id || "",
      senior_display_name: `Senior ${raw.senior_id || ""}`,
      created_at: raw.created_at || new Date().toISOString(),
      last_updated_at: raw.last_updated_at || new Date().toISOString(),
      status: raw.status || "ACKNOWLEDGED",
      severity: raw.severity || "HIGH",
      triggering_signals: Array.isArray(raw.triggering_signals)
        ? raw.triggering_signals.join("; ")
        : raw.triggering_signals || "",
      recommended_next_step: raw.recommended_next_step || "",
      resolution_reason: raw.resolution_reason || null,
      acknowledgement_notes: notes,
    };
  }

  async resolveAlert(
    alertId: string,
    coordinatorId?: string,
    resolutionReason?: string,
    notes?: string
  ): Promise<Alert> {
    const payload: Record<string, any> = {
      resolution_reason: resolutionReason || "Resolved by coordinator",
      note: notes,
    };
    if (coordinatorId) {
      payload.coordinator_id = coordinatorId;
    }

    const raw = await this.client.post<any>(
      `/alerts/${alertId}/resolve`,
      payload
    );

    return {
      alert_id: raw.alert_id || alertId,
      senior_id: raw.senior_id || "",
      senior_display_name: `Senior ${raw.senior_id || ""}`,
      created_at: raw.created_at || new Date().toISOString(),
      last_updated_at: raw.last_updated_at || new Date().toISOString(),
      status: raw.status || "RESOLVED",
      severity: raw.severity || "HIGH",
      triggering_signals: Array.isArray(raw.triggering_signals)
        ? raw.triggering_signals.join("; ")
        : raw.triggering_signals || "",
      recommended_next_step: raw.recommended_next_step || "",
      resolution_reason: raw.resolution_reason || resolutionReason,
    };
  }

  // --- API Contract (v1) Coordinator Methods ---

  async getCoordinatorToday(date?: string): Promise<PriorityListResponse> {
    const dateParam = date || "2026-10-11";
    return this.client.get<PriorityListResponse>(
      `/coordinators/me/today?date=${dateParam}`
    );
  }

  async getCoordinatorSeniors(params?: {
    q?: string;
    risk_level?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.risk_level) query.set("risk_level", params.risk_level);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractPaginatedList<CoordinatorCaseloadItem>>(
      `/coordinators/me/seniors${qs}`
    );
  }

  async getContractSeniorDetail(seniorId: string): Promise<ContractSeniorDetail> {
    return this.client.get<ContractSeniorDetail>(`/seniors/${seniorId}`);
  }

  async getSeniorContractRiskHistory(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractRiskHistoryItem[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractRiskHistoryItem[]>(
      `/seniors/${seniorId}/risk-history${qs}`
    );
  }

  async getSeniorVitals(
    seniorId: string,
    type?: string,
    from?: string,
    to?: string
  ): Promise<ContractVitalItem[]> {
    const query = new URLSearchParams();
    if (type) query.set("type", type);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractVitalItem[]>(
      `/seniors/${seniorId}/vitals${qs}`
    );
  }

  async getSeniorMedications(seniorId: string): Promise<ContractMedicationsResponse> {
    return this.client.get<ContractMedicationsResponse>(
      `/seniors/${seniorId}/medications`
    );
  }

  async getSeniorActivity(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractActivityItem[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractActivityItem[]>(
      `/seniors/${seniorId}/activity${qs}`
    );
  }

  async getSeniorCalls(seniorId: string): Promise<ContractCallObject[]> {
    return this.client.get<ContractCallObject[]>(`/seniors/${seniorId}/calls`);
  }

  async getSeniorMessages(
    seniorId: string,
    limit?: number,
    before?: string
  ): Promise<ContractPaginatedList<ContractMessageItem>> {
    const query = new URLSearchParams();
    if (limit) query.set("limit", limit.toString());
    if (before) query.set("before", before);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractPaginatedList<ContractMessageItem>>(
      `/seniors/${seniorId}/messages${qs}`
    );
  }

  async getSeniorCues(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractCueRecord[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractCueRecord[]>(
      `/seniors/${seniorId}/cues${qs}`
    );
  }

  async getSeniorMemory(seniorId: string): Promise<ContractMemoryItem[]> {
    return this.client.get<ContractMemoryItem[]>(`/seniors/${seniorId}/memory`);
  }

  async getSeniorFamilyInteractions(
    seniorId: string
  ): Promise<ContractFamilyInteractionItem[]> {
    return this.client.get<ContractFamilyInteractionItem[]>(
      `/seniors/${seniorId}/family-interactions`
    );
  }

  // --- Alerts Contract Methods ---

  async escalateAlert(alertId: string, note: string): Promise<ContractAlertObject> {
    return this.client.post<ContractAlertObject>(`/alerts/${alertId}/escalate`, {
      note,
    });
  }

  async submitAlertFeedback(
    alertId: string,
    feedback: ContractAlertFeedbackRequest
  ): Promise<any> {
    return this.client.post<any>(`/alerts/${alertId}/feedback`, feedback);
  }

  // --- Calls & Messages ---

  async connectCall(
    seniorId: string,
    recordingConsent: boolean = true,
    initiator: string = "coordinator"
  ): Promise<ContractCallObject> {
    return this.client.post<ContractCallObject>("/calls/connect", {
      senior_id: seniorId,
      recording_consent: recordingConsent,
      initiator,
    });
  }

  async getCall(callId: string): Promise<ContractCallObject> {
    return this.client.get<ContractCallObject>(`/calls/${callId}`);
  }

  async processCall(callId: string): Promise<any> {
    return this.client.post<any>(`/calls/${callId}/process`);
  }

  async sendMessage(
    seniorId: string,
    body: string,
    audioBlob?: Blob,
    language?: string
  ): Promise<ContractMessageItem> {
    if (audioBlob) {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.m4a");
      if (language) formData.append("language", language);
      return this.client.request<ContractMessageItem>(
        `/seniors/${seniorId}/messages`,
        {
          method: "POST",
          headers: {}, // Let browser set multipart boundary
          body: formData,
        }
      );
    }
    return this.client.post<ContractMessageItem>(`/seniors/${seniorId}/messages`, {
      body,
    });
  }

  async markMessageRead(messageId: string): Promise<void> {
    return this.client.post<void>(`/messages/${messageId}/read`);
  }

  async getNotifications(
    unreadOnly: boolean = true
  ): Promise<{ items: ContractNotificationItem[] }> {
    return this.client.get<{ items: ContractNotificationItem[] }>(
      `/notifications?unread=${unreadOnly}`
    );
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.client.post<void>(`/notifications/${id}/read`);
  }

  // --- Senior App (/me/*) ---

  async getSeniorHome(): Promise<SeniorHomeResponse> {
    return this.client.get<SeniorHomeResponse>("/me/home");
  }

  async confirmSeniorMedication(
    medicationId: string,
    scheduledAt: string
  ): Promise<{ status: string; actual_at: string }> {
    return this.client.post<{ status: string; actual_at: string }>(
      `/me/medications/${medicationId}/confirm`,
      { scheduled_at: scheduledAt }
    );
  }

  async logSeniorVital(vital: {
    measurement_type: string;
    value: number;
    unit: string;
    measured_at?: string;
  }): Promise<any> {
    return this.client.post<any>("/me/vitals", vital);
  }

  async submitSeniorReport(
    text: string,
    language: string = "hindi"
  ): Promise<{ checkin_id: string }> {
    return this.client.post<{ checkin_id: string }>("/me/report", {
      text,
      language,
    });
  }

  async callCoordinatorFromSenior(): Promise<ContractCallObject> {
    return this.client.post<ContractCallObject>("/me/call-coordinator", {
      recording_consent: true,
    });
  }

  // --- Ops Web Dashboard (/ops/* & /admin/*) ---

  async getOpsOverview(params?: {
    from?: string;
    to?: string;
    city?: string;
    coordinator_id?: string;
  }): Promise<OpsOverviewResponse> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.city) query.set("city", params.city);
    if (params?.coordinator_id) query.set("coordinator_id", params.coordinator_id);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsOverviewResponse>(`/ops/overview${qs}`);
  }

  async getOpsAlertsVolume(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertVolumeItem[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.city) query.set("city", params.city);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsAlertVolumeItem[]>(`/ops/alerts/volume${qs}`);
  }

  async getOpsAlertsResponseTimes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsResponseTimesItem[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.city) query.set("city", params.city);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsResponseTimesItem[]>(`/ops/alerts/response-times${qs}`);
  }

  async getOpsAlertsOutcomes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertOutcomesItem[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.city) query.set("city", params.city);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsAlertOutcomesItem[]>(`/ops/alerts/outcomes${qs}`);
  }

  async getOpsAlertsPrecision(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertPrecisionItem[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.city) query.set("city", params.city);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsAlertPrecisionItem[]>(`/ops/alerts/precision${qs}`);
  }

  async getOpsCoordinators(params?: { city?: string }): Promise<OpsCoordinatorItem[]> {
    const query = new URLSearchParams();
    if (params?.city) query.set("city", params.city);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<OpsCoordinatorItem[]>(`/ops/coordinators${qs}`);
  }

  async getOpsCoordinatorDetail(id: string): Promise<any> {
    return this.client.get<any>(`/ops/coordinators/${id}`);
  }

  async getOpsSeniors(params?: {
    city?: string;
    risk_level?: string;
    coordinator_id?: string;
    consent_level?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>> {
    const query = new URLSearchParams();
    if (params?.city) query.set("city", params.city);
    if (params?.risk_level) query.set("risk_level", params.risk_level);
    if (params?.coordinator_id) query.set("coordinator_id", params.coordinator_id);
    if (params?.consent_level) query.set("consent_level", params.consent_level);
    if (params?.q) query.set("q", params.q);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.client.get<ContractPaginatedList<CoordinatorCaseloadItem>>(`/ops/seniors${qs}`);
  }

  async getOpsCities(): Promise<OpsCityItem[]> {
    return this.client.get<OpsCityItem[]>("/ops/cities");
  }

  async getOpsDailyReports(date?: string): Promise<OpsDailyReportItem[]> {
    const dateParam = date || "2026-10-11";
    return this.client.get<OpsDailyReportItem[]>(`/ops/reports/daily?date=${dateParam}`);
  }

  async runAdminJob(jobName: string, date?: string): Promise<AdminJobRunResponse> {
    const dateParam = date || "2026-10-11";
    return this.client.post<AdminJobRunResponse>(
      `/admin/jobs/${jobName}/run?date=${dateParam}`
    );
  }

  // --- Family ---

  async getFamilyWeeklySummary(week?: string): Promise<FamilyWeeklySummaryResponse> {
    const weekParam = week || "2026-W41";
    return this.client.get<FamilyWeeklySummaryResponse>(
      `/family/me/summary?week=${weekParam}`
    );
  }

  async getSeniorFamilySummary(
    seniorId: string,
    week?: string
  ): Promise<FamilyWeeklySummaryResponse> {
    const weekParam = week || "2026-W41";
    return this.client.get<FamilyWeeklySummaryResponse>(
      `/seniors/${seniorId}/family-summary?week=${weekParam}`
    );
  }
}


