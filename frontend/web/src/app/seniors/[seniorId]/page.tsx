"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  HeartPulse,
  Activity,
  Pill,
  MessageSquare,
  ShieldAlert,
  Info,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Phone,
  Send,
  CalendarPlus,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  MapPin,
  Mic,
  Headphones,
  FileText,
  Volume2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useOptionalAuth } from "@/context/AuthContext";
import { SeniorProfile } from "@/types/domain";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import {
  formatDate,
  formatDateTime,
  formatScore,
  formatCity,
} from "@/lib/formatting";
import SeniorAvatar from "@/app/city-manager/components/SeniorAvatar";
import { getSeniorMetadata } from "@/app/city-manager/data/seniorDirectory";
import SeniorVoiceCompanionModal from "@/components/voice/SeniorVoiceCompanionModal";

export default function SeniorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const seniorId = params.seniorId as string;
  const { service, lastUpdated } = useApp();

  const [senior, setSenior] = useState<SeniorProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "vitals" | "ai_call" | "medications" | "alerts"
  >("overview");

  const auth = useOptionalAuth();
  const user = auth?.user;

  useEffect(() => {
    if (user?.role === "CITY_MANAGER" && seniorId) {
      router.replace(`/city-manager/seniors/${seniorId}`);
    }
  }, [user, seniorId, router]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!seniorId) return;
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);

      const profile = await service.getSeniorById(seniorId);
      if (!profile) {
        setNotFound(true);
      } else {
        setSenior(profile);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load senior profile.");
    } finally {
      setLoading(false);
    }
  }, [seniorId, service]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, lastUpdated]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-slate-600">
        <div className="w-12 h-12 rounded-full border-4 border-teal-600 border-t-transparent animate-spin mb-4" />
        <p className="text-base font-bold text-slate-800">
          Loading Senior Command Dossier for {seniorId}...
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center">
        <EmptyState
          title={`Senior ${seniorId} Not Found`}
          description="The requested senior profile ID does not exist in the active municipal cohort database."
          action={
            <Link
              href="/city-manager/seniors"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Seniors Directory</span>
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !senior) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorState
          title="Error Loading Profile"
          message={error || "Profile could not be retrieved."}
          onRetry={loadProfile}
        />
      </div>
    );
  }

  const latest = senior.latest_risk_score;
  const baselines = senior.baselines;
  const meta = getSeniorMetadata(seniorId);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Operations Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link
            href="/city-manager"
            className="hover:text-teal-700 transition-colors flex items-center gap-1"
          >
            Operations Command Centre
          </Link>
          <span>/</span>
          <Link
            href="/city-manager/seniors"
            className="hover:text-teal-700 transition-colors"
          >
            My Seniors Roster
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold font-mono">
            {senior.senior_id} ({senior.display_name})
          </span>
        </div>

        <Link
          href="/city-manager/seniors"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-slate-50 transition-all self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Seniors Roster</span>
        </Link>
      </div>

      {/* Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Senior Command Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Avatar + Identity */}
          <div className="flex items-start sm:items-center gap-5">
            <SeniorAvatar
              name={senior.display_name}
              gender={meta.gender}
              size={76}
              className="ring-4 ring-teal-500/10 shadow-md"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {senior.display_name}
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Monitored
                </span>
                <RiskBadge level={senior.current_risk_level} />
                {senior.active_alert_count > 0 && (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                    {senior.active_alert_count} Open Alert{senior.active_alert_count > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 font-medium">
                <span>
                  Senior ID: <strong className="font-mono text-slate-800">{senior.senior_id}</strong>
                </span>
                <span>
                  Age & Gender: <strong className="text-slate-800">{senior.age} years • {meta.gender}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <strong className="text-slate-800">{formatCity(senior.city_id)}</strong>
                </span>
                <span>
                  Language: <strong className="text-slate-800 capitalize">{senior.preferred_language}</strong>
                </span>
                <span>
                  Living: <strong className="text-slate-800 capitalize">{senior.living_arrangement.replace(/_/g, " ")}</strong>
                </span>
                <span>
                  Consent:{" "}
                  <strong className={senior.family_consent ? "text-emerald-700" : "text-amber-700"}>
                    {senior.family_consent ? "Family Authorized" : "Direct Senior"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* AI Saathi Voice Call Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
            >
              <Mic className="w-4 h-4 text-slate-950" />
              <span>AI Saathi Check-In</span>
            </button>

            {/* Direct Phone Call */}
            <button
              type="button"
              onClick={() => setCallModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>Call Senior</span>
            </button>

            {/* Send Message */}
            <button
              type="button"
              onClick={() => setMessageModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-2xs transition-colors"
            >
              <Send className="w-4 h-4 text-slate-500" />
              <span>Send Message</span>
            </button>

            {/* Schedule Visit */}
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-2xs transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-teal-600" />
              <span>Schedule Visit</span>
            </button>
          </div>
        </div>

        {/* Attention Reason Banner */}
        {senior.attention_reason && (
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 text-xs sm:text-sm text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold text-amber-900 block mb-0.5">
                Active Early Warning Clinical Signal
              </strong>
              <p className="text-amber-800 leading-relaxed font-medium">
                {senior.attention_reason}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4 Command Centre Quick Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Calculated Risk Score */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Overall Risk Score</span>
              <RiskBadge level={senior.current_risk_level} />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-slate-900">
                {formatScore(senior.current_risk_score)}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 font-medium">
            Evaluated on {formatDate(senior.last_observation_date)}
          </p>
        </div>

        {/* Card 2: ML Model Probability */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-indigo-700">
                <Sparkles className="w-3.5 h-3.5" /> ML Deterioration
              </span>
              <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                {senior.ml_risk?.model_version || "v2.0"}
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {senior.ml_risk && senior.ml_risk.probability !== null && senior.ml_risk.probability !== undefined
                ? `${(senior.ml_risk.probability * 100).toFixed(1)}%`
                : "Normal"}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 font-medium">
            Risk Tier: <strong className="text-slate-700">{senior.ml_risk?.ml_risk_level || senior.current_risk_level}</strong>
          </p>
        </div>

        {/* Card 3: Recent Check-in & AI Saathi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Latest Wellbeing Check</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Logged
              </span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">
              {meta.last_checkin_time || "Today, 9:14 AM"}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 font-medium truncate">
            {meta.recent_ai_call?.summary || "Automated wellness check-in completed normally."}
          </p>
        </div>

        {/* Card 4: Next Scheduled Visit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Next Field Care Visit</span>
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">
              {meta.next_visit_time || "Today, 2:00 PM"}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 font-medium">
            Coordinator: <strong className="text-slate-700">{senior.coordinator_id}</strong>
          </p>
        </div>
      </div>

      {/* Navigation Tabs Styled to Match Command Centre */}
      <div className="border-b border-slate-200 bg-white rounded-2xl p-1 shadow-xs">
        <nav className="flex space-x-1 text-xs sm:text-sm font-bold overflow-x-auto scrollbar-none" aria-label="Profile Tabs">
          {[
            { id: "overview", label: "Overview & Rules" },
            { id: "history", label: `Risk Trajectory (${senior.risk_history.length})` },
            { id: "vitals", label: `Vitals & Sensor Trend (${senior.recent_vitals.length})` },
            { id: "ai_call", label: "AI Saathi Call Insights" },
            { id: "medications", label: `Medications (${senior.medications.length})` },
            { id: "alerts", label: `Alerts (${senior.related_alerts.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}

      {/* 1. OVERVIEW & RULE FACTORS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {latest ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Latest Risk Assessment Explanation
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scoring Version: {latest.scoring_version} • Confidence: {latest.confidence_level}
                  </p>
                </div>
                <RiskBadge level={latest.risk_level} />
              </div>

              {/* Recommended Action Protocol */}
              <div className="bg-teal-50/70 border border-teal-200 p-4 rounded-2xl text-xs sm:text-sm">
                <span className="font-extrabold text-teal-950 block mb-1">
                  Coordinator Action Protocol:
                </span>
                <p className="text-teal-900 leading-relaxed font-medium">
                  {latest.recommended_action}
                </p>
              </div>

              {/* Top Contributing Factors */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Contributing Risk Drivers (Deterministic Engine)
                </h3>

                {latest.top_contributing_factors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No active risk rule triggers recorded for this evaluation date.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {latest.top_contributing_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          factor.is_safety_tripwire
                            ? "bg-rose-50 border-rose-200 text-rose-950"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
                              {factor.rule_id}
                            </span>
                            <span className="font-bold">{factor.category}</span>
                            {factor.is_safety_tripwire && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white">
                                SAFETY TRIPWIRE
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 text-xs sm:text-sm font-medium">{factor.evidence}</p>
                          <span className="text-[11px] text-slate-400 block">
                            Observation Window: {factor.window}
                          </span>
                        </div>
                        <div className="shrink-0 text-right font-black text-sm">
                          +{factor.points_contributed} pts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Machine Learning Model Insights */}
          {senior.ml_risk && senior.ml_risk.ml_available ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Machine Learning Early Warning Model
                    </h2>
                    <p className="text-xs text-slate-500">
                      Architecture: {senior.ml_risk.model_architecture || "Logistic Regression (balanced)"}
                    </p>
                  </div>
                </div>
                {senior.ml_risk.ml_risk_level && <RiskBadge level={senior.ml_risk.ml_risk_level} />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">ML Anomaly Score</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {senior.ml_risk.ml_risk_score ?? "N/A"}/100
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">Decline Probability</span>
                  <span className="text-xl font-black text-slate-900 block mt-0.5">
                    {senior.ml_risk.probability !== null && senior.ml_risk.probability !== undefined
                      ? `${(senior.ml_risk.probability * 100).toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">Evaluation Date</span>
                  <span className="font-bold text-sm text-slate-800 block mt-1 font-mono">
                    {senior.ml_risk.date}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Individual Baseline Steady State */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Personal Baseline Steady State
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-observation steady-state priors used as personalized comparative baseline
              </p>
            </div>

            {baselines ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Systolic BP</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_bp_systolic} mmHg
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Diastolic BP</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_bp_diastolic} mmHg
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Blood Oxygen</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_spo2}% SpO2
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Fasting Glucose</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_blood_glucose} mg/dL
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Daily Steps</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_steps} steps
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Sleep Duration</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_sleep_hours} hrs/night
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Active Minutes</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_active_minutes} min/day
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Body Weight</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_weight} kg
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 2. RISK TRAJECTORY */}
      {activeTab === "history" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Longitudinal Risk Score Trajectory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated on a 0-100 scale against personalized baselines with bounded rule contributions
            </p>
          </div>

          <RiskTrendChart data={senior.risk_history} />

          {/* Tabular History */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Daily Evaluation Records
            </h3>
            {senior.risk_history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No score entries recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Risk Band</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Recommended Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {senior.risk_history.map((h) => (
                      <tr key={h.date} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium">{h.date}</td>
                        <td className="py-2.5 px-3 font-black text-sm">{h.risk_score}</td>
                        <td className="py-2.5 px-3">
                          <RiskBadge level={h.risk_level} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{h.confidence_level}</td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-sm truncate" title={h.recommended_action}>
                          {h.recommended_action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. VITALS & ACTIVITY */}
      {activeTab === "vitals" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Recent Vital Measurements
            </h2>
            {senior.recent_vitals.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No observations available for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Measurement</th>
                      <th className="py-3 px-3">Value</th>
                      <th className="py-3 px-3">Context</th>
                      <th className="py-3 px-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {senior.recent_vitals.map((v) => (
                      <tr key={v.measurement_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                          {formatDateTime(v.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 font-bold capitalize">
                          {v.measurement_type.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {v.measurement_value} {v.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 capitalize">
                          {v.measurement_context}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {v.quality_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. AI SAATHI CALL INSIGHTS */}
      {activeTab === "ai_call" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Daily AI Wellness Check-in Call (Priya)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Automated conversational screening recorded via ToughTongue AI voice scenario.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-xs"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Start New Call</span>
            </button>
          </div>

          {/* Call Summary Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Call Completed: {meta.recent_ai_call?.time_label || "Today, 9:14 AM"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-[11px]">
                {meta.recent_ai_call?.status || "Completed"}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {meta.recent_ai_call?.summary || "Automated check-in completed. Senior reported normal routine."}
            </p>

            {/* Clinical Observation Badges */}
            {meta.recent_ai_call?.clinical_flags && meta.recent_ai_call.clinical_flags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                {meta.recent_ai_call.clinical_flags.map((flag, idx) => (
                  <span
                    key={idx}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      flag.type === "warning"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-emerald-100 text-emerald-900 border-emerald-300"
                    }`}
                  >
                    {flag.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dialogue Turns */}
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Transcript & Dialogue Turns
            </h3>
            {meta.recent_ai_call?.dialogue && meta.recent_ai_call.dialogue.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {meta.recent_ai_call.dialogue.map((turn, idx) => {
                  const isAssistant = turn.speaker === "Assistant";
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm ${
                        isAssistant
                          ? "bg-teal-50/70 border border-teal-200 text-teal-950 mr-8"
                          : "bg-slate-100 border border-slate-200 text-slate-900 ml-8"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>{isAssistant ? "AI Saathi (Priya)" : senior.display_name}</span>
                        <span>{turn.time}</span>
                      </div>
                      <p className="font-medium">{turn.text}</p>
                      {turn.hindi_text && (
                        <p className="text-slate-500 text-xs mt-1 italic">{turn.hindi_text}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No dialogue transcript turns logged.</p>
            )}
          </div>
        </div>
      )}

      {/* 5. MEDICATIONS */}
      {activeTab === "medications" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Active Prescriptions & Adherence
          </h2>
          {senior.medications.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No active medication regimens recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="py-3 px-3">Medication</th>
                    <th className="py-3 px-3">Dosage</th>
                    <th className="py-3 px-3">Frequency</th>
                    <th className="py-3 px-3">Timing</th>
                    <th className="py-3 px-3">Adherence Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {senior.medications.map((m) => (
                    <tr key={m.schedule_id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">{m.medication_name}</td>
                      <td className="py-3 px-3 text-slate-700">{m.dosage}</td>
                      <td className="py-3 px-3 text-slate-600">{m.frequency}</td>
                      <td className="py-3 px-3 text-slate-500">{m.timing}</td>
                      <td className="py-3 px-3 font-bold text-teal-800">
                        {Math.round(m.adherence_rate_pct)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. ALERTS */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Senior-Linked Clinical Alerts
          </h2>
          {senior.related_alerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No open alerts registered for this senior.</p>
          ) : (
            <div className="space-y-3">
              {senior.related_alerts.map((al) => (
                <div
                  key={al.alert_id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <RiskBadge level={al.severity} />
                      <AlertBadge status={al.status} />
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDateTime(al.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{al.triggering_signals}</p>
                    <p className="text-slate-500 text-xs">Next: {al.recommended_next_step}</p>
                  </div>
                  <Link
                    href={`/alerts/${al.alert_id}`}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-teal-50 hover:text-teal-900 text-slate-700 font-bold rounded-xl text-xs transition-colors self-start sm:self-auto shrink-0 shadow-2xs"
                  >
                    Triage Alert
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Embedded ToughTongue Voice Agent Companion Modal */}
      <SeniorVoiceCompanionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        seniorName={senior.display_name}
        seniorId={senior.senior_id}
      />

      {/* Interactive Modal: Call Senior */}
      {callModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Direct Telephone Call</h3>
                <p className="text-xs text-slate-500">Authorized Care Coordinator Line</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm">
              <p>
                Senior: <strong>{senior.display_name}</strong>
              </p>
              <p>
                Primary Phone: <strong className="text-teal-700">{meta.primary_phone || "+91 98450 12345"}</strong>
              </p>
              <p>
                Emergency Contact: <strong>{meta.emergency_contact_name} ({meta.emergency_contact_phone})</strong>
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCallModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <a
                href={`tel:${meta.primary_phone || "+919845012345"}`}
                onClick={() => {
                  setCallModalOpen(false);
                  setActionSuccessMsg(`Initiating call with ${senior.display_name}`);
                }}
                className="px-5 py-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow"
              >
                Dial Now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modal: Send Message */}
      {messageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Send WhatsApp / SMS Notice</h3>
                <p className="text-xs text-slate-500">To {senior.display_name} & Authorized Family</p>
              </div>
            </div>
            <textarea
              rows={3}
              defaultValue={`Namaste ${senior.display_name} ji, Sahaj Care coordinator here to check in on your morning medicine schedule.`}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMessageModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMessageModalOpen(false);
                  setActionSuccessMsg(`Care notification queued for ${senior.display_name}`);
                }}
                className="px-5 py-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modal: Schedule Visit */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Schedule In-Person Care Visit</h3>
                <p className="text-xs text-slate-500">Dispatch field caretaker for {senior.display_name}</p>
              </div>
            </div>
            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Visit Purpose</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <option>Routine Physical Wellbeing Check</option>
                  <option>Blood Pressure & Vitals Assessment</option>
                  <option>Medication Reconciliation</option>
                  <option>Post-Fall Safety Assessment</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Field Caretaker</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <option>Deepak Kumar (Bengaluru North)</option>
                  <option>Sunita Patil (Bengaluru South)</option>
                  <option>Ramesh Yadav (Bengaluru East)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setScheduleModalOpen(false);
                  setActionSuccessMsg(`Visit scheduled for ${senior.display_name} with Deepak Kumar`);
                }}
                className="px-5 py-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
