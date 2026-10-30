"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getDataService } from "@/services";
import { registerWebPushToken, isPushNotificationSupported } from "@/services/fcm";
import {
  Bell,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Heart,
  Calendar,
  Pill,
  ShieldCheck,
  Save,
  RefreshCw,
  Sliders,
  Smartphone,
} from "lucide-react";

interface SeniorNotificationPrefs {
  daily_wellbeing: boolean;
  ai_saathi_reminder: boolean;
  caretaker_visit_reminder: boolean;
  medication_reminder: boolean;
  appointment_reminder: boolean;
  reminder_time: string;
}

const DEFAULT_PREFS: SeniorNotificationPrefs = {
  daily_wellbeing: true,
  ai_saathi_reminder: true,
  caretaker_visit_reminder: true,
  medication_reminder: true,
  appointment_reminder: true,
  reminder_time: "09:00",
};

export default function SeniorNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SeniorNotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [requestingPush, setRequestingPush] = useState<boolean>(false);

  useEffect(() => {
    // Check Notification status
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus("unsupported");
    }

    // Load saved preferences
    const loadPreferences = async () => {
      try {
        const ds = getDataService();
        const res = await ds.getNotificationPreferences();
        if (res && res.preferences) {
          setPrefs((prev) => ({
            ...prev,
            ...res.preferences,
          }));
        }
      } catch (err) {
        console.warn("Could not load notification preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleToggle = (key: keyof SeniorNotificationPrefs) => {
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
      const ds = getDataService();
      await ds.updateNotificationPreferences(prefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableBrowserPush = async () => {
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

  const reminderTimeOptions = [
    { value: "08:00", label: "सुबह 08:00 बजे" },
    { value: "09:00", label: "सुबह 09:00 बजे (सुझाया गया)" },
    { value: "10:00", label: "सुबह 10:00 बजे" },
    { value: "11:00", label: "सुबह 11:00 बजे" },
    { value: "16:00", label: "दोपहर 04:00 बजे" },
    { value: "18:00", label: "शाम 06:00 बजे" },
  ];

  const categories = [
    {
      key: "daily_wellbeing" as const,
      title: "दैनिक हाल-चाल स्मरण (Daily Wellbeing)",
      desc: "हर सुबह आपका कुशल-क्षेम और स्वास्थ्य पूछने के लिए स्मरण सूचना।",
      icon: <Heart className="w-6 h-6 text-rose-600" />,
    },
    {
      key: "ai_saathi_reminder" as const,
      title: "सहज साथी बात-चीत (AI Saathi)",
      desc: "सहज साथी से बात करने और दिनचर्या साझा करने के लिए स्मरण।",
      icon: <Sparkles className="w-6 h-6 text-amber-500" />,
    },
    {
      key: "caretaker_visit_reminder" as const,
      title: "केयरटेकर मुलाकात (Caretaker Visit)",
      desc: "जब आपके केयरटेकर आपसे मिलने आने वाले हों, तब पूर्व सूचना।",
      icon: <Calendar className="w-6 h-6 text-teal-600" />,
    },
    {
      key: "medication_reminder" as const,
      title: "दवाइयाँ लेने का समय (Medication Schedule)",
      desc: "डॉक्टर द्वारा निर्धारित दवाइयाँ समय पर लेने के लिए स्मरण।",
      icon: <Pill className="w-6 h-6 text-blue-600" />,
    },
    {
      key: "appointment_reminder" as const,
      title: "अपॉइंटमेंट व चेकअप (Appointments)",
      desc: "निर्धारित क्लिनिक या डॉक्टर विज़िट के लिए आवश्यक स्मरण।",
      icon: <Clock className="w-6 h-6 text-purple-600" />,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back button and Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/senior/notifications"
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-extrabold px-4 py-2.5 rounded-2xl border-2 border-slate-200 text-base transition-colors min-h-[48px]"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>सूचनाओं पर वापस जाएँ</span>
        </Link>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6">
        <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              सूचना पसंद (Notification Settings)
            </h1>
            <p className="text-slate-600 text-base font-medium">
              आप चुन सकते हैं कि आपको कौन-सी सूचनाएँ किस समय मिलें
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-emerald-900 font-extrabold flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>आपकी पसंद सफलतापूर्वक सुरक्षित कर ली गई है!</span>
          </div>
        )}

        {/* Browser Push Permission Status Banner */}
        <div className="bg-slate-50 rounded-2xl p-5 border-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900 text-base">
                डिवाइस पुश सूचना (Device Push Notification)
              </p>
              <p className="text-sm font-medium text-slate-600">
                {pushStatus === "granted"
                  ? "✓ आपके इस फ़ोन/ब्राउज़र पर पुश सूचनाएँ सक्रिय हैं।"
                  : pushStatus === "denied"
                  ? "⚠️ सूचनाएँ ब्लॉक हैं। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।"
                  : "पुश सूचना पाने के लिए अनुमति चालू करें।"}
              </p>
            </div>
          </div>
          {pushStatus !== "granted" && (
            <button
              type="button"
              onClick={handleEnableBrowserPush}
              disabled={requestingPush}
              className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-black px-4 py-2.5 rounded-xl text-sm sm:text-base shadow transition-all min-h-[48px]"
            >
              {requestingPush ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span>सूचना अनुमति दें</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" />
            <p className="font-bold text-slate-600">पसंद लोड हो रही हैं...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Preferred Reminder Time Selection */}
            <div className="bg-teal-50/50 rounded-2xl p-5 border-2 border-teal-200 space-y-3">
              <label className="block text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-700" />
                <span>दैनिक स्मरण का पसंदीदा समय (Preferred Time)</span>
              </label>
              <p className="text-sm text-slate-600 font-medium">
                आप सुबह किस समय अपनी दैनिक हाल-चाल सूचना पाना चाहते हैं?
              </p>
              <select
                value={prefs.reminder_time}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, reminder_time: e.target.value }))
                }
                className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-base sm:text-lg font-extrabold text-slate-800 focus:outline-none focus:border-teal-600"
              >
                {reminderTimeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Toggle Switches */}
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 pt-2">
                सूचना श्रेणियाँ (Categories)
              </h2>

              {categories.map((cat) => {
                const isEnabled = prefs[cat.key];
                return (
                  <div
                    key={cat.key}
                    onClick={() => handleToggle(cat.key)}
                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start justify-between gap-4 ${
                      isEnabled
                        ? "border-teal-500 bg-teal-50/20"
                        : "border-slate-200 bg-white opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                        {cat.icon}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          {cat.title}
                        </h3>
                        <p className="text-sm sm:text-base font-medium text-slate-600">
                          {cat.desc}
                        </p>
                      </div>
                    </div>

                    {/* Accessible Switch UI */}
                    <div className="shrink-0 pt-1">
                      <div
                        className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                          isEnabled ? "bg-teal-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            isEnabled ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Privacy note */}
            <div className="bg-slate-100 rounded-2xl p-4 border border-slate-300 flex items-start gap-3 text-slate-700 text-sm">
              <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>ज़रूरी सुरक्षा नीति:</strong> आपातकालीन सुरक्षा सूचनाएँ व तत्काल सहायता सूचनाएँ
                हमेशा पहुँचाई जाती हैं ताकि आपकी सुरक्षा सुनिश्चित रहे।
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2.5 bg-teal-700 hover:bg-teal-800 text-white font-black px-6 py-4 rounded-2xl text-lg sm:text-xl shadow-lg transition-all active:scale-98 disabled:opacity-60 min-h-[56px]"
              >
                {saving ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Save className="w-6 h-6" />
                )}
                <span>बदलाव सुरक्षित करें (Save Preferences)</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

