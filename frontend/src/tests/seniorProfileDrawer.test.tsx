import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SeniorProfileDrawer from "../app/city-manager/components/SeniorProfileDrawer";
import { OperationalAlertItem } from "@/types/api";

// Mock the API client
vi.mock("@/services/apiClient", () => ({
  defaultApiClient: {
    get: vi.fn((url: string) => {
      if (url.includes("S0054")) {
        return Promise.resolve({
          senior_id: "S0054",
          name: "Savitri Devi",
          age: 75,
          preferred_language: "Hindi",
          city_id: "CITY_DELHI",
          living_arrangement: "alone",
          coordinator_id: "COORD_001",
          expected_checkin_frequency: "daily",
          family_consent: true,
          baselines: {
            senior_id: "S0054",
            baseline_bp_systolic: 122,
            baseline_bp_diastolic: 71,
            baseline_blood_glucose: 125,
            baseline_glucose_context: "fasting",
            baseline_spo2: 98.0,
            baseline_weight: 70,
            baseline_steps: 3200,
            baseline_active_minutes: 45,
            baseline_sleep_hours: 7.0,
            baseline_appetite_level: 4.0,
            baseline_mood_level: 4.0,
            baseline_med_adherence_tendency: 0.95,
          },
          latest_risk_score: {
            senior_id: "S0054",
            date: "2026-10-29",
            risk_score: 65,
            risk_level: "HIGH",
            confidence_level: "HIGH",
            baseline_confidence: "HIGH",
            top_contributing_factors: [],
            recommended_action: "In-home caretaker vitals check.",
            data_quality_flags: [],
            scoring_version: "2.0.0",
          },
          active_alerts: [],
        });
      }

      if (url.includes("S0013")) {
        return Promise.resolve({
          senior_id: "S0013",
          name: "Pushpa Kapoor",
          age: 71,
          preferred_language: "Hindi",
          city_id: "CITY_BENGALURU",
          living_arrangement: "family",
          coordinator_id: "COORD_003",
          expected_checkin_frequency: "daily",
          family_consent: true,
          baselines: {
            senior_id: "S0013",
            baseline_bp_systolic: 130,
            baseline_bp_diastolic: 85,
            baseline_blood_glucose: 110,
            baseline_glucose_context: "random",
            baseline_spo2: 96.5,
            baseline_weight: 62,
            baseline_steps: 4000,
            baseline_active_minutes: 50,
            baseline_sleep_hours: 6.8,
            baseline_appetite_level: 4.0,
            baseline_mood_level: 4.2,
            baseline_med_adherence_tendency: 0.92,
          },
          latest_risk_score: {
            senior_id: "S0013",
            date: "2026-10-29",
            risk_score: 80,
            risk_level: "URGENT",
            confidence_level: "HIGH",
            baseline_confidence: "HIGH",
            top_contributing_factors: [],
            recommended_action: "Immediate nursing assessment.",
            data_quality_flags: [],
            scoring_version: "2.0.0",
          },
          active_alerts: [],
        });
      }

      if (url.startsWith("/seniors/") || url.startsWith("/api/v1/operational/seniors/")) {
        return Promise.resolve({
          senior_id: "S0012",
          name: "Kamala Sharma",
          age: 78,
          preferred_language: "hindi",
          city_id: "CITY_NOIDA",
          living_arrangement: "alone",
          coordinator_id: "COORD_002",
          expected_checkin_frequency: "daily",
          family_consent: true,
          baselines: {
            senior_id: "S0012",
            baseline_bp_systolic: 128,
            baseline_bp_diastolic: 82,
            baseline_blood_glucose: 102,
            baseline_glucose_context: "post_meal",
            baseline_spo2: 97.2,
            baseline_weight: 60,
            baseline_steps: 4200,
            baseline_active_minutes: 65,
            baseline_sleep_hours: 6.5,
            baseline_appetite_level: 4.2,
            baseline_mood_level: 4.1,
            baseline_med_adherence_tendency: 0.98,
          },
          latest_risk_score: {
            senior_id: "S0012",
            date: "2026-10-29",
            risk_score: 35,
            risk_level: "MODERATE",
            confidence_level: "MEDIUM",
            baseline_confidence: "HIGH",
            top_contributing_factors: [],
            recommended_action: "Monitor blood pressure & verify hydration.",
            data_quality_flags: [],
            scoring_version: "2.0.0",
          },
          active_alerts: [],
        });
      }

      if (url.startsWith("/api/v1/operational/visits")) {
        return Promise.resolve([
          {
            id: "vis_123",
            caretaker_user_id: "caretaker_01",
            caretaker_name: "Deepak Kumar",
            senior_id: "S0012",
            senior_name: "Kamala Sharma",
            status: "SCHEDULED",
            scheduled_start: "2026-10-29 14:00:00",
            visit_purpose: "Routine vitals check",
          },
        ]);
      }
      return Promise.resolve([]);
    }),
    post: vi.fn(() => Promise.resolve({})),
  },
}));

