"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PlayCircle,
  StopCircle,
  ShieldAlert,
  PlusCircle,
  FileText,
  Activity,
  Heart,
  User,
  Check,
  AlertCircle,
  Compass,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  VisitDetailResponse,
  CareTaskItem,
  VisitObservationItem,
  VisitConcernItem,
} from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function VisitExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const visitId = params?.visitId as string;

  const [visit, setVisit] = useState<VisitDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [showIncompleteModal, setShowIncompleteModal] = useState<string | null>(null);
  const [incompleteReason, setIncompleteReason] = useState("");
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Observation Form State
  const [obsType, setObsType] = useState("BLOOD_PRESSURE");
  const [obsNumeric, setObsNumeric] = useState("");
  const [obsText, setObsText] = useState("");
  const [obsAbnormal, setObsAbnormal] = useState(false);
  const [obsNotes, setObsNotes] = useState("");

  // Concern Form State
  const [concernCategory, setConcernCategory] = useState("FALL_RISK");
  const [concernSeverity, setConcernSeverity] = useState("MEDIUM");
  const [concernDescription, setConcernDescription] = useState("");
  const [concernFollowUp, setConcernFollowUp] = useState(true);

  // Checkout Form State
  const [checkoutOutcome, setCheckoutOutcome] = useState("COMPLETED_SUCCESSFULLY");
  const [checkoutSummary, setCheckoutSummary] = useState("");
  const [checkoutFollowUp, setCheckoutFollowUp] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Timer for active visit
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const fetchVisit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<VisitDetailResponse>(
        `/api/v1/caretaker/visits/${visitId}`
      );
      setVisit(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load visit details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visitId) {
      fetchVisit();
    }
  }, [visitId]);

  // Elapsed timer
  useEffect(() => {
    if (visit?.status === "IN_PROGRESS" && visit.actual_start) {
      const calcElapsed = () => {
        const start = new Date(visit.actual_start!).getTime();
        const now = Date.now();
        setElapsedMinutes(Math.max(0, Math.floor((now - start) / 60000)));
      };
      calcElapsed();
      const interval = setInterval(calcElapsed, 30000);
      return () => clearInterval(interval);
    }
  }, [visit?.status, visit?.actual_start]);

  // Check In Handler
  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const updated = await defaultApiClient.post<VisitDetailResponse>(
        `/api/v1/caretaker/visits/${visitId}/check-in`,
        {
          geofence_verified: true,
          notes: "Arrived at residence. Geofence verified.",
        }
      );
      setVisit(updated);
    } catch (err: any) {
      alert(err?.message || "Failed to check in.");
    } finally {
      setActionLoading(false);
    }
  };

  // Complete Care Task
  const handleCompleteTask = async (task: CareTaskItem) => {
    setActionLoading(true);
    try {
      const updatedTask = await defaultApiClient.patch<CareTaskItem>(
        `/api/v1/caretaker/tasks/${task.id}`,
        {
          status: "COMPLETED",
          completion_notes: "Completed during in-home visit",
        }
      );
      setVisit((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === task.id ? updatedTask : t)),
            }
          : prev
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update task.");
    } finally {
      setActionLoading(false);
    }
  };

  // Mark Care Task Incomplete
  const handleMarkTaskIncomplete = async () => {
    if (!showIncompleteModal || !incompleteReason.trim()) return;
    setActionLoading(true);
    try {
      const updatedTask = await defaultApiClient.patch<CareTaskItem>(
        `/api/v1/caretaker/tasks/${showIncompleteModal}`,
        {
          status: "NOT_COMPLETED",
          incomplete_reason: incompleteReason.trim(),
        }
      );
      setVisit((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === showIncompleteModal ? updatedTask : t)),
            }
          : prev
      );
      setShowIncompleteModal(null);
      setIncompleteReason("");
    } catch (err: any) {
      alert(err?.message || "Failed to update task.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Observation
  const handleSubmitObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await defaultApiClient.post<VisitObservationItem>(
        `/api/v1/caretaker/visits/${visitId}/observations`,
        {
          observation_type: obsType,
          numeric_value: obsNumeric ? parseFloat(obsNumeric) : undefined,
          text_value: obsText.trim() || undefined,
          flag_status: obsAbnormal ? "ABNORMAL" : "NORMAL",
          notes: obsNotes.trim() || undefined,
        }
      );
      setVisit((prev) =>
        prev
          ? {
              ...prev,
              observations: [res, ...prev.observations],
            }
          : prev
      );
      setShowObservationModal(false);
      setObsNumeric("");
      setObsText("");
      setObsAbnormal(false);
      setObsNotes("");
    } catch (err: any) {
      alert(err?.message || "Failed to record observation.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Concern
  const handleSubmitConcern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concernDescription.trim()) return;
    setActionLoading(true);
    try {
      const res = await defaultApiClient.post<VisitConcernItem>(
        `/api/v1/caretaker/visits/${visitId}/concerns`,
        {
          category: concernCategory,
          severity: concernSeverity,
          description: concernDescription.trim(),
          follow_up_needed: concernFollowUp,
        }
      );
      setVisit((prev) =>
        prev
          ? {
              ...prev,
              concerns: [res, ...prev.concerns],
            }
          : prev
      );
      setShowConcernModal(false);
      setConcernDescription("");
      if (concernSeverity === "HIGH" || concernSeverity === "URGENT") {
        alert("Concern logged and automatically escalated to City Manager operational alerts desk!");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to raise concern.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Check-Out
  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    // Guard: check pending tasks
    const pendingTasks = visit?.tasks.filter((t) => t.status === "PENDING") || [];
    if (pendingTasks.length > 0) {
      setCheckoutError(
        `Cannot check out: ${pendingTasks.length} task(s) are still PENDING. Please mark each task Completed or Not Completed.`
      );
      return;
    }

    setActionLoading(true);
    try {
      const updated = await defaultApiClient.post<VisitDetailResponse>(
        `/api/v1/caretaker/visits/${visitId}/check-out`,
        {
          completion_outcome: checkoutOutcome,
          summary_notes: checkoutSummary.trim() || undefined,
          follow_up_required: checkoutFollowUp,
        }
      );
      setVisit(updated);
      setShowCheckoutModal(false);
    } catch (err: any) {
      setCheckoutError(err?.message || "Failed to complete visit check-out.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Loading visit details...</p>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Link
          href="/caretaker"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Schedule</span>
        </Link>
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 space-y-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Unable to Load Visit
          </h2>
          <p className="text-xs">{error || "Visit record was not found or access is unauthorized."}</p>
        </div>
      </div>
    );
  }

  const isScheduled = visit.status === "SCHEDULED";
  const isInProgress = visit.status === "IN_PROGRESS";
  const isCompleted = visit.status === "COMPLETED";

  const pendingTasks = visit.tasks.filter((t) => t.status === "PENDING");
  const completedTasks = visit.tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between">
        <Link
          href="/caretaker"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Schedule</span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
              isCompleted
                ? "bg-emerald-100 text-emerald-800"
                : isInProgress
                ? "bg-blue-100 text-blue-800 animate-pulse"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {visit.status.replace("_", " ")}
          </span>
          {visit.completion_outcome && (
            <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
              {visit.completion_outcome.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* Senior Profile Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700">
                Senior Profile
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  visit.baseline_risk_tier === "HIGH"
                    ? "bg-red-100 text-red-800"
                    : visit.baseline_risk_tier === "MEDIUM"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {visit.baseline_risk_tier} RISK
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              {visit.senior_name}{" "}
              <span className="text-sm font-semibold text-slate-400">({visit.senior_age} yrs)</span>
            </h1>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {visit.senior_address || "Home Address"}
                {visit.senior_pin_code ? ` - ${visit.senior_pin_code}` : ""}
              </span>
            </p>
          </div>

          {/* Quick Contact Buttons */}
          <div className="flex items-center gap-2">
            {visit.senior_phone && (
              <a
                href={`tel:${visit.senior_phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-slate-600" />
                <span>Call Senior</span>
              </a>
            )}
            {visit.emergency_contact_phone && (
              <a
                href={`tel:${visit.emergency_contact_phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>Emergency: {visit.emergency_contact_name || "Family"}</span>
              </a>
            )}
          </div>
        </div>

        {/* Clinical / Operational Context Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Visit Purpose</span>
            <span className="font-bold text-slate-800">
              {visit.visit_purpose || visit.visit_type.replace("_", " ")}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Language</span>
            <span className="font-bold text-slate-800">{visit.preferred_language || "English"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Living Setup</span>
            <span className="font-bold text-slate-800">{visit.living_arrangement.replace("_", " ")}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Scheduled Window</span>
            <span className="font-bold text-slate-800">
              {new Date(visit.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Check In Action Banner (If Scheduled) */}
      {isScheduled && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black tracking-tight">Ready to Begin Home Visit?</h2>
            <p className="text-xs text-emerald-100 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>GPS Geofence active. Confirm your arrival at the senior&apos;s residence.</span>
            </p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="w-full sm:w-auto px-6 py-3 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <PlayCircle className="w-5 h-5 fill-emerald-800 text-white" />
            <span>{actionLoading ? "Checking In..." : "Check In & Start Visit"}</span>
          </button>
        </div>
      )}

      {/* Active In-Progress Execution Header */}
      {isInProgress && (
        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-100">
                In Progress • Duration: {elapsedMinutes} mins
              </span>
            </div>
            <p className="text-xs text-blue-100">
              Started at {new Date(visit.actual_start!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Perform care tasks and record vitals below.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowConcernModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Raise Concern</span>
            </button>
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-blue-800 hover:bg-blue-50 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <StopCircle className="w-4 h-4 text-blue-800" />
              <span>Check Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Completed Summary Banner */}
      {isCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Visit Completed Successfully</span>
            </div>
            <span className="text-xs text-slate-500">
              Ended: {visit.actual_end ? new Date(visit.actual_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
          {visit.summary_notes && (
            <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-emerald-100">
              <span className="font-bold block text-slate-900 mb-0.5">Caretaker Clinical Summary:</span>
              {visit.summary_notes}
            </p>
          )}
        </div>
      )}

      {/* Care Tasks Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Assigned Care Tasks</h2>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {completedTasks.length} of {visit.tasks.length} Completed
          </span>
        </div>

        {visit.tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No specific care tasks assigned for this visit.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visit.tasks.map((task) => {
              const isTaskDone = task.status === "COMPLETED";
              const isTaskIncomplete = task.status === "NOT_COMPLETED";

              return (
                <div
                  key={task.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isTaskDone ? "bg-slate-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      disabled={!isInProgress || actionLoading || isTaskDone}
                      onClick={() => handleCompleteTask(task)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isTaskDone
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : isTaskIncomplete
                          ? "bg-red-100 border-red-300 text-red-600"
                          : isInProgress
                          ? "border-slate-300 hover:border-brand-500 bg-white"
                          : "border-slate-200 bg-slate-100 cursor-not-allowed"
                      }`}
                    >
                      {isTaskDone ? (
                        <Check className="w-4 h-4" />
                      ) : isTaskIncomplete ? (
                        <XCircle className="w-4 h-4" />
                      ) : null}
                    </button>

                    <div className="space-y-0.5">
                      <p
                        className={`text-xs font-bold ${
                          isTaskDone ? "line-through text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-[11px] text-slate-500">{task.description}</p>
                      )}
                      {task.incomplete_reason && (
                        <p className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded inline-block">
                          Reason: {task.incomplete_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Task Status & Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {task.status === "PENDING" && isInProgress && (
                      <button
                        onClick={() => setShowIncompleteModal(task.id)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors border border-slate-200"
                      >
                        Mark Incomplete
                      </button>
                    )}
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        isTaskDone
                          ? "bg-emerald-100 text-emerald-800"
                          : isTaskIncomplete
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In-Home Observations Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Recorded Observations & Vitals</h2>
          </div>
          {isInProgress && (
            <button
              onClick={() => setShowObservationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-lg transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Observation</span>
            </button>
          )}
        </div>

        {visit.observations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No clinical observations or vitals recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visit.observations.map((obs) => {
              const isAbnormal = obs.flag_status === "ABNORMAL";

              return (
                <div key={obs.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {obs.observation_type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isAbnormal
                            ? "bg-red-100 text-red-700 animate-pulse font-black"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {obs.flag_status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700">
                      {obs.numeric_value !== null && obs.numeric_value !== undefined && (
                        <span className="font-mono font-bold text-slate-900">
                          Value: {obs.numeric_value}{" "}
                        </span>
                      )}
                      {obs.text_value && <span>{obs.text_value} </span>}
                    </div>

                    {obs.notes && (
                      <p className="text-[11px] text-slate-500 italic">Notes: {obs.notes}</p>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(obs.recorded_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logged In-Home Concerns Section */}
      {visit.concerns.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-4 bg-red-50/50 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-red-900">Concerns Raised During Visit</h2>
            </div>
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              {visit.concerns.length} Logged
            </span>
          </div>

          <div className="divide-y divide-red-100">
            {visit.concerns.map((c) => (
              <div key={c.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        c.severity === "URGENT" || c.severity === "HIGH"
                          ? "bg-red-600 text-white"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {c.severity}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Mark Task Incomplete */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Mark Task Incomplete</h3>
            <p className="text-xs text-slate-500">
              Please specify why this assigned task could not be completed during this visit.
            </p>
            <textarea
              rows={3}
              required
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              placeholder="e.g. Senior was asleep, Medication stock exhausted..."
              className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowIncompleteModal(null);
                  setIncompleteReason("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!incompleteReason.trim() || actionLoading}
                onClick={handleMarkTaskIncomplete}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirm Incomplete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Observation */}
      {showObservationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitObservation}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-slate-900">Record Field Observation / Vital</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observation Type</label>
                <select
                  value={obsType}
                  onChange={(e) => setObsType(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="BLOOD_PRESSURE">Blood Pressure</option>
                  <option value="PULSE_RATE">Pulse Rate (BPM)</option>
                  <option value="BLOOD_GLUCOSE">Blood Glucose (mg/dL)</option>
                  <option value="MOOD_BEHAVIOR">Mood & Behavior</option>
                  <option value="MOBILITY_ASSESSMENT">Mobility & Gait</option>
                  <option value="NUTRITION_INTAKE">Nutritional Intake</option>
                  <option value="ENVIRONMENT_SAFETY">Home Environment Safety</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Numeric Value (if applicable)
                </label>
                <input
                  type="number"
                  step="any"
                  value={obsNumeric}
                  onChange={(e) => setObsNumeric(e.target.value)}
                  placeholder="e.g. 120 or 75"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Text Summary</label>
                <input
                  type="text"
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="e.g. 120/80 mmHg or Alert and cheerful"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="obsAbnormal"
                  checked={obsAbnormal}
                  onChange={(e) => setObsAbnormal(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <label htmlFor="obsAbnormal" className="font-semibold text-red-700">
                  Flag as Abnormal / Out of Range
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Field Notes</label>
                <textarea
                  rows={2}
                  value={obsNotes}
                  onChange={(e) => setObsNotes(e.target.value)}
                  placeholder="Additional context or remarks..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowObservationModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
              >
                Save Observation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Raise Concern */}
      {showConcernModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitConcern}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border-t-4 border-amber-500"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Raise In-Home Concern
              </h3>
              <p className="text-xs text-slate-500">
                Log risks noticed during the visit. HIGH and URGENT severities will immediately alert the City Manager.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concern Category</label>
                <select
                  value={concernCategory}
                  onChange={(e) => setConcernCategory(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="FALL_RISK">Fall Hazard / Physical Safety</option>
                  <option value="COGNITIVE_DECLINE">Confusion / Cognitive Change</option>
                  <option value="MEDICATION_NONCOMPLIANCE">Medication Skipped / Mismanaged</option>
                  <option value="SOCIAL_ISOLATION">Depression / Extreme Isolation</option>
                  <option value="HYGIENE_ENVIRONMENT">Living Environment Deterioration</option>
                  <option value="NUTRITIONAL_DEFICIT">Poor Appetite / Weight Loss</option>
                  <option value="MEDICAL_EMERGENCY">Acute Distress / Medical Escalation</option>
                  <option value="OTHER">Other Clinical Concern</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Severity Level</label>
                <select
                  value={concernSeverity}
                  onChange={(e) => setConcernSeverity(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                >
                  <option value="LOW">Low (Monitor during next check)</option>
                  <option value="MEDIUM">Medium (Requires follow-up review)</option>
                  <option value="HIGH">High (Creates immediate operational alert)</option>
                  <option value="URGENT">Urgent (Immediate triage & supervisor notification)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={concernDescription}
                  onChange={(e) => setConcernDescription(e.target.value)}
                  placeholder="Describe the specific hazards, symptoms, or concerns observed..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="concernFollowUp"
                  checked={concernFollowUp}
                  onChange={(e) => setConcernFollowUp(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="concernFollowUp" className="font-semibold text-slate-700">
                  Supervisor clinical follow-up required
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConcernModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !concernDescription.trim()}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Submit Concern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Check-Out Visit */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCheckOut}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <StopCircle className="w-4 h-4 text-blue-600" />
                Complete Visit Check-Out
              </h3>
              <p className="text-xs text-slate-500">
                Finalize your home visit report. All care tasks must be completed or marked with an incomplete reason.
              </p>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Completion Outcome</label>
                <select
                  value={checkoutOutcome}
                  onChange={(e) => setCheckoutOutcome(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                >
                  <option value="COMPLETED_SUCCESSFULLY">Completed Successfully</option>
                  <option value="SENIOR_UNAVAILABLE">Senior Not At Home / Unavailable</option>
                  <option value="REFUSED_CARE">Care Refused by Senior</option>
                  <option value="HOSPITALIZED">Senior Hospitalized</option>
                  <option value="EMERGENCY_TRANSFER">Emergency Hospital Transfer</option>
                  <option value="OTHER">Other Outcome</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Visit Summary & Handoff Notes
                </label>
                <textarea
                  rows={3}
                  value={checkoutSummary}
                  onChange={(e) => setCheckoutSummary(e.target.value)}
                  placeholder="Summarize overall wellbeing, emotional state, and any coordination needs..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="checkoutFollowUp"
                  checked={checkoutFollowUp}
                  onChange={(e) => setCheckoutFollowUp(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="checkoutFollowUp" className="font-semibold text-slate-700">
                  Follow-up home visit recommended
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutModal(false);
                  setCheckoutError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "Finalizing..." : "Complete & Check Out"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

