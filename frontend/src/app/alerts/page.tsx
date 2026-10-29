"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  Search,
  Filter,
  User,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  Clock,
  CheckCheck,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Alert, AlertStatus, RiskLevel } from "@/types/domain";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { SelectFilter } from "@/components/ui/SelectFilter";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatDateTime } from "@/lib/formatting";

function AlertsCenterContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";
  const initialSearch = searchParams.get("search") || "";

  const {
    service,
    coordinatorId,
    acknowledgeAlert,
    resolveAlert,
    lastUpdated,
  } = useApp();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Interaction Modals State
  const [acknowledgingAlert, setAcknowledgingAlert] = useState<Alert | null>(
    null
  );
  const [ackNotes, setAckNotes] = useState<string>("");
  const [isSubmittingAck, setIsSubmittingAck] = useState<boolean>(false);

  const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);
  const [resolveReason, setResolveReason] = useState<string>("");
  const [isSubmittingResolve, setIsSubmittingResolve] =
    useState<boolean>(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await service.listAlerts({
        search: search.trim() || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        severity: severityFilter !== "ALL" ? severityFilter : undefined,
      });

      setAlerts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, [service, search, statusFilter, severityFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, lastUpdated]);

  const handleOpenAcknowledge = (alert: Alert) => {
    setAcknowledgingAlert(alert);
    setAckNotes(`Coordinator ${coordinatorId} reviewed risk signals and initiated follow-up.`);
  };

  const handleConfirmAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgingAlert) return;

    try {
      setIsSubmittingAck(true);
      await acknowledgeAlert(acknowledgingAlert.alert_id, ackNotes);
      setAcknowledgingAlert(null);
      setAckNotes("");
    } catch (err) {
      // Error handled by Toast in AppContext
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleOpenResolve = (alert: Alert) => {
    setResolvingAlert(alert);
    setResolveReason("");
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert || !resolveReason.trim()) return;

    try {
      setIsSubmittingResolve(true);
      await resolveAlert(resolvingAlert.alert_id, resolveReason.trim());
      setResolvingAlert(null);
      setResolveReason("");
    } catch (err) {
      // Error handled by Toast in AppContext
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setSeverityFilter("ALL");
  };

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "ALL" || severityFilter !== "ALL";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Alerts Triage Center
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review, acknowledge, and document clinical resolution for automated early-warning alerts.
        </p>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by Alert ID (e.g. ALT_00012) or Senior ID..."
            />
          </div>

          <div className="md:col-span-4">
            <SelectFilter
              id="status-filter"
              label="Alert Status"
              value={statusFilter}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "OPEN", label: "Active / Open" },
                { value: "ACKNOWLEDGED", label: "Acknowledged" },
                { value: "ESCALATED", label: "Escalated" },
                { value: "RESOLVED", label: "Resolved" },
              ]}
              onChange={setStatusFilter}
            />
          </div>

          <div className="md:col-span-3">
            <SelectFilter
              id="severity-filter"
              label="Severity"
              value={severityFilter}
              options={[
                { value: "ALL", label: "All Severities" },
                { value: "URGENT_REVIEW", label: "Urgent Review" },
                { value: "HIGH", label: "High Risk" },
                { value: "MODERATE", label: "Moderate Risk" },
              ]}
              onChange={setSeverityFilter}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{alerts.length}</strong> alert{alerts.length === 1 ? "" : "s"}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 focus:outline-none focus:underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts Stream State */}
      {loading ? (
        <LoadingState message="Loading early-warning alerts..." />
      ) : error ? (
        <ErrorState
          title="Failed to Load Alerts"
          message={error}
          onRetry={loadAlerts}
        />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No Alerts Found"
          description="There are no alerts matching your current status and severity filters."
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Clear Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const isOpen = alert.status === "OPEN" || alert.status === "ESCALATED";
            const isAck = alert.status === "ACKNOWLEDGED";
            const isResolved = alert.status === "RESOLVED";

            return (
              <div
                key={alert.alert_id}
                className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                  alert.severity === "URGENT_REVIEW"
                    ? "border-red-200 ring-1 ring-red-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Alert Details */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {alert.alert_id}
                      </span>
                      <AlertBadge status={alert.status} />
                      <RiskBadge level={alert.severity} />
                      <span className="text-slate-400 text-xs">•</span>
                      <Link
                        href={`/seniors/${alert.senior_id}`}
                        className="font-bold text-xs text-brand-600 hover:underline flex items-center gap-1"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{alert.senior_display_name || alert.senior_id}</span>
                      </Link>
                    </div>

                    {/* Triggering Signals */}
                    <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/70 text-xs">
                      <span className="font-semibold text-slate-800 block mb-1">
                        Triggering Detection Signals:
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {alert.triggering_signals}
                      </p>
                    </div>

                    {/* Recommended Next Step */}
                    <div className="text-xs text-slate-600 flex items-start gap-1.5">
                      <strong className="text-slate-700 shrink-0">
                        Protocol Guidance:
                      </strong>
                      <span>{alert.recommended_next_step}</span>
                    </div>

                    {/* Metadata / Timestamps */}
                    <div className="text-[11px] text-slate-400 flex items-center gap-4 flex-wrap pt-1">
                      <span>Created: {alert.created_at}</span>
                      <span>Last Updated: {alert.last_updated_at}</span>
                      {alert.acknowledgement_notes && (
                        <span className="text-blue-700 font-medium">
                          Notes: {alert.acknowledgement_notes}
                        </span>
                      )}
                    </div>

                    {/* Resolution reason if resolved */}
                    {isResolved && alert.resolution_reason && (
                      <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-lg flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Documented Resolution: </strong>
                          {alert.resolution_reason}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                    {/* Acknowledge Button */}
                    {isOpen && (
                      <button
                        type="button"
                        onClick={() => handleOpenAcknowledge(alert)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    {/* Resolve Button */}
                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => handleOpenResolve(alert)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Resolve Alert</span>
                      </button>
                    )}

                    {/* Senior Profile Link */}
                    <Link
                      href={`/seniors/${alert.senior_id}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
                    >
                      <span>View Senior</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Acknowledge Alert */}
      <Modal
        isOpen={Boolean(acknowledgingAlert)}
        onClose={() => setAcknowledgingAlert(null)}
        title={`Acknowledge Alert ${acknowledgingAlert?.alert_id}`}
        description="Acknowledge receipt and log preliminary triage intent. This updates alert status to ACKNOWLEDGED without resolving it."
      >
        <form onSubmit={handleConfirmAcknowledge} className="space-y-4">
          <div>
            <label
              htmlFor="ack-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Coordinator Follow-up Notes (Optional)
            </label>
            <textarea
              id="ack-notes"
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              placeholder="e.g. Initiated call with senior; checking pain and vitals..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAcknowledgingAlert(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAck}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <span>{isSubmittingAck ? "Saving..." : "Confirm Acknowledgment"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Resolve Alert */}
      <Modal
        isOpen={Boolean(resolvingAlert)}
        onClose={() => setResolvingAlert(null)}
        title={`Resolve Alert ${resolvingAlert?.alert_id}`}
        description="Document clinical or coordinator disposition before removing this alert from the active queue."
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <div>
            <label
              htmlFor="resolve-reason"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Documented Resolution Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="resolve-reason"
              required
              rows={3}
              value={resolveReason}
              onChange={(e) => setResolveReason(e.target.value)}
              placeholder="e.g. Senior assessed by visiting nurse; vitals stabilized, no fracture or acute emergency found."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
            />
          </div>

          <div className="text-[11px] text-slate-500 italic">
            This reason will be permanently attached to the alert audit trail.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResolvingAlert(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingResolve || !resolveReason.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <span>{isSubmittingResolve ? "Saving..." : "Confirm Resolution"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading alerts..." />}>
      <AlertsCenterContent />
    </Suspense>
  );
}

