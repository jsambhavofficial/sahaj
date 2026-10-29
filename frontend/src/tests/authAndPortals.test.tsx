import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AppProvider } from "../context/AppContext";
import { Navbar } from "../components/layout/Navbar";
import { defaultApiClient } from "../services/apiClient";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/admin",
}));

describe("Phase 3 Authentication & Portal Navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("restores user session from localStorage cache", async () => {
    const mockUser = {
      id: "usr_admin_001",
      organization_id: "org_samarth_central",
      email: "admin@samarth.org",
      full_name: "Aarav Sharma",
      role: "ORGANIZATION_ADMIN" as const,
      is_active: true,
      is_verified: true,
      staff_profile: null,
    };

    localStorage.setItem("samarth_auth_token", "jwt_token_sample");
    localStorage.setItem("samarth_auth_user", JSON.stringify(mockUser));

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(mockUser);

    let authState: any = null;
    const TestComponent = () => {
      authState = useAuth();
      return <div>User: {authState.user?.email || "None"}</div>;
    };

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    expect(screen.getByText("User: admin@samarth.org")).toBeInTheDocument();
    expect(authState.isAdmin).toBe(true);
    expect(authState.isCityManager).toBe(false);
  });

  it("handles login and logout lifecycle", async () => {
    const managerUser = {
      id: "usr_mgr_delhi",
      organization_id: "org_samarth_central",
      email: "delhi.mgr@samarth.org",
      full_name: "Pooja Malhotra",
      role: "CITY_MANAGER" as const,
      is_active: true,
      is_verified: true,
      staff_profile: {
        employee_code: "DEL-MGR-01",
        city_id: "CITY_DELHI",
        specialization: "Regional Operations",
        on_duty_status: "AVAILABLE",
        max_active_cases: 100,
      },
    };

    vi.spyOn(defaultApiClient, "post").mockImplementation(async (url: string) => {
      if (url.includes("/login")) {
        return {
          access_token: "test_jwt_mgr",
          token_type: "bearer",
          user: managerUser,
        };
      }
      return { status: "logged_out" };
    });

    let authState: any = null;
    const TestComponent = () => {
      authState = useAuth();
      return (
        <div>
          <span>Current: {authState.user?.full_name || "Guest"}</span>
          <button onClick={() => authState.login("delhi.mgr@samarth.org", "Pass123")}>
            Login
          </button>
          <button onClick={() => authState.logout()}>Logout</button>
        </div>
      );
    };

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    expect(screen.getByText("Current: Guest")).toBeInTheDocument();

    await act(async () => {
      await authState.login("delhi.mgr@samarth.org", "Pass123");
    });

    expect(screen.getByText("Current: Pooja Malhotra")).toBeInTheDocument();
    expect(authState.isCityManager).toBe(true);
    expect(authState.assignedCityId).toBe("CITY_DELHI");
    expect(localStorage.getItem("samarth_auth_token")).toBe("test_jwt_mgr");

    await act(async () => {
      await authState.logout();
    });

    expect(screen.getByText("Current: Guest")).toBeInTheDocument();
    expect(localStorage.getItem("samarth_auth_token")).toBeNull();
  });

  it("renders Navbar with Admin portal links when logged in as Organization Admin", async () => {
    const adminUser = {
      id: "usr_admin_001",
      organization_id: "org_samarth_central",
      email: "admin@samarth.org",
      full_name: "Admin Aarav",
      role: "ORGANIZATION_ADMIN" as const,
      is_active: true,
      is_verified: true,
      staff_profile: null,
    };

    localStorage.setItem("samarth_auth_token", "jwt_token_sample");
    localStorage.setItem("samarth_auth_user", JSON.stringify(adminUser));

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(adminUser);

    await act(async () => {
      render(
        <AppProvider>
          <AuthProvider>
            <Navbar />
          </AuthProvider>
        </AppProvider>
      );
    });

    expect(screen.getByText("Admin Aarav")).toBeInTheDocument();
    expect(screen.getByText("ORGANIZATION ADMIN")).toBeInTheDocument();
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
    expect(screen.getAllByText("Cities").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Staff").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Audit Logs").length).toBeGreaterThan(0);
  });

  it("renders Navbar with City Manager portal links when logged in as City Manager", async () => {
    const managerUser = {
      id: "usr_mgr_delhi",
      organization_id: "org_samarth_central",
      email: "delhi.mgr@samarth.org",
      full_name: "Pooja Malhotra",
      role: "CITY_MANAGER" as const,
      is_active: true,
      is_verified: true,
      staff_profile: {
        employee_code: "DEL-MGR-01",
        city_id: "CITY_DELHI",
        specialization: "Operations",
        on_duty_status: "AVAILABLE",
        max_active_cases: 100,
      },
    };

    localStorage.setItem("samarth_auth_token", "jwt_token_sample");
    localStorage.setItem("samarth_auth_user", JSON.stringify(managerUser));

    vi.spyOn(defaultApiClient, "get").mockResolvedValue(managerUser);

    await act(async () => {
      render(
        <AppProvider>
          <AuthProvider>
            <Navbar />
          </AuthProvider>
        </AppProvider>
      );
    });

    expect(screen.getByText("Pooja Malhotra")).toBeInTheDocument();
    expect(screen.getByText("CITY MANAGER")).toBeInTheDocument();
    expect(screen.getByText("City Manager")).toBeInTheDocument();
    expect(screen.getAllByText("Caretakers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("My Seniors").length).toBeGreaterThan(0);
  });
});
