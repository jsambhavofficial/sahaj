"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  Shield,
  FileCode,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { AuditLogEntry } from "@/types/api";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.get<AuditLogEntry[]>("/api/v1/audit-logs?limit=100");
      setLogs(data);
    } catch (err: any) {
      setError(err?.message || "Failed to retrieve immutable platform audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target_entity_type.toLowerCase().includes(search.toLowerCase()) ||
      l.target_entity_id.toLowerCase().includes(search.toLowerCase()) ||
      (l.actor_user_id && l.actor_user_id.toLowerCase().includes(search.toLowerCase()));

    const matchesAction = !actionFilter || l.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-brand-600" />
            Platform Security & Operational Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system audit logs tracking logins, caseload modifications, triage actions, and DPDP revocations.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by actor, action, target entity..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All Action Types</option>
            <option value="USER_LOGIN">User Logins</option>
            <option value="USER_LOGOUT">User Logouts</option>
            <option value="ALERT_ACKNOWLEDGED">Alert Acknowledgements</option>
            <option value="ALERT_RESOLVED">Alert Resolutions</option>
            <option value="CARETAKER_ASSIGNMENT_CREATED">Caseload Assignments</option>
            <option value="FAMILY_AUTHORIZATION_REVOKED">Family Revocations</option>
            <option value="CITY_CREATED">City Created</option>
            <option value="STAFF_ACCOUNT_CREATED">Staff Created</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading immutable audit entries...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No audit records matched your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Timestamp (UTC)</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">State Mutation Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {l.actor_user_id || "SYSTEM_BOOTSTRAP"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{l.target_entity_type}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                        {l.target_entity_id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      {l.after_state ? (
                        <code className="block bg-slate-50 p-1.5 rounded text-[10px] text-slate-700 font-mono overflow-x-auto border border-slate-200/60">
                          {l.after_state}
                        </code>
                      ) : (
                        <span className="text-slate-400 italic">No state diff</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

