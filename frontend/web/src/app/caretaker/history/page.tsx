"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  History,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { CaretakerScheduleResponse, VisitSummaryItem } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CaretakerHistoryPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CaretakerScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<CaretakerScheduleResponse>(
        "/api/v1/caretaker/schedule"
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load visit history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const historyVisits = (data?.visits || []).filter(
    (v) => v.status === "COMPLETED" || v.status === "CANCELLED" || v.status === "MISSED"
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/caretaker"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-brand-700">Audit & Log</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Field Visit History
          </h1>
          <p className="text-xs text-slate-500">
            Log of completed care visits, clinical summaries, and outcomes
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500">Loading visit history...</p>
        </div>
      ) : historyVisits.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
          <History className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold">No completed past visits recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {historyVisits.map((v) => (
            <div key={v.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {new Date(v.scheduled_start).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(v.scheduled_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      v.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>

                {v.completion_outcome && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    {v.completion_outcome.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">{v.senior_name}</h3>
                <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{v.senior_address || "Bengaluru Home Address"}</span>
                </p>
              </div>

              {v.summary_notes && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900 block mb-0.5">Summary Note:</span>
                  {v.summary_notes}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-500">
                  Tasks Completed: {v.completed_task_count} / {v.task_count}
                </span>
                <Link
                  href={`/caretaker/visits/${v.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Full Record</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

