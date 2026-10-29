import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpDataService } from "../services/httpDataService";
import { ApiClient } from "../services/apiClient";

describe("HttpDataService", () => {
  let mockClient: ApiClient;
  let service: HttpDataService;

  beforeEach(() => {
    mockClient = new ApiClient("http://localhost:8000");
    service = new HttpDataService(mockClient);
    vi.restoreAllMocks();
  });

  it("identifies as non-mock service", () => {
    expect(service.isMock).toBe(false);
  });

  it("checks health via apiClient", async () => {
    vi.spyOn(mockClient, "get").mockResolvedValue({
      status: "healthy",
      version: "2.0.0",
      service: "SamarthCare AI",
      timestamp: "2026-10-29",
    });

    const res = await service.checkHealth();
    expect(res.status).toBe("healthy");
    expect(mockClient.get).toHaveBeenCalledWith("/health");
  });

  it("lists seniors with query parameters", async () => {
    vi.spyOn(mockClient, "get").mockResolvedValue([
      {
        senior_id: "S0001",
        age: 72,
        preferred_language: "hindi",
        city_id: "delhi",
        living_arrangement: "alone",
        coordinator_id: "COORD-01",
        expected_checkin_frequency: "daily",
        family_consent: true,
        current_risk_level: "HIGH",
        current_risk_score: 82,
        last_observation_date: "2026-03-31",
        active_alert_count: 1,
      },
    ]);

    const seniors = await service.listSeniors({ risk_level: "HIGH" });
    expect(seniors.length).toBe(1);
    expect(seniors[0].senior_id).toBe("S0001");
    expect(seniors[0].current_risk_level).toBe("HIGH");
    expect(seniors[0].current_risk_score).toBe(82);
    expect(seniors[0].active_alert_count).toBe(1);
  });

  it("retrieves full senior detail by id", async () => {
    vi.spyOn(mockClient, "get").mockImplementation(async (path: string) => {
      if (path === "/seniors/S0001") {
        return {
          senior_id: "S0001",
          age: 72,
          preferred_language: "hindi",
          city_id: "delhi",
          living_arrangement: "alone",
          coordinator_id: "COORD-01",
          expected_checkin_frequency: "daily",
          family_consent: true,
          baselines: {
            senior_id: "S0001",
            baseline_bp_systolic: 125.0,
            baseline_bp_diastolic: 80.0,
            baseline_blood_glucose: 110.0,
            baseline_glucose_context: "fasting",
            baseline_spo2: 96.5,
            baseline_weight: 65.0,
            baseline_steps: 4000,
            baseline_active_minutes: 30,
            baseline_sleep_hours: 7.0,
            baseline_appetite_level: 4.0,
            baseline_mood_level: 4.0,
            baseline_med_adherence_tendency: 0.95,
          },
          latest_risk_score: {
            senior_id: "S0001",
            date: "2026-03-31",
            risk_score: 82,
            risk_level: "HIGH",
            confidence_level: "HIGH",
            baseline_confidence: "HIGH",
            top_contributing_factors: [],
            recommended_action: "Urgent phone check-in",
            data_quality_flags: [],
            scoring_version: "2.0.0",
          },
          active_alert_count: 1,
          active_alerts: [],
        };
      }
      if (path.includes("/risk-history")) {
        return [];
      }
      return null;
    });

    const senior = await service.getSeniorById("S0001");
    expect(senior).not.toBeNull();
    expect(senior?.senior_id).toBe("S0001");
    expect(senior?.current_risk_score).toBe(82);
    expect(senior?.baselines?.baseline_spo2).toBe(96.5);
  });

  it("handles acknowledgeAlert and resolveAlert", async () => {
    vi.spyOn(mockClient, "post").mockResolvedValue({
      alert_id: "ALT-001",
      senior_id: "S0001",
      created_at: "2026-03-30",
      last_updated_at: "2026-10-29",
      status: "ACKNOWLEDGED",
      severity: "HIGH",
      triggering_signals: "Hypoxia drop",
      recommended_next_step: "Call senior immediately",
      resolution_reason: null,
    });

    const ack = await service.acknowledgeAlert("ALT-001", "COORD-01", "Reviewing");
    expect(ack.status).toBe("ACKNOWLEDGED");
    expect(mockClient.post).toHaveBeenCalledWith(
      "/alerts/ALT-001/acknowledge",
      expect.objectContaining({ coordinator_id: "COORD-01" })
    );

    vi.spyOn(mockClient, "post").mockResolvedValue({
      alert_id: "ALT-001",
      senior_id: "S0001",
      created_at: "2026-03-30",
      last_updated_at: "2026-10-29",
      status: "RESOLVED",
      severity: "HIGH",
      triggering_signals: "Hypoxia drop",
      recommended_next_step: "Call senior immediately",
      resolution_reason: "Vitals normalized",
    });

    const res = await service.resolveAlert("ALT-001", "COORD-01", "Vitals normalized");
    expect(res.status).toBe("RESOLVED");
    expect(res.resolution_reason).toBe("Vitals normalized");
  });
});
