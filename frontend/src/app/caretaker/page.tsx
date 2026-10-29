"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Phone,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  Users,
  FileText,
  Activity,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { CaretakerScheduleResponse, VisitSummaryItem } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CaretakerSchedulePage() {
  const { user, isCaretaker } = useAuth();
  const [data, setData] = useState<CaretakerScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "TODAY" | "COMPLETED">("TODAY");

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<CaretakerScheduleResponse>(
        "/api/v1/caretaker/schedule"
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load today's visit schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "--:--";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric", weekday: "short" });
    } catch {
      return "";
    }
  };

  const activeVisit = data?.visits.find((v) => v.status === "IN_PROGRESS");

  const filteredVisits = (data?.visits || []).filter((v) => {
    if (filter === "TODAY") {
      const today = new Date().toDateString();
      const vDate = new Date(v.scheduled_start).toDateString();
      return vDate === today;
    }
    if (filter === "COMPLETED") {
      return v.status === "COMPLETED";
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Caretaker Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Field Caretaker
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {user?.staff_profile?.city_id ? user.staff_profile.city_id.replace("CITY_", "") : "Bengaluru"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Hello, {user?.full_name || "Aarav Patel"}
          </h1>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSchedule}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
          <Link
            href="/caretaker/seniors"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>My Seniors</span>
          </Link>
        </div>
      </div>

      {/* Active Visit Alert Banner */}
      {activeVisit && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                Active Visit In Progress
              </span>
            </div>
            <h2 className="text-lg font-black tracking-tight">{activeVisit.senior_name}</h2>
            <p className="text-xs text-emerald-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {activeVisit.senior_address || "Bengaluru Home"}
            </p>
          </div>
          <Link
            href={`/caretaker/visits/${activeVisit.id}`}
            className="w-full sm:w-auto px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <PlayCircle className="w-4 h-4 fill-emerald-800 text-white" />
            <span>Resume Visit Execution</span>
          </Link>
        </div>
      )}

      {/* Daily Progress Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Assigned Today</span>
            <Calendar className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {data?.total_assigned_today ?? "--"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {data?.completed_today ?? "--"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            {data?.in_progress_today ?? "--"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {data?.pending_today ?? "--"}
          </div>
        </div>
      </div>

      {/* Visits List Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Home Visit Schedule</h2>
            <p className="text-xs text-slate-500">Scheduled in-person visits and care routines</p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setFilter("TODAY")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                filter === "TODAY" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                filter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Assigned
            </button>
            <button
              onClick={() => setFilter("COMPLETED")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                filter === "COMPLETED" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500">Loading visit schedule...</p>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold">No visits found for the selected view.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredVisits.map((visit) => {
              const isToday =
                new Date(visit.scheduled_start).toDateString() === new Date().toDateString();

              return (
                <div
                  key={visit.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatTime(visit.scheduled_start)} - {formatTime(visit.scheduled_end)}
                      </span>
                      {!isToday && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {formatDate(visit.scheduled_start)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          visit.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : visit.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : visit.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {visit.status.replace("_", " ")}
                      </span>
                      {visit.completion_outcome && (
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          {visit.completion_outcome.replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {visit.senior_name || "Senior Citizen"}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">({visit.senior_id})</span>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{visit.senior_address || "Bengaluru Home Address"}</span>
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="font-medium text-slate-700">
                        {visit.visit_purpose || visit.visit_type.replace("_", " ")}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {visit.completed_task_count} / {visit.task_count} Tasks
                      </span>
                      {visit.concern_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {visit.concern_count} Concern{visit.concern_count > 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {visit.senior_emergency_phone && (
                      <a
                        href={`tel:${visit.senior_emergency_phone}`}
                        title="Emergency Call"
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                      </a>
                    )}

                    <Link
                      href={`/caretaker/visits/${visit.id}`}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors ${
                        visit.status === "IN_PROGRESS"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : visit.status === "SCHEDULED"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      }`}
                    >
                      {visit.status === "IN_PROGRESS" ? (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          <span>Resume</span>
                        </>
                      ) : visit.status === "SCHEDULED" ? (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          <span>Start Visit</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          <span>View Summary</span>
                        </>
                      )}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Emergency Protocol Card */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-amber-900">
          <p className="font-bold">In-Home Emergency Protocol</p>
          <p className="text-[11px] text-amber-800">
            In case of acute medical distress, fall injury, or unconsciousness: call 108 immediately, notify City Manager, and flag the in-home concern as <span className="font-bold">URGENT</span> to dispatch immediate clinical support.
          </p>
        </div>
      </div>
    </div>
  );
}

