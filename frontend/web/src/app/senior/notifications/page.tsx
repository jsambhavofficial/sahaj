"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDataService } from "@/services";
import { registerWebPushToken } from "@/services/fcm";
import { ContractNotificationItem } from "@/types/api";
import {
  Bell,
  CheckCircle2,
  Clock,
  Settings,
  Sparkles,
  Heart,
  Calendar,
  Pill,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Send,
  ArrowRight,
  Info,
} from "lucide-react";

export default function SeniorNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<ContractNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const ds = getDataService();
      // fetch all notifications
      const res = await ds.getNotifications(false);
      setNotifications(res.items || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      const ds = getDataService();
      await ds.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error("Mark read failed:", err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const ds = getDataService();
      await ds.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    } catch (err) {
      console.error("Mark all read failed:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestSending(true);
    setTestStatus(null);
    try {
      // Ensure web push registration
      await registerWebPushToken();

      // Trigger test notification through API
      const res = await fetch("/api/v1/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "daily_wellbeing",
          title: "नमस्ते जी!",
          body: "आज अपना हाल-चाल बताना न भूलें।",
          data: { senior_id: "SELF", source: "senior_test_button" },
        }),
      });

      if (res.ok) {
        setTestStatus("सूचना सफलतापूर्वक भेज दी गई है!");
        setTimeout(() => fetchNotifications(), 1500);
      } else {
        // Fallback for mock service
        setTestStatus("सूचना भेज दी गई है (डेमो मोड)।");
        setTimeout(() => fetchNotifications(), 1000);
      }
    } catch (err) {
      setTestStatus("सूचना ट्रिगर हो गई है।");
    } finally {
      setTestSending(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  const getNotificationIcon = (kind: string) => {
    switch (kind) {
      case "daily_wellbeing":
      case "checkin_prompt":
        return <Heart className="w-6 h-6 text-rose-600" />;
      case "ai_saathi_reminder":
        return <Sparkles className="w-6 h-6 text-amber-500" />;
      case "caretaker_visit_reminder":
      case "visit_completed":
        return <Calendar className="w-6 h-6 text-teal-600" />;
      case "medication_reminder":
        return <Pill className="w-6 h-6 text-blue-600" />;
      case "appointment_reminder":
        return <Clock className="w-6 h-6 text-purple-600" />;
      default:
        return <Bell className="w-6 h-6 text-brand-600" />;
    }
  };

  const getCategoryLabel = (kind: string) => {
    switch (kind) {
      case "daily_wellbeing":
      case "checkin_prompt":
        return "दैनिक हाल-चाल";
      case "ai_saathi_reminder":
        return "सहज साथी बात-चीत";
      case "caretaker_visit_reminder":
        return "केयरटेकर मुलाकात";
      case "medication_reminder":
        return "दवा स्मरण";
      case "appointment_reminder":
        return "अपॉइंटमेंट";
      case "care_update":
      case "visit_completed":
        return "जरूरी अपडेट";
      default:
        return "सामान्य सूचना";
    }
  };

  const getTargetUrl = (item: ContractNotificationItem): string => {
    const kind = item.kind;
    const data = item.data || {};
    if (kind === "daily_wellbeing" || kind === "checkin_prompt") {
      return "/senior/check-in";
    }
    if (kind === "caretaker_visit_reminder" || kind === "visit_completed") {
      return "/senior/visits";
    }
    if (kind === "ai_saathi_reminder") {
      return "/senior";
    }
    if (kind === "medication_reminder") {
      return "/senior";
    }
    if (data.senior_id) {
      return "/senior";
    }
    return "/senior";
  };

  const filteredItems = notifications.filter((item) => {
    if (filter === "unread") return !item.read_at;
    if (filter === "read") return !!item.read_at;
    return true;
  });

  const unreadTotal = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-teal-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                आपकी सूचनाएँ (Notifications)
              </h1>
              <p className="text-teal-100 text-base font-medium">
                दैनिक स्मरण, साथी संवाद और स्वास्थ्य अपडेट
              </p>
            </div>
          </div>
          {unreadTotal > 0 ? (
            <p className="text-amber-300 font-extrabold text-sm sm:text-base flex items-center gap-1.5 pt-1">
              ✨ आपके पास <span className="underline">{unreadTotal} नई सूचनाएँ</span> हैं।
            </p>
          ) : (
            <p className="text-teal-200 font-medium text-sm pt-1">
              ✓ सभी सूचनाएँ पढ़ी जा चुकी हैं।
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Link
            href="/senior/notifications/settings"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white font-bold px-4 py-2.5 rounded-2xl text-base transition-all min-h-[48px]"
          >
            <Settings className="w-5 h-5" />
            <span>सेटिंग्स (Settings)</span>
          </Link>

          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={testSending}
            className="inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-base shadow transition-all active:scale-95 disabled:opacity-60 min-h-[48px]"
          >
            {testSending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span>टेस्ट सूचना भेजें</span>
          </button>
        </div>
      </div>

      {/* Test Status Toast */}
      {testStatus && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-emerald-900 font-bold flex items-center gap-3 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Filter Tabs and Mark All Read Button */}
      <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Accessible Filter Pill Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-base transition-all min-h-[44px] ${
              filter === "all"
                ? "bg-teal-700 text-white shadow"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            सभी ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-base transition-all min-h-[44px] ${
              filter === "unread"
                ? "bg-teal-700 text-white shadow"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            नयी ({unreadTotal})
          </button>
          <button
            type="button"
            onClick={() => setFilter("read")}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-base transition-all min-h-[44px] ${
              filter === "read"
                ? "bg-teal-700 text-white shadow"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            पढ़ी हुई ({notifications.length - unreadTotal})
          </button>
        </div>

        {/* Mark All Read Button */}
        {unreadTotal > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-4 py-2.5 rounded-xl text-sm sm:text-base transition-colors border border-slate-300 min-h-[44px]"
          >
            {markingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
            )}
            <span>सभी को पढ़ा हुआ मानें</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-200 shadow-sm">
            <RefreshCw className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-700">आपकी सूचनाएँ लोड हो रही हैं...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-200 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              {filter === "unread" ? "कोई नयी सूचना नहीं है" : "कोई सूचना उपलब्ध नहीं है"}
            </h3>
            <p className="text-base text-slate-600 max-w-md mx-auto">
              समय-समय पर आपकी देखभाल, दवाइयों और साथी से जुड़े स्मरण यहाँ दिखाई देंगे।
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isUnread = !item.read_at;
            const targetUrl = getTargetUrl(item);
            const dateStr = item.sent_at || item.scheduled_for;
            let formattedTime = "हाल ही में";
            if (dateStr) {
              try {
                const d = new Date(dateStr);
                formattedTime = d.toLocaleDateString("hi-IN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } catch {
                formattedTime = String(dateStr);
              }
            }

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-5 sm:p-6 border-2 transition-all shadow-sm ${
                  isUnread
                    ? "border-teal-500 bg-teal-50/20 shadow-md ring-1 ring-teal-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Category Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                    {getNotificationIcon(item.kind)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {getCategoryLabel(item.kind)}
                        </span>
                        {isUnread && (
                          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                            नयी
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formattedTime}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                      {item.title}
                    </h2>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-medium">
                      {item.body}
                    </p>

                    {/* Bottom Action Buttons */}
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                      {/* Deep Linking Navigation Button */}
                      <Link
                        href={targetUrl}
                        className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-4 py-2 rounded-xl text-sm sm:text-base shadow-sm transition-all active:scale-95 min-h-[44px]"
                      >
                        <span>यहाँ देखें</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>

                      {/* Mark Single Read */}
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(item.id)}
                          disabled={markingId === item.id}
                          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-teal-700 font-extrabold text-sm sm:text-base px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors min-h-[44px]"
                        >
                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          <span>पढ़ा हुआ मार्क करें</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Senior Privacy and Consent Information Banner */}
      <div className="bg-slate-100 rounded-2xl p-5 border border-slate-300 flex items-start gap-3.5 text-slate-700 text-sm">
        <ShieldCheck className="w-6 h-6 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900 text-base">
            गोपनीयता व सुरक्षा का वचन
          </p>
          <p className="leading-relaxed">
            आपके फोन की लॉक-स्क्रीन पर स्वास्थ्य सम्बन्धी कोई भी संवेदनशील जानकारी नहीं दिखाई जाती।
            सभी सूचनाएँ पूरी तरह सुरक्षित और अधिकृत हैं।
          </p>
        </div>
      </div>
    </div>
  );
}

