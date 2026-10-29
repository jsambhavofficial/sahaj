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
  Check,
  UserCheck,
  PlusCircle,
  Activity,
  User,
  ClipboardList,
  Eye,
  FileText,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  OperationalAlertItem,
  AlertDetailExtendedResponse,
  StaffDetail,
  FollowUpTaskItem,
} from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [staffList, setStaffList] = useState<StaffDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  // Modal State for Alert Dossier & Details
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertDetail, setAlertDetail] = useState<AlertDetailExtendedResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal State for Resolve
  const [resolvingAlert, setResolvingAlert] = useState<OperationalAlertItem | null>(null);
  const [resolutionReason, setResolutionReason] = useState("");

  // Modal State for Assign
  const [assigningAlertId, setAssigningAlertId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // Modal State for Follow-Up Task
  const [followUpAlertId, setFollowUpAlertId] = useState<string | null>(null);
  const [followUpActionType, setFollowUpActionType] = useState("HOME_VISIT");
  const [followUpStaffId, setFollowUpStaffId] = useState("");
  const [followUpHours, setFollowUpHours] = useState(24);
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Assigned City";

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/api/v1/operational/alerts?limit=150";
      if (statusFilter) endpoint += `&status_filter=${statusFilter}`;
      if (severityFilter) endpoint += `&severity=${severityFilter}`;

      const [data, staffData] = await Promise.all([
        defaultApiClient.get<OperationalAlertItem[]>(endpoint),
        defaultApiClient.get<StaffDetail[]>("/api/v1/operational/staff").catch(() => []),
      ]);

      setAlerts(data);
      setStaffList(staffData);
      if (staffData.length > 0) {
        setSelectedStaffId(staffData[0].user_id);
        setFollowUpStaffId(staffData[0].user_id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load city operational alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  // Load detailed alert dossier
  const handleViewAlert = async (alertId: string) => {
    setSelectedAlertId(alertId);
    setLoadingDetail(true);
    try {
      const data = await defaultApiClient.get<AlertDetailExtendedResponse>(
        `/api/v1/operational/alerts/${alertId}`
      );
      setAlertDetail(data);
    } catch (err: any) {
      alert(err?.message || "Failed to load alert dossier.");
      setSelectedAlertId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await defaultApiClient.post(
        `/api/v1/operational/alerts/${alertId}/acknowledge`,
        { notes: `Acknowledged by City Manager (${user?.full_name || "Manager"}).` }
      );
      setActionSuccess(`Alert ${alertId} acknowledged.`);
      await fetchAlerts();
      if (selectedAlertId === alertId) {
        handleViewAlert(alertId);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to acknowledge alert.");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningAlertId || !selectedStaffId) return;
    setSubmittingAction(true);
    try {
      await defaultApiClient.post(
        `/api/v1/operational/alerts/${assigningAlertId}/assign`,
        { assigned_to_user_id: selectedStaffId, notes: assignNotes.trim() || undefined }
      );
      setActionSuccess(`Alert assigned to staff member.`);
      setAssigningAlertId(null);
      setAssignNotes("");
      await fetchAlerts();
      if (selectedAlertId === assigningAlertId) {
        handleViewAlert(assigningAlertId);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to assign alert.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpAlertId || !followUpStaffId) return;
    setSubmittingAction(true);
    try {
      await defaultApiClient.post(
        `/api/v1/operational/alerts/${followUpAlertId}/follow-up`,
        {
          action_type: followUpActionType,
          assigned_to_user_id: followUpStaffId,
          due_hours: Number(followUpHours),
          notes: followUpNotes.trim() || undefined,
        }
      );
      setActionSuccess(`Follow-up task created and dispatched.`);
      setFollowUpAlertId(null);
      setFollowUpNotes("");
      await fetchAlerts();
      if (selectedAlertId === followUpAlertId) {
        handleViewAlert(followUpAlertId);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to dispatch follow-up task.");
    } finally {
      setSubmittingAction(false);
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
      if (selectedAlertId === resolvingAlert.alert_id) {
        setSelectedAlertId(null);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to resolve alert.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredAlerts = alerts.filter(
    (a) =>
      a.alert_id.toLowerCase().includes(search.toLowerCase()) ||
      a.senior_id.toLowerCase().includes(search.toLowerCase()) ||
      (a.senior_name && a.senior_name.toLowerCase().includes(search.toLowerCase())) ||
      (a.triggering_signals && a.triggering_signals.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Clinical & Operational Alerts Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              {cityName} Chapter
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Intelligent early-warning triage combining deterministic rules, ML inferences, and human follow-up workflows
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-center gap-2.5 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Alert ID, Senior ID, Name, or Clinical cue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="FOLLOW_UP_REQUIRED">Follow-Up Required</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Severities</option>
            <option value="URGENT_REVIEW">Urgent Review</option>
            <option value="HIGH">High</option>
            <option value="MODERATE">Moderate</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
            Loading municipal alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No operational alerts match your criteria for {cityName}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Severity & ID</th>
                  <th className="px-4 py-3">Senior Citizen</th>
                  <th className="px-4 py-3">Trigger Signals</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((alert) => (
                  <tr key={alert.alert_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            alert.severity === "URGENT_REVIEW"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : alert.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {alert.severity.replace("_", " ")}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 block mt-1">
                        {alert.alert_id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/seniors/${alert.senior_id}`}
                        className="font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                      >
                        {alert.senior_name || alert.senior_id}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-400 block">
                        {alert.senior_id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-[11px] text-slate-800 line-clamp-2">
                        {alert.triggering_signals || "Deviation detected across vital baselines"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          alert.status === "OPEN"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : alert.status === "ACKNOWLEDGED"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : alert.status === "UNDER_REVIEW"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : alert.status === "FOLLOW_UP_REQUIRED"
                            ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                            : alert.status === "ESCALATED"
                            ? "bg-red-600 text-white font-black"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {alert.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleDateString()}{" "}
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewAlert(alert.alert_id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Dossier</span>
                        </button>

                        {alert.status === "OPEN" && (
                          <button
                            onClick={() => handleAcknowledge(alert.alert_id)}
                            className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-800 rounded-md text-[11px] font-medium hover:bg-amber-100 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== "RESOLVED" && (
                          <>
                            <button
                              onClick={() => {
                                setAssigningAlertId(alert.alert_id);
                                setAssignNotes("");
                              }}
                              className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-[11px] font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Assign</span>
                            </button>

                            <button
                              onClick={() => {
                                setFollowUpAlertId(alert.alert_id);
                                setFollowUpNotes("");
                              }}
                              className="px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-md text-[11px] font-medium hover:bg-purple-100 transition-colors flex items-center gap-1"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>Follow-Up</span>
                            </button>

                            <button
                              onClick={() => {
                                setResolvingAlert(alert);
                                setResolutionReason("");
                              }}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[11px] font-medium hover:bg-emerald-700 shadow-2xs transition-colors flex items-center gap-1"
                            >
                              <FileCheck className="w-3 h-3" /> Resolve
                            </button>
                          </>
                        )}
                        {alert.status === "RESOLVED" && (
                          <span className="text-[11px] text-slate-400 italic">Closed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Full Alert Dossier & Side-by-Side Assessment Breakdown */}
      {selectedAlertId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Operational Alert Dossier ({selectedAlertId})
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlertId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600" />
                <p>Loading authoritative risk assessment and triage history...</p>
              </div>
            ) : alertDetail ? (
              <div className="space-y-4 text-xs">
                {/* Senior & Triage Status Card */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Senior</span>
                    <span className="font-bold text-slate-900">{alertDetail.senior_name}</span>
                    <span className="font-mono text-slate-500 block">{alertDetail.senior_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Severity</span>
                    <span className="font-bold text-red-700">{alertDetail.severity.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                    <span className="font-bold text-slate-800">{alertDetail.status.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Staff</span>
                    <span className="font-bold text-brand-700">{alertDetail.assigned_to_name || "Unassigned"}</span>
                  </div>
                </div>

                {/* Risk Assessment: Separate Rule Score & ML Probability */}
                {alertDetail.assessment ? (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-brand-600" />
                        Linked AI Risk Assessment ({alertDetail.assessment.id})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Evaluated {alertDetail.assessment.assessment_date}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Rule-Based Score */}
                      <div className="p-3 bg-brand-50/50 rounded-lg border border-brand-100 space-y-1">
                        <span className="text-[11px] font-bold text-brand-900 block">
                          Rule-Based Clinical Score
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-brand-700">
                            {alertDetail.assessment.rule_score}
                          </span>
                          <span className="text-xs text-slate-500">/ 100</span>
                          <span className="text-[10px] font-bold uppercase bg-brand-100 text-brand-800 px-2 py-0.5 rounded">
                            {alertDetail.assessment.rule_category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Deterministic safety rules, vitals bounds, and baseline deviations.
                        </p>
                      </div>

                      {/* ML Statistical Probability */}
                      <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 space-y-1">
                        <span className="text-[11px] font-bold text-purple-900 block">
                          ML Statistical Anomaly Probability
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-purple-700">
                            {alertDetail.assessment.ml_probability !== null && alertDetail.assessment.ml_probability !== undefined
                              ? `${Math.round(alertDetail.assessment.ml_probability * 100)}%`
                              : "N/A"}
                          </span>
                          <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            {alertDetail.assessment.ml_risk_level || "DEGRADED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Logistic regression model trained on longitudinal synthetic telemetry.
                        </p>
                      </div>
                    </div>

                    {/* Contributing Factors & Tripwires */}
                    {alertDetail.assessment.top_contributing_factors.length > 0 && (
                      <div className="space-y-1 pt-2">
                        <span className="font-bold text-slate-800 block text-[11px]">
                          Triggering Clinical Factors:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                          {alertDetail.assessment.top_contributing_factors.map((f, i) => (
                            <li key={i}>
                              <span className="font-semibold text-slate-800">{f.rule_id}:</span> {f.evidence || "Observation triggered"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Non-Diagnostic Disclaimer */}
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900">
                      <span className="font-bold block">Safety Disclaimer:</span>
                      {alertDetail.assessment.disclaimer}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-xs italic">
                    Alert originated from clinical concern without formal ML vector.
                  </div>
                )}

                {/* Follow-Up Tasks Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-brand-600" />
                      Follow-Up Actions ({alertDetail.follow_up_tasks.length})
                    </span>
                    <button
                      onClick={() => {
                        setFollowUpAlertId(alertDetail.id);
                        setFollowUpNotes("");
                      }}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" /> Add Follow-Up
                    </button>
                  </div>

                  {alertDetail.follow_up_tasks.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-lg">
                      No follow-up tasks currently assigned for this alert.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {alertDetail.follow_up_tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {task.action_type.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded uppercase ${
                                  task.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Assigned to: <span className="font-semibold">{task.assigned_to_name || task.assigned_to_user_id}</span> • Due: {new Date(task.due_at).toLocaleDateString()}
                            </p>
                            {task.outcome_notes && (
                              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1">
                                <span className="font-bold">Field Outcome:</span> {task.outcome_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setSelectedAlertId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Alert to Staff Member */}
      {assigningAlertId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Assign Alert to Staff Member</h3>
              </div>
              <button
                onClick={() => setAssigningAlertId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsible Staff Member / Caretaker *
                </label>
                <select
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name} ({s.role.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Instructions / Triage Notes
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g., Contact senior immediately, check morning vitals, inspect medication organizers."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningAlertId(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !selectedStaffId}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Follow-Up Task */}
      {followUpAlertId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Create Actionable Follow-Up Task</h3>
              </div>
              <button
                onClick={() => setFollowUpAlertId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Follow-Up Action Type</label>
                <select
                  value={followUpActionType}
                  onChange={(e) => setFollowUpActionType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  <option value="HOME_VISIT">In-Person Home Visit</option>
                  <option value="PHONE_CHECKIN">Urgent Telephonic Welfare Call</option>
                  <option value="MEDICATION_AUDIT">Medication Adherence Audit</option>
                  <option value="CLINICAL_TRIAGE">Supervisor Clinical Assessment</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Caretaker / Staff</label>
                <select
                  required
                  value={followUpStaffId}
                  onChange={(e) => setFollowUpStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name} ({s.role.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Within (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={followUpHours}
                  onChange={(e) => setFollowUpHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Field Instructions</label>
                <textarea
                  rows={3}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Specific checks to perform (e.g., assess dizziness, verify pill box, test BP)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFollowUpAlertId(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !followUpStaffId}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? "Dispatching..." : "Dispatch Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resolve Alert with Reason */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Resolve Operational Alert</h3>
              </div>
              <button
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div>
                  <span className="font-semibold text-slate-700">Alert ID:</span>{" "}
                  <span className="font-mono">{resolvingAlert.alert_id}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Senior:</span>{" "}
                  {resolvingAlert.senior_name || resolvingAlert.senior_id} ({resolvingAlert.senior_id})
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Severity:</span>{" "}
                  <span className="font-bold">{resolvingAlert.severity}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Reason / Clinical Disposition *
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  placeholder="e.g., Visited senior at home; vitals stabilized, routine medication intake resumed without side effects."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !resolutionReason.trim()}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                >
                  {submittingAction ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
