"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { getDataService } from "@/services";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import { formatDay } from "@/lib/opsFormat";

type SortKey = "open_alerts" | "caseload" | "calls" | "alerts_handled" | "display_name";

interface DailyActivity {
  day: string;
  alert_actions: number;
  calls: number;
  messages_sent: number;
}

function Daily({ coordinatorId }: { coordinatorId: string }) {
  const { data, loading, error } = useAsync(() => getDataService().getOpsCoordinatorDetail(coordinatorId), [coordinatorId]);
  if (loading) return <p className="px-5 py-3 text-xs text-slate-500">Loading activity…</p>;
  if (error) return <p className="px-5 py-3 text-xs text-rose-700">{error}</p>;
  const days: DailyActivity[] = [...(data?.daily ?? [])].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);
  if (days.length === 0) return <p className="px-5 py-3 text-xs text-slate-500">No recorded activity yet.</p>;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
        <tr><th className="px-5 py-1.5">Day</th><th className="px-3 py-1.5 text-right">Alert actions</th><th className="px-3 py-1.5 text-right">Calls</th><th className="px-5 py-1.5 text-right">Messages</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {days.map((d) => (
          <tr key={d.day}><td className="px-5 py-1.5">{formatDay(d.day)}</td><td className="px-3 py-1.5 text-right">{d.alert_actions}</td><td className="px-3 py-1.5 text-right">{d.calls}</td><td className="px-5 py-1.5 text-right">{d.messages_sent}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CoordinatorsPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<SortKey>("open_alerts");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(() => getDataService().getOpsCoordinators(), []);

  const cities = useMemo(() => Array.from(new Set((data ?? []).map((c) => c.city))).sort(), [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((c) => (!city || c.city === city) && (!q || c.display_name.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "display_name" ? a.display_name.localeCompare(b.display_name) : b[sort] - a[sort]));
  }, [data, search, city, sort]);

  const select = "bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600";
  const totals = rows.reduce((t, c) => ({ caseload: t.caseload + c.caseload, open: t.open + c.open_alerts, calls: t.calls + c.calls }), { caseload: 0, open: 0, calls: 0 });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Coordinators</h1>
        <p className="text-sm text-slate-600 mt-1">Caseload and activity of every care coordinator.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coordinators…" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-600" />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={select} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={select} aria-label="Sort by">
          <option value="open_alerts">Most open alerts</option>
          <option value="caseload">Largest caseload</option>
          <option value="calls">Most calls</option>
          <option value="alerts_handled">Most alerts handled</option>
          <option value="display_name">Name</option>
        </select>
      </div>

      {loading && !data ? <LoadingState message="Loading coordinators…" /> : error ? <ErrorState message={error} onRetry={reload} /> : rows.length === 0 ? <EmptyState title="No coordinators found" /> : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <p className="px-5 pt-4 text-xs text-slate-500">{rows.length} coordinators · {totals.caseload} seniors · {totals.open} open alerts · {totals.calls} calls</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-3">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <tr><th className="px-5 py-2">Coordinator</th><th className="px-3 py-2">City</th><th className="px-3 py-2 text-right">Caseload</th><th className="px-3 py-2 text-right">Open alerts</th><th className="px-3 py-2 text-right">Alerts handled</th><th className="px-3 py-2 text-right">Calls</th><th className="px-3 py-2 text-right">Messages</th><th className="px-5 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const open = openId === c.coordinator_id;
                  return (
                    <React.Fragment key={c.coordinator_id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenId(open ? null : c.coordinator_id)}>
                        <td className="px-5 py-2.5 font-bold text-slate-800">{c.display_name}</td>
                        <td className="px-3 py-2.5">{c.city}</td>
                        <td className="px-3 py-2.5 text-right">{c.caseload}</td>
                        <td className="px-3 py-2.5 text-right font-bold">{c.open_alerts}</td>
                        <td className="px-3 py-2.5 text-right">{c.alerts_handled}</td>
                        <td className="px-3 py-2.5 text-right">{c.calls}</td>
                        <td className="px-3 py-2.5 text-right">{c.messages_sent}</td>
                        <td className="px-5 py-2.5 text-slate-400">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
                      </tr>
                      {open && <tr><td colSpan={8} className="bg-slate-50/60 pb-2"><Daily coordinatorId={c.coordinator_id} /></td></tr>}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
