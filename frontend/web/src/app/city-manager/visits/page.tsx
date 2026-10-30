"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UserCog,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PlayCircle,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { VisitSummaryItem, SeniorDirectoryItem, StaffDetail } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerVisitsPage() {
  const { user, isCityManager, isAdmin } = useAuth();

  const [visits, setVisits] = useState<VisitSummaryItem[]>([]);
  const [seniors, setSeniors] = useState<SeniorDirectoryItem[]>([]);
  const [caretakers, setCaretakers] = useState<StaffDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal: Schedule Visit
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSeniorId, setSelectedSeniorId] = useState("");
  const [selectedCaretakerId, setSelectedCaretakerId] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("ROUTINE_HOME_CHECK");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [tasksInput, setTasksInput] = useState(
    "Check blood pressure and pulse, Inspect prescription pill organizer, Check bathroom fall hazards"
  );
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Modal: Cancel Visit
  const [cancelVisitId, setCancelVisitId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Modal: Reassign Visit
  const [reassignVisitId, setReassignVisitId] = useState<string | null>(null);
  const [newCaretakerId, setNewCaretakerId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, sRes, cRes] = await Promise.all([
        defaultApiClient.get<VisitSummaryItem[]>("/api/v1/operational/visits"),
        defaultApiClient.get<SeniorDirectoryItem[]>("/api/v1/operational/seniors").catch(() => []),
        defaultApiClient.get<StaffDetail[]>("/api/v1/operational/staff?role=CARETAKER").catch(() => []),
      ]);

      setVisits(vRes);
      setSeniors(sRes);
      setCaretakers(cRes);

      if (sRes.length > 0 && !selectedSeniorId) {
        setSelectedSeniorId(sRes[0].senior_id);
      }
      if (cRes.length > 0 && !selectedCaretakerId) {
        setSelectedCaretakerId(cRes[0].user_id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load operational visits data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set default schedule times to today + 2 hours
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const startStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const end = new Date(now.getTime() + 90 * 60000);
    const endStr = new Date(end.getTime() - end.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setScheduledStart(startStr);
    setScheduledEnd(endStr);

    fetchData();
  }, []);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    setScheduleLoading(true);

    try {
      const taskTitles = tasksInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await defaultApiClient.post("/api/v1/operational/visits", {
        senior_id: selectedSeniorId,
        caretaker_user_id: selectedCaretakerId,
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: new Date(scheduledEnd).toISOString(),
        visit_purpose: visitPurpose,
        initial_tasks: taskTitles,
      });

      setShowScheduleModal(false);
      await fetchData();
    } catch (err: any) {
      setScheduleError(
        err?.message ||
          "Failed to schedule visit. Please verify caretaker schedule overlap and parameters."
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCancelVisit = async () => {
    if (!cancelVisitId || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await defaultApiClient.post(`/api/v1/operational/visits/${cancelVisitId}/cancel`, {
        reason: cancelReason.trim(),
      });
      setCancelVisitId(null);
      setCancelReason("");
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel visit.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReassignVisit = async () => {
    if (!reassignVisitId || !newCaretakerId) return;
    setReassignLoading(true);
    try {
      await defaultApiClient.patch(`/api/v1/operational/visits/${reassignVisitId}/reassign`, {
        new_caretaker_user_id: newCaretakerId,
        reason: reassignReason.trim() || undefined,
      });
      setReassignVisitId(null);
      setNewCaretakerId("");
      setReassignReason("");
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to reassign visit.");
    } finally {
      setReassignLoading(false);
    }
  };

  const filteredVisits = visits.filter((v) => {
    if (statusFilter === "ALL") return true;
    return v.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
              Operations Desk
            </span>
            <span className="text-xs text-slate-500">
              {user?.staff_profile?.city_id ? user.staff_profile.city_id.replace("CITY_", "") : "All Cities"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Home Visit & Care Schedule Management
          </h1>
          <p className="text-xs text-slate-500">
            Schedule, dispatch, monitor, and coordinate in-home elder-care field visits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Schedule Home Visit</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-1">
          {["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-slate-400 pl-4 hidden sm:inline">
          {filteredVisits.length} visits found
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Visits Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500">Loading scheduled visits...</p>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold">No visits matching the selected status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Senior Citizen</th>
                  <th className="py-3 px-4">Field Caretaker</th>
                  <th className="py-3 px-4">Purpose & Tasks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {new Date(v.scheduled_start).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(v.scheduled_start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(v.scheduled_end).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{v.senior_name || v.senior_id}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[180px]">{v.senior_address || "Bengaluru"}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <UserCog className="w-3.5 h-3.5 text-brand-600" />
                        <span>{v.caretaker_name || "Aarav Patel"}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {v.caretaker_user_id}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {v.visit_purpose || v.visit_type.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>
                          {v.completed_task_count} / {v.task_count} Tasks Completed
                        </span>
                        {v.concern_count > 0 && (
                          <span className="text-red-600 font-bold">
                            • {v.concern_count} Concern(s)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          v.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : v.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 animate-pulse"
                            : v.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {v.status.replace("_", " ")}
                      </span>
                      {v.completion_outcome && (
                        <div className="text-[10px] font-medium text-emerald-700 mt-0.5">
                          {v.completion_outcome.replace(/_/g, " ")}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {v.status === "SCHEDULED" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setReassignVisitId(v.id);
                              setNewCaretakerId(caretakers[0]?.user_id || "");
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => setCancelVisitId(v.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={`/caretaker/visits/${v.id}`}
                          className="text-[11px] font-bold text-brand-600 hover:text-brand-800"
                        >
                          View Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Schedule New Visit */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVisit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border-t-4 border-brand-600"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Schedule In-Home Care Visit</h3>
              <p className="text-xs text-slate-500">
                Dispatch an authorized caretaker to senior&apos;s home with predefined tasks.
              </p>
            </div>

            {scheduleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{scheduleError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Senior Citizen</label>
                  <select
                    value={selectedSeniorId}
                    onChange={(e) => setSelectedSeniorId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  >
                    {seniors.map((s) => (
                      <option key={s.senior_id} value={s.senior_id}>
                        {s.name} ({s.senior_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Caretaker
                  </label>
                  <select
                    value={selectedCaretakerId}
                    onChange={(e) => setSelectedCaretakerId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  >
                    {caretakers.map((c) => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.full_name} ({c.employee_code || "Staff"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Visit Purpose</label>
                <select
                  value={visitPurpose}
                  onChange={(e) => setVisitPurpose(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ROUTINE_HOME_CHECK">Routine Wellbeing & Safety Check</option>
                  <option value="MEDICATION_ASSISTANCE">Medication Adherence Audit</option>
                  <option value="POST_DISCHARGE_FOLLOW_UP">Post-Hospitalization Discharge Review</option>
                  <option value="PHYSIOTHERAPY_SESSION">Mobility & Rehabilitation Exercise</option>
                  <option value="EMERGENCY_CHECKIN">Post-Alert Urgent Welfare Check</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scheduled Start</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scheduled End</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Care Tasks (comma-separated)
                </label>
                <textarea
                  rows={2}
                  value={tasksInput}
                  onChange={(e) => setTasksInput(e.target.value)}
                  placeholder="Task 1, Task 2, Task 3..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  setScheduleError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleLoading}
                className="px-5 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
              >
                {scheduleLoading ? "Scheduling..." : "Confirm Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Reassign Visit */}
      {reassignVisitId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Reassign Care Visit</h3>
            <p className="text-xs text-slate-500">
              Transfer this visit to another authorized caretaker within the same municipal chapter.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Caretaker</label>
                <select
                  value={newCaretakerId}
                  onChange={(e) => setNewCaretakerId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  {caretakers.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name} ({c.employee_code || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Reassignment</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Original caretaker on emergency leave"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignVisitId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reassignLoading || !newCaretakerId}
                onClick={handleReassignVisit}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {reassignLoading ? "Reassigning..." : "Confirm Reassignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Visit */}
      {cancelVisitId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Cancel Scheduled Visit</h3>
            <p className="text-xs text-slate-500">
              Please enter an operational or clinical reason for cancelling this home visit.
            </p>

            <textarea
              rows={3}
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Senior requested reschedule, Family visiting senior..."
              className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelVisitId(null);
                  setCancelReason("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelLoading || !cancelReason.trim()}
                onClick={handleCancelVisit}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

