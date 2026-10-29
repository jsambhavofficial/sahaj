"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  X,
  FileCheck,
  MapPin,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { OperationalAlertItem } from "@/types/api";

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  // Modal State for Resolve
  const [resolvingAlert, setResolvingAlert] = useState<OperationalAlertItem | null>(null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/api/v1/operational/alerts?limit=150";
      if (statusFilter) endpoint += `&status_filter=${statusFilter}`;
      if (severityFilter) endpoint += `&severity=${severityFilter}`;

      const data = await defaultApiClient.get<OperationalAlertItem[]>(endpoint);
      setAlerts(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load operational alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await defaultApiClient.post(
        `/api/v1/operational/alerts/${alertId}/acknowledge`,
        { notes: "Acknowledged by Organization Admin in Executive Portal." }
      );
      setActionSuccess(`Alert ${alertId} successfully acknowledged.`);
      await fetchAlerts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to acknowledge alert.");
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert) return;
    setSubmittingAction(true);
    try {
      await defaultApiClient.post(
        `/api/v1/operational/alerts/${resolvingAlert.alert_id}/resolve`,
        { resolution_reason: resolutionReason.trim() }
      );
      setActionSuccess(`Alert ${resolvingAlert.alert_id} resolved with clinical disposition.`);
      setResolvingAlert(null);
      setResolutionReason("");
      await fetchAlerts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to resolve alert.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredAlerts = alerts.filter((a) =>
    a.alert_id.toLowerCase().includes(search.toLowerCase()) ||
    a.senior_id.toLowerCase().includes(search.toLowerCase()) ||
    (a.senior_name && a.senior_name.toLowerCase().includes(search.toLowerCase())) ||
    (a.triggering_signals && a.triggering_signals.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-600" />
            AI Early Warning & Triage Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physiological, behavioral, and sensor alerts detected across senior populations.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Alerts
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Alert ID, Senior ID, or symptoms..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open (New)</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All Severities</option>
            <option value="URGENT_REVIEW">Urgent Review</option>
            <option value="HIGH">High Risk</option>
            <option value="MODERATE">Moderate</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading early warning alerts...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No alerts matched your current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Alert ID</th>
                  <th className="py-3.5 px-4">Severity / Status</th>
                  <th className="py-3.5 px-4">Senior / Chapter</th>
                  <th className="py-3.5 px-4">Triggering AI Signals</th>
                  <th className="py-3.5 px-4">Recommended Next Step</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAlerts.map((a) => {
                  const isResolved = a.status === "RESOLVED";
                  const isAck = a.status === "ACKNOWLEDGED";

                  return (
                    <tr key={a.alert_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {a.alert_id}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            a.severity === "URGENT_REVIEW"
                              ? "bg-red-100 text-red-800"
                              : a.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {a.severity.replace("_", " ")}
                        </span>
                        <div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              isResolved
                                ? "bg-slate-100 text-slate-600"
                                : isAck
                                ? "bg-purple-100 text-purple-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/seniors/${a.senior_id}`}
                          className="font-bold text-slate-900 hover:text-brand-600"
                        >
                          {a.senior_name}
                        </Link>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          {a.senior_id}
                          {a.city_id && (
                            <span className="text-[10px] bg-slate-100 px-1.5 rounded font-sans text-slate-600">
                              {a.city_id.replace("CITY_", "")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-700 font-normal">
                          {a.triggering_signals}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-600 italic font-normal">
                          {a.recommended_next_step}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                        {a.created_at}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isResolved ? (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Resolved
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {!isAck && (
                              <button
                                onClick={() => handleAcknowledge(a.alert_id)}
                                className="px-2 py-1 bg-white border border-slate-300 hover:border-slate-400 rounded text-[11px] font-semibold text-slate-700 transition-colors"
                              >
                                Ack
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setResolvingAlert(a);
                                setResolutionReason(
                                  a.recommended_next_step ||
                                  "Clinical team contacted senior; condition stabilized."
                                );
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolve Disposition Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                Document Alert Resolution
              </h3>
              <button
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolve} className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Resolving Alert:</p>
                <p className="font-mono font-bold text-slate-900">{resolvingAlert.alert_id} ({resolvingAlert.senior_name})</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700">
                  Documented Clinical / Safety Disposition (Mandatory)
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  placeholder="Describe doctor review, caretaker home check, or recovered vitals..."
                  className="mt-1 block w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !resolutionReason.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {submittingAction ? "Persisting..." : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

