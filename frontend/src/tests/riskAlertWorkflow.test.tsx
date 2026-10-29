import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider } from "../context/AuthContext";
import { AppProvider } from "../context/AppContext";
import { defaultApiClient } from "../services/apiClient";
import CityManagerAlertsPage from "../app/city-manager/alerts/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/city-manager/alerts",
}));

describe("Phase 5 AI Risk Engine & Alert Workflow Frontend", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("fetches and renders municipal alerts list with triage actions", async () => {
    const mockManager = {
      id: "usr_mgr_blr",
      organization_id: "org_samarth_central",
      email: "bengaluru_mgr@samarth.ai",
      full_name: "Rajesh Rao",
      role: "CITY_MANAGER",
      is_active: true,
      is_verified: true,
      staff_profile: {
        id: "stf_mgr_01",
        user_id: "usr_mgr_blr",
        city_id: "CITY_BENGALURU",
        employee_code: "EMP-MGR-BLR",
        specialization: "Operations",
        on_duty_status: "ON_DUTY",
      },
    };

    const mockAlerts = [
      {
        alert_id: "ALT_00101",
        senior_id: "S0004",
        senior_name: "Senior S0004",
        city_id: "CITY_BENGALURU",
        severity: "URGENT_REVIEW",
        status: "OPEN",
        triggering_signals: "Acute fall reported; severe hypertensive spike (175 mmHg)",
        recommended_next_step: "Immediate in-person welfare visit required.",
        created_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
    ];

    localStorage.setItem("samarth_auth_token", "test_jwt_token");
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockManager));

    vi.spyOn(defaultApiClient, "get").mockImplementation((endpoint: string) => {
      if (endpoint.includes("/operational/alerts")) {
        return Promise.resolve(mockAlerts);
      }
      if (endpoint.includes("/operational/staff")) {
        return Promise.resolve([
          {
            user_id: "usr_ct_blr",
            full_name: "Aarav Patel",
            role: "CARETAKER",
            email: "caretaker_blr@samarth.ai",
            employee_code: "EMP-BLR-01",
          },
        ]);
      }
      return Promise.resolve(mockManager);
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <CityManagerAlertsPage />
          </AppProvider>
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Clinical & Operational Alerts Desk")).toBeDefined();
      expect(screen.getByText("ALT_00101")).toBeDefined();
      expect(screen.getByText("Senior S0004")).toBeDefined();
      expect(screen.getByText("URGENT REVIEW")).toBeDefined();
    });
  });

  it("opens alert dossier and displays rule score vs ML probability side-by-side", async () => {
    const mockManager = {
      id: "usr_mgr_blr",
      organization_id: "org_samarth_central",
      email: "bengaluru_mgr@samarth.ai",
      full_name: "Rajesh Rao",
      role: "CITY_MANAGER",
      is_active: true,
      is_verified: true,
      staff_profile: {
        id: "stf_mgr_01",
        user_id: "usr_mgr_blr",
        city_id: "CITY_BENGALURU",
        employee_code: "EMP-MGR-BLR",
        specialization: "Operations",
        on_duty_status: "ON_DUTY",
      },
    };

    const mockAlerts = [
      {
        alert_id: "ALT_00101",
        senior_id: "S0004",
        senior_name: "Senior S0004",
        city_id: "CITY_BENGALURU",
        severity: "URGENT_REVIEW",
        status: "OPEN",
        triggering_signals: "Acute fall reported",
        recommended_next_step: "Immediate in-person welfare visit required.",
        created_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
    ];

    const mockDetail = {
      id: "ALT_00101",
      senior_id: "S0004",
      senior_name: "Senior S0004",
      senior_city_id: "CITY_BENGALURU",
      senior_address: "142 Indiranagar, Bengaluru",
      senior_phone: "+91-9876543210",
      emergency_contact_name: "Pooja Gupta",
      emergency_contact_phone: "+91-9876500000",
      severity: "URGENT_REVIEW",
      status: "OPEN",
      triggering_signals: "Acute fall reported",
      recommended_next_step: "Immediate in-person welfare visit required.",
      assessment_id: "asm_sample_01",
      assessment: {
        id: "asm_sample_01",
        senior_id: "S0004",
        assessment_date: "2026-10-29",
        rule_score: 85,
        rule_category: "URGENT_REVIEW",
        ml_probability: 0.82,
        ml_risk_score: 82,
        ml_risk_level: "URGENT_REVIEW",
        model_version: "2.0.0",
        is_safety_tripwire: true,
        top_contributing_factors: [
          { rule_id: "RULE_ACUTE_FALL", evidence: "Senior check-in note confirmed slip or fall" },
        ],
        top_feature_influences: [],
        data_quality_flags: [],
        recommended_action: "Immediate post-fall safety protocol.",
        status: "COMPLETED",
        trigger_source: "MANUAL_REQUEST",
        disclaimer: "Synthetic clinical decision support output. Non-diagnostic.",
        created_at: new Date().toISOString(),
      },
      assigned_to_user_id: null,
      assigned_to_name: null,
      follow_up_required: false,
      follow_up_notes: null,
      follow_up_tasks: [],
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgement_notes: null,
      resolved_by: null,
      resolved_at: null,
      resolution_reason: null,
      created_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    };

    localStorage.setItem("samarth_auth_token", "test_jwt_token");
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockManager));

    vi.spyOn(defaultApiClient, "get").mockImplementation((endpoint: string) => {
      if (endpoint === "/api/v1/operational/alerts/ALT_00101") {
        return Promise.resolve(mockDetail);
      }
      if (endpoint.includes("/operational/alerts")) {
        return Promise.resolve(mockAlerts);
      }
      if (endpoint.includes("/operational/staff")) {
        return Promise.resolve([]);
      }
      return Promise.resolve(mockManager);
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <CityManagerAlertsPage />
          </AppProvider>
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Dossier")).toBeDefined();
    });

    // Click "Dossier"
    await act(async () => {
      fireEvent.click(screen.getByText("Dossier"));
    });

    await waitFor(() => {
      expect(screen.getByText("Rule-Based Clinical Score")).toBeDefined();
      expect(screen.getByText("ML Statistical Anomaly Probability")).toBeDefined();
      expect(screen.getByText("85")).toBeDefined();
      expect(screen.getByText("82%")).toBeDefined();
      expect(screen.getByText("RULE_ACUTE_FALL:")).toBeDefined();
    });
  });
});

