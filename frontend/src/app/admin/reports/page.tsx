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
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { ReportsSummary } from "@/types/api";

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await defaultApiClient.get<ReportsSummary>(
        "/api/v1/operational/reports/summary"
      );
      setData(summary);
    } catch (err: any) {
      setError(err?.message || "Failed to load operational reports summary.");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-600" />
            Executive Operational Reports & Distributions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated population distributions across chapters, staff allocations, and risk categories.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seniors by Chapter */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <Building2 className="w-4 h-4 text-brand-600" />
            <h3>Seniors Enrolled by Chapter</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.seniors_by_city).map(([cityId, count]) => (
              <div key={cityId} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700">{cityId.replace("CITY_", "")}</span>
                  <span className="text-slate-900">{count} seniors</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (count / 40) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts by Severity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <Bell className="w-4 h-4 text-amber-600" />
            <h3>Alerts Distribution by Severity</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.alerts_by_severity).map(([sev, count]) => (
              <div
                key={sev}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${
                    sev === "URGENT_REVIEW"
                      ? "bg-red-100 text-red-800"
                      : sev === "HIGH"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {sev.replace("_", " ")}
                </span>
                <p className="text-2xl font-black text-slate-900 mt-2">{count}</p>
                <p className="text-[11px] text-slate-500">Recorded events</p>
              </div>
            ))}
          </div>
        </div>

        {/* Staff by Role */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <UserCog className="w-4 h-4 text-emerald-600" />
            <h3>Operational Staffing by Role</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.staff_by_role).map(([role, count]) => (
              <div
                key={role}
                className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{role.replace("_", " ")}</span>
                  <p className="text-[11px] text-slate-500">Authorized personnel</p>
                </div>
                <span className="text-base font-black text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alert Triage Status Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-sm text-slate-900">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <h3>Alert Triage Lifecycle Status</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(data.alerts_by_status).map(([st, count]) => (
              <div
                key={st}
                className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{st}</span>
                  <p className="text-[11px] text-slate-500">Current status pool</p>
                </div>
                <span className="text-base font-black text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

