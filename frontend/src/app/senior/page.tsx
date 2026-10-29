"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { defaultApiClient } from "@/services/apiClient";
import { SeniorDashboardResponse } from "@/types/api";
import {
  Heart,
  Calendar,
  ClipboardList,
  PhoneCall,
  UserCheck,
  Clock,
  MapPin,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Smile,
  Info,
} from "lucide-react";

export default function SeniorDashboardPage() {
  const [data, setData] = useState<SeniorDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<SeniorDashboardResponse>("/api/v1/senior/dashboard");
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Data load karne mein dikkat aayi. Kripya punah prayas karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600 mb-4" />
        <p className="text-xl font-bold text-slate-700">Aapka aaj ka care card tayyar ho raha hai...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-8 text-center max-w-xl mx-auto my-8">
        <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-amber-950">Sampark Nahi Ho Paaya</h2>
        <p className="text-base text-amber-800 mt-2 mb-6">{error || "Kripya refresh karein."}</p>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center justify-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-base font-bold rounded-xl shadow-md min-h-[48px]"
        >
          Dobara Koshish Karein (Retry)
        </button>
      </div>
    );
  }

  const formatVisitTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Aaj Ka Status Hero Card */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-teal-800/80 text-teal-100 text-xs sm:text-sm font-bold px-3 py-1 rounded-full border border-teal-500">
              <Smile className="w-4 h-4 text-amber-300" />
              Aaj Ki Care & Taza Jaankari
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {data.senior_name} Ji
            </h2>
            <p className="text-teal-100 text-base sm:text-lg max-w-2xl font-medium">
              {data.today_status_message}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link
              href="/senior/check-in"
              className="inline-flex items-center justify-center gap-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl text-lg shadow-lg transition-transform active:scale-95 min-h-[52px]"
            >
              <ClipboardList className="w-6 h-6" />
              <span>Tabiyat Batayein</span>
            </Link>
            <Link
              href="/senior/help"
              className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-teal-50 text-teal-900 font-extrabold px-6 py-3.5 rounded-xl text-lg shadow-lg transition-transform active:scale-95 min-h-[52px]"
            >
              <PhoneCall className="w-6 h-6 text-teal-700" />
              <span>Help Chahiye</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Next Visit & Today's Care Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Scheduled Visit Card */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                <Calendar className="w-4 h-4 text-teal-600" />
                Agli Home Visit
              </span>
              {data.next_scheduled_visit && (
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  Scheduled
                </span>
              )}
            </div>

            {data.next_scheduled_visit ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">
                  {data.next_scheduled_visit.visit_purpose || "Niyamit Swasthya Visit"}
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2.5 text-base font-semibold text-slate-800">
                    <Clock className="w-5 h-5 text-teal-600" />
                    <span>{formatVisitTime(data.next_scheduled_visit.scheduled_start)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-base text-slate-700 font-medium">
                    <UserCheck className="w-5 h-5 text-teal-600" />
                    <span>
                      Caretaker: <strong className="text-slate-900">{data.next_scheduled_visit.caretaker_name || "Samarth Team Member"}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-base font-medium">Filhal koi nayi visit schedule nahi hai.</p>
                <p className="text-xs text-slate-400 mt-1">Caretaker visit jald hi update ki jayegi.</p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
              href="/senior/visits"
              className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-900 text-base font-bold"
            >
              <span>Saari visits dekhein</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Latest Check-in / Wellbeing Status */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                Pichhla Wellbeing Check-In
              </span>
              {data.latest_checkin && (
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                  Darz Hai
                </span>
              )}
            </div>

            {data.latest_checkin ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">Taarikh:</span>
                    <span className="text-base font-bold text-slate-900">{data.latest_checkin.checkin_date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">Aapne bataya:</span>
                    <span className="text-base font-extrabold text-teal-800">
                      {data.latest_checkin.general_wellbeing_label}
                    </span>
                  </div>
                  {data.latest_checkin.concern_categories.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500">Mukhya batein:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {data.latest_checkin.concern_categories.map((c, i) => (
                          <span key={i} className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <Smile className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-base font-medium">Aaj ka check-in abhi bacha hai.</p>
                <p className="text-xs text-slate-400 mt-1">Kuch hi pal mein apni tabiyat batayein.</p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
              href="/senior/check-in"
              className="inline-flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 text-base font-bold"
            >
              <span>Naya check-in darz karein</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Care Team Helpline Banner */}
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-bold text-emerald-950 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-700" />
              Aapki Samarth Care Team — {data.care_team.city_name} Chapter
            </h3>
            <p className="text-sm sm:text-base text-emerald-800 font-medium">
              Coordinator: <strong className="text-slate-900">{data.care_team.coordinator_name || "Samarth Coordinator"}</strong> | Timing: {data.care_team.hours}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`tel:${data.care_team.office_phone}`}
              className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-3 rounded-xl text-base shadow min-h-[48px]"
            >
              <PhoneCall className="w-5 h-5" />
              <span>Call: {data.care_team.office_phone}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Safety & DPDP Privacy Disclaimer */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-xs sm:text-sm text-slate-600 font-medium">
          🔒 <strong>DPDP Act 2023 Compliant:</strong> {data.disclaimer}
        </p>
      </div>
    </div>
  );
}

