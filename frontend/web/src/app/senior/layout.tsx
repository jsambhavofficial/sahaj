"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getDataService } from "@/services";
import { registerWebPushToken } from "@/services/fcm";
import {
  Heart,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Phone,
  Home,
  ClipboardList,
  Calendar,
  HelpCircle,
  Users,
  UserCog,
  Mic,
  Sparkles,
  Bell,
  Settings,
} from "lucide-react";
import SeniorVoiceCompanionModal from "@/components/voice/SeniorVoiceCompanionModal";

export default function SeniorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading, isSenior, isAdmin } = useAuth();
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [adminPreview, setAdminPreview] = useState<boolean>(false);

  const handleSwitchToSenior = () => {
    const seniorUser = {
      id: "S0042",
      email: "shanti@sahaj.local",
      role: "SENIOR",
      full_name: "Shanti Devi",
      display_name: "Shanti Ji",
      is_active: true,
      is_verified: true,
    };
    localStorage.setItem("samarth_auth_user", JSON.stringify(seniorUser));
    window.location.reload();
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Load unread notification count and register web push token
  useEffect(() => {
    if (isAuthenticated) {
      registerWebPushToken().catch(() => {});

      const fetchUnread = async () => {
        try {
          const ds = getDataService();
          const count = await ds.getUnreadNotificationCount();
          setUnreadCount(count);
        } catch {
          // ignore background error
        }
      };

      fetchUnread();
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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

  // Enforce role guard: only SENIOR or ORGANIZATION_ADMIN (or dev preview mode)
  if (!isSenior && !isAdmin && !adminPreview) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center shadow-md space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-amber-950">Senior Citizen Portal Access</h2>
            <p className="text-base text-amber-800 mt-2 font-medium leading-relaxed">
              आप वर्तमान में <span className="font-bold underline uppercase">{user?.role}</span> के रूप में साइन-इन हैं। यह पोर्टल वरिष्ठ नागरिकों (Seniors) के लिए डिज़ाइन किया गया है।
            </p>
          </div>

          {/* Quick 1-Click Action Buttons for Developer/Tester */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleSwitchToSenior}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-5 py-3 rounded-xl text-sm shadow transition-all active:scale-95 cursor-pointer"
            >
              <span>Senior (Shanti Ji) के रूप में स्विच करें</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminPreview(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-5 py-3 rounded-xl text-sm shadow transition-all active:scale-95 cursor-pointer"
            >
              <span>{user?.role} Preview Mode चालू करें</span>
            </button>

            <Link
              href="/caretaker/notifications"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 font-extrabold px-4 py-3 rounded-xl text-sm shadow-sm transition-all"
            >
              <span>Care Coordinator Notifications पर जाएँ</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const quickNav = [
    { label: "Aaj Ki Care", href: "/senior", icon: Heart },
    { label: "Tabiyat Batayein", href: "/senior/check-in", icon: ClipboardList },
    { label: "Meri Visits", href: "/senior/visits", icon: Calendar },
    { label: "Suchnayein", href: "/senior/notifications", icon: Bell, badge: unreadCount },
    { label: "Help Chahiye", href: "/senior/help", icon: HelpCircle },
    { label: "Care Team", href: "/senior/care-team", icon: Users },
    { label: "Meri Profile", href: "/senior/profile", icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Emergency Assistance Strip */}
      <div className="bg-rose-700 text-white px-4 py-2 text-center text-sm sm:text-base font-bold shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
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

          {/* Quick Actions: Notification Bell, Voice Companion & Helpline */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Accessible Notification Bell Icon */}
            <Link
              href="/senior/notifications"
              className={`relative inline-flex items-center justify-center p-3 rounded-xl border-2 transition-all min-h-[48px] min-w-[48px] ${
                pathname.startsWith("/senior/notifications")
                  ? "bg-teal-50 border-teal-500 text-teal-700 shadow"
                  : "bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700"
              }`}
              title="Suchnayein (Notifications)"
              aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-xs font-black text-white bg-rose-600 border-2 border-white rounded-full shadow-md animate-pulse">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

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
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-base whitespace-nowrap transition-all min-h-[48px] ${
                  isActive
                    ? "bg-teal-600 text-white shadow-md"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-600"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 text-xs font-black px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white text-teal-800" : "bg-rose-600 text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
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
