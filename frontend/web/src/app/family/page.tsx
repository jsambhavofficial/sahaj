"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  User,
  ShieldCheck,
  ChevronRight,
  Info,
  RefreshCw,
  Activity,
  FileText,
  MapPin,
  Smile,
  Moon,
  Coffee,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  FamilyUserProfileResponse,
  FamilySeniorSummary,
  FamilyCareSummaryResponse,
} from "@/types/api";

export default function FamilyDashboardPage() {
  const [profile, setProfile] = useState<FamilyUserProfileResponse | null>(null);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string | null>(null);
  const [careSummary, setCareSummary] = useState<FamilyCareSummaryResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Family Profile and Linked Seniors
  const fetchProfile = async () => {
    setLoadingProfile(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<FamilyUserProfileResponse>("/api/v1/family/profile");
      setProfile(res);
      // Automatically select first active senior if available
      const activeSeniors = res.linked_seniors.filter(s => s.authorization_status === "ACTIVE");
      if (activeSeniors.length > 0 && !selectedSeniorId) {
        setSelectedSeniorId(activeSeniors[0].senior_id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load family account details.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. Fetch Care Summary whenever selectedSeniorId changes
  const fetchCareSummary = async (seniorId: string) => {
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<FamilyCareSummaryResponse>(
        `/api/v1/family/seniors/${seniorId}/care-summary`
      );
      setCareSummary(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load care overview for the selected senior.");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (selectedSeniorId) {
      fetchCareSummary(selectedSeniorId);
    }
  }, [selectedSeniorId]);

  const activeSeniors = profile?.linked_seniors.filter(s => s.authorization_status === "ACTIVE") || [];
  const selectedSenior = activeSeniors.find(s => s.senior_id === selectedSeniorId);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
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

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-rose-600 mb-3" />
        <p className="text-sm font-medium">Loading family care overview...</p>
      </div>
    );
  }

  // Empty State: No active linked seniors
  if (!loadingProfile && activeSeniors.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Authorized Senior Linked Yet</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Your family account is active, but there are no active verified senior citizen profiles linked to your profile at this time.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/family/contact"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
          >
            <PhoneCall className="w-4 h-4" /> Contact Sahaj Care Team
          </Link>
          <Link
            href="/family/profile"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            View Account Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Senior Selector & Quick Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Active Senior Profile</span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {careSummary?.name || selectedSenior?.name || "Senior Citizen"}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {careSummary?.care_status || "Active Care Management"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Relationship: <strong className="text-slate-700">{selectedSenior?.relationship_type || "Authorized Family"}</strong>
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Chapter: <strong className="text-slate-700">{careSummary?.city_name || selectedSenior?.city_name}</strong>
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Consent: <strong className="text-emerald-700">DPDP Act Verified</strong>
            </span>
          </div>
        </div>

        {/* Multi-senior selector if more than 1 linked */}
        {activeSeniors.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Switch Senior:</label>
            <select
              value={selectedSeniorId || ""}
              onChange={(e) => setSelectedSeniorId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {activeSeniors.map((s) => (
                <option key={s.senior_id} value={s.senior_id}>
                  {s.name} ({s.relationship_type})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            href="/family/contact"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <PhoneCall className="w-3.5 h-3.5" /> Request Callback
          </Link>
          <button
            onClick={() => selectedSeniorId && fetchCareSummary(selectedSeniorId)}
            disabled={loadingSummary}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh summary"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSummary ? "animate-spin text-rose-600" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Scheduled Visits, Completed Visits & Wellbeing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Next Scheduled Visit */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Next Scheduled Visit</h3>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Upcoming
              </span>
            </div>

            {careSummary?.next_scheduled_visit ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{formatDate(careSummary.next_scheduled_visit.scheduled_start)}</span>
                  <span className="text-xs font-normal text-slate-500">
                    ({formatTime(careSummary.next_scheduled_visit.scheduled_start)} - {formatTime(careSummary.next_scheduled_visit.scheduled_end)})
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <p className="text-slate-500">
                    Coordinator: <strong className="text-slate-800">{careSummary.next_scheduled_visit.assigned_caretaker_name || "Care Coordinator"}</strong>
                  </p>
                  <p className="text-slate-500">
                    Purpose: <strong className="text-slate-800">{careSummary.next_scheduled_visit.visit_purpose}</strong>
                  </p>
                  <p className="text-slate-600 text-[11px] italic mt-1">
                    &ldquo;{careSummary.next_scheduled_visit.family_summary}&rdquo;
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-6 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No upcoming visit scheduled yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Your care team will schedule the next routine visit shortly.</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/family/visits"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between"
            >
              <span>View Full Visit Calendar</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Most Recent Completed Visit */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Latest Completed Visit</h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Completed
              </span>
            </div>

            {careSummary?.latest_completed_visit ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>{formatDate(careSummary.latest_completed_visit.actual_end || careSummary.latest_completed_visit.scheduled_end)}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <p className="text-slate-500">
                    Coordinator: <strong className="text-slate-800">{careSummary.latest_completed_visit.assigned_caretaker_name || "Care Coordinator"}</strong>
                  </p>
                  <p className="text-slate-500">
                    Outcome: <strong className="text-emerald-700">{careSummary.latest_completed_visit.completion_outcome || "Normal Routine"}</strong>
                  </p>
                  <p className="text-slate-600 text-[11px] mt-1 bg-white p-2 rounded border border-slate-200">
                    {careSummary.latest_completed_visit.family_summary}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-6 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No previous visit records found.</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/family/visits"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-between"
            >
              <span>View Past Visit Reports</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: Latest Wellbeing Check-in */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Latest Wellbeing Log</h3>
              </div>
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Self-Reported
              </span>
            </div>

            {careSummary?.latest_wellbeing_checkin ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {careSummary.latest_wellbeing_checkin.overall_status}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(careSummary.latest_wellbeing_checkin.checkin_date)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <Smile className="w-3.5 h-3.5 text-purple-500" />
                      <span>Mood</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {careSummary.latest_wellbeing_checkin.reported_mood || "Normal"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Sleep</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {careSummary.latest_wellbeing_checkin.sleep_hours ? `${careSummary.latest_wellbeing_checkin.sleep_hours} hrs` : "Restful"}
                    </span>
                  </div>
                </div>

                {careSummary.latest_wellbeing_checkin.factual_notes && (
                  <p className="text-[11px] text-slate-600 bg-purple-50/50 p-2 rounded border border-purple-100">
                    &ldquo;{careSummary.latest_wellbeing_checkin.factual_notes}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 text-center py-6 text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No recent wellbeing check-in recorded.</p>
                <p className="text-[11px] text-slate-400 mt-1">Daily check-in logs will appear here once recorded.</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Non-diagnostic wellness logging
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Permitted Care Updates & Direct Care Team Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Permitted Care Updates Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold text-slate-900">Care Updates & Coordinator Actions</h3>
            </div>
            <span className="text-xs text-slate-400">Chronological history</span>
          </div>

          {careSummary?.recent_updates && careSummary.recent_updates.length > 0 ? (
            <div className="space-y-3">
              {careSummary.recent_updates.map((update) => (
                <div
                  key={update.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{update.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {update.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{update.message}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {formatDate(update.timestamp)} • {formatTime(update.timestamp)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-rose-600 shrink-0">
                    {update.action_taken}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-xs font-medium text-slate-600">No active care updates recorded</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Routine monitoring is stable. Any coordinator observations will be transparently displayed here.
              </p>
            </div>
          )}
        </div>

        {/* Right: Direct Care Team Office Coordinates */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <PhoneCall className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold text-slate-900">Care Team Contact</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Chapter Office</span>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  Sahaj Elder-Care ({careSummary?.care_team_contact?.city_name || "Regional Office"})
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Care Coordination Phone</span>
                <p className="text-sm font-bold text-rose-600 mt-0.5">
                  <a href={`tel:${careSummary?.care_team_contact?.office_phone || "+918045678900"}`}>
                    {careSummary?.care_team_contact?.office_phone || "+91 80 4567 8900"}
                  </a>
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Support Email</span>
                <p className="text-xs font-medium text-slate-700 mt-0.5">
                  {careSummary?.care_team_contact?.support_email || "care.hq@samarth.ai"}
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Operating Hours</span>
                <p className="text-xs text-slate-600 mt-0.5">
                  {careSummary?.care_team_contact?.hours || "Mon - Sat: 8:00 AM - 8:00 PM IST (24/7 On-Call Support Line)"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href="/family/contact"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <PhoneCall className="w-4 h-4" /> Submit Callback Request
            </Link>
          </div>
        </div>
      </div>

      {/* Mandatory Clinical Disclaimer Banner */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-500 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700">Transparency & Non-Diagnostic Notice:</strong> {careSummary?.disclaimer || "Factual elder-care coordination summary. Non-diagnostic. Prepared for authorized family members."} The information displayed reflects care coordinator field observations and operational task execution. It does not constitute medical advice or emergency medical services.
        </p>
      </div>
    </div>
  );
}
