import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider } from "../context/AuthContext";
import { AppProvider } from "../context/AppContext";
import { Navbar } from "../components/layout/Navbar";
import { defaultApiClient } from "../services/apiClient";
import SeniorDashboardPage from "../app/senior/page";
import SeniorCheckInPage from "../app/senior/check-in/page";
import SeniorVisitsPage from "../app/senior/visits/page";
import SeniorHelpPage from "../app/senior/help/page";
import SeniorProfilePage from "../app/senior/profile/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/senior",
  useParams: () => ({}),
}));

describe("Phase 7 Senior Citizen Portal & Check-in Frontend", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const mockSeniorUser = {
    id: "usr_senior_001",
    organization_id: "org_samarth_central",
    email: "senior_s0001@samarth.ai",
    full_name: "Ramesh Gupta",
    role: "SENIOR",
    is_active: true,
    is_verified: true,
  };

  const mockDashboardData = {
    senior_id: "S0001",
    senior_name: "Ramesh Gupta",
    age: 74,
    city_name: "Chandigarh",
    living_arrangement: "independent",
    preferred_language: "Hindi",
    next_scheduled_visit: {
      id: "v_next_001",
      visit_type: "ROUTINE_CHECKIN",
      visit_purpose: "Weekly Blood Pressure & Wellbeing Visit",
      status: "SCHEDULED",
      scheduled_start: "2026-10-30T10:00:00Z",
      scheduled_end: "2026-10-30T11:00:00Z",
      caretaker_name: "Aarav Patel (Care Coordinator)",
    },
    latest_completed_visit: {
      id: "v_past_001",
      visit_type: "ROUTINE_CHECKIN",
      visit_purpose: "Routine Field Care Visit",
      status: "COMPLETED",
      scheduled_start: "2026-10-23T10:00:00Z",
      scheduled_end: "2026-10-23T11:00:00Z",
      actual_start: "2026-10-23T10:05:00Z",
      actual_end: "2026-10-23T10:55:00Z",
      caretaker_name: "Aarav Patel",
      senior_summary: "Visit completed successfully.",
    },
    latest_checkin: {
      id: "ci_001",
      checkin_date: "2026-10-28",
      general_wellbeing: "FEELING_WELL",
      general_wellbeing_label: "Tabiyat achhi hai / Feeling well",
      concern_categories: [],
      change_from_usual: "SAME",
      help_requested: false,
    },
    care_team: {
      city_name: "Chandigarh",
      coordinator_name: "Aarav Patel (Field Caretaker)",
      office_phone: "+91 172 274 0001",
      support_email: "care.chandigarh@samarth.ai",
      hours: "Monday – Saturday: 8:00 AM – 8:00 PM IST",
    },
    pending_help_requests_count: 0,
    today_status_message: "Aapki agli visit 2026-10-30 ko scheduled hai.",
    disclaimer: "Aapka wellbeing record surakshit hai. Emergency ke liye 112 par call karein.",
  };

  it("1. Navbar renders Senior-specific Hindi/English links when signed in as Senior", async () => {
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockSeniorUser));
    localStorage.setItem("samarth_auth_token", "fake_senior_jwt");

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockSeniorUser);

    render(
      <AuthProvider>
        <AppProvider>
          <Navbar />
        </AppProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Aaj Ki Care").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Tabiyat Batayein").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Meri Visits").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Help Chahiye").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Meri Profile").length).toBeGreaterThan(0);
    });
  });

  it("2. Senior Dashboard ('Aaj Ki Care') renders hero card, next visit, and care team info", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockDashboardData);

    render(<SeniorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ramesh Gupta/)).toBeInTheDocument();
      expect(screen.getByText("Agli Home Visit")).toBeInTheDocument();
      expect(screen.getByText("Weekly Blood Pressure & Wellbeing Visit")).toBeInTheDocument();
      expect(screen.getAllByText(/Aarav Patel/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Chandigarh Chapter/)).toBeInTheDocument();
    });
  });

  it("3. Senior Check-in 5-step wizard navigates steps and submits with idempotency", async () => {
    const mockPost = vi.spyOn(defaultApiClient, "post").mockResolvedValue({
      id: "ci_new_123",
      senior_id: "S0001",
      submission_time: "2026-10-29T10:00:00Z",
      general_wellbeing: "FEELING_WELL",
      general_wellbeing_label: "Tabiyat achhi hai / Feeling well",
      concern_categories: [],
      help_requested: false,
      status: "RECORDED",
      confirmation_message: "Dhanyawaad! Aapka tabiyat ka update darj ho gaya hai.",
    });

    render(<SeniorCheckInPage />);

    // Step 1: Feeling Well
    expect(screen.getByText("Kadam 1: Aaj aap kaisa mehsoos kar rahe hain?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Aage Badhein (Next)"));

    // Step 2: Specific Concerns
    expect(screen.getByText("Kadam 2: Kya koi khaas takleef ya pareshani hai?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Aage Badhein (Next)"));

    // Step 3: Change from usual
    expect(screen.getByText("Kadam 3: Pichhle dinon ki tulna mein kaisa hai?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Aage Badhein (Next)"));

    // Step 4: Callback toggle
    expect(screen.getByText("Kadam 4: Kya aap Samarth team se phone par baat karna chahte hain?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Aage Badhein (Review)"));

    // Step 5: Review & Submit
    expect(screen.getByText("Kadam 5: Jaankari Ki Pushti (Review & Submit)")).toBeInTheDocument();
    const submitBtn = screen.getByText("Submit Karein");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/senior/check-ins",
        expect.objectContaining({
          general_wellbeing: "FEELING_WELL",
          help_requested: false,
        })
      );
      expect(screen.getByText("Shukriya! Aapki Tabiyat Ki Jaankari Darz Ho Gayi Hai")).toBeInTheDocument();
    });
  });

  it("4. Senior Visits page displays upcoming and past visits", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue([
      mockDashboardData.next_scheduled_visit,
      mockDashboardData.latest_completed_visit,
    ]);

    render(<SeniorVisitsPage />);

    await waitFor(() => {
      expect(screen.getByText("Meri Visits (Caregiver Visits)")).toBeInTheDocument();
      expect(screen.getByText("Weekly Blood Pressure & Wellbeing Visit")).toBeInTheDocument();
      expect(screen.getByText("Purn (Completed)")).toBeInTheDocument();
    });
  });

  it("5. Senior Help page submits callback request and lists history", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue([
      {
        id: "cb_001",
        category: "PLEASE_CALL_ME",
        message: "Kripya mujhe call karein.",
        status: "RESOLVED",
        preferred_contact_method: "PHONE",
        resolution_notes: "Coordinator talked to senior.",
        created_at: "2026-10-28T14:00:00Z",
      },
    ]);

    const mockPost = vi.spyOn(defaultApiClient, "post").mockResolvedValue({
      id: "cb_002",
      senior_id: "S0001",
      category: "PLEASE_CALL_ME",
      status: "SUBMITTED",
      message: "Namaste, kripya mujhe call karein.",
    });

    render(<SeniorHelpPage />);

    await waitFor(() => {
      expect(screen.getByText("Help Chahiye (Direct Support & Callback)")).toBeInTheDocument();
      expect(screen.getByText(/Coordinator talked to senior/)).toBeInTheDocument();
    });

    const submitBtn = screen.getByText("Request Bhejein (Submit)");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });
  });

  it("6. Senior Profile page displays details, DPDP notice and updates preferences", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue({
      senior_id: "S0001",
      user_id: "usr_senior_001",
      name: "Ramesh Gupta",
      age: 74,
      city_name: "Chandigarh",
      preferred_language: "Hindi",
      living_arrangement: "independent",
      primary_phone: "+91 98765 00001",
      emergency_contact_name: "Pooja Gupta",
      emergency_contact_phone: "+91 98765 43210",
      has_active_dpdp_consent: true,
      authorized_family_members: [
        {
          link_id: "lnk_001",
          family_user_id: "usr_fam_001",
          family_member_name: "Pooja Gupta",
          relationship_type: "Daughter",
          is_active: true,
          linked_at: "2026-10-01T10:00:00Z",
        },
      ],
    });

    const mockPatch = vi.spyOn(defaultApiClient, "patch").mockResolvedValue({
      senior_id: "S0001",
      user_id: "usr_senior_001",
      name: "Ramesh Gupta",
      age: 74,
      city_name: "Chandigarh",
      preferred_language: "Punjabi",
      living_arrangement: "independent",
      emergency_contact_name: "Pooja Gupta",
      emergency_contact_phone: "+91 98765 43210",
      has_active_dpdp_consent: true,
      authorized_family_members: [],
    });

    render(<SeniorProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Meri Profile & Privacy (DPDP 2023)")).toBeInTheDocument();
      expect(screen.getByText("74 Saal")).toBeInTheDocument();
      expect(screen.getByText("Pooja Gupta")).toBeInTheDocument();
      expect(screen.getByText(/DPDP Act 2023/)).toBeInTheDocument();
    });

    const saveBtn = screen.getByText("Badlav Save Karein");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });
  });
});
