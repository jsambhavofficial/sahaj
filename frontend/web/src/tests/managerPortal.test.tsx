import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Data shaped like the live /ops and /seniors responses, including nulls for "not known yet".
const svc = vi.hoisted(() => ({
  getOpsOverview: vi.fn(),
  getOpsCities: vi.fn(),
  getOpsAlertsVolume: vi.fn(),
  getOpsCoordinators: vi.fn(),
  getOpsAlertsResponseTimes: vi.fn(),
  getOpsAlertsPrecision: vi.fn(),
  getOpsAlertsOutcomes: vi.fn(),
  getOpsDailyReports: vi.fn(),
  getOpsSeniors: vi.fn(),
  getOpsCoordinatorDetail: vi.fn(),
  getContractSeniorDetail: vi.fn(),
  getSeniorContractRiskHistory: vi.fn(),
  getSeniorMedications: vi.fn(),
  getSeniorVitals: vi.fn(),
  getSeniorCalls: vi.fn(),
  getSeniorCues: vi.fn(),
}));
const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services", () => ({ getDataService: () => svc }));
vi.mock("@/services/apiClient", () => ({ defaultApiClient: api }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ seniorId: "S0001" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/city-manager",
}));

import Dashboard from "../app/city-manager/page";
import SeniorsPage from "../app/city-manager/seniors/page";
import SeniorDetail from "../app/city-manager/seniors/[seniorId]/page";
import AlertsPage from "../app/city-manager/alerts/page";
import CoordinatorsPage from "../app/city-manager/caretakers/page";
import ReportsPage from "../app/city-manager/reports/page";

const overview = { open_alerts: 26, alerts_in_range: 19, median_minutes_to_ack: null, median_minutes_to_resolve: 5760, useful_share: null, ai_call_completion_rate: null, seniors_covered: 247, seniors_total: 250 };
const cities = [{ city: "Bengaluru", seniors: 36, coordinators: 18, open_alerts: 3, avg_risk: 17.5, high_risk_count: 0 }, { city: "Chandigarh", seniors: 17, coordinators: 9, open_alerts: 1, avg_risk: null, high_risk_count: 0 }];
const coordinators = [
  { coordinator_id: "c1", display_name: "Care Coordinator 001", city: "Bengaluru", caseload: 2, open_alerts: 0, alerts_handled: 0, calls: 6, messages_sent: 0 },
  { coordinator_id: "c2", display_name: "Care Coordinator 002", city: "Pune", caseload: 2, open_alerts: 3, alerts_handled: 4, calls: 9, messages_sent: 1 },
];
const seniorRow = { senior_id: "S0001", display_name: "Shanti Khanna", age: 71, city: "Bengaluru", preferred_language: "hinglish", living_arrangement: "with_spouse", coordinator_id: "c1", family_consent_level: "full", risk_score: 35, risk_level: "MODERATE", open_alert_id: null, last_contact_at: "2026-10-09T10:38:00Z", coordinator_name: "Care Coordinator 001" };

beforeEach(() => {
  vi.clearAllMocks();
  svc.getOpsOverview.mockResolvedValue(overview);
  svc.getOpsCities.mockResolvedValue(cities);
  svc.getOpsAlertsVolume.mockResolvedValue([{ day: "2026-10-01", city: "Bengaluru", severity: "URGENT_REVIEW", status: "ESCALATED", alerts: 1 }, { day: "2026-10-01", city: "Pune", severity: "HIGH", status: "RESOLVED", alerts: 2 }]);
  svc.getOpsCoordinators.mockResolvedValue(coordinators);
  svc.getOpsAlertsResponseTimes.mockResolvedValue([{ alert_id: "ALT_1847B850", city: "Chandigarh", coordinator_id: "c2", severity: "HIGH", created_at: "2026-10-11T00:30:00Z", minutes_to_ack: null, minutes_to_resolve: null }]);
  svc.getOpsAlertsPrecision.mockResolvedValue([]);
  svc.getOpsAlertsOutcomes.mockResolvedValue([{ city: "Pune", resolution_reason: null, useful: null, outcome: "called", alerts: 2 }, { city: "Pune", resolution_reason: null, useful: null, outcome: null, alerts: 5 }]);
  svc.getOpsSeniors.mockResolvedValue({ items: [seniorRow], total: 1, limit: 25, offset: 0 });
});

