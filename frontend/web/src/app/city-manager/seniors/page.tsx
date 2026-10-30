"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getDataService } from "@/services";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/opsFormat";

const PAGE_SIZE = 25;
const RISK_LEVELS = [
  { value: "", label: "All risk levels" },
  { value: "URGENT_REVIEW", label: "Urgent review" },
  { value: "HIGH", label: "High" },
  { value: "MODERATE", label: "Moderate" },
  { value: "LOW", label: "Low" },
];

export default function SeniorsDirectoryPage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [city, setCity] = useState("");
  const [offset, setOffset] = useState(0);

  // a search typed in the header arrives as ?q=
  useEffect(() => {
    const q0 = new URLSearchParams(window.location.search).get("q");
    if (q0) setInput(q0);
  }, []);

  // wait for the user to stop typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const cities = useAsync(() => getDataService().getOpsCities(), []);
  const list = useAsync(
    () =>
      getDataService().getOpsSeniors({
        q: q || undefined,
        risk_level: risk || undefined,
        city: city || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [q, risk, city, offset]
  );

  const total = list.data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  const select = "bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Seniors</h1>
        <p className="text-sm text-slate-600 mt-1">Every enrolled senior with their latest risk level, highest risk first.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by name or senior ID…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <select value={risk} onChange={(e) => { setRisk(e.target.value); setOffset(0); }} className={select} aria-label="Risk level">
          {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={city} onChange={(e) => { setCity(e.target.value); setOffset(0); }} className={select} aria-label="City">
          <option value="">All cities</option>
          {(cities.data ?? []).map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
        </select>
      </div>

      {list.loading && !list.data ? (
        <LoadingState message="Loading seniors…" />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState title="No seniors match these filters" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-5 py-2">Senior</th><th className="px-3 py-2">City</th><th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Risk</th><th className="px-3 py-2">Coordinator</th><th className="px-3 py-2">Last contact</th><th className="px-5 py-2">Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((s) => (
                  <tr key={s.senior_id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/city-manager/seniors/${s.senior_id}`} className="font-bold text-teal-800 hover:underline">
                        {s.display_name || s.senior_id}
                      </Link>
                      <p className="text-slate-500">{s.senior_id} · {s.age} yrs</p>
                    </td>
                    <td className="px-3 py-2.5">{s.city}</td>
                    <td className="px-3 py-2.5 capitalize">{s.preferred_language}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={s.risk_level} />
                        <span className="text-slate-500">{s.risk_score ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{(s as { coordinator_name?: string }).coordinator_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{formatDateTime(s.last_contact_at)}</td>
                    <td className="px-5 py-2.5">{s.open_alert_id ? <span className="font-bold text-rose-700">Open</span> : <span className="text-slate-400">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>{from}–{to} of {total}</span>
            <div className="flex gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="p-1.5 rounded border border-slate-300 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={to >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className="p-1.5 rounded border border-slate-300 disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
