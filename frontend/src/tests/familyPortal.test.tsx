import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider } from "../context/AuthContext";
import { AppProvider } from "../context/AppContext";
import { Navbar } from "../components/layout/Navbar";
import { defaultApiClient } from "../services/apiClient";
import FamilyDashboardPage from "../app/family/page";
import FamilyVisitsPage from "../app/family/visits/page";
import FamilyContactPage from "../app/family/contact/page";
import FamilyProfilePage from "../app/family/profile/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/family",
  useParams: () => ({}),
}));

describe("Phase 6 Family Portal & Care Transparency Frontend", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const mockFamilyUser = {
    id: "usr_fam_001",
    organization_id: "org_samarth_central",
    email: "family_s0001@samarth.ai",
    full_name: "Pooja Gupta",
    role: "FAMILY",
    is_active: true,
    is_verified: true,
  };

  const mockFamilyProfile = {
    id: "usr_fam_001",
    email: "family_s0001@samarth.ai",
    full_name: "Pooja Gupta",
    role: "FAMILY",
    phone_number: "+91 98765 43210",
    linked_seniors: [
      {
        senior_id: "S0001",
        name: "Ramesh Gupta",
        age: 74,
        city_name: "Chandigarh",
        relationship_type: "Daughter",
        permission_tier: "FULL_READ",
        authorization_status: "ACTIVE",
        granted_at: "2026-10-01T10:00:00Z",
        has_active_consent: true,
      },
    ],
  };

  const mockCareSummary = {
    senior_id: "S0001",
    name: "Ramesh Gupta",
    age: 74,
    city_name: "Chandigarh",
    living_arrangement: "Living Alone",
    care_status: "Active Care Management",
    next_scheduled_visit: {
      id: "vis_001",
      visit_type: "ROUTINE_CHECKIN",
      visit_purpose: "Routine In-Person Wellbeing Check",
      status: "SCHEDULED",
      scheduled_start: "2026-10-30T10:00:00Z",
      scheduled_end: "2026-10-30T11:00:00Z",
      assigned_caretaker_name: "Aarav P. (Care Coordinator)",
      family_summary: "Care coordinator will perform scheduled wellness review.",
      completion_outcome: null,
    },
    latest_completed_visit: {
      id: "vis_000",
      visit_type: "ROUTINE_CHECKIN",
      visit_purpose: "Routine Field Care Visit",
      status: "COMPLETED",
      scheduled_start: "2026-10-25T10:00:00Z",
      scheduled_end: "2026-10-25T11:00:00Z",
      actual_start: "2026-10-25T10:05:00Z",
      actual_end: "2026-10-25T10:55:00Z",
      assigned_caretaker_name: "Aarav P. (Care Coordinator)",
      family_summary: "Completed routine visit. Senior was well.",
      completion_outcome: "NORMAL_ROUTINE",
    },
    latest_wellbeing_checkin: {
      id: "ci_001",
      checkin_date: "2026-10-29T08:00:00Z",
      overall_status: "Reported Feeling Well",
      reported_mood: "4/5",
      reported_pain: "1/10",
      sleep_hours: 7.5,
      meal_nutrition_status: "REGULAR",
      factual_notes: "Enjoyed morning walk in garden.",
    },
    recent_updates: [
      {
        id: "alt_001",
        timestamp: "2026-10-28T14:00:00Z",
        category: "CARE_UPDATE",
        title: "Care Review Completed",
        message: "Care coordinator completed observation review. Routine monitoring continues.",
        status: "Resolved",
        action_taken: "Care coordination active",
      },
    ],
    care_team_contact: {
      city_name: "Chandigarh",
      office_phone: "+91 172 274 0001",
      support_email: "care.chandigarh@samarth.ai",
      hours: "Monday – Saturday: 8:00 AM – 8:00 PM IST",
    },
    disclaimer: "Factual elder-care coordination summary. Non-diagnostic. Prepared for authorized family members.",
  };

  it("renders Family navigation links in Navbar when logged in as FAMILY", async () => {
    localStorage.setItem("samarth_auth_token", "test_family_jwt");
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockFamilyUser));

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockFamilyUser);

    await act(async () => {
      render(
        <AuthProvider>
          <AppProvider>
            <Navbar />
          </AppProvider>
        </AuthProvider>
      );
    });

    expect(screen.getAllByText("Family Home").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Visits & Schedule").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contact & Requests").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile & Privacy").length).toBeGreaterThan(0);
  });

  it("renders Family Dashboard with authorized senior summary and visits", async () => {
    vi.spyOn(defaultApiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/api/v1/family/profile")) {
        return Promise.resolve(mockFamilyProfile);
      }
      if (url.includes("/care-summary")) {
        return Promise.resolve(mockCareSummary);
      }
      return Promise.resolve({});
    });

    await act(async () => {
      render(<FamilyDashboardPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Ramesh Gupta")).toBeDefined();
    });

    expect(screen.getByText("Active Care Management")).toBeDefined();
    expect(screen.getByText("Next Scheduled Visit")).toBeDefined();
    expect(screen.getByText("Latest Completed Visit")).toBeDefined();
    expect(screen.getByText("Latest Wellbeing Log")).toBeDefined();
    expect(screen.getByText("Care Updates & Coordinator Actions")).toBeDefined();
    expect(screen.getByText("+91 172 274 0001")).toBeDefined();
  });

  it("submits callback request in Family Contact page", async () => {
    vi.spyOn(defaultApiClient, "get").mockImplementation((url: string) => {
      if (url.includes("/api/v1/family/profile")) {
        return Promise.resolve(mockFamilyProfile);
      }
      if (url.includes("/callback-requests")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    const mockCreatedCb = {
      id: "cb_req_101",
      senior_id: "S0001",
      senior_name: "Ramesh Gupta",
      family_user_id: "usr_fam_001",
      family_user_name: "Pooja Gupta",
      category: "VISIT_RESCHEDULE",
      preferred_contact_method: "PHONE",
      message: "Please call regarding morning schedule.",
      status: "SUBMITTED",
      created_at: "2026-10-29T12:00:00Z",
      updated_at: "2026-10-29T12:00:00Z",
    };

    const postSpy = vi.spyOn(defaultApiClient, "post").mockResolvedValue(mockCreatedCb);

    await act(async () => {
      render(<FamilyContactPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Request a Callback or Send Inquiry")).toBeDefined();
    });

    // Enter message
    const textarea = screen.getByPlaceholderText(/Describe your inquiry/i);
    fireEvent.change(textarea, { target: { value: "Please call regarding morning schedule." } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Submit Callback Request/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(postSpy).toHaveBeenCalledWith("/api/v1/family/callback-requests", expect.objectContaining({
      senior_id: "S0001",
      message: "Please call regarding morning schedule.",
    }));

    await waitFor(() => {
      expect(screen.getByText(/Callback request submitted successfully/i)).toBeDefined();
    });
  });

  it("renders Family Profile page with linked seniors and consent status", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockFamilyProfile);

    await act(async () => {
      render(
        <AuthProvider>
          <FamilyProfilePage />
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Ramesh Gupta")).toBeDefined();
    });

    expect(screen.getByText("DPDP Consent")).toBeDefined();
    expect(screen.getByText("FULL_READ")).toBeDefined();
    expect(screen.getByText("Revoke My Access")).toBeDefined();
  });
});
