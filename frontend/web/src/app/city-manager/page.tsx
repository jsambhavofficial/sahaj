"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Activity, Bell, CheckCircle2, Clock, PhoneCall, RefreshCw, ThumbsUp, Users } from "lucide-react";
import { getDataService } from "@/services";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import {
  SEVERITY_BAR,
  SEVERITY_CLASS,
  SEVERITY_LABEL,
  ageOf,
  formatDay,
  formatMinutes,
  formatNumber,
  formatShare,
  pillClass,
} from "@/lib/opsFormat";

const SEVERITIES = ["URGENT_REVIEW", "HIGH", "MODERATE"] as const;

export default function OrganizationDashboardPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const svc = getDataService();
    const [overview, cities, volume, coordinators, responseTimes] = await Promise.all([
      svc.getOpsOverview(),
      svc.getOpsCities(),
      svc.getOpsAlertsVolume(),
      svc.getOpsCoordinators(),
      svc.getOpsAlertsResponseTimes(),
    ]);
    return { overview, cities, volume, coordinators, responseTimes };
  }, []);

  // Alerts per day, split by severity (most recent 14 days that have alerts)
  const volumeByDay = useMemo(() => {
    const days = new Map<string, Record<string, number>>();
    (data?.volume ?? []).forEach((v) => {
      const row = days.get(v.day) ?? {};
      row[v.severity] = (row[v.severity] ?? 0) + v.alerts;
      days.set(v.day, row);
    });
    return Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [data]);
  const maxPerDay = Math.max(1, ...volumeByDay.map(([, r]) => Object.values(r).reduce((a, b) => a + b, 0)));

  const busiestCoordinators = useMemo(
    () => [...(data?.coordinators ?? [])].sort((a, b) => b.open_alerts - a.open_alerts || b.caseload - a.caseload).slice(0, 8),
    [data]
  );

  const waitingAlerts = useMemo(
    () =>
      (data?.responseTimes ?? [])
        .filter((r) => r.minutes_to_ack === null && r.minutes_to_resolve === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, 8),
    [data]
  );

  if (loading && !data) return <LoadingState message="Loading organization overview…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { overview, cities } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Organization overview</h1>
          <p className="text-sm text-slate-600 mt-1">
            Alert volumes, response times and outcomes across cities and coordinators.
          </p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Open alerts" value={overview.open_alerts} subtitle={`${overview.alerts_in_range} raised in range`} icon={<Bell className="w-5 h-5" />} variant={overview.open_alerts > 0 ? "warning" : "success"} />
        <MetricCard title="Median time to acknowledge" value={formatMinutes(overview.median_minutes_to_ack)} subtitle="From alert to first coordinator action" icon={<Clock className="w-5 h-5" />} variant="info" />
        <MetricCard title="Median time to resolve" value={formatMinutes(overview.median_minutes_to_resolve)} subtitle="From alert to resolution" icon={<CheckCircle2 className="w-5 h-5" />} variant="info" />
        <MetricCard title="Alerts rated useful" value={formatShare(overview.useful_share)} subtitle="Coordinator feedback" icon={<ThumbsUp className="w-5 h-5" />} variant="default" />
        <MetricCard title="AI wellbeing calls completed" value={formatShare(overview.ai_call_completion_rate)} subtitle="Of calls attempted" icon={<PhoneCall className="w-5 h-5" />} variant="default" />
        <MetricCard title="Seniors covered" value={`${overview.seniors_covered} / ${overview.seniors_total}`} subtitle="With a recent risk score" icon={<Users className="w-5 h-5" />} variant="success" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-700" /> Alerts per day
          </h2>
          {volumeByDay.length === 0 ? (
            <EmptyState title="No alerts in this period" />
          ) : (
            <>
              <div className="mt-4 space-y-1.5">
                {volumeByDay.map(([day, row]) => {
                  const total = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <div key={day} className="flex items-center gap-3 text-xs">
                      <span className="w-14 text-slate-500 shrink-0">{formatDay(day)}</span>
                      <div className="flex h-4 flex-1 rounded bg-slate-100 overflow-hidden">
                        {SEVERITIES.map((s) =>
                          row[s] ? <div key={s} className={SEVERITY_BAR[s]} style={{ width: `${(row[s] / maxPerDay) * 100}%` }} title={`${SEVERITY_LABEL[s]}: ${row[s]}`} /> : null
                        )}
                      </div>
                      <span className="w-6 text-right font-bold text-slate-700">{total}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
                {SEVERITIES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${SEVERITY_BAR[s]}`} />{SEVERITY_LABEL[s]}</span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5">
          <h2 className="text-sm font-black text-slate-900">Alerts still waiting for a response</h2>
          {waitingAlerts.length === 0 ? (
            <EmptyState title="Nothing waiting" description="Every alert has been acknowledged or resolved." />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {waitingAlerts.map((a) => (
                <li key={a.alert_id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{a.alert_id}</p>
                    <p className="text-slate-500">{a.city} · raised {ageOf(a.created_at)} ago</p>
                  </div>
                  <span className={pillClass(SEVERITY_CLASS, a.severity)}>{SEVERITY_LABEL[a.severity] ?? a.severity}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/city-manager/alerts" className="inline-block mt-3 text-xs font-bold text-teal-800 hover:underline">All alerts →</Link>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <h2 className="text-sm font-black text-slate-900 px-5 pt-5">Cities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-3">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <tr>
                <th className="px-5 py-2">City</th><th className="px-3 py-2 text-right">Seniors</th><th className="px-3 py-2 text-right">Coordinators</th>
                <th className="px-3 py-2 text-right">Open alerts</th><th className="px-3 py-2 text-right">Average risk</th><th className="px-5 py-2 text-right">High risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cities.map((c) => (
                <tr key={c.city} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-bold text-slate-800">{c.city}</td>
                  <td className="px-3 py-2.5 text-right">{c.seniors}</td>
                  <td className="px-3 py-2.5 text-right">{c.coordinators}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{c.open_alerts}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(c.avg_risk, 1)}</td>
                  <td className="px-5 py-2.5 text-right">{c.high_risk_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-black text-slate-900">Coordinators with the most open alerts</h2>
          <Link href="/city-manager/caretakers" className="text-xs font-bold text-teal-800 hover:underline">All coordinators →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-3">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <tr><th className="px-5 py-2">Coordinator</th><th className="px-3 py-2">City</th><th className="px-3 py-2 text-right">Caseload</th><th className="px-3 py-2 text-right">Open alerts</th><th className="px-5 py-2 text-right">Calls</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {busiestCoordinators.map((c) => (
                <tr key={c.coordinator_id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-bold text-slate-800">{c.display_name}</td>
                  <td className="px-3 py-2.5">{c.city}</td>
                  <td className="px-3 py-2.5 text-right">{c.caseload}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{c.open_alerts}</td>
                  <td className="px-5 py-2.5 text-right">{c.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