describe("organization manager portal", () => {
  it("dashboard shows real figures and a dash where nothing is known yet", async () => {
    render(<Dashboard />);
    await screen.findByText("Organization overview");
    expect(screen.getByText("26")).toBeTruthy();                 // open alerts
    expect(screen.getByText("247 / 250")).toBeTruthy();          // seniors covered
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2); // unknown medians/shares are not shown as 0
    expect(screen.getByText("4.0 days")).toBeTruthy();           // 5760 minutes
    expect(screen.getByText("Chandigarh")).toBeTruthy();         // city with a null average risk still renders
    expect(screen.getByText("ALT_1847B850")).toBeTruthy();       // waiting alert
    expect(screen.getByText("Care Coordinator 002")).toBeTruthy();
  });

  it("dashboard shows an error with retry when the API fails", async () => {
    svc.getOpsOverview.mockRejectedValue(new Error("Backend unavailable"));
    render(<Dashboard />);
    expect(await screen.findByText(/Backend unavailable/)).toBeTruthy();
  });

  it("seniors directory lists seniors and searches by name", async () => {
    render(<SeniorsPage />);
    await screen.findByText("Shanti Khanna");
    expect(screen.getByText(/S0001 · 71 yrs/)).toBeTruthy();
    expect(screen.getByText("Care Coordinator 001")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: "shan" } });
    await waitFor(() => expect(svc.getOpsSeniors).toHaveBeenLastCalledWith(expect.objectContaining({ q: "shan", offset: 0 })), { timeout: 2000 });
  });

  it("seniors directory shows an empty state", async () => {
    svc.getOpsSeniors.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    render(<SeniorsPage />);
    expect(await screen.findByText("No seniors match these filters")).toBeTruthy();
  });

  it("senior detail renders risk, vitals, medicines and calls, and tolerates empty lists", async () => {
    svc.getContractSeniorDetail.mockResolvedValue({ senior_id: "S0001", display_name: "Shanti Khanna", age: 71, city: "Bengaluru", living_arrangement: "with_spouse", preferred_language: "hinglish", family_consent_level: "full", conditions: [{ category: "physical", condition: "hypertension" }], health_profile: { cognitive_status: "normal", fall_risk_level: "high" } });
    svc.getSeniorContractRiskHistory.mockResolvedValue([{ date: "2026-10-10", risk_score: 20, risk_level: "LOW", top_factors: [], recommended_action: "" }, { date: "2026-10-11", risk_score: 58, risk_level: "HIGH", top_factors: [{ rule_id: "r1", category: "vitals", evidence: "BP higher than usual for 3 days", window: "3d", points_contributed: 12, is_safety_tripwire: false }], recommended_action: "Call today" }]);
    svc.getSeniorMedications.mockResolvedValue({ schedules: [{ medication_id: "M1", drug_name: "Amlodipine", dosage: "5 mg", indication: "blood pressure", times_per_day: 1, scheduled_times: ["08:00"], criticality: "high", is_active: true }], adherence: { last_7d_pct: 86, last_30d_pct: 90, missed_critical_7d: 1 }, recent_events: [] });
    svc.getSeniorVitals.mockResolvedValue([{ measurement_id: "v1", measured_at: "2026-10-11T08:00:00Z", measurement_type: "blood_pressure_systolic", value: 142, unit: "mmHg", quality_status: "valid" }]);
    svc.getSeniorCalls.mockResolvedValue([{ id: "c", senior_id: "S0001", kind: "phone_bridge", status: "completed", transcript_status: "done", started_at: "2026-10-11T10:00:00Z", summary: "Reported mild dizziness.", urgency_flag: false, recording_stored: false, turns: [], cues: [] }]);
    svc.getSeniorCues.mockResolvedValue([{ cue_type: "dizziness", cue_value: "present", negated: false, at: "2026-10-11T10:00:00Z" }]);
    render(<SeniorDetail />);
    await screen.findByText("Shanti Khanna");
    expect(screen.getByText("BP higher than usual for 3 days")).toBeTruthy();
    expect(screen.getByText("Call today", { exact: false })).toBeTruthy();
    expect(screen.getByText(/142\.0 mmHg/)).toBeTruthy();
    expect(screen.getByText("Amlodipine")).toBeTruthy();
    expect(screen.getByText(/1 critical doses missed/)).toBeTruthy();
    expect(screen.getByText("Reported mild dizziness.")).toBeTruthy();
    expect(screen.getByText(/dizziness · /)).toBeTruthy();
  });

  it("senior detail copes with a senior who has no data yet", async () => {
    svc.getContractSeniorDetail.mockResolvedValue({ senior_id: "S0001", display_name: "Shanti Khanna", age: 71, city: "Bengaluru", living_arrangement: "alone", preferred_language: "hindi" });
    svc.getSeniorContractRiskHistory.mockResolvedValue([]);
    svc.getSeniorMedications.mockResolvedValue({ schedules: [], adherence: { last_7d_pct: 0, last_30d_pct: 0, missed_critical_7d: 0 }, recent_events: [] });
    svc.getSeniorVitals.mockResolvedValue([]);
    svc.getSeniorCalls.mockResolvedValue([]);
    svc.getSeniorCues.mockResolvedValue([]);
    render(<SeniorDetail />);
    await screen.findByText("Shanti Khanna");
    expect(screen.getByText("No risk scores yet")).toBeTruthy();
    expect(screen.getByText("No vitals recorded")).toBeTruthy();
    expect(screen.getByText("No calls yet")).toBeTruthy();
  });

  it("alerts list expands to show why an alert fired", async () => {
    api.get.mockResolvedValue({ total: 1, items: [{ alert_id: "ALT_33F16E16", senior_id: "S0206", status: "OPEN", severity: "HIGH", created_at: "2026-10-07T00:30:00Z", last_updated_at: "2026-10-07T00:30:00Z", triggering_signals: ["A low oxygen reading was recorded"], recommended_next_step: "Call the senior today", resolution_reason: null }] });
    render(<AlertsPage />);
    const row = await screen.findByText("ALT_33F16E16");
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("/alerts?limit=25"));
    fireEvent.click(row);
    expect(await screen.findByText("A low oxygen reading was recorded")).toBeTruthy();
    expect(screen.getByText(/Call the senior today/)).toBeTruthy();
  });

  it("alerts list can be filtered by status", async () => {
    api.get.mockResolvedValue({ total: 0, items: [] });
    render(<AlertsPage />);
    await screen.findByText("No alerts match these filters");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ESCALATED" } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining("status=ESCALATED")));
  });

  it("coordinators page sorts by open alerts and expands daily activity", async () => {
    svc.getOpsCoordinatorDetail.mockResolvedValue({ daily: [{ day: "2026-10-02", alert_actions: 1, calls: 2, messages_sent: 0 }] });
    render(<CoordinatorsPage />);
    const first = await screen.findAllByText(/Care Coordinator 00/);
    expect(first[0].textContent).toBe("Care Coordinator 002"); // 3 open alerts comes first
    fireEvent.click(first[0]);
    expect(await screen.findByText("Alert actions")).toBeTruthy();
    expect(svc.getOpsCoordinatorDetail).toHaveBeenCalledWith("c2");
  });

  it("reports show each coordinator's priority list and handle no feedback yet", async () => {
    svc.getOpsDailyReports.mockResolvedValue([{ coordinator: { coordinator_id: "c1", display_name: "Care Coordinator 001", city: "Bengaluru" }, revision: 1, items: [{ rank: 1, previous_rank: null, senior: { senior_id: "S0001", display_name: "Shanti Khanna", age: 71, city: "Bengaluru", preferred_language: "hinglish" }, risk_score: 58, risk_level: "HIGH", reasons: ["BP rising for 3 days"], suggested_action: "Call today", alert_id: null, ai_call_done: false }] }]);
    render(<ReportsPage />);
    expect(await screen.findByText("Shanti Khanna")).toBeTruthy();
    expect(screen.getByText("BP rising for 3 days")).toBeTruthy();
    expect(await screen.findByText("No feedback yet")).toBeTruthy();
    expect(screen.getByText("called")).toBeTruthy();
    expect(screen.getByText("no feedback yet")).toBeTruthy();
  });
});
