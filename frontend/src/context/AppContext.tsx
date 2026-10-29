"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  Alert,
  DashboardMetrics,
  SeniorSummary,
  SeniorProfile,
} from "../types/domain";
import { AlertFilterParams, SeniorFilterParams, ContractAlertObject } from "../types/api";
import { getDataService } from "../services";
import { IDataService } from "../services/dataService";

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface AppContextValue {
  service: IDataService;
  coordinatorId: string;
  setCoordinatorId: (id: string) => void;
  metrics: DashboardMetrics | null;
  loadingMetrics: boolean;
  refreshMetrics: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  // State-mutating actions
  acknowledgeAlert: (alertId: string, notes?: string) => Promise<Alert | ContractAlertObject>;
  resolveAlert: (alertId: string, reason: string) => Promise<Alert | ContractAlertObject>;
  lastUpdated: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [service] = useState<IDataService>(() => getDataService());
  const [coordinatorId, setCoordinatorId] = useState<string>("COORD_001");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const addToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      setLoadingMetrics(true);
      const data = await service.getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics:", err);
      addToast("Failed to update dashboard population metrics.", "error");
    } finally {
      setLoadingMetrics(false);
    }
  }, [service, addToast]);

  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  const acknowledgeAlert = useCallback(
    async (alertId: string, notes?: string): Promise<Alert | ContractAlertObject> => {
      try {
        const updated = await service.acknowledgeAlert(
          alertId,
          coordinatorId,
          notes
        );
        addToast(`Alert ${alertId} acknowledged.`, "success");
        setLastUpdated(Date.now());
        await refreshMetrics();
        return updated;
      } catch (err: any) {
        addToast(
          err.message || `Failed to acknowledge alert ${alertId}`,
          "error"
        );
        throw err;
      }
    },
    [service, coordinatorId, addToast, refreshMetrics]
  );

  const resolveAlert = useCallback(
    async (alertId: string, reason: string): Promise<Alert | ContractAlertObject> => {
      try {
        const updated = await service.resolveAlert(
          alertId,
          coordinatorId,
          reason
        );
        addToast(`Alert ${alertId} marked as resolved.`, "success");
        setLastUpdated(Date.now());
        await refreshMetrics();
        return updated;
      } catch (err: any) {
        addToast(
          err.message || `Failed to resolve alert ${alertId}`,
          "error"
        );
        throw err;
      }
    },
    [service, coordinatorId, addToast, refreshMetrics]
  );

  return (
    <AppContext.Provider
      value={{
        service,
        coordinatorId,
        setCoordinatorId,
        metrics,
        loadingMetrics,
        refreshMetrics,
        toasts,
        addToast,
        removeToast,
        acknowledgeAlert,
        resolveAlert,
        lastUpdated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
}

