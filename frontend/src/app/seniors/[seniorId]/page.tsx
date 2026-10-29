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
} from "lucide-react";
import { useApp } from "@/context/AppContext";
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
    "overview" | "history" | "vitals" | "medications" | "alerts"
  >("overview");

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
    return <LoadingState message={`Loading profile for ${seniorId}...`} />;
  }

  if (notFound) {
    return (
      <div className="py-12">
        <EmptyState
          title={`Senior ${seniorId} Not Found`}
          description="The requested senior profile ID does not exist in the active cohort database or fixtures."
          action={
            <Link
              href="/seniors"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Seniors Directory</span>
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !senior) {
    return (
      <div className="py-12">
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

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/seniors"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors focus:outline-none focus:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Seniors Directory</span>
        </Link>
      </div>

      {/* Senior Header Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {senior.display_name}
              </h1>
              <RiskBadge level={senior.current_risk_level} />
              {senior.active_alert_count > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  {senior.active_alert_count} Active Alert{senior.active_alert_count > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500 font-medium">
              <span>Senior ID: <strong className="font-mono text-slate-700">{senior.senior_id}</strong></span>
              <span>Age: <strong className="text-slate-700">{senior.age}</strong></span>
              <span>City: <strong className="text-slate-700">{formatCity(senior.city_id)}</strong></span>
              <span>Language: <strong className="text-slate-700 capitalize">{senior.preferred_language}</strong></span>
              <span>Living: <strong className="text-slate-700 capitalize">{senior.living_arrangement.replace(/_/g, " ")}</strong></span>
              <span>Coordinator: <strong className="text-slate-700">{senior.coordinator_id}</strong></span>
              <span>Consent: <strong className={senior.family_consent ? "text-emerald-700" : "text-amber-700"}>
                {senior.family_consent ? "Family Authorized" : "Self Only"}
              </strong></span>
            </div>
          </div>

          {/* Right Risk Score Gauge */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 shrink-0">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Calculated Risk Score
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  {formatScore(senior.current_risk_score)}
                </span>
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                As of {formatDate(senior.last_observation_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Attention Note / Signal */}
        {senior.attention_reason && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-900">Primary Attention Signal: </strong>
              {senior.attention_reason}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold" aria-label="Profile Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Overview & Baseline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Risk Trajectory ({senior.risk_history.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vitals")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "vitals"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Vitals & Daily Activity ({senior.recent_vitals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("medications")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "medications"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Medications & Notes ({senior.medications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "alerts"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Alerts</span>
            {senior.related_alerts.length > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
                {senior.related_alerts.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Latest Assessment Details */}
          {latest ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Latest Risk Assessment Explanation
                  </h2>
                  <p className="text-xs text-slate-500">
                    Scoring Version: {latest.scoring_version} • Confidence: {latest.confidence_level}
                  </p>
                </div>
                <RiskBadge level={latest.risk_level} />
              </div>

              {/* Recommended Action */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-800 block mb-1">
                  Coordinator Action Protocol:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {latest.recommended_action}
                </p>
              </div>

              {/* Contributing Factors */}
              <div>
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                  Top Contributing Risk Factors
                </h3>

                {latest.top_contributing_factors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No active risk rule triggers recorded for this evaluation date.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {latest.top_contributing_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          factor.is_safety_tripwire
                            ? "bg-red-50 border-red-200 text-red-950"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">
                              {factor.rule_id}
                            </span>
                            <span className="font-semibold">{factor.category}</span>
                            {factor.is_safety_tripwire && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-600 text-white">
                                SAFETY TRIPWIRE
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 text-xs">{factor.evidence}</p>
                          <span className="text-[11px] text-slate-400">
                            Window: {factor.window}
                          </span>
                        </div>
                        <div className="shrink-0 text-right font-bold text-xs">
                          +{factor.points_contributed} pts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
              No daily risk score recorded for this senior.
            </div>
          )}

          {/* Machine Learning Early Warning Indicator */}
          {senior.ml_risk && senior.ml_risk.ml_available ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Machine Learning Deterioration Model
                    </h2>
                    <p className="text-xs text-slate-500">
                      Architecture: {senior.ml_risk.model_architecture || "Logistic Regression (balanced)"} • Version: {senior.ml_risk.model_version || "2.0.0"}
                    </p>
                  </div>
                </div>
                {senior.ml_risk.ml_risk_level && (
                  <RiskBadge level={senior.ml_risk.ml_risk_level} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">ML Anomaly Score</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-extrabold text-slate-900">
                      {senior.ml_risk.ml_risk_score !== null ? senior.ml_risk.ml_risk_score : "N/A"}
                    </span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">Decline Probability</span>
                  <span className="text-xl font-extrabold text-slate-900 block mt-0.5">
                    {senior.ml_risk.probability !== null && senior.ml_risk.probability !== undefined
                      ? `${(senior.ml_risk.probability * 100).toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[11px] block">Evaluation Date</span>
                  <span className="font-bold text-sm text-slate-800 block mt-1 font-mono">
                    {senior.ml_risk.date}
                  </span>
                </div>
              </div>

              {/* Top Directional Feature Drivers */}
              {senior.ml_risk.top_feature_influences && senior.ml_risk.top_feature_influences.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                    Top Positive Risk Drivers (Model Feature Weights)
                  </h3>
                  <div className="space-y-1.5">
                    {senior.ml_risk.top_feature_influences.map((inf, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {inf.feature}
                          </span>
                          <span className="text-slate-600 text-xs">
                            Observed: <strong className="text-slate-800">{String(inf.observed_value)}</strong>
                          </span>
                        </div>
                        <span className="font-bold text-slate-700 text-xs">
                          +{inf.influence_weight.toFixed(3)} weight
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 bg-indigo-50/40 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Dual-Track Decision Support:</strong> {senior.ml_risk.disclaimer}
                </span>
              </div>
            </div>
          ) : null}

          {/* Individual Steady-State Baselines */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Personal Baseline Steady State
            </h2>
            <p className="text-xs text-slate-500">
              Pre-observation steady-state priors used as personalized comparative baseline
            </p>

            {baselines ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Systolic BP</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_bp_systolic} mmHg
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Diastolic BP</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_bp_diastolic} mmHg
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Blood Oxygen</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_spo2}% SpO2
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Fasting Glucose</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_blood_glucose} mg/dL
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Daily Step Baseline</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_steps} steps
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Active Minutes</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_active_minutes} min/day
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Sleep Duration</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_sleep_hours} hrs/night
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[11px] block">Body Weight</span>
                  <span className="font-bold text-sm text-slate-800">
                    {baselines.baseline_weight} kg
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-400 text-xs italic">
                Baseline parameters have not been established yet for this profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. RISK TRAJECTORY TAB */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Longitudinal Risk Score History
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated on a 0-100 scale against personalized baselines with bounded rule contributions
            </p>
          </div>

          <RiskTrendChart data={senior.risk_history} />

          {/* Tabular History */}
          <div className="overflow-x-auto border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-800 mb-3">
              Daily Evaluation Log
            </h3>
            {senior.risk_history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No score entries recorded.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Score</th>
                    <th className="py-2 px-3">Risk Band</th>
                    <th className="py-2 px-3">Confidence</th>
                    <th className="py-2 px-3">Recommended Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {senior.risk_history.map((h) => (
                    <tr key={h.date} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-medium">{h.date}</td>
                      <td className="py-2.5 px-3 font-bold">{h.risk_score}</td>
                      <td className="py-2.5 px-3">
                        <RiskBadge level={h.risk_level} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{h.confidence_level}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-sm truncate" title={h.recommended_action}>
                        {h.recommended_action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 3. VITALS & ACTIVITY TAB */}
      {activeTab === "vitals" && (
        <div className="space-y-6">
          {/* Vitals Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Vital Measurements
            </h2>
            {senior.recent_vitals.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No observations available for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Measurement</th>
                      <th className="py-2 px-3">Value</th>
                      <th className="py-2 px-3">Context</th>
                      <th className="py-2 px-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {senior.recent_vitals.map((v) => (
                      <tr key={v.measurement_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDateTime(v.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 font-medium capitalize">
                          {v.measurement_type.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {v.measurement_value} {v.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 capitalize">
                          {v.measurement_context}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
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

          {/* Activity Logs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Daily Activity & Sleep Logs
            </h2>
            {senior.recent_activity.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No activity logs recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Steps</th>
                      <th className="py-2 px-3">Active Minutes</th>
                      <th className="py-2 px-3">Sleep Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {senior.recent_activity.map((a) => (
                      <tr key={a.date} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono">{a.date}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {a.steps.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {a.active_minutes} min
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {a.sleep_hours} hrs
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

      {/* 4. MEDICATIONS & NOTES TAB */}
      {activeTab === "medications" && (
        <div className="space-y-6">
          {/* Medications */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Active Prescriptions & Adherence
            </h2>
            {senior.medications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No active medication regimens recorded.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {senior.medications.map((m) => (
                  <div
                    key={m.schedule_id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {m.medication_name}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {m.adherence_rate_pct}% Adherence
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>Dosage: <strong>{m.dosage}</strong></div>
                      <div>Frequency: {m.frequency} • {m.timing}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Check-in Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Coordinator & Family Check-in Transcripts
            </h2>
            {senior.recent_checkins.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No check-in notes recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {senior.recent_checkins.map((chk) => (
                  <div
                    key={chk.checkin_id}
                    className="p-4 rounded-lg border border-slate-200 bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Date: {chk.date} • Type: {chk.checkin_type}</span>
                      <span className="capitalize">Lang: {chk.language}</span>
                    </div>
                    <p className="text-slate-800 italic">
                      &ldquo;{chk.transcript_summary}&rdquo;
                    </p>
                    {chk.extracted_symptoms && chk.extracted_symptoms.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] font-semibold text-slate-500">
                          NLP Extracted Cues:
                        </span>
                        {chk.extracted_symptoms.map((symptom, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800"
                          >
                            {symptom.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. ALERTS TAB */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Related Decision-Support Alerts
            </h2>
            <Link
              href="/alerts"
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              Open Alerts Center
            </Link>
          </div>

          {senior.related_alerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No alerts have been triggered for this senior.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {senior.related_alerts.map((alert) => (
                <div key={alert.alert_id} className="py-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">
                        {alert.alert_id}
                      </span>
                      <AlertBadge status={alert.status} />
                      <RiskBadge level={alert.severity} />
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      Created: {alert.created_at}
                    </span>
                  </div>
                  <p className="text-slate-700">{alert.triggering_signals}</p>
                  <p className="text-[11px] text-slate-500">
                    Protocol: {alert.recommended_next_step}
                  </p>
                  {alert.resolution_reason && (
                    <div className="text-[11px] bg-slate-50 p-2 rounded text-slate-600">
                      <strong>Resolution: </strong> {alert.resolution_reason}
                    </div>
                  )}
                  {alert.acknowledgement_notes && (
                    <div className="text-[11px] bg-blue-50/50 p-2 rounded text-blue-800">
                      <strong>Coordinator Note: </strong> {alert.acknowledgement_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
