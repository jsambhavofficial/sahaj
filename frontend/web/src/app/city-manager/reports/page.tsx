"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  RefreshCw,
  AlertCircle,
  Building2,
  Users,
  Bell,
  UserCog,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { ReportsSummary } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Assigned City";

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await defaultApiClient.get<ReportsSummary>(
        "/api/v1/operational/reports/summary"
      );
      setData(summary);
    } catch (err: any) {
      setError(err?.message || "Failed to load city reports summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 animate-pulse rounded-2xl"></div>
          <div className="h-64 bg-slate-100 animate-pulse rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-lg font-bold text-red-900">Failed to Load Reports</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalSeniors = Object.values(data.seniors_by_risk_tier).reduce((a, b) => a + b, 0);
  const totalAlerts = Object.values(data.alerts_by_status).reduce((a, b) => a + b, 0);
  const totalStaff = Object.values(data.staff_by_role).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-600" />
            {cityName} Operational Reports & Caseload Metrics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Municipal caseload distributions, triage metrics, and risk tiering for your chapter.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Seniors in {cityName}
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalSeniors}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Logged Alerts
          </span>
          <p className="text-2xl font-black text-rose-600 mt-1">{totalAlerts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Assigned Staff
          </span>
          <p className="text-2xl font-black text-brand-700 mt-1">{totalStaff}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Tier Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <Users className="w-4 h-4 text-brand-600" />
            <h3>Seniors by Baseline Risk Tier</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.seniors_by_risk_tier).length === 0 ? (
              <p className="text-xs text-slate-400">No senior baseline data available.</p>
            ) : (
              Object.entries(data.seniors_by_risk_tier).map(([tier, count]) => (
                <div key={tier} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{tier}</span>
                    <span className="font-mono text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        tier === "CRITICAL" || tier === "HIGH"
                          ? "bg-rose-500"
                          : tier === "MODERATE" || tier === "MEDIUM"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: totalSeniors > 0 ? `${(count / totalSeniors) * 100}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts by Severity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <ShieldAlert className="w-4 h-4 text-brand-600" />
            <h3>Alerts by Severity Level</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.alerts_by_severity).length === 0 ? (
              <p className="text-xs text-slate-400">No alerts logged for this city.</p>
            ) : (
              Object.entries(data.alerts_by_severity).map(([sev, count]) => (
                <div key={sev} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{sev}</span>
                    <span className="font-mono text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        sev === "CRITICAL"
                          ? "bg-rose-600"
                          : sev === "HIGH" || sev === "URGENT_REVIEW"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width: totalAlerts > 0 ? `${(count / totalAlerts) * 100}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts by Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <Bell className="w-4 h-4 text-brand-600" />
            <h3>Alert Triage Disposition</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.alerts_by_status).length === 0 ? (
              <p className="text-xs text-slate-400">No alert status data.</p>
            ) : (
              Object.entries(data.alerts_by_status).map(([st, count]) => (
                <div key={st} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{st}</span>
                    <span className="font-mono text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        st === "OPEN"
                          ? "bg-rose-500"
                          : st === "ACKNOWLEDGED"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: totalAlerts > 0 ? `${(count / totalAlerts) * 100}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff by Role */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <UserCog className="w-4 h-4 text-brand-600" />
            <h3>Assigned Staff by Role</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.staff_by_role).length === 0 ? (
              <p className="text-xs text-slate-400">No staff records in city.</p>
            ) : (
              Object.entries(data.staff_by_role).map(([roleName, count]) => (
                <div key={roleName} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{roleName.replace("_", " ")}</span>
                    <span className="font-mono text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600"
                      style={{
                        width: totalStaff > 0 ? `${(count / totalStaff) * 100}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

