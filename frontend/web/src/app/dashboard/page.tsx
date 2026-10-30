"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Activity,
  HeartPulse,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SeniorSummary, Alert } from "@/types/domain";
import { MetricCard } from "@/components/ui/MetricCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RiskDistributionChart } from "@/components/charts/RiskDistributionChart";
import { formatDate, formatScore } from "@/lib/formatting";

export default function DashboardPage() {
  const router = useRouter();
  const { metrics, loadingMetrics, refreshMetrics, service, lastUpdated } =
    useApp();

  const [prioritySeniors, setPrioritySeniors] = useState<SeniorSummary[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loadingLists, setLoadingLists] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingLists(true);
      setError(null);

      const [seniors, alerts] = await Promise.all([
        service.listSeniors({ limit: 100 }),
        service.listAlerts(),
      ]);

      // Priority list: Seniors with Urgent Review, High Risk, or active alerts
      const priority = seniors
        .filter(
          (s) =>
            s.current_risk_level === "URGENT_REVIEW" ||
            s.current_risk_level === "HIGH" ||
            s.active_alert_count > 0
        )
        .sort((a, b) => {
          // Urgent review first, then by score descending
          const aUrgent = a.current_risk_level === "URGENT_REVIEW" ? 1 : 0;
          const bUrgent = b.current_risk_level === "URGENT_REVIEW" ? 1 : 0;
          if (aUrgent !== bUrgent) return bUrgent - aUrgent;
          return (b.current_risk_score || 0) - (a.current_risk_score || 0);
        });

      setPrioritySeniors(priority);
      setRecentAlerts(alerts.slice(0, 5));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard records.");
    } finally {
      setLoadingLists(false);
    }
  }, [service]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, lastUpdated]);

  const handleCategoryClick = (cat: string) => {
    router.push(`/seniors?risk_level=${cat}`);
  };

  if (loadingMetrics && loadingLists) {
    return <LoadingState message="Loading coordinator dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard Unavailable"
        message={error}
        onRetry={() => {
          refreshMetrics();
          loadDashboardData();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Care Coordinator Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Population-level early-warning telemetry and senior triage queue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Open Alerts Queue</span>
          </Link>
        </div>
      </div>

      {/* Population Metrics Cards */}
      {metrics && (
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">
            Population Overview Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Monitored Seniors"
              value={metrics.total_seniors}
              subtitle="Total synthetic cohort size"
              icon={<Users className="w-5 h-5" />}
              onClick={() => router.push("/seniors")}
            />
            <MetricCard
              title="Active Alerts"
              value={metrics.active_alerts_count}
              subtitle={`${metrics.acknowledged_alerts_count} acknowledged in triage`}
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              variant={metrics.active_alerts_count > 0 ? "danger" : "default"}
              onClick={() => router.push("/alerts?status=OPEN")}
            />
            <MetricCard
              title="Urgent Review Cohort"
              value={metrics.by_risk_level.URGENT_REVIEW}
              subtitle="Tripwires / acute safety scores"
              icon={<HeartPulse className="w-5 h-5 text-red-600" />}
              variant={
                metrics.by_risk_level.URGENT_REVIEW > 0 ? "danger" : "default"
              }
              onClick={() => handleCategoryClick("URGENT_REVIEW")}
            />
            <MetricCard
              title="Telemetry Gaps"
              value={metrics.overdue_checkins_count}
              subtitle="Missing score or check-in observation"
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              variant={
                metrics.overdue_checkins_count > 0 ? "warning" : "default"
              }
              onClick={() => router.push("/seniors?missing=true")}
            />
          </div>
        </section>
      )}

      {/* Main Grid: Visual Chart + Priority List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Risk Distribution Chart */}
        <div className="lg:col-span-1 space-y-6">
          {metrics && (
            <RiskDistributionChart
              distribution={metrics.by_risk_level}
              total={metrics.total_seniors}
              onSelectCategory={handleCategoryClick}
            />
          )}

          {/* Quick Guidance Box */}
          <div className="bg-slate-100/70 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Triage Protocol Notice
            </div>
            <p>
              High and Urgent Review scores mandate same-day telephone or family check-ins. Alerts stay active until coordinator acknowledgment and resolution.
            </p>
          </div>
        </div>

        {/* Right Columns: Priority Attention Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Priority Review Queue
                </h2>
                <p className="text-xs text-slate-500">
                  Seniors exhibiting safety tripwires, multi-day decline, or open alerts
                </p>
              </div>
              <Link
                href="/seniors"
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
              >
                <span>View all ({metrics?.total_seniors || 0})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {prioritySeniors.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No Seniors Currently Require Priority Triage"
                  description="All monitored seniors are currently in baseline range with no unresolved alerts."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {prioritySeniors.map((senior) => (
                  <div
                    key={senior.senior_id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                          href={`/seniors/${senior.senior_id}`}
                          className="font-bold text-slate-900 hover:text-brand-600 text-sm focus:outline-none focus:underline"
                        >
                          {senior.display_name}
                        </Link>
                        <RiskBadge level={senior.current_risk_level} />
                        {senior.active_alert_count > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {senior.active_alert_count} active alert{senior.active_alert_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {senior.attention_reason ? (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          <span className="font-semibold text-slate-700">Signal: </span>
                          {senior.attention_reason}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Elevated score; routine observation recommended.
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400 flex items-center gap-4">
                        <span>Age: {senior.age}</span>
                        <span>City: {senior.city_id.replace(/^CITY_/, "")}</span>
                        <span>
                          Last Checked: {formatDate(senior.last_observation_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">
                          Score
                        </span>
                        <span className="text-lg font-bold text-slate-900">
                          {formatScore(senior.current_risk_score)}
                          <span className="text-xs font-normal text-slate-400">/100</span>
                        </span>
                      </div>
                      <Link
                        href={`/seniors/${senior.senior_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 transition-colors"
                      >
                        <span>Profile</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Alerts Stream */}
      <section
        aria-labelledby="recent-alerts-heading"
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2
              id="recent-alerts-heading"
              className="text-base font-semibold text-slate-900"
            >
              Recent Early Warning Alerts
            </h2>
            <p className="text-xs text-slate-500">
              Latest anomaly detections and tripwires across the cohort
            </p>
          </div>
          <Link
            href="/alerts"
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            <span>Alerts Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Recent Alerts"
              description="No automated alerts have been generated for this cohort window."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAlerts.map((alert) => (
              <div
                key={alert.alert_id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {alert.alert_id}
                    </span>
                    <AlertBadge status={alert.status} />
                    <RiskBadge level={alert.severity} />
                    <Link
                      href={`/seniors/${alert.senior_id}`}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      {alert.senior_display_name || alert.senior_id}
                    </Link>
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-2">
                    {alert.triggering_signals}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Created: {alert.created_at} • Next step: {alert.recommended_next_step}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Link
                    href={`/alerts?search=${alert.alert_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                  >
                    <span>Triage Alert</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

