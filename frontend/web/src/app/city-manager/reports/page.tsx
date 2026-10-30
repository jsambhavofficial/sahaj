"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { getDataService } from "@/services";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import { formatDay, formatShare } from "@/lib/opsFormat";

const card = "bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5";
const h2 = "text-sm font-black text-slate-900";

export default function ReportsPage() {
  // The demo cohort ends before the real calendar date; NEXT_PUBLIC_DEMO_DATE picks the day to open on.
  const [date, setDate] = useState(() => process.env.NEXT_PUBLIC_DEMO_DATE || new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState("");

  const daily = useAsync(() => getDataService().getOpsDailyReports(date), [date]);
  const insights = useAsync(async () => {
    const svc = getDataService();
    const [precision, outcomes] = await Promise.all([svc.getOpsAlertsPrecision(), svc.getOpsAlertsOutcomes()]);
    return { precision, outcomes };
  }, []);

  const cities = useMemo(() => Array.from(new Set((daily.data ?? []).map((d) => d.coordinator.city))).sort(), [daily.data]);
  const lists = useMemo(
    () => (daily.data ?? []).filter((d) => (!city || d.coordinator.city === city) && d.items.length > 0),
    [daily.data, city]
  );

  const outcomeRows = useMemo(() => {
    const byOutcome = new Map<string, number>();
    (insights.data?.outcomes ?? []).forEach((o) => {
      const key = o.outcome ? o.outcome.replace(/_/g, " ") : "no feedback yet";
      byOutcome.set(key, (byOutcome.get(key) ?? 0) + o.alerts);
    });
    return Array.from(byOutcome.entries()).sort(([, a], [, b]) => b - a);
  }, [insights.data]);

  const input = "bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Reports</h1>
          <p className="text-sm text-slate-600 mt-1">The daily priority list across coordinators, and how well alerts are performing.</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 print:hidden">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <h2 className={h2}>Daily priority report</h2>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={input} aria-label="Report date" />
          <select value={city} onChange={(e) => setCity(e.target.value)} className={input} aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {daily.loading && !daily.data ? <LoadingState message="Loading report…" /> : daily.error ? <ErrorState message={daily.error} onRetry={daily.reload} /> : lists.length === 0 ? (
          <EmptyState title={`No priority lists for ${formatDay(date)}`} description="Lists are built each morning and again after the AI wellbeing calls." />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {lists.map((l) => (
              <div key={l.coordinator.coordinator_id} className={card}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-black text-slate-900">{l.coordinator.display_name}</h3>
                  <span className="text-[11px] text-slate-500">{l.coordinator.city}</span>
                </div>
                <ol className="mt-3 space-y-3">
                  {l.items.slice(0, 5).map((it) => (
                    <li key={it.rank} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white grid place-items-center text-[10px] font-bold">{it.rank}</span>
                        <Link href={`/city-manager/seniors/${it.senior.senior_id}`} className="font-bold text-teal-800 hover:underline">{it.senior.display_name || it.senior.senior_id}</Link>
                        <RiskBadge level={it.risk_level} />
                        <span className="text-slate-500">{it.risk_score}</span>
                      </div>
                      {it.reasons.length > 0 && <p className="text-slate-600 mt-1 pl-7">{it.reasons[0]}</p>}
                      <p className="text-slate-700 mt-0.5 pl-7"><b>Next:</b> {it.suggested_action}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className={card}>
          <h2 className={h2}>Alert precision by week</h2>
          <p className="text-xs text-slate-500 mt-1">Share of rated alerts that coordinators found useful.</p>
          {insights.loading ? <LoadingState message="Loading…" /> : (insights.data?.precision.length ?? 0) === 0 ? (
            <EmptyState title="No feedback yet" description="Precision appears once coordinators rate alerts as useful or not." />
          ) : (
            <table className="w-full text-xs mt-3">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-1.5">Week</th><th>City</th><th className="text-right">Rated</th><th className="text-right">Useful</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {insights.data!.precision.map((p, i) => (
                  <tr key={i}><td className="py-1.5">{formatDay(p.week_start)}</td><td>{p.city}</td><td className="text-right">{p.rated_alerts}</td><td className="text-right font-bold">{formatShare(p.precision)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>What happened after alerts</h2>
          {insights.loading ? <LoadingState message="Loading…" /> : outcomeRows.length === 0 ? <EmptyState title="No alerts yet" /> : (
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {outcomeRows.map(([name, n]) => (
                <li key={name} className="py-2 flex justify-between capitalize"><span>{name}</span><b>{n}</b></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
