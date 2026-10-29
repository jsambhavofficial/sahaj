"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { defaultApiClient } from "@/services/apiClient";

interface CityManagerContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openAlertsCount: number;
  setOpenAlertsCount: (n: number) => void;
  backendConnected: boolean;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const CityManagerContext = createContext<CityManagerContextType>({
  searchQuery: "",
  setSearchQuery: () => {},
  openAlertsCount: 17,
  setOpenAlertsCount: () => {},
  backendConnected: true,
  refreshTrigger: 0,
  triggerRefresh: () => {},
});

export const useCityManager = () => useContext(CityManagerContext);

export function CityManagerProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openAlertsCount, setOpenAlertsCount] = useState<number>(17);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Check backend health periodically
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        await defaultApiClient.get("/health");
        if (isMounted) setBackendConnected(true);
      } catch {
        if (isMounted) setBackendConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <CityManagerContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        openAlertsCount,
        setOpenAlertsCount,
        backendConnected,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </CityManagerContext.Provider>
  );
}

