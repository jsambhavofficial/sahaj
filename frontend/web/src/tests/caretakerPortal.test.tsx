import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AppProvider } from "../context/AppContext";
import { Navbar } from "../components/layout/Navbar";
import { defaultApiClient } from "../services/apiClient";
import CaretakerSchedulePage from "../app/caretaker/page";
import CaretakerSeniorsPage from "../app/caretaker/seniors/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/caretaker",
  useParams: () => ({ visitId: "vis_sample_001" }),
}));

describe("Phase 4 Caretaker Portal & Visit Management Frontend", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders Caretaker navigation items in Navbar when logged in as Caretaker", async () => {
    const mockCaretakerUser = {
      id: "usr_ct_001",
      organization_id: "org_samarth_central",
      email: "caretaker_001@samarth.ai",
      full_name: "Aarav Patel",
      role: "CARETAKER",
      is_active: true,
      is_verified: true,
      staff_profile: {
        id: "stf_001",
        user_id: "usr_ct_001",
        city_id: "CITY_BLR",
        employee_code: "EMP-BLR-001",
        specialization: "General Eldercare",
        on_duty_status: "ON_DUTY",
      },
    };

    localStorage.setItem("samarth_auth_token", "test_caretaker_jwt");
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockCaretakerUser));

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockCaretakerUser);

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <Navbar />
          </AppProvider>
        </AuthProvider>
      );
    });

    expect(screen.getAllByText("Today's Schedule").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("My Seniors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visit History").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Caretaker Portal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Aarav Patel").length).toBeGreaterThanOrEqual(1);
  });

  it("fetches and displays daily visit schedule with progress counters", async () => {
    const mockSchedule = {
      total_assigned_today: 2,
      completed_today: 1,
      in_progress_today: 1,
      pending_today: 0,
      active_visit_id: "vis_in_prog_01",
      visits: [
        {
          id: "vis_in_prog_01",
          caretaker_user_id: "usr_ct_001",
          caretaker_name: "Aarav Patel",
          senior_id: "S0001",
          senior_name: "Ramesh Gupta",
          senior_city_id: "CITY_BLR",
          senior_address: "142 Indiranagar, 4th Cross",
          senior_phone: "+91-9876543210",
          senior_emergency_phone: "+91-9876500000",
          visit_type: "ROUTINE_HOME_CHECK",
          visit_purpose: "Routine Morning Check",
          status: "IN_PROGRESS",
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 3600000).toISOString(),
          actual_start: new Date(Date.now() - 1800000).toISOString(),
          actual_end: null,
          completion_outcome: null,
          summary_notes: null,
          cancellation_reason: null,
          follow_up_required: false,
          task_count: 3,
          completed_task_count: 2,
          concern_count: 0,
        },
      ],
    };

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockSchedule);

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <CaretakerSchedulePage />
          </AppProvider>
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Active Visit In Progress")).toBeDefined();
      expect(screen.getAllByText("Ramesh Gupta").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Resume Visit Execution")).toBeDefined();
    });
  });

  it("fetches and renders assigned seniors directory with emergency contacts", async () => {
    const mockSeniors = [
      {
        senior_id: "S0001",
        name: "Ramesh Gupta",
        age: 78,
        city_id: "CITY_BLR",
        primary_phone: "+91-9876543210",
        emergency_contact_name: "Pooja Gupta",
        emergency_contact_phone: "+91-9876500000",
        address: "142 Indiranagar, Bengaluru",
        baseline_risk_tier: "HIGH",
        living_arrangement: "ALONE",
        assignment_role: "PRIMARY_CARETAKER",
      },
    ];

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockSeniors);

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <CaretakerSeniorsPage />
          </AppProvider>
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("My Assigned Senior Citizens")).toBeDefined();
      expect(screen.getByText("Ramesh Gupta")).toBeDefined();
      expect(screen.getByText("HIGH RISK")).toBeDefined();
      expect(screen.getByText("142 Indiranagar, Bengaluru")).toBeDefined();
    });
  });
});
