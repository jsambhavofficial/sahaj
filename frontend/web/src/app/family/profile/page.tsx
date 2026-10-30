"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  RefreshCw,
  LogOut,
  MapPin,
  Calendar,
  Lock,
  XCircle,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { FamilyUserProfileResponse, FamilySeniorSummary } from "@/types/api";

export default function FamilyProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<FamilyUserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Unlink / Revocation Modal State
  const [revokingSenior, setRevokingSenior] = useState<FamilySeniorSummary | null>(null);
  const [revokeReason, setRevokeReason] = useState("Requested by family member");
  const [revoking, setRevoking] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<FamilyUserProfileResponse>("/api/v1/family/profile");
      setProfile(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load family profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRevokeSelf = async () => {
    if (!revokingSenior) return;

    setRevoking(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await defaultApiClient.post(
        `/api/v1/family/seniors/${revokingSenior.senior_id}/unlink`,
        { reason: revokeReason }
      );
      setSuccessMsg(`Successfully revoked authorization link for ${revokingSenior.name}.`);
      setRevokingSenior(null);
      await fetchProfile();
    } catch (err: any) {
      setError(err?.message || "Failed to revoke family authorization link.");
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/family"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Family Home
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Family Account & Access Management</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your verified identity, authorized linked senior profiles, and privacy consent status under Indian DPDP Act 2023.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Details Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">Your Account</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Full Name</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{profile?.full_name || user?.full_name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Email Address</span>
              <p className="text-xs font-mono text-slate-700 mt-0.5">{profile?.email || user?.email}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Platform Role</span>
              <p className="text-xs font-semibold text-rose-700 mt-0.5">
                {profile?.role || user?.role} (Verified Family Member)
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Linked Senior Profiles & Authorization Status */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-bold text-slate-900">Authorized Linked Seniors</h2>
            </div>
            <button
              onClick={fetchProfile}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-600" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-600 mb-2" />
              <p className="text-xs font-medium">Loading authorization records...</p>
            </div>
          ) : profile?.linked_seniors.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium text-slate-600">No linked seniors</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Authorized senior links are established by your regional care coordinator.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile?.linked_seniors.map((s) => {
                const isActive = s.authorization_status === "ACTIVE";

                return (
                  <div
                    key={s.senior_id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {s.authorization_status}
                        </span>
                        {s.has_active_consent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> DPDP Consent
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span>ID: <strong className="font-mono text-slate-700">{s.senior_id}</strong></span>
                        <span>Relationship: <strong className="text-slate-700">{s.relationship_type}</strong></span>
                        <span>Chapter: <strong className="text-slate-700">{s.city_name}</strong></span>
                        <span>Scope: <strong className="text-slate-700">{s.permission_tier}</strong></span>
                        <span>Granted: <strong className="text-slate-700">{formatDate(s.granted_at)}</strong></span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => setRevokingSenior(s)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold transition"
                        >
                          Revoke My Access
                        </button>
                      ) : (
                        <span className="text-xs text-red-500 italic">Access Revoked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Privacy and DPDP Act Notice */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Lock className="w-4 h-4 text-slate-500" />
          <span>Privacy & DPDP Act 2023 Principles</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          In strict compliance with the Indian Digital Personal Data Protection (DPDP) Act 2023, access to elder-care data is provisioned strictly on the basis of verified consent and explicit familial relationship links. Family access provides factual care updates, scheduled visits, and wellbeing logs. Raw medical telemetry and staff-only scratchpads are intentionally withheld to preserve dignity and privacy. If you choose to revoke your access, all data access for that senior is immediately terminated in the backend.
        </p>
      </div>

      {/* Revocation Confirmation Modal */}
      {revokingSenior && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Revoke Family Access Link</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to revoke your authorization link to{" "}
              <strong className="text-slate-900">{revokingSenior.name}</strong>?
              Once revoked, you will immediately lose access to their care summary, visit schedules, and callback history.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Revocation
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokingSenior(null)}
                disabled={revoking}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeSelf}
                disabled={revoking}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {revoking ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

