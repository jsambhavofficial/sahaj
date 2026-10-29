"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { defaultApiClient } from "@/services/apiClient";
import { SeniorHelpCreateRequest } from "@/types/api";
import {
  HelpCircle,
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Send,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

interface HelpRequestItem {
  id: string;
  category: string;
  message: string;
  status: string;
  preferred_contact_method: string;
  resolution_notes?: string | null;
  created_at: string;
}

export default function SeniorHelpPage() {
  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState<string>("PLEASE_CALL_ME");
  const [message, setMessage] = useState<string>("Namaste, kripya mujhe call karein.");

  const categories = [
    { id: "PLEASE_CALL_ME", label: "Mujhe Phone Karein (Callback Request)" },
    { id: "CARE_CONCERN", label: "Swasthya Ya Dawaai Sambandhit (Care Concern)" },
    { id: "VISIT_QUERY", label: "Visit Ke Baare Mein Jankari (Visit Query)" },
    { id: "DAILY_ASSISTANCE", label: "Rozana Sahayata (Daily Assistance)" },
  ];

  const fetchHelpRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<HelpRequestItem[]>("/api/v1/senior/help-requests");
      setRequests(res);
    } catch (err: any) {
      setError(err?.message || "Purani requests load karne mein dikkat aayi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHelpRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: SeniorHelpCreateRequest = {
        category,
        message: message.trim(),
        preferred_contact_method: "PHONE",
        idempotency_key: `help_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      await defaultApiClient.post("/api/v1/senior/help-requests", payload);
      setSuccessMsg("Aapki request Sahaj team tak pahunch gayi hai. Care coordinator jald call karenge.");
      setMessage("Namaste, kripya mujhe call karein.");
      fetchHelpRequests();
    } catch (err: any) {
      setError(err?.message || "Request bhejne mein asuvidha aayi. Kripya punah prayas karein.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-teal-600" />
            Help Chahiye (Direct Support & Callback)
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            Kisi bhi sahayata ke liye yahan se phone callback request karein.
          </p>
        </div>
        <Link
          href="/senior"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-base px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home Lauten</span>
        </Link>
      </div>

      {/* Emergency Contact Quick Strip */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <PhoneCall className="w-6 h-6 text-amber-700 flex-shrink-0" />
          <div>
            <h4 className="text-base font-extrabold text-amber-950">Seedhe Helpline Par Baat Karna Chahte Hain?</h4>
            <p className="text-xs sm:text-sm text-amber-800 font-medium">Hamare care executive se baat karne ke liye abhi dial karein:</p>
          </div>
        </div>
        <a
          href="tel:1800-120-8800"
          className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-base shadow min-h-[48px]"
        >
          <PhoneCall className="w-5 h-5 fill-white" />
          <span>1800-120-8800</span>
        </a>
      </div>

      {/* New Request Card */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" />
          <span>Nayi Request Bhejein</span>
        </h3>

        {successMsg && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-base font-bold">{successMsg}</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-950 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-base font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-bold text-slate-800 mb-2">
              Kripya Vishay (Category) Chunein:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-4 rounded-xl border-2 text-left font-bold text-base transition-all min-h-[52px] ${
                    category === cat.id
                      ? "border-teal-600 bg-teal-50 text-teal-950 shadow-sm ring-1 ring-teal-600"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-base font-bold text-slate-800 mb-1">
              Aapka Sandesh (Message):
            </label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-base p-3.5 border-2 border-slate-300 rounded-xl focus:border-teal-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-8 py-3.5 rounded-xl text-lg shadow-md min-h-[52px] transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Bheja Ja Raha Hai...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Request Bhejein (Submit)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Previous Requests History */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          <span>Aapki Pichhli Requests ({requests.length})</span>
        </h3>

        {loading ? (
          <div className="text-center py-8 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-2" />
            <p className="text-sm font-semibold">Requests laayi ja rahi hain...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-base font-medium">Abhi tak koi callback request darz nahi hui hai.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-md self-start">
                    {req.category.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      req.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}>
                      {req.status === "RESOLVED" ? "Resolved (Samadhan Hua)" : "Pending (Pratikshit)"}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(req.created_at)}</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-800">&quot;{req.message}&quot;</p>
                {req.resolution_notes && (
                  <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1">
                    <strong>Care Team Note:</strong> {req.resolution_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

