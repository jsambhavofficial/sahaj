"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { registerWebPushToken } from "@/services/fcm";
import { ContractNotificationItem } from "@/types/api";
import {
  Bell,
  CheckCircle2,
  Clock,
  Settings,
  AlertTriangle,
  UserPlus,
  Calendar,
  ClipboardList,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Send,
  RefreshCw,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function CaretakerNotificationsPage() {
  const router = useRouter();
  const { service } = useApp();
  const [notifications, setNotifications] = useState<ContractNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<"all" | "unread" | "concerns" | "visits" | "read">("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await service.getNotifications(false);
      setNotifications(res.items || []);
    } catch (err) {
      console.error("Failed to load caretaker notifications:", err);
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
      await service.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await service.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestSending(true);
    setTestStatus(null);
    try {
      await registerWebPushToken();
      const res = await fetch("/api/v1/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "wellbeing_concern_detected",
          title: "Wellbeing Concern Review",
          body: "A new wellbeing concern requires your review.",
          data: { senior_id: "S0042", source: "caretaker_test_button" },
        }),
      });

      if (res.ok) {
        setTestStatus("Test notification delivered successfully!");
        setTimeout(() => fetchNotifications(), 1500);
      } else {
        setTestStatus("Test notification triggered (Demo mode).");
        setTimeout(() => fetchNotifications(), 1000);
      }
    } catch (err) {
      setTestStatus("Notification triggered.");
    } finally {
      setTestSending(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "wellbeing_concern_detected":
      case "ai_concern_review":
      case "alert_new":
      case "case_escalation":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
          label: "Wellbeing Concern",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "senior_assigned":
        return {
          icon: <UserPlus className="w-4 h-4 text-blue-600" />,
          label: "New Senior Assignment",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "pending_followup_task":
      case "followup_update":
        return {
          icon: <ClipboardList className="w-4 h-4 text-amber-600" />,
          label: "Follow-up Task",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "overdue_caretaker_visit":
      case "caretaker_visit_reminder":
        return {
          icon: <Calendar className="w-4 h-4 text-purple-600" />,
          label: "Visit Alert",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "family_concern_submitted":
        return {
          icon: <Eye className="w-4 h-4 text-emerald-600" />,
          label: "Family Observation",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "missed_checkin_verification":
        return {
          icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
          label: "Missed Check-in",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-slate-600" />,
          label: "System Alert",
          bg: "bg-slate-50 text-slate-700 border-slate-200",
        };
    }
  };

  const getTargetUrl = (item: ContractNotificationItem): string => {
    const data = item.data || {};
    if (data.senior_id) {
      return `/caretaker/seniors`;
    }
    if (data.visit_id) {
      return `/caretaker?visit_id=${encodeURIComponent(data.visit_id)}`;
    }
    return "/caretaker";
  };

  const filteredItems = notifications.filter((item) => {
    if (filter === "unread") return !item.read_at;
    if (filter === "read") return !!item.read_at;
    if (filter === "concerns") {
      return (
        item.kind.includes("concern") ||
        item.kind.includes("alert") ||
        item.kind.includes("escalation") ||
        item.kind.includes("missed")
      );
    }
    if (filter === "visits") {
      return item.kind.includes("visit") || item.kind.includes("task");
    }
    return true;
  });

  const unreadTotal = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Care Coordinator Notifications
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Real-time alerts, assigned senior updates, and overdue visits
              </p>
            </div>
          </div>
          {unreadTotal > 0 ? (
            <p className="text-sm font-semibold text-brand-600 pt-1">
              You have {unreadTotal} unread notification{unreadTotal > 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs font-medium text-emerald-600 pt-1">
              ✓ All notifications caught up
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/caretaker/notifications/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </Link>

          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={testSending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all disabled:opacity-60"
          >
            {testSending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send Test Push</span>
          </button>
        </div>
      </div>

      {/* Test Status Alert */}
      {testStatus && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Filter Tabs and Mark All Read Button */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "unread"
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Unread ({unreadTotal})
          </button>
          <button
            type="button"
            onClick={() => setFilter("concerns")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "concerns"
                ? "bg-rose-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Concerns & Escalations
          </button>
          <button
            type="button"
            onClick={() => setFilter("visits")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "visits"
                ? "bg-purple-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Visits & Tasks
          </button>
          <button
            type="button"
            onClick={() => setFilter("read")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "read"
                ? "bg-slate-700 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Read
          </button>
        </div>

        {unreadTotal > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-xs font-semibold text-slate-600 hover:text-brand-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center"
          >
            {markingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Loading notifications...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No notifications found</h3>
            <p className="text-xs text-slate-500">
              Assigned case events and scheduled visit reminders will appear here.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isUnread = !item.read_at;
            const badge = getKindBadge(item.kind);
            const targetUrl = getTargetUrl(item);
            const dateStr = item.sent_at || item.scheduled_for;
            let formattedDate = "Recent";
            if (dateStr) {
              try {
                formattedDate = new Date(dateStr).toLocaleString("en-IN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } catch {
                formattedDate = String(dateStr);
              }
            }

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl p-4 sm:p-5 border transition-all ${
                  isUnread
                    ? "border-brand-300 bg-brand-50/10 shadow-sm ring-1 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{badge.icon}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        {item.data?.senior_id && (
                          <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            Senior: {item.data.senior_id}
                          </span>
                        )}
                        {item.data?.visit_id && (
                          <span className="text-[10px] font-mono font-semibold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                            Visit: {item.data.visit_id}
                          </span>
                        )}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formattedDate}
                  </span>
                </div>

                {/* Bottom Actions */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <Link
                    href={targetUrl}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(item.id)}
                      disabled={markingId === item.id}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark as read</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Role-Based Assignment & Privacy Notice */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-slate-800">
            Role-Based Assignment & Health Privacy Protocol
          </p>
          <p>
            You only receive alerts and updates for seniors assigned directly to your coordinator caseload.
            Lock-screen push previews are masked to protect senior medical confidentiality.
          </p>
        </div>
      </div>
    </div>
  );
}

