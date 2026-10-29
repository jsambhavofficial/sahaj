"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { UserPublicProfile } from "../types/api";
import { defaultApiClient } from "../services/apiClient";

interface AuthContextValue {
  user: UserPublicProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<UserPublicProfile>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  role: string | null;
  isAdmin: boolean;
  isCityManager: boolean;
  isCaretaker: boolean;
  isFamily: boolean;
  isSenior: boolean;
  assignedCityId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublicProfile | null>(null);
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
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore parse error
        }
      }

      if (storedToken) {
        setToken(storedToken);
        try {
          const profile = await defaultApiClient.get<UserPublicProfile>("/api/v1/auth/me");
          setUser(profile);
          localStorage.setItem("samarth_auth_user", JSON.stringify(profile));
        } catch (err) {
          // If network error, retain cached user profile if present
          if (!(err instanceof Error && err.message?.includes("fetch"))) {
            console.warn("Stored authentication token invalid or expired. Clearing session.");
            localStorage.removeItem("samarth_auth_token");
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
    async (email: string, password: string = "Password@123!"): Promise<UserPublicProfile> => {
      setLoading(true);
      try {
        const res = await defaultApiClient.post<{
          access_token: string;
          token_type: string;
          user: UserPublicProfile;
        }>("/api/v1/auth/login", {
          email,
          password,
        });

        const authToken = res.access_token;
        const authUser = res.user;

        localStorage.setItem("samarth_auth_token", authToken);
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

  const logout = useCallback(async () => {
    try {
      if (token) {
        await defaultApiClient.post("/api/v1/auth/logout");
      }
    } catch {
      // Best-effort logout notification
    } finally {
      localStorage.removeItem("samarth_auth_token");
      localStorage.removeItem("samarth_auth_user");
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const role = user?.role || null;
  const isAdmin = role === "ORGANIZATION_ADMIN";
  const isCityManager = role === "CITY_MANAGER";
  const isCaretaker = role === "CARETAKER";
  const isFamily = role === "FAMILY";
  const isSenior = role === "SENIOR";
  const assignedCityId = user?.staff_profile?.city_id || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        role,
        isAdmin,
        isCityManager,
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
