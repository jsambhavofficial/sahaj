"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import {
  SEVERITY_CLASS,
  SEVERITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  ageOf,
  formatDateTime,
  pillClass,
} from "@/lib/opsFormat";

interface AlertRow {
  alert_id: string;
  senior_id: string;
  status: string;
  severity: string;
  created_at: string;
  last_updated_at: string;
  triggering_signals: string[];
  recommended_next_step: string;
  resolution_reason?: string | null;
}

const PAGE_SIZE = 25;
const STATUSES = ["", "OPEN", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"];
const SEVERITIES = ["", "URGENT_REVIEW", "HIGH", "MODERATE"];

export default function AlertsPage() {
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(() => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (status) qs.set("status", status);
    if (severity) qs.set("severity", severity);
    return defaultApiClient.get<{ items: AlertRow[]; total: number }>(`/alerts?${qs}`);
  }, [status, severity, offset]);

  const total = data?.total ?? 0;
  const select = "bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Alerts</h1>
        <p className="text-sm text-slate-600 mt-1">
          Every alert raised by the early-warning system. Coordinators acknowledge and resolve them in the Sahaj app.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className={select} aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? STATUS_LABEL[s] : "All statuses"}</option>)}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setOffset(0); }} className={select} aria-label="Severity">
          {SEVERITIES.map((s) => <option key={s} value={s}>{s ? SEVERITY_LABEL[s] : "All severities"}</option>)}
        </select>
      </div>

      {loading && !data ? (
        <LoadingState message="Loading alerts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No alerts match these filters" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.items.map((a) => {
              const open = openId === a.alert_id;
              return (
                <li key={a.alert_id}>
                  <button
                    onClick={() => setOpenId(open ? null : a.alert_id)}
                    className="w-full text-left px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-slate-50"
                    aria-expanded={open}
                  >
                    <span className="font-bold text-xs text-slate-800 w-28">{a.alert_id}</span>
                    <span className={pillClass(SEVERITY_CLASS, a.severity)}>{SEVERITY_LABEL[a.severity] ?? a.severity}</span>
                    <span className={pillClass(STATUS_CLASS, a.status)}>{STATUS_LABEL[a.status] ?? a.status}</span>
                    <span className="text-xs text-slate-500 flex-1 min-w-[10rem]">Senior {a.senior_id} · raised {formatDateTime(a.created_at)}{a.status === "OPEN" ? ` (${ageOf(a.created_at)} ago)` : ""}</span>
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-xs space-y-2 bg-slate-50/60">
                      <p className="font-bold text-slate-800">Why it fired</p>
                      <ul className="list-disc pl-5 text-slate-700 space-y-1">
                        {a.triggering_signals.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                      <p className="text-slate-700"><span className="font-bold">Suggested next step:</span> {a.recommended_next_step}</p>
                      {a.resolution_reason && <p className="text-slate-700"><span className="font-bold">Resolution:</span> {a.resolution_reason}</p>}
                      <Link href={`/city-manager/seniors/${a.senior_id}`} className="inline-block font-bold text-teal-800 hover:underline">Open senior →</Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="p-1.5 rounded border border-slate-300 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className="p-1.5 rounded border border-slate-300 disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
