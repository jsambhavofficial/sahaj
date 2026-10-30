"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  UserCog,
  Bell,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Calendar,
  Zap,
  Play,
  CheckCircle2,
  Activity,
  Sparkles,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { getDataService } from "@/services";
import { AdminDashboardMetrics, AdminJobRunResponse } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function AdminDashboardPage() {
  const { user, isAdmin } = useAuth();
  const dataService = getDataService();
  const [data, setData] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contract 5.4: Admin Jobs State
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [jobResponses, setJobResponses] = useState<Record<string, AdminJobRunResponse>>({});

  const handleRunJob = async (jobName: string) => {
    setRunningJob(jobName);
    try {
      const res = await dataService.runAdminJob(jobName);
      setJobResponses((prev) => ({ ...prev, [jobName]: res }));
    } catch (err: any) {
      alert(`Job failed to trigger: ${err?.message || "Unknown error"}`);
    } finally {
      setRunningJob(null);
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<AdminDashboardMetrics>(
        "/api/v1/operational/admin/dashboard"
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load executive admin dashboard metrics.");
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
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg"></div>
          <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl"></div>
          ))}
        </div>
        <div className="h-80 bg-slate-100 animate-pulse rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-lg font-bold text-red-900">Failed to Load Dashboard</h3>
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
  const modCount = data.alerts_by_severity["MODERATE"] || 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Organization Admin Overview
            </h1>
            <span className="px-2 py-0.5 bg-brand-100 text-brand-800 text-[11px] font-bold rounded-full">
              National HQ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time population health and operational performance across all operating chapters.
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Monitored Seniors</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.total_active_seniors}
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 100% active in care plans
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Active City Chapters</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.total_active_cities}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Across 8 regional states</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Staff In Field</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {data.total_active_caretakers + data.total_city_managers}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {data.total_active_caretakers} Caretakers, {data.total_city_managers} Managers
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCog className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Active AI Alerts</p>
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

      {/* City Chapters Operational Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Regional Chapter Performance</h3>
            <p className="text-xs text-slate-500">Active senior populations and alert levels by city</p>
          </div>
          <Link
            href="/admin/cities"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Manage Chapters <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Tier / State</th>
                <th className="py-3 px-4 text-center">Monitored Seniors</th>
                <th className="py-3 px-4 text-center">Active Caretakers</th>
                <th className="py-3 px-4 text-center">Open Alerts</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {data.cities_summary.map((c) => (
                <tr key={c.city_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {c.name}
                    <span className="block text-[10px] text-slate-400 font-mono font-normal">
                      {c.city_id}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    Tier {c.tier} • {c.state}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    {c.senior_count}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700">
                    {c.caretaker_count}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        c.open_alerts_count > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.open_alerts_count}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/cities/${c.city_id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 rounded transition-colors inline-flex items-center gap-1"
                    >
                      View Chapter <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract 5.4: System Admin & Batch AI Pipeline Jobs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>System Admin &amp; Batch AI Pipeline Jobs</span>
              <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                POST /admin/jobs/&#123;name&#125;/run
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Trigger asynchronous background worker jobs for clinical risk calculations, ML calibration, and reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              id: "run_daily_risk",
              title: "Run Daily Risk Pipeline",
              desc: "Recompute deterministic rule scores & ML risk percentiles for all seniors.",
              icon: Activity,
            },
            {
              id: "refresh_ml_predictions",
              title: "Refresh ML Predictions",
              desc: "Batch infer and calibrate machine learning risk probabilities.",
              icon: Sparkles,
            },
            {
              id: "sync_vitals",
              title: "Sync Vitals Ingestion",
              desc: "Poll and aggregate vitals from IoT devices and mobile check-ins.",
              icon: Zap,
            },
            {
              id: "generate_daily_reports",
              title: "Generate Daily Reports",
              desc: "Compile ops summaries, caseload status, and city performance metrics.",
              icon: Building2,
            },
            {
              id: "send_morning_notifications",
              title: "Send Morning Notifications",
              desc: "Dispatch scheduled check-in reminders and alerts to coordinators.",
              icon: Bell,
            },
          ].map((job) => {
            const isRunning = runningJob === job.id;
            const res = jobResponses[job.id];
            const JobIcon = job.icon;

            return (
              <div
                key={job.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex flex-col justify-between gap-3 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <JobIcon className="w-4 h-4 text-brand-600" />
                      <span>{job.title}</span>
                    </div>
                    {res && (
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          res.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : res.status === "running"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {res.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{job.desc}</p>
                  {res && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Task: {res.task_id || res.job_name || res.job} • {res.triggered_at ? new Date(res.triggered_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleRunJob(job.id)}
                  disabled={isRunning}
                  className="w-full py-1.5 px-3 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-lg text-xs font-bold text-slate-700 hover:text-brand-700 flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-98 disabled:opacity-60"
                >
                  <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin text-brand-600" : "fill-current"}`} />
                  <span>{isRunning ? "Triggering..." : "Execute Job"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Alerts Feed & Caretaker Visits Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Alerts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent High-Priority Alerts</h3>
              <p className="text-xs text-slate-500">Alerts requiring coordinator evaluation and triage</p>
            </div>
            <Link
              href="/admin/alerts"
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Alerts Center <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {data.recent_alerts.map((a) => (
              <div
                key={a.alert_id}
                className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                    {a.city_id && (
                      <span className="text-[10px] text-slate-500 bg-slate-200/60 px-1.5 py-0.2 rounded">
                        {a.city_id.replace("CITY_", "")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1">{a.triggering_signals}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {a.created_at}
                  </span>
                  <Link
                    href={`/admin/alerts?search=${a.alert_id}`}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs"
                  >
                    Triage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Caretaker Visits Phase 4 Preview */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Calendar className="w-4 h-4 text-brand-600" />
            <h3>Field Visits & Schedules</h3>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
              Phase 4 Caretaker Scope
            </span>
            <p className="text-xs text-slate-600 font-medium">
              Daily physical visits, geofence verification, and mobile check-in logging are scheduled for Phase 4 rollout.
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500">Scheduled Today:</span>
              <span className="font-bold text-slate-700">0 (Planned)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-200/60">
              <span className="text-slate-500">Completed:</span>
              <span className="font-bold text-slate-700">0</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Exceptions:</span>
              <span className="font-bold text-emerald-600">None</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

