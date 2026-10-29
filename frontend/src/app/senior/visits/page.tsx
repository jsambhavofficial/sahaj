"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { defaultApiClient } from "@/services/apiClient";
import { SeniorVisitItem } from "@/types/api";
import {
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  FileText,
} from "lucide-react";

export default function SeniorVisitsPage() {
  const [visits, setVisits] = useState<SeniorVisitItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<SeniorVisitItem[]>("/api/v1/senior/visits");
      setVisits(res);
    } catch (err: any) {
      setError(err?.message || "Visits ki list load karne mein dikkat aayi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const formatVisitDate = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const upcomingVisits = visits.filter(
    (v) => v.status === "SCHEDULED" || v.status === "IN_PROGRESS"
  );
  const pastVisits = visits.filter(
    (v) => v.status === "COMPLETED" || v.status === "CANCELLED"
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            Meri Visits (Caregiver Visits)
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            Yahan aap aane wali aur pichhli sabhi home visits dekh sakte hain.
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

      {loading && (
        <div className="min-h-[40vh] flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-3" />
          <p className="text-lg font-bold text-slate-700">Visits ki jaankari laayi ja rahi hai...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <p className="text-base font-semibold">{error}</p>
          </div>
          <button
            onClick={fetchVisits}
            className="px-4 py-2 bg-teal-600 text-white font-bold rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {/* Section: Aane Wali Visits (Upcoming) */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              <span>Aane Wali Visits ({upcomingVisits.length})</span>
            </h3>

            {upcomingVisits.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-base font-medium">Filhal koi nayi visit schedule nahi hai.</p>
                <p className="text-xs text-slate-400 mt-1">Zaroorat padne par &apos;Help Chahiye&apos; se sampark karein.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {upcomingVisits.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white border-2 border-teal-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-teal-800 bg-teal-100 px-3 py-1 rounded-full uppercase tracking-wider">
                          {v.status === "IN_PROGRESS" ? "Abhi Chal Rahi Hai" : "Agli Visit"}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">{v.visit_type}</span>
                      </div>
                      <h4 className="text-lg sm:text-xl font-bold text-slate-900">
                        {v.visit_purpose || "Niyamit Swasthya Aur Sahayata Visit"}
                      </h4>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Clock className="w-4 h-4 text-teal-600" />
                          {formatVisitDate(v.scheduled_start)}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <UserCheck className="w-4 h-4 text-teal-600" />
                          Caretaker: <strong className="text-slate-900">{v.caretaker_name || "Sahaj Team"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Pichhli Visits (Past) */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Pichhli Visits ({pastVisits.length})</span>
            </h3>

            {pastVisits.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500">
                <p className="text-base font-medium">Abhi tak koi purani visit darz nahi hai.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pastVisits.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          Purn (Completed)
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {formatVisitDate(v.actual_start || v.scheduled_start)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        Caretaker: <strong className="text-slate-800">{v.caretaker_name || "Sahaj Staff"}</strong>
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-800">
                      {v.visit_purpose || "General Home Visit"}
                    </h4>

                    {v.senior_summary && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-700">
                        <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-teal-600" />
                          Visit Summary:
                        </span>
                        <p>{v.senior_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

