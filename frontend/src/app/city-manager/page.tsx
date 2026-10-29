"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  UserCog,
  Bell,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { CityManagerDashboard } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerDashboardPage() {
  const { user, isCityManager } = useAuth();
  const [data, setData] = useState<CityManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<CityManagerDashboard>(
        "/api/v1/operational/city-manager/dashboard"
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load city manager operational dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl"></div>
          ))}
        </div>
        <div className="h-72 bg-slate-100 animate-pulse rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-lg font-bold text-red-900">City Jurisdiction Error</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const criticalCount = data.alerts_by_severity["URGENT_REVIEW"] || 0;
  const highCount = data.alerts_by_severity["HIGH"] || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {data.city_name} Chapter Operations
            </h1>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[11px] font-bold rounded-full">
              City Manager Scope
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {data.state}, India • Jurisdiction code: <code className="font-mono text-slate-700">{data.city_id}</code>
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Dashboard
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Enrolled Seniors in {data.city_name}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.active_seniors_count}
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Monitored in active caseloads
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Field Caretakers</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.caretakers_count}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Assigned to this chapter</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCog className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Open AI Alerts</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.open_alerts_count}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold">
              <span className="px-1.5 py-0.2 bg-red-100 text-red-700 rounded">
                {criticalCount} Urgent
              </span>
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                {highCount} High
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/city-manager/seniors"
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between group transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              Seniors Roster
            </p>
            <p className="text-[11px] text-slate-500">View seniors in {data.city_name}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          href="/city-manager/caretakers"
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between group transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              Caretaker Team
            </p>
            <p className="text-[11px] text-slate-500">Caseload assignments</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          href="/city-manager/alerts"
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between group transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              Triage City Alerts
            </p>
            <p className="text-[11px] text-slate-500">{data.open_alerts_count} pending triage</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
        </Link>
      </div>

      {/* Caretaker Caseload Section & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Alerts in this City */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Alerts in {data.city_name}</h3>
              <p className="text-xs text-slate-500">Directly actionable clinical & behavioral signals</p>
            </div>
            <Link
              href="/city-manager/alerts"
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              All City Alerts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {data.recent_alerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No active alerts reported in {data.city_name}.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recent_alerts.map((a) => (
                <div
                  key={a.alert_id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          a.severity === "URGENT_REVIEW"
                            ? "bg-red-100 text-red-800"
                            : a.severity === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {a.severity.replace("_", " ")}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{a.senior_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({a.senior_id})</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{a.triggering_signals}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {a.created_at}
                    </span>
                    <Link
                      href={`/city-manager/alerts?search=${a.alert_id}`}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs"
                    >
                      Triage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Caretaker Caseload Team */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Caretakers in {data.city_name}</h3>
              <p className="text-xs text-slate-500">Active caseload load balancing</p>
            </div>
            <Link
              href="/city-manager/caretakers"
              className="text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              Details
            </Link>
          </div>

          {data.caretakers_caseload.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No caretakers registered in {data.city_name}.
            </p>
          ) : (
            <div className="space-y-3">
              {data.caretakers_caseload.map((c) => (
                <div
                  key={c.caretaker_id}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{c.caretaker_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{c.employee_code}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{c.active_senior_count}</span>
                    <span className="text-[10px] text-slate-500 block">seniors assigned</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

