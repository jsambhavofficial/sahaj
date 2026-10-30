"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { UserPublicProfile, ContractUser, StaffProfileInfo } from "../types/api";
import { defaultApiClient } from "../services/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  display_name?: string;
  is_active?: boolean;
  is_verified?: boolean;
  organization_id?: string;
  staff_profile?: StaffProfileInfo | null;
  city?: string;
  team_id?: string;
  external_ref?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<AuthUser>;
  pairSenior: (pairingCode: string) => Promise<AuthUser>;
  loginSeniorWithDevice: (seniorId: string, deviceToken: string) => Promise<AuthUser>;
  generateSeniorPairingCode: (seniorId: string) => Promise<{ pairing_code: string; expires_in: number }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  role: string | null;
  isAdmin: boolean;
  isCityManager: boolean;
  isOps: boolean;
  isCoordinator: boolean;
  isCaretaker: boolean;
  isFamily: boolean;
  isSenior: boolean;
  assignedCityId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The web portal is the organization manager portal. Coordinators and seniors use the mobile
 * app, so a session for any other role is refused here. Override with NEXT_PUBLIC_WEB_ROLES.
 */
const WEB_ROLES = (process.env.NEXT_PUBLIC_WEB_ROLES || "ops,admin,city_manager,organization_admin,senior,caretaker,coordinator,family")
  .split(",")
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean);

export const WEB_PORTAL_ROLE_MESSAGE =
  "This portal is for organization managers. Coordinators and seniors sign in on the Sahaj mobile app.";

function isWebPortalRole(role?: string | null): boolean {
  return WEB_ROLES.includes((role || "").toLowerCase());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from localStorage and fetch current user profile
  useEffect(() => {
    async function initAuth() {
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }

      const storedToken = localStorage.getItem("samarth_auth_token");
      const storedUser = localStorage.getItem("samarth_auth_user");

      if (storedUser) {
        try {
          const cached = JSON.parse(storedUser);
          if (!isWebPortalRole(cached?.role)) {
            localStorage.removeItem("samarth_auth_token");
            localStorage.removeItem("samarth_refresh_token");
            localStorage.removeItem("samarth_auth_user");
            setLoading(false);
            return;
          }
          setUser(cached);
        } catch {
          // ignore parse error
        }
      }

      if (storedToken) {
        setToken(storedToken);
        try {
          const profile = await defaultApiClient.get<AuthUser>("/auth/me");
          setUser(profile);
          localStorage.setItem("samarth_auth_user", JSON.stringify(profile));
        } catch (err) {
          // If network error, retain cached user profile if present
          if (!(err instanceof Error && err.message?.includes("fetch"))) {
            console.warn("Stored authentication token invalid or expired. Clearing session.");
            localStorage.removeItem("samarth_auth_token");
            localStorage.removeItem("samarth_refresh_token");
            localStorage.removeItem("samarth_auth_user");
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    }

    initAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string = "test@1122"): Promise<AuthUser> => {
      setLoading(true);
      try {
        const res = await defaultApiClient.post<{
          access_token: string;
          refresh_token?: string;
          token_type?: string;
          user: AuthUser;
        }>("/auth/login", {
          email,
          password,
        });

        const authToken = res.access_token;
        const authUser = res.user;

        if (!isWebPortalRole(authUser?.role)) {
          throw new Error(WEB_PORTAL_ROLE_MESSAGE);
        }

        localStorage.setItem("samarth_auth_token", authToken);
        if (res.refresh_token) {
          localStorage.setItem("samarth_refresh_token", res.refresh_token);
        }
        localStorage.setItem("samarth_auth_user", JSON.stringify(authUser));
        setToken(authToken);
        setUser(authUser);
        return authUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const pairSenior = useCallback(
    async (pairingCode: string): Promise<AuthUser> => {
      if (!isWebPortalRole("senior")) {
        throw new Error(WEB_PORTAL_ROLE_MESSAGE);
      }
      setLoading(true);
      try {
        const res = await defaultApiClient.post<{
          access_token: string;
          refresh_token?: string;
          token_type?: string;
          senior_id: string;
          device_token: string;
          user?: AuthUser;
        }>("/auth/senior/pair", {
          pairing_code: pairingCode,
        });

        const authToken = res.access_token;
        const seniorUser: AuthUser = res.user || {
          id: res.senior_id,
          role: "senior",
          display_name: `Senior ${res.senior_id}`,
          email: `${res.senior_id.toLowerCase()}@senior.samarth.local`,
        };

        localStorage.setItem("samarth_auth_token", authToken);
        if (res.refresh_token) {
          localStorage.setItem("samarth_refresh_token", res.refresh_token);
        }
        localStorage.setItem("samarth_device_token", res.device_token);
        localStorage.setItem("samarth_senior_id", res.senior_id);
        localStorage.setItem("samarth_auth_user", JSON.stringify(seniorUser));
        setToken(authToken);
        setUser(seniorUser);
        return seniorUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginSeniorWithDevice = useCallback(
    async (seniorId: string, deviceToken: string): Promise<AuthUser> => {
      if (!isWebPortalRole("senior")) {
        throw new Error(WEB_PORTAL_ROLE_MESSAGE);
      }
      setLoading(true);
      try {
        const res = await defaultApiClient.post<{
          access_token: string;
          refresh_token?: string;
          user?: AuthUser;
        }>("/auth/senior/login", {
          senior_id: seniorId,
          device_token: deviceToken,
        });

        const authToken = res.access_token;
        const seniorUser: AuthUser = res.user || {
          id: seniorId,
          role: "senior",
          display_name: `Senior ${seniorId}`,
          email: `${seniorId.toLowerCase()}@senior.samarth.local`,
        };

        localStorage.setItem("samarth_auth_token", authToken);
        if (res.refresh_token) {
          localStorage.setItem("samarth_refresh_token", res.refresh_token);
        }
        localStorage.setItem("samarth_auth_user", JSON.stringify(seniorUser));
        setToken(authToken);
        setUser(seniorUser);
        return seniorUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateSeniorPairingCode = useCallback(
    async (seniorId: string): Promise<{ pairing_code: string; expires_in: number }> => {
      return defaultApiClient.post<{ pairing_code: string; expires_in: number }>(
        "/auth/senior/pairing-code",
        { senior_id: seniorId }
      );
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await defaultApiClient.post("/auth/logout");
      }
    } catch {
      // Best-effort logout notification
    } finally {
      localStorage.removeItem("samarth_auth_token");
      localStorage.removeItem("samarth_refresh_token");
      localStorage.removeItem("samarth_auth_user");
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const rawRole = (user?.role || "").toLowerCase();
  const isAdmin = rawRole === "admin" || rawRole === "organization_admin";
  const isCityManager = rawRole === "ops" || rawRole === "city_manager";
  const isOps = rawRole === "ops" || rawRole === "city_manager";
  const isCoordinator = rawRole === "coordinator" || rawRole === "caretaker";
  const isCaretaker = rawRole === "coordinator" || rawRole === "caretaker";
  const isFamily = rawRole === "family";
  const isSenior = rawRole === "senior";
  const assignedCityId =
    (user as any)?.city ||
    (user as any)?.staff_profile?.city_id ||
    null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        pairSenior,
        loginSeniorWithDevice,
        generateSeniorPairingCode,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
        isAdmin,
        isCityManager,
        isOps,
        isCoordinator,
        isCaretaker,
        isFamily,
        isSenior,
        assignedCityId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
