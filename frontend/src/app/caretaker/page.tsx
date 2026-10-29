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
  TrendingUp,
  TrendingDown,
  Sparkles,
  PhoneCall,
  Check,
  X,
  ExternalLink,
  Search,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  CaretakerScheduleResponse,
  PriorityListResponse,
  PriorityListItem,
} from "@/types/api";
import { getDataService } from "@/services";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";

export default function CaretakerSchedulePage() {
  const { user } = useAuth();
  const { addToast } = useApp();
  const dataService = getDataService();

  // Navigation mode: "VISITS_SCHEDULE" | "ATTENTION_TODAY" (Contract v1)
  const [activeTab, setActiveTab] = useState<"VISITS_SCHEDULE" | "ATTENTION_TODAY">("VISITS_SCHEDULE");

  // Priority Attention State
  const [selectedDate, setSelectedDate] = useState<string>("2026-10-11");
  const [priorityData, setPriorityData] = useState<PriorityListResponse | null>(null);
  const [loadingPriority, setLoadingPriority] = useState<boolean>(true);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");

  // Call simulation state
  const [callingItem, setCallingItem] = useState<PriorityListItem | null>(null);
  const [callStatus, setCallStatus] = useState<"initiating" | "connected" | "ended">("initiating");
  const [callDuration, setCallDuration] = useState<number>(0);

  // Field Visits State
  const [visitData, setVisitData] = useState<CaretakerScheduleResponse | null>(null);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [visitFilter, setVisitFilter] = useState<"ALL" | "TODAY" | "COMPLETED">("TODAY");

  // Fetch Priority List (Contract 3.1: /coordinators/me/today?date=)
  const fetchPriorityList = async (dateStr: string) => {
    setLoadingPriority(true);
    setPriorityError(null);
    try {
      const res = await dataService.getCoordinatorToday(dateStr);
      setPriorityData(res);
    } catch (err: any) {
      setPriorityError(err?.message || "Failed to load priority attention list.");
    } finally {
      setLoadingPriority(false);
    }
  };

  // Fetch Visit Schedule
  const fetchVisitSchedule = async () => {
    setLoadingVisits(true);
    setVisitError(null);
    try {
      const res = await defaultApiClient.get<CaretakerScheduleResponse>(
        "/api/v1/caretaker/schedule"
      );
      setVisitData(res);
    } catch (err: any) {
      setVisitError(err?.message || "Failed to load today's visit schedule.");
    } finally {
      setLoadingVisits(false);
    }
  };

  useEffect(() => {
    fetchPriorityList(selectedDate);
    fetchVisitSchedule();
  }, [selectedDate]);

  // Handle call timer
  useEffect(() => {
    let timer: any;
    if (callingItem && callStatus === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callingItem, callStatus]);

  const handleStartCall = async (item: PriorityListItem) => {
    setCallingItem(item);
    setCallStatus("initiating");
    setCallDuration(0);
    try {
      await dataService.connectCall(
        item.senior.senior_id,
        true,
        user?.id || "coord_001"
      );
      setTimeout(() => {
        setCallStatus("connected");
      }, 1200);
    } catch (err: any) {
      addToast(err?.message || "Failed to connect call via VoIP bridge.", "error");
      setCallingItem(null);
    }
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    addToast(`Call with ${callingItem?.senior.display_name} logged successfully.`, "success");
    setTimeout(() => {
      setCallingItem(null);
      setCallDuration(0);
    }, 1000);
  };

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

  const activeVisit = visitData?.visits.find((v) => v.status === "IN_PROGRESS");

  const filteredVisits = (visitData?.visits || []).filter((v) => {
    if (visitFilter === "TODAY") {
      const today = new Date().toDateString();
      const vDate = new Date(v.scheduled_start).toDateString();
      return vDate === today;
    }
    if (visitFilter === "COMPLETED") {
      return v.status === "COMPLETED";
    }
    return true;
  });

  const filteredPriorityItems = (priorityData?.items || []).filter((item: PriorityListItem) => {
    if (riskFilter === "ALL") return true;
    return item.risk_level.toLowerCase() === riskFilter.toLowerCase();
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Caretaker & Coordinator Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800">
              Care Coordinator & Caretaker
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {user?.city || (user?.staff_profile?.city_id ? user.staff_profile.city_id.replace("CITY_", "") : "Bengaluru")}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Hello, {user?.full_name || user?.display_name || "Pooja Sharma"}
          </h1>
          <p className="text-xs text-slate-500">
            SamarthCare AI Command • Protocol Target Date: <span className="font-semibold text-slate-700">{selectedDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === "ATTENTION_TODAY") fetchPriorityList(selectedDate);
              else fetchVisitSchedule();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingPriority || loadingVisits) ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
          <Link
            href="/caretaker/seniors"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>My Caseload</span>
          </Link>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("ATTENTION_TODAY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "ATTENTION_TODAY"
              ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-rose-600" />
          <span>Who Needs Attention Today</span>
          {priorityData && priorityData.items.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
              {priorityData.items.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("VISITS_SCHEDULE")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "VISITS_SCHEDULE"
              ? "bg-brand-50 text-brand-700 border border-brand-200 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4 text-brand-600" />
          <span>Home Visits Schedule</span>
          {visitData && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
              {visitData.visits.length}
            </span>
          )}
        </button>
      </div>

      {/* ACTIVE TAB 1: WHO NEEDS ATTENTION TODAY (/coordinators/me/today) */}
      {activeTab === "ATTENTION_TODAY" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Priority Controls Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Ranked Caseload Priority</span>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Deterministic Score + Calibrated ML
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Sorted by acute clinical risk, vital deviations, and medication non-adherence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                {["ALL", "urgent", "high", "rising"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskFilter(r)}
                    className={`px-2.5 py-1 rounded-md font-bold capitalize transition-all ${
                      riskFilter === r
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Urgent Attention</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {priorityData?.items.filter((s: PriorityListItem) => s.risk_level === "urgent").length ?? 0}
              </div>
              <span className="text-[10px] text-slate-400">Immediate coordinator intervention</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">High Risk Tier</span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {priorityData?.items.filter((s: PriorityListItem) => s.risk_level === "high").length ?? 0}
              </div>
              <span className="text-[10px] text-slate-400">Escalating vitals or cues</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rising Concerns</span>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {priorityData?.items.filter((s: PriorityListItem) => s.risk_level === "rising").length ?? 0}
              </div>
              <span className="text-[10px] text-slate-400">Early deviation signals</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Caseload</span>
              <div className="text-2xl font-black text-brand-700 mt-1">
                {priorityData?.items.length ?? 0}
              </div>
              <span className="text-[10px] text-slate-400">Assigned senior roster</span>
            </div>
          </div>

          {/* Priority Seniors List */}
          {priorityError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{priorityError}</span>
            </div>
          )}

          {loadingPriority ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500">Calculating deterministic risk & ranking ML probabilities...</p>
            </div>
          ) : filteredPriorityItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2 shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No seniors match the selected filter.</p>
              <p className="text-xs text-slate-400">All caseload seniors are stable or outside the selected criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPriorityItems.map((item: PriorityListItem) => {
                const isUrgent = item.risk_level === "urgent";
                const isHigh = item.risk_level === "high";
                const rankDelta =
                  item.previous_rank !== undefined && item.previous_rank !== null
                    ? item.previous_rank - item.rank
                    : null;

                return (
                  <div
                    key={item.senior.senior_id}
                    className={`bg-white rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md ${
                      isUrgent
                        ? "border-rose-300 ring-1 ring-rose-300/40"
                        : isHigh
                        ? "border-amber-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Rank & Identity */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center ${
                              isUrgent
                                ? "bg-rose-600 text-white shadow-sm shadow-rose-200"
                                : isHigh
                                ? "bg-amber-500 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            #{item.rank}
                          </span>

                          {/* Rank Delta Indicator */}
                          <div className="mt-1 flex items-center gap-0.5 text-[10px] font-bold">
                            {rankDelta !== null && rankDelta > 0 ? (
                              <span className="text-rose-600 flex items-center" title={`Moved up ${rankDelta} positions`}>
                                <TrendingUp className="w-3 h-3" />
                                +{rankDelta}
                              </span>
                            ) : rankDelta !== null && rankDelta < 0 ? (
                              <span className="text-emerald-600 flex items-center" title={`Moved down ${Math.abs(rankDelta)} positions`}>
                                <TrendingDown className="w-3 h-3" />
                                {rankDelta}
                              </span>
                            ) : rankDelta === 0 ? (
                              <span className="text-slate-400 font-mono">-</span>
                            ) : (
                              <span className="text-purple-600 uppercase font-black text-[9px] px-1 bg-purple-50 rounded">
                                NEW
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/seniors/${item.senior.senior_id}`}
                              className="text-base font-black text-slate-900 hover:text-brand-600 transition-colors flex items-center gap-1.5"
                            >
                              <span>{item.senior.display_name}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </Link>

                            <span className="text-xs text-slate-500 font-mono">
                              ({item.senior.senior_id})
                            </span>

                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isUrgent
                                  ? "bg-rose-100 text-rose-800"
                                  : isHigh
                                  ? "bg-amber-100 text-amber-800"
                                  : item.risk_level === "rising"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {item.risk_level}
                            </span>

                            {rankDelta !== null && rankDelta > 0 && (
                              <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                ↑ {rankDelta} positions
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>
                              {item.senior.age} years
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.senior.city}
                            </span>
                            <span>•</span>
                            <span className="capitalize">
                              Lang: {item.senior.preferred_language}
                            </span>
                          </div>

                          {/* Plain Language Reason */}
                          <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-700 leading-relaxed font-medium">
                            <span className="font-bold text-slate-900 mr-1">Primary Reasons:</span>
                            {item.reasons.length > 0 ? item.reasons.join("; ") : "Scheduled routine clinical monitoring."}
                          </div>

                          {item.suggested_action && (
                            <div className="text-[11px] text-brand-700 font-semibold flex items-center gap-1 pt-0.5">
                              <span>Action:</span>
                              <span>{item.suggested_action}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Scores & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        {/* Score badges */}
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Clinical Risk</div>
                            <div className="text-sm font-black text-slate-800">{item.risk_score}/100</div>
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartCall(item)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Quick Call</span>
                          </button>

                          <Link
                            href={`/seniors/${item.senior.senior_id}`}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <span>Dossier</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE TAB 2: FIELD VISITS SCHEDULE */}
      {activeTab === "VISITS_SCHEDULE" && (
        <div className="space-y-6 animate-in fade-in">
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
                {visitData?.total_assigned_today ?? "--"}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {visitData?.completed_today ?? "--"}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700">
                {visitData?.in_progress_today ?? "--"}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700">
                {visitData?.pending_today ?? "--"}
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
                  onClick={() => setVisitFilter("TODAY")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    visitFilter === "TODAY" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setVisitFilter("ALL")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    visitFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Assigned
                </button>
                <button
                  onClick={() => setVisitFilter("COMPLETED")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    visitFilter === "COMPLETED" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>

            {visitError && (
              <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{visitError}</span>
              </div>
            )}

            {loadingVisits ? (
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
        </div>
      )}

      {/* Interactive Phone Call Modal */}
      {callingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95">
            <div className="relative mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
              <PhoneCall className={`w-8 h-8 ${callStatus === "initiating" ? "animate-bounce" : ""}`} />
              {callStatus === "connected" && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">{callingItem.senior.display_name}</h3>
              <p className="text-xs text-slate-500 font-mono">{callingItem.senior.senior_id}</p>
              <div className="pt-2 text-xs font-bold text-slate-700">
                {callStatus === "initiating" && (
                  <span className="text-amber-600">Dialing senior phone via SamarthCare VoIP...</span>
                )}
                {callStatus === "connected" && (
                  <span className="text-emerald-600 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Call Connected • {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
                {callStatus === "ended" && <span className="text-slate-500">Call Ended</span>}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-left text-[11px] text-slate-600 border border-slate-200">
              <span className="font-bold text-slate-800 block mb-0.5">Clinical Reasons:</span>
              {callingItem.reasons.join("; ") || "Routine health check-in"}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleEndCall}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-colors"
              >
                End & Log Call
              </button>
            </div>
          </div>
        </div>
      )}

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
