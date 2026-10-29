"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { defaultApiClient } from "@/services/apiClient";
import { SeniorCareTeamSummary } from "@/types/api";
import {
  Users,
  PhoneCall,
  Mail,
  Clock,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowLeft,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";

export default function SeniorCareTeamPage() {
  const [careTeam, setCareTeam] = useState<SeniorCareTeamSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCareTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<SeniorCareTeamSummary>("/api/v1/senior/care-team");
      setCareTeam(res);
    } catch (err: any) {
      setError(err?.message || "Care team ki jaankari load karne mein dikkat aayi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCareTeam();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Meri Care Team (Your Sahaj Support)
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            Aapke shehar ki samarpit dekhbhal team ke contact details.
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
          <p className="text-lg font-bold text-slate-700">Care team ki jaankari laayi ja rahi hai...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <p className="text-base font-semibold">{error}</p>
          </div>
          <button
            onClick={fetchCareTeam}
            className="px-4 py-2 bg-teal-600 text-white font-bold rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {careTeam && (
        <div className="space-y-6">
          {/* Main Coordinator Card */}
          <div className="bg-gradient-to-br from-teal-800 to-teal-950 text-white rounded-2xl p-6 sm:p-8 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-600/60 border border-teal-400 flex items-center justify-center text-white">
                  <HeartHandshake className="w-9 h-9" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                    Aapka Assigned Coordinator
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    {careTeam.coordinator_name || "Sahaj Care Coordinator"}
                  </h3>
                  <p className="text-teal-200 text-sm font-medium mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {careTeam.city_name} Chapter
                  </p>
                </div>
              </div>

              <a
                href={`tel:${careTeam.office_phone}`}
                className="inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl text-lg shadow min-h-[52px] transition-transform active:scale-95"
              >
                <PhoneCall className="w-5 h-5 fill-slate-950" />
                <span>Call Coordinator</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-teal-700/60 text-sm">
              <div className="flex items-center gap-3">
                <PhoneCall className="w-5 h-5 text-teal-300" />
                <div>
                  <span className="text-teal-300 text-xs font-semibold block">Office Helpline:</span>
                  <strong className="text-base font-bold">{careTeam.office_phone}</strong>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-teal-300" />
                <div>
                  <span className="text-teal-300 text-xs font-semibold block">Operating Hours:</span>
                  <strong className="text-base font-bold">{careTeam.hours}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Quick FAQ / Information for Seniors */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              Sahaj Se Judi Zaroori Batein
            </h3>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  Caretaker Home Visit Kab Aati Hai?
                </h4>
                <p className="text-sm text-slate-700 mt-1 pl-7">
                  Aapke niyamit schedule ke hisab se hamare verified caretaker aapke ghar aate hain. Aane se pehle coordinator aapse ya parivar se sampark karte hain.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  Medical Emergency Mein Kya Karein?
                </h4>
                <p className="text-sm text-slate-700 mt-1 pl-7">
                  Kripya tatkaal rashtriya helpline <strong>112</strong> par call karein aur apne parivar ya padosi ko soochit karein. Sahaj portal medical diagnosis ya emergency service ka vikalp nahi hai.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

