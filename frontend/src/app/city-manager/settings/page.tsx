"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  ShieldCheck,
  Bell,
  Sliders,
  Save,
  CheckCircle2,
  Lock,
  Headphones,
  MapPin,
  Clock,
  Sparkles,
  Smartphone,
  AlertTriangle,
  User,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerSettingsPage() {
  const { user } = useAuth();
  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Bengaluru";

  const [managerName, setManagerName] = useState(user?.full_name || "Rajesh Rao");
  const [managerEmail, setManagerEmail] = useState(user?.email || "bengaluru_mgr@samarth.ai");
  const [managerPhone, setManagerPhone] = useState("+91 98450 12345");

  // Operational Settings
  const [autoRefreshSec, setAutoRefreshSec] = useState("30");
  const [sosEscalationTier, setSosEscalationTier] = useState("URGENT");
  const [mlThreshold, setMlThreshold] = useState("80");
  const [inactivityHours, setInactivityHours] = useState("48");
  const [voiceCallCadence, setVoiceCallCadence] = useState("DAILY_MORNING");

  // Toggles
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dpdpAuditLogging, setDpdpAuditLogging] = useState(true);
  const [autoAssignCaretakers, setAutoAssignCaretakers] = useState(true);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sahaj_city_manager_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.managerName) setManagerName(parsed.managerName);
        if (parsed.managerEmail) setManagerEmail(parsed.managerEmail);
        if (parsed.managerPhone) setManagerPhone(parsed.managerPhone);
        if (parsed.autoRefreshSec) setAutoRefreshSec(parsed.autoRefreshSec);
        if (parsed.mlThreshold) setMlThreshold(parsed.mlThreshold);
        if (parsed.smsAlertsEnabled !== undefined) setSmsAlertsEnabled(parsed.smsAlertsEnabled);
        if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      managerName,
      managerEmail,
      managerPhone,
      autoRefreshSec,
      sosEscalationTier,
      mlThreshold,
      inactivityHours,
      voiceCallCadence,
      smsAlertsEnabled,
      soundEnabled,
      dpdpAuditLogging,
      autoAssignCaretakers,
    };
    try {
      localStorage.setItem("sahaj_city_manager_settings", JSON.stringify(config));
    } catch {
      // Ignore
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#1c3e35]" />
            <span>Operations &amp; Command Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure jurisdiction alert thresholds, AI voice companion dispatch, and notification policies for {cityName}.
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: City Jurisdiction & Scope */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Municipal Jurisdiction &amp; Auto-Refresh
              </h2>
              <p className="text-[11px] text-slate-500">
                Assigned command operations scope
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Active City Scope
              </label>
              <input
                type="text"
                disabled
                value={`${cityName} Operations (CITY_${cityName.toUpperCase()})`}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Jurisdiction is managed by Organization Super Admin.
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dashboard Live Polling Interval
              </label>
              <select
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="15">Every 15 Seconds (Rapid Triage)</option>
                <option value="30">Every 30 Seconds (Default)</option>
                <option value="60">Every 60 Seconds</option>
                <option value="0">Manual Refresh Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: AI Risk Engine & Alert Sensitivity */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                AI Early Warning &amp; Voice Screening Sensitivity
              </h2>
              <p className="text-[11px] text-slate-500">
                Calibrate ML deterioration triggers and Priya AI check-in routines
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                ML Deterioration Alert Cutoff
              </label>
              <select
                value={mlThreshold}
                onChange={(e) => setMlThreshold(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="70">&gt; 70% Probability (High Sensitivity)</option>
                <option value="80">&gt; 80% Probability (Standard Bounded)</option>
                <option value="90">&gt; 90% Probability (Urgent Only)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Inactivity Warning Window
              </label>
              <select
                value={inactivityHours}
                onChange={(e) => setInactivityHours(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="24">24 Hours (Immediate Follow-up)</option>
                <option value="48">48 Hours (Standard)</option>
                <option value="72">72 Hours</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Priya AI Saathi Call Frequency
              </label>
              <select
                value={voiceCallCadence}
                onChange={(e) => setVoiceCallCadence(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="DAILY_MORNING">Daily Morning Check-in (9:00 AM)</option>
                <option value="TWICE_DAILY">Twice Daily (Morning &amp; Evening)</option>
                <option value="CUSTOM">On-Demand Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Notification Toggles */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Dispatch, SMS &amp; Compliance Toggles
              </h2>
              <p className="text-[11px] text-slate-500">
                Automated family communication and DPDP 2023 verification policies
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs divide-y divide-slate-100">
            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Automatic SMS / WhatsApp to Family on Urgent Alerts</p>
                <p className="text-slate-500 text-[11px]">Dispatch automated alert summary to authorized guardian</p>
              </div>
              <input
                type="checkbox"
                checked={smsAlertsEnabled}
                onChange={(e) => setSmsAlertsEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-[#1c3e35] focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Audio Chime for Critical Early Warnings</p>
                <p className="text-slate-500 text-[11px]">Play sound alert when new URGENT clinical signal is detected</p>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-[#1c3e35] focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">DPDP 2023 Audit Logging &amp; Access Controls</p>
                <p className="text-slate-500 text-[11px]">Maintain immutable log of caretaker and manager profile inspections</p>
              </div>
              <input
                type="checkbox"
                checked={dpdpAuditLogging}
                onChange={(e) => setDpdpAuditLogging(e.target.checked)}
                className="w-5 h-5 rounded text-[#1c3e35] focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Smart Caretaker Workload Balancing</p>
                <p className="text-slate-500 text-[11px]">Auto-suggest caretakers with lowest caseload for newly scheduled visits</p>
              </div>
              <input
                type="checkbox"
                checked={autoAssignCaretakers}
                onChange={(e) => setAutoAssignCaretakers(e.target.checked)}
                className="w-5 h-5 rounded text-[#1c3e35] focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Manager Profile Details */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                City Manager Operator Profile
              </h2>
              <p className="text-[11px] text-slate-500">
                Identity displayed in operations logs and triage notes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-[#1c3e35] hover:bg-[#255246] text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}

