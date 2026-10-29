"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  User,
  Info,
  XCircle,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  FamilyUserProfileResponse,
  FamilyVisitSummary,
} from "@/types/api";

export default function FamilyVisitsPage() {
  const [profile, setProfile] = useState<FamilyUserProfileResponse | null>(null);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string | null>(null);
  const [visits, setVisits] = useState<FamilyVisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "COMPLETED">("ALL");

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const prof = await defaultApiClient.get<FamilyUserProfileResponse>("/api/v1/family/profile");
        setProfile(prof);
        const active = prof.linked_seniors.filter((s) => s.authorization_status === "ACTIVE");
        if (active.length > 0) {
          setSelectedSeniorId(active[0].senior_id);
          const vList = await defaultApiClient.get<FamilyVisitSummary[]>(
            `/api/v1/family/seniors/${active[0].senior_id}/visits`
          );
          setVisits(vList);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load visit records.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleSeniorChange = async (seniorId: string) => {
    setSelectedSeniorId(seniorId);
    setLoading(true);
    setError(null);
    try {
      const vList = await defaultApiClient.get<FamilyVisitSummary[]>(
        `/api/v1/family/seniors/${seniorId}/visits`
      );
      setVisits(vList);
    } catch (err: any) {
      setError(err?.message || "Failed to load visit records for the selected senior.");
    } finally {
      setLoading(false);
    }
  };

  const activeSeniors = profile?.linked_seniors.filter((s) => s.authorization_status === "ACTIVE") || [];
  const selectedSenior = activeSeniors.find((s) => s.senior_id === selectedSeniorId);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
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

  const filteredVisits = visits.filter((v) => {
    if (statusFilter === "UPCOMING") {
      return ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(v.status);
    }
    if (statusFilter === "COMPLETED") {
      return v.status === "COMPLETED";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/family"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Family Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Field Care Visits & History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track scheduled in-person visits and view verified care summaries for{" "}
            <strong>{selectedSenior?.name || "your linked senior"}</strong>.
          </p>
        </div>

        {/* Senior Selector if multiple */}
        {activeSeniors.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Senior:</label>
            <select
              value={selectedSeniorId || ""}
              onChange={(e) => handleSeniorChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
            >
              {activeSeniors.map((s) => (
                <option key={s.senior_id} value={s.senior_id}>
                  {s.name} ({s.relationship_type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === "ALL"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Visits ({visits.length})
        </button>
        <button
          onClick={() => setStatusFilter("UPCOMING")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === "UPCOMING"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Upcoming (
          {visits.filter((v) => ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(v.status)).length}
          )
        </button>
        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === "COMPLETED"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Completed ({visits.filter((v) => v.status === "COMPLETED").length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
          <RefreshCw className="w-7 h-7 animate-spin text-rose-600 mb-3" />
          <p className="text-sm font-medium">Loading visit records...</p>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No visits found</h3>
          <p className="text-xs text-slate-500 mt-1">
            No visits match the current status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVisits.map((v) => {
            const isCompleted = v.status === "COMPLETED";
            const isUpcoming = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(v.status);
            const isCancelled = v.status === "CANCELLED";

            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isUpcoming
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      {isUpcoming && <Clock className="w-3 h-3" />}
                      {isCancelled && <XCircle className="w-3 h-3" />}
                      {v.status}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {v.visit_type}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    {v.visit_purpose || "Routine In-Person Wellbeing Check"}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(v.scheduled_start)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTime(v.scheduled_start)} - {formatTime(v.scheduled_end)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Assigned: <strong className="text-slate-700">{v.assigned_caretaker_name || "Care Coordinator"}</strong>
                    </span>
                  </div>

                  {/* Summary / Outcome */}
                  {v.family_summary && (
                    <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900 mb-0.5">Care Summary:</p>
                      <p>{v.family_summary}</p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-end justify-between">
                  {v.completion_outcome && (
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                      Outcome: {v.completion_outcome}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Privacy note */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-500 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          Visit observations and times are logged by certified Samarth care coordinators upon arrival and departure. Internal staff notes and coordinates are redacted for privacy.
        </span>
      </div>
    </div>
  );
}

