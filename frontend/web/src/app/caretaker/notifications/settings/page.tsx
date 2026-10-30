"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { registerWebPushToken } from "@/services/fcm";
import {
  Bell,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  UserPlus,
  Calendar,
  ClipboardList,
  Eye,
  ShieldCheck,
  Smartphone,
  Save,
  RefreshCw,
} from "lucide-react";

interface CaretakerNotificationPrefs {
  wellbeing_concern_detected: boolean;
  senior_assigned: boolean;
  pending_followup_task: boolean;
  missed_checkin_verification: boolean;
  overdue_caretaker_visit: boolean;
  family_concern_submitted: boolean;
  case_escalation: boolean;
}

const DEFAULT_COORDINATOR_PREFS: CaretakerNotificationPrefs = {
  wellbeing_concern_detected: true,
  senior_assigned: true,
  pending_followup_task: true,
  missed_checkin_verification: true,
  overdue_caretaker_visit: true,
  family_concern_submitted: true,
  case_escalation: true,
};

export default function CaretakerNotificationSettingsPage() {
  const { service } = useApp();
  const [prefs, setPrefs] = useState<CaretakerNotificationPrefs>(DEFAULT_COORDINATOR_PREFS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [requestingPush, setRequestingPush] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus("unsupported");
    }

    const loadPrefs = async () => {
      try {
        const res = await service.getNotificationPreferences();
        if (res && res.preferences) {
          setPrefs((prev) => ({
            ...prev,
            ...res.preferences,
          }));
        }
      } catch (err) {
        console.warn("Could not load coordinator preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPrefs();
  }, [service]);

  const handleToggle = (key: keyof CaretakerNotificationPrefs) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await service.updateNotificationPreferences(prefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to update preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setRequestingPush(true);
    try {
      const result = await registerWebPushToken();
      if (result.permission) {
        setPushStatus(result.permission);
      }
    } finally {
      setRequestingPush(false);
    }
  };

  const categories = [
    {
      key: "wellbeing_concern_detected" as const,
      title: "New Wellbeing Concern Detected",
      desc: "Immediate alert when an AI check-in detects distress or elevated risk for an assigned senior.",
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    },
    {
      key: "case_escalation" as const,
      title: "Important Case Escalations",
      desc: "Critical priority updates requiring coordinator human review or supervisor intervention.",
      icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
    },
    {
      key: "senior_assigned" as const,
      title: "New Senior Assignment",
      desc: "Notification when an elder is newly added to your care caseload.",
      icon: <UserPlus className="w-5 h-5 text-blue-600" />,
    },
    {
      key: "pending_followup_task" as const,
      title: "Pending Follow-up Tasks",
      desc: "Reminders for scheduled coordinator calls, observations, or action items.",
      icon: <ClipboardList className="w-5 h-5 text-amber-600" />,
    },
    {
      key: "missed_checkin_verification" as const,
      title: "Missed Check-in Verification",
      desc: "Alerts when a daily scheduled check-in is missed and requires manual phone verification.",
      icon: <ShieldCheck className="w-5 h-5 text-purple-600" />,
    },
    {
      key: "overdue_caretaker_visit" as const,
      title: "Overdue Caretaker Visits",
      desc: "Real-time notice when an on-site visit is delayed beyond the scheduled grace window.",
      icon: <Calendar className="w-5 h-5 text-orange-600" />,
    },
    {
      key: "family_concern_submitted" as const,
      title: "Family Observations Submitted",
      desc: "Notifications when an authorized family member logs a query or concern.",
      icon: <Eye className="w-5 h-5 text-emerald-600" />,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      {/* Back button */}
      <div>
        <Link
          href="/caretaker/notifications"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Notifications</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Coordinator Notification Preferences
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Manage alert categories delivered to your browser and mobile device
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Preferences saved successfully.</span>
          </div>
        )}

        {/* Push Device Status */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-800">
                Web Push Device Registration
              </p>
              <p className="text-xs text-slate-500">
                {pushStatus === "granted"
                  ? "✓ Push notifications active for this browser."
                  : pushStatus === "denied"
                  ? "⚠️ Notifications are blocked in browser permissions."
                  : "Enable push to receive urgent alerts even when the tab is backgrounded."}
              </p>
            </div>
          </div>
          {pushStatus !== "granted" && (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={requestingPush}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
            >
              {requestingPush ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>Enable Push</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading preferences...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-3">
              {categories.map((cat) => {
                const isEnabled = prefs[cat.key];
                return (
                  <div
                    key={cat.key}
                    onClick={() => handleToggle(cat.key)}
                    className={`cursor-pointer rounded-xl p-4 border transition-all flex items-start justify-between gap-3 ${
                      isEnabled
                        ? "border-brand-300 bg-brand-50/10"
                        : "border-slate-200 bg-white opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {cat.icon}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900">
                          {cat.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {cat.desc}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          isEnabled ? "bg-brand-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform duration-200 ease-in-out ${
                            isEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow transition-colors active:scale-98 disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Preferences</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

