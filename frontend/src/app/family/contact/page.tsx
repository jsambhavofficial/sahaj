"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  Send,
  MessageSquare,
  ShieldAlert,
  Info,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  FamilyUserProfileResponse,
  CallbackResponse,
  CallbackCreateRequest,
} from "@/types/api";

export default function FamilyContactPage() {
  const [profile, setProfile] = useState<FamilyUserProfileResponse | null>(null);
  const [requests, setRequests] = useState<CallbackResponse[]>([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string>("");
  const [category, setCategory] = useState<string>("GENERAL_INQUIRY");
  const [contactMethod, setContactMethod] = useState<string>("PHONE");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, cbRes] = await Promise.all([
        defaultApiClient.get<FamilyUserProfileResponse>("/api/v1/family/profile"),
        defaultApiClient.get<CallbackResponse[]>("/api/v1/family/callback-requests"),
      ]);
      setProfile(profRes);
      setRequests(cbRes);

      const active = profRes.linked_seniors.filter((s) => s.authorization_status === "ACTIVE");
      if (active.length > 0 && !selectedSeniorId) {
        setSelectedSeniorId(active[0].senior_id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load callback inquiries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeniorId) {
      setError("Please select an authorized senior.");
      return;
    }
    if (message.trim().length < 5) {
      setError("Please enter a message of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: CallbackCreateRequest = {
        senior_id: selectedSeniorId,
        category,
        preferred_contact_method: contactMethod,
        message: message.trim(),
      };

      const newCb = await defaultApiClient.post<CallbackResponse>(
        "/api/v1/family/callback-requests",
        payload
      );

      setRequests((prev) => [newCb, ...prev]);
      setSuccessMsg("Callback request submitted successfully. A care coordinator will contact you.");
      setMessage("");
    } catch (err: any) {
      setError(err?.message || "Failed to submit callback request.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeSeniors = profile?.linked_seniors.filter((s) => s.authorization_status === "ACTIVE") || [];

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

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "--:--";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
        <h1 className="text-2xl font-extrabold text-slate-900">Contact Care Team & Callback Requests</h1>
        <p className="text-xs text-slate-500 mt-1">
          Submit care questions, visit reschedule requests, or request a phone callback from your city coordinator.
        </p>
      </div>

      {/* Emergency Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Not for acute medical emergencies:</strong> If your loved one is experiencing a critical medical emergency (such as severe chest pain, loss of consciousness, or acute trauma), please call an ambulance (112 / 108) immediately.
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Submit Callback Request */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
            <MessageSquare className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">Request a Callback or Send Inquiry</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Senior Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Regarding Senior <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSeniorId}
                  onChange={(e) => setSelectedSeniorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                >
                  {activeSeniors.map((s) => (
                    <option key={s.senior_id} value={s.senior_id}>
                      {s.name} ({s.relationship_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inquiry Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                >
                  <option value="GENERAL_INQUIRY">General Care Inquiry</option>
                  <option value="VISIT_RESCHEDULE">Visit Reschedule Request</option>
                  <option value="CARE_CONCERN">Care Observation / Concern</option>
                  <option value="MEDICATION_QUERY">Medication or Schedule Query</option>
                  <option value="URGENT_ASSISTANCE">Priority Non-Emergency Assistance</option>
                </select>
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Callback Method
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contactMethod"
                    value="PHONE"
                    checked={contactMethod === "PHONE"}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>Phone Call</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contactMethod"
                    value="EMAIL"
                    checked={contactMethod === "EMAIL"}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contactMethod"
                    value="IN_APP"
                    checked={contactMethod === "IN_APP"}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>In-App Response</span>
                </label>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message / Notes for Coordinator <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your inquiry, requested visit time, or care concern..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <span className="text-[11px] text-slate-400">Minimum 5 characters.</span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Callback Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Card: Direct Office Contact */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Phone className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Direct Office Contacts</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Central Helpline</span>
              <p className="text-sm font-bold text-rose-600">
                <a href="tel:+918045678900">+91 80 4567 8900</a>
              </p>
              <p className="text-[11px] text-slate-500">Available Monday–Saturday, 8:00 AM – 8:00 PM IST</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Email Support</span>
              <p className="text-xs font-semibold text-slate-800">family.support@samarth.ai</p>
              <p className="text-[11px] text-slate-500">Inquiries answered within 4 operational hours</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Response Commitment</span>
              <p className="text-[11px] text-slate-600">
                All submitted callback requests are routed directly to your senior&apos;s assigned city manager and field coordinator.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History of Submitted Callback Requests */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Your Submitted Requests</h3>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh requests"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-600" : ""}`} />
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium text-slate-600">No requests submitted yet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Use the form above to submit a question or callback request to the care coordination team.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const isResolved = r.status === "RESOLVED";
              const isInProgress = r.status === "IN_PROGRESS";
              const isAck = r.status === "ACKNOWLEDGED";

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{r.category}</span>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          isResolved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isInProgress
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : isAck
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Submitted: {formatDate(r.created_at)} at {formatTime(r.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700">&ldquo;{r.message}&rdquo;</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex-wrap">
                    <span>Senior: <strong className="text-slate-700">{r.senior_name}</strong></span>
                    <span>Method: <strong className="text-slate-700">{r.preferred_contact_method}</strong></span>
                    {r.assigned_to_user_name && (
                      <span>Assignee: <strong className="text-slate-700">{r.assigned_to_user_name}</strong></span>
                    )}
                  </div>

                  {r.resolution_notes && (
                    <div className="mt-2 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                      <strong className="block text-[11px] uppercase font-bold text-emerald-800">
                        Care Team Resolution Note ({formatDate(r.resolved_at)}):
                      </strong>
                      <p className="mt-0.5">{r.resolution_notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