describe("SeniorProfileDrawer", () => {
  const onCloseMock = vi.fn();
  const onTriageAlertMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SeniorProfileDrawer
        isOpen={false}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders senior details, stat cards and actions when open", async () => {
    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    // Verify Senior Name & ID in header
    expect(await screen.findByText("Kamala Sharma")).toBeInTheDocument();
    expect(screen.getByText("Senior S0012")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/78 years/i)).toBeInTheDocument();

    // Verify Overview Stats
    expect(screen.getByText("Health Risk")).toBeInTheDocument();
    expect(screen.getByText("Last Check-in")).toBeInTheDocument();
    expect(screen.getByText("Next Visit")).toBeInTheDocument();

    // Verify AI Call Summary & Medication
    expect(screen.getByText("Recent AI Call Summary")).toBeInTheDocument();
    expect(screen.getByText("Medication")).toBeInTheDocument();
    expect(screen.getByText("Latest Vitals")).toBeInTheDocument();

    // Verify Pinned Action Buttons
    expect(screen.getByRole("button", { name: /Call Senior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Schedule Visit/i })).toBeInTheDocument();
  });

  it("resets drawer state when switching seniors without retaining stale data", async () => {
    const { rerender } = render(
      <SeniorProfileDrawer
        key="S0012"
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    expect(await screen.findByText("Kamala Sharma")).toBeInTheDocument();
    expect(screen.getByText("Senior S0012")).toBeInTheDocument();

    // Switch to another senior (Savitri Devi S0054)
    rerender(
      <SeniorProfileDrawer
        key="S0054"
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0054"
      />
    );

    // Newly selected senior must appear cleanly
    expect(await screen.findByText("Savitri Devi")).toBeInTheDocument();
    expect(screen.getByText("Senior S0054")).toBeInTheDocument();
    expect(screen.getByText(/75 years/i)).toBeInTheDocument();

    // Kamala Sharma must NOT remain in the document
    expect(screen.queryByText("Kamala Sharma")).not.toBeInTheDocument();
    expect(screen.queryByText("Senior S0012")).not.toBeInTheDocument();
  });

  it("displays active alert banner with distinct alert ID and triggers triage action correctly", async () => {
    const mockAlert: OperationalAlertItem = {
      alert_id: "ALT_00033",
      senior_id: "S0013",
      senior_name: "Pushpa Kapoor",
      city_id: "CITY_BENGALURU",
      severity: "URGENT_REVIEW",
      status: "ESCALATED",
      triggering_signals: "Acute dizziness and delayed mobility check-in",
      recommended_next_step: "Immediate clinical triage & field caretaker visit",
      created_at: "2026-10-29 09:30:00",
      last_updated_at: "2026-10-29 09:30:00",
    };

    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0013"
        activeAlert={mockAlert}
        onTriageAlert={onTriageAlertMock}
      />
    );

    // Should display Pushpa Kapoor and Senior S0013
    expect(await screen.findByText("Pushpa Kapoor")).toBeInTheDocument();
    expect(screen.getByText("Senior S0013")).toBeInTheDocument();

    // Should display the active alert signal
    expect(screen.getByText(/Acute dizziness and delayed mobility check-in/i)).toBeInTheDocument();

    // Clicking Triage should pass mockAlert to onTriageAlert
    const triageBtn = screen.getByRole("button", { name: /Triage >/i });
    fireEvent.click(triageBtn);

    expect(onTriageAlertMock).toHaveBeenCalledTimes(1);
    expect(onTriageAlertMock).toHaveBeenCalledWith(mockAlert);
    expect(onTriageAlertMock.mock.calls[0][0].alert_id).toBe("ALT_00033");
    expect(onTriageAlertMock.mock.calls[0][0].senior_id).toBe("S0013");
  });

  it("calls onClose when close button is clicked", async () => {
    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    const closeBtn = await screen.findByRole("button", { name: /Close Senior Profile/i });
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("switches tabs between Overview, Health, Visits, AI Call, Messages, Profile", async () => {
    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    // Switch to Health tab
    const healthTab = screen.getByTitle("Health & Vitals");
    fireEvent.click(healthTab);
    expect(await screen.findByText(/Clinical Baseline Parameters/i)).toBeInTheDocument();

    // Switch to Visits tab
    const visitsTab = screen.getByTitle("Visits Schedule");
    fireEvent.click(visitsTab);
    expect(await screen.findByText(/Care Visit Records/i)).toBeInTheDocument();

    // Switch to Profile tab
    const profileTab = screen.getByTitle("Demographics & DPDP");
    fireEvent.click(profileTab);
    expect(await screen.findByText(/Personal & Guardian Demographics/i)).toBeInTheDocument();
  });

  it("opens View Transcript modal when clicking View Transcript", async () => {
    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    const transcriptBtn = screen.getByRole("button", { name: /View Transcript/i });
    fireEvent.click(transcriptBtn);

    expect(await screen.findByText(/Call Transcript & Dialogue/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Priya • Sahaj AI Agent/i).length).toBeGreaterThan(0);
  });

  it("opens Call Senior modal when clicking Call Senior", async () => {
    render(
      <SeniorProfileDrawer
        isOpen={true}
        onClose={onCloseMock}
        seniorId="S0012"
      />
    );

    const callBtn = screen.getByRole("button", { name: /Call Senior/i });
    fireEvent.click(callBtn);

    expect(await screen.findByText(/Connecting through care bridge/i)).toBeInTheDocument();
  });
});
