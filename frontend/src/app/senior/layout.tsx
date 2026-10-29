"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Heart, ShieldCheck, AlertCircle, Loader2, Phone, Home, ClipboardList, Calendar, HelpCircle, Users, UserCog, Mic, Sparkles } from "lucide-react";
import SeniorVoiceCompanionModal from "@/components/voice/SeniorVoiceCompanionModal";

export default function SeniorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading, isSenior, isAdmin } = useAuth();
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-slate-600">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-4" />
        <p className="text-lg font-medium">Aapka portal khul raha hai... Please wait</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Enforce role guard: only SENIOR or ORGANIZATION_ADMIN
  if (!isSenior && !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-amber-950">Senior Citizen Portal Access</h2>
          <p className="text-base text-amber-800 mt-2 max-w-lg mx-auto leading-relaxed">
            Aap <span className="font-semibold">{user?.role}</span> ke roop mein signed-in hain. Yeh portal hamare registered senior citizens ke liye hai.
          </p>
        </div>
      </div>
    );
  }

  const quickNav = [
    { label: "Aaj Ki Care", href: "/senior", icon: Heart },
    { label: "Tabiyat Batayein", href: "/senior/check-in", icon: ClipboardList },
    { label: "Meri Visits", href: "/senior/visits", icon: Calendar },
    { label: "Help Chahiye", href: "/senior/help", icon: HelpCircle },
    { label: "Care Team", href: "/senior/care-team", icon: Users },
    { label: "Meri Profile", href: "/senior/profile", icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Emergency Assistance Strip */}
      <div className="bg-rose-700 text-white px-4 py-2 text-center text-sm sm:text-base font-bold shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            🚨 Aapatkaaleen (Emergency) Sahayata:
          </span>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 bg-white text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-full text-sm font-extrabold shadow"
          >
            <Phone className="w-4 h-4 fill-rose-700" />
            112 Par Call Karein
          </a>
        </div>
      </div>

      {/* Accessible Portal Header */}
      <div className="bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
              <Heart className="w-7 h-7 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Sahaj Saathi Portal
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                  <ShieldCheck className="w-3.5 h-3.5" /> Surakshit
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600">
                Namaste, <span className="font-bold text-slate-900">{user?.full_name}</span> ji! Aapki dekhbhal hamari prathmikta hai.
              </p>
            </div>
          </div>

          {/* Quick Helpline & Voice Companion Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-sm sm:text-base shadow-md transition-all active:scale-95 min-h-[48px]"
            >
              <Mic className="w-5 h-5 text-slate-950" />
              <span>AI Saathi (Voice)</span>
            </button>

            <a
              href="tel:1800-120-8800"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm sm:text-base shadow transition-colors min-h-[48px]"
            >
              <Phone className="w-4 h-4 fill-white" />
              <span className="hidden sm:inline">Sahaj Helpline:</span> 1800-120-8800
            </a>
          </div>
        </div>

        {/* Accessible Navigation Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {quickNav.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-base whitespace-nowrap transition-all min-h-[48px] ${
                  isActive
                    ? "bg-teal-600 text-white shadow-md"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-600"}`} />
                <span>{tab.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {children}
      </main>

      {/* Global Senior Voice Companion Modal */}
      <SeniorVoiceCompanionModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        seniorName={user?.full_name || "Aadarneey Senior"}
        seniorId={user?.id || "SENIOR_PORTAL"}
        userEmail={user?.email || ""}
      />
    </div>
  );
}

