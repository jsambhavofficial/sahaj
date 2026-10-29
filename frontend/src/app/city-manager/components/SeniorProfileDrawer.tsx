"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  X,
  Phone,
  PhoneCall,
  MessageSquare,
  Calendar,
  CalendarDays,
  Activity,
  Heart,
  Shield,
  FileText,
  Sparkles,
  Clock,
  Check,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  User,
  LayoutGrid,
  Pill,
  Droplets,
  Scale,
  Stethoscope,
  Send,
  CheckCircle2,
  ExternalLink,
  Volume2,
  RefreshCw,
  AlertCircle,
  MapPin,
  Lock,
  Play,
  Pause,
  Headphones,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import {
  ApiSeniorProfileDetail,
  VisitSummaryItem,
  OperationalAlertItem,
} from "@/types/api";
import {
  getSeniorMetadata,
  SeniorDirectoryMeta,
  DialogueTurn,
} from "../data/seniorDirectory";
import SeniorAvatar from "./SeniorAvatar";

interface SeniorProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  seniorId: string | null;
  activeAlert?: OperationalAlertItem | null;
  onTriageAlert?: (alert: OperationalAlertItem) => void;
}

export default function SeniorProfileDrawer({
  isOpen,
  onClose,
  seniorId,
  activeAlert,
  onTriageAlert,
}: SeniorProfileDrawerProps) {
  // Navigation tabs matching design: Overview, Health, Visits, AI Call, Messages, Profile
  const [activeTab, setActiveTab] = useState<
    "overview" | "health" | "visits" | "insights" | "messages" | "profile"
  >("overview");

  // Audio player simulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(14); // seconds
  const [playbackSpeed, setPlaybackSpeed] = useState<"1x" | "1.25x" | "1.5x">("1x");

  // Real backend data states
  const [seniorDetail, setSeniorDetail] = useState<ApiSeniorProfileDetail | null>(null);
  const [seniorVisits, setSeniorVisits] = useState<VisitSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sub-modal states for bottom action bar & transcript
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Call simulator state
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [callDuration, setCallDuration] = useState(0);

  // Message compose state
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  // Schedule visit state
  const [scheduleDate, setScheduleDate] = useState("2026-10-30");
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [schedulePurpose, setSchedulePurpose] = useState("Routine vitals & mobility check");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Metadata helper
  const meta: SeniorDirectoryMeta = getSeniorMetadata(seniorId);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Reset tab and states when opened or seniorId changes
  useEffect(() => {
    let isCurrent = true;
    if (isOpen && seniorId) {
      setActiveTab("overview");
      setSeniorDetail(null);
      setSeniorVisits([]);
      setFetchError(null);
      setIsTranscriptModalOpen(false);
      setIsPlayingAudio(false);
      setAudioCurrentTime(14);
      setMessageSent(false);
      setScheduleSuccess(false);
      setCallStatus("idle");
      setCallDuration(0);

      // Lock body scroll
      document.body.style.overflow = "hidden";

      // Fetch senior detail from early warning API & scoped operational senior & visits
      const loadSeniorData = async (id: string) => {
        setLoading(true);
        setFetchError(null);
        try {
          const [detailRes, scopedRes, visitsRes] = await Promise.allSettled([
            defaultApiClient.get<ApiSeniorProfileDetail>(`/seniors/${id}`),
            defaultApiClient.get<{ name?: string; age?: number; city_id?: string; is_active?: boolean }>(`/api/v1/operational/seniors/${id}`),
            defaultApiClient.get<VisitSummaryItem[]>(`/api/v1/operational/visits`),
          ]);

          if (!isCurrent) return;

          let detail: ApiSeniorProfileDetail | null = null;
          if (detailRes.status === "fulfilled") {
            detail = detailRes.value;
          }

          if (scopedRes.status === "fulfilled" && scopedRes.value?.name) {
            if (detail) {
              detail.name = scopedRes.value.name;
              if (scopedRes.value.age) detail.age = scopedRes.value.age;
            } else {
              detail = {
                senior_id: id,
                name: scopedRes.value.name,
                age: scopedRes.value.age || meta.age,
                preferred_language: "Hindi",
                city_id: scopedRes.value.city_id || "CITY_BENGALURU",
                living_arrangement: "Living with family",
                coordinator_id: "COORD_01",
                expected_checkin_frequency: "DAILY",
                family_consent: true,
                active_alerts: [],
              };
            }
          }
          setSeniorDetail(detail);

          if (visitsRes.status === "fulfilled") {
            const filtered = visitsRes.value.filter((v) => v.senior_id === id);
            setSeniorVisits(filtered);
          }
        } catch (err: any) {
          if (!isCurrent) return;
          console.error("Failed to load senior data", err);
          setFetchError("Could not retrieve latest live telemetry.");
        } finally {
          if (isCurrent) {
            setLoading(false);
          }
        }
      };

      loadSeniorData(seniorId);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      isCurrent = false;
      document.body.style.overflow = "";
    };
  }, [isOpen, seniorId]);

  // Audio timer ticker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAudio) {
      timer = setInterval(() => {
        setAudioCurrentTime((prev) => {
          if (prev >= 105) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlayingAudio]);

  // Handle ESC key to close drawer or open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isTranscriptModalOpen) setIsTranscriptModalOpen(false);
        else if (isCallModalOpen) setIsCallModalOpen(false);
        else if (isMessageModalOpen) setIsMessageModalOpen(false);
        else if (isScheduleModalOpen) setIsScheduleModalOpen(false);
        else if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isTranscriptModalOpen,
    isCallModalOpen,
    isMessageModalOpen,
    isScheduleModalOpen,
    onClose,
  ]);

  // Call duration counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleStartCall = () => {
    setCallStatus("ringing");
    setCallDuration(0);
    setTimeout(() => {
      setCallStatus("connected");
    }, 2200);
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    setTimeout(() => {
      setCallStatus("idle");
      setIsCallModalOpen(false);
    }, 1500);
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    setMessageSent(true);
    setTimeout(() => {
      setMessageSent(false);
      setMessageText("");
      setIsMessageModalOpen(false);
    }, 1500);
  };

  const handleScheduleVisit = () => {
    setScheduleSuccess(true);
    setTimeout(() => {
      setScheduleSuccess(false);
      setIsScheduleModalOpen(false);
    }, 1500);
  };

  if (!isOpen) return null;

  const displayName = seniorDetail?.name || activeAlert?.senior_name || meta.name;
  const displayId = seniorId || meta.senior_id;
  const displayAge = seniorDetail?.age || meta.age;

  // Determine vitals values
  const displayBp = seniorDetail?.baselines
    ? `${Math.round(seniorDetail.baselines.baseline_bp_systolic)}/${Math.round(seniorDetail.baselines.baseline_bp_diastolic)}`
    : meta.vitals.bp;

  const displaySugar = seniorDetail?.baselines
    ? `${Math.round(seniorDetail.baselines.baseline_blood_glucose)} mg/dL`
    : meta.vitals.sugar;

  const displayWeight = seniorDetail?.baselines
    ? `${Math.round(seniorDetail.baselines.baseline_weight)} kg`
    : meta.vitals.weight;

  const displayRisk =
    seniorDetail?.latest_risk_score?.risk_level ||
    activeAlert?.severity ||
    meta.risk_level ||
    "HIGH";

  // Format seconds to mm:ss
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. SOFT BACKDROP OVERLAY                                              */}
      {/* ===================================================================== */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 animate-fadeIn"
        aria-hidden="true"
      />

      {/* ===================================================================== */}
      {/* 2. FLOATING WHITE PROFILE DRAWER (ROUNDED 32px)                       */}
      {/* ===================================================================== */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Senior Profile - ${displayName}`}
        className="fixed top-3 bottom-3 right-3 z-50 w-[95vw] sm:w-[490px] md:w-[510px] lg:w-[535px] max-w-[calc(100vw-24px)] h-[calc(100vh-24px)] bg-white rounded-[32px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden transition-all duration-300 ease-out animate-slideInRight"
      >
        {/* ------------------------------------------------------------------- */}
        {/* HEADER: Avatar, Name, Status Pill, Meta, Close Button               */}
        {/* ------------------------------------------------------------------- */}
        <div className="px-6 pt-5 pb-4 bg-white border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {/* Senior Photo Circle (Guaranteed 64px x 64px) */}
              <SeniorAvatar
                name={displayName}
                gender={meta.gender}
                size={64}
                imageUrl={meta.avatar_url}
              />

              {/* Senior Identity Details */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Senior {displayId}
                  </h4>
                  {/* Status Badge */}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {meta.status}
                  </span>
                </div>

                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {displayName}
                </h2>

                <p className="text-xs text-slate-500 font-semibold">
                  {displayAge} years &nbsp;|&nbsp; {meta.gender} &nbsp;|&nbsp; Senior ID:{" "}
                  <span className="font-mono text-slate-700 font-bold">
                    {displayId}
                  </span>
                </p>
              </div>
            </div>

            {/* Header Right Actions: Full Report Link + Close Button */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                href={`/city-manager/seniors/${displayId}`}
                onClick={onClose}
                className="px-2.5 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors inline-flex items-center gap-1 shadow-2xs"
                title="Open full page clinical report"
              >
                <span>Full Report</span>
                <ExternalLink className="w-3 h-3 text-teal-700" />
              </Link>

              {/* Close Button */}
              <button
                onClick={onClose}
                aria-label="Close Senior Profile"
                className="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* MAIN BODY: Left Vertical Navigation Rail + Right Scrollable Content */}
        {/* ------------------------------------------------------------------- */}
        <div className="flex-1 flex overflow-hidden bg-white">
          {/* Left Vertical Navigation Strip */}
          <nav
            aria-label="Profile navigation"
            className="w-[72px] sm:w-[76px] flex-shrink-0 border-r border-slate-100 flex flex-col items-center py-4 space-y-2.5 bg-slate-50/50"
          >
            {/* Overview */}
            <button
              onClick={() => setActiveTab("overview")}
              title="Overview"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[9px] font-bold">Overview</span>
            </button>

            {/* Health */}
            <button
              onClick={() => setActiveTab("health")}
              title="Health & Vitals"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "health"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Heart className="w-4 h-4" />
              <span className="text-[9px] font-bold">Health</span>
            </button>

            {/* Visits */}
            <button
              onClick={() => setActiveTab("visits")}
              title="Visits Schedule"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "visits"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-[9px] font-bold">Visits</span>
            </button>

            {/* AI Call / Transcript */}
            <button
              onClick={() => setActiveTab("insights")}
              title="AI Calling Transcript"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "insights"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-[9px] font-bold">AI Call</span>
            </button>

            {/* Messages */}
            <button
              onClick={() => setActiveTab("messages")}
              title="Messages"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "messages"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[9px] font-bold">Messages</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => setActiveTab("profile")}
              title="Demographics & DPDP"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === "profile"
                  ? "bg-[#1c3e35] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-[9px] font-bold">Profile</span>
            </button>
          </nav>

          {/* Right Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
            {loading && (
              <div className="py-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Syncing live early warning telemetry...</span>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 1: OVERVIEW (EXACTLY MATCHING ATTACHED SCREENSHOT)           */}
            {/* =============================================================== */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* 1. Three Top Stat Cards in a 3-column row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Card 1: Health Risk */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-amber-800">
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                      <span>Health Risk</span>
                    </div>
                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="text-sm font-black text-amber-900">
                        {displayRisk === "URGENT"
                          ? "Urgent"
                          : displayRisk === "HIGH"
                          ? "High"
                          : "Medium"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                  </div>

                  {/* Card 2: Last Check-in */}
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Last Check-in</span>
                    </div>
                    <div className="pt-1">
                      <p className="text-[10px] text-slate-500 font-semibold">Today</p>
                      <p className="text-sm font-black text-slate-900 leading-none">
                        9:14 AM
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Next Visit */}
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-blue-800">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Next Visit</span>
                    </div>
                    <div className="pt-1">
                      <p className="text-[10px] text-slate-500 font-semibold">Today</p>
                      <p className="text-sm font-black text-slate-900 leading-none">
                        2:00 PM
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Warning / Acute Complaint Banner */}
                {(() => {
                  const currentAlert =
                    activeAlert ||
                    (seniorDetail?.active_alerts && seniorDetail.active_alerts.length > 0
                      ? {
                          alert_id: seniorDetail.active_alerts[0].alert_id,
                          senior_id: displayId,
                          senior_name: displayName,
                          city_id: seniorDetail.city_id,
                          severity: seniorDetail.active_alerts[0].severity,
                          status: seniorDetail.active_alerts[0].status,
                          triggering_signals: seniorDetail.active_alerts[0].triggering_signals,
                          recommended_next_step: seniorDetail.active_alerts[0].recommended_next_step,
                          created_at: seniorDetail.active_alerts[0].created_at,
                          last_updated_at: seniorDetail.active_alerts[0].last_updated_at,
                        }
                      : null);

                  if (!currentAlert && !meta.active_alert_banner) return null;

                  const bannerTitle = currentAlert?.triggering_signals
                    ? "Active Early Warning Alert"
                    : meta.active_alert_banner?.title || "Care Alert";
                  const bannerDesc =
                    currentAlert?.triggering_signals ||
                    meta.active_alert_banner?.description;

                  return (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="w-7 h-7 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center flex-shrink-0 font-black text-sm">
                        !
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-amber-950">
                            {bannerTitle}
                          </h5>
                          {currentAlert && onTriageAlert && (
                            <button
                              onClick={() => onTriageAlert(currentAlert)}
                              className="text-[10px] font-black text-rose-700 underline hover:text-rose-900 cursor-pointer"
                            >
                              Triage &gt;
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                          {bannerDesc}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Recent AI Call Summary Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900">
                        Recent AI Call Summary
                      </h4>
                    </div>
                    <button
                      onClick={() => setActiveTab("insights")}
                      className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{meta.recent_ai_call.time_label}</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold">
                        {meta.recent_ai_call.status}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-700 leading-relaxed">
                      {meta.recent_ai_call.summary}
                    </p>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        onClick={() => setIsTranscriptModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-extrabold shadow-2xs transition-all hover:shadow-xs cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>View Transcript</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Medication Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Pill className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900">
                        Medication
                      </h4>
                    </div>
                    <button
                      onClick={() => setActiveTab("health")}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Today's Status */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Today&apos;s Status</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 mt-1">
                        {meta.meds_taken} / {meta.meds_total} taken
                      </p>
                    </div>

                    {/* Next Dose */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Next Dose</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 mt-1">
                        {meta.next_dose_time}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {meta.next_medication_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. Latest Vitals Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900">
                        Latest Vitals
                      </h4>
                    </div>
                    <button
                      onClick={() => setActiveTab("health")}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      View History
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {/* BP */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-500">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>BP</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 mt-0.5">
                        {displayBp}
                      </p>
                      <span className="text-[10px] font-bold text-slate-500">
                        {meta.vitals.bp_status}
                      </span>
                    </div>

                    {/* Sugar */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-500">
                        <Droplets className="w-3 h-3 text-blue-500" />
                        <span>Sugar</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 mt-0.5 truncate">
                        {displaySugar}
                      </p>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {meta.vitals.sugar_status}
                      </span>
                    </div>

                    {/* Weight */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-500">
                        <Scale className="w-3 h-3 text-purple-500" />
                        <span>Weight</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 mt-0.5">
                        {displayWeight}
                      </p>
                      <span className="text-[10px] font-bold text-blue-700">
                        {meta.vitals.weight_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 2: HEALTH (Clinical Baselines & ML Risk Explanations)        */}
            {/* =============================================================== */}
            {activeTab === "health" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Clinical Baseline Parameters
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">Baseline Blood Pressure</p>
                      <p className="font-mono font-bold text-slate-800">{displayBp} mmHg</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">Blood Glucose</p>
                      <p className="font-mono font-bold text-slate-800">{displaySugar}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">SpO2 Oxygen Saturation</p>
                      <p className="font-mono font-bold text-slate-800">
                        {seniorDetail?.baselines?.baseline_spo2 || 96.5}%
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">Daily Steps (3-Day Average)</p>
                      <p className="font-mono font-bold text-slate-800">
                        {seniorDetail?.baselines?.baseline_steps || 3820} steps/day
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">Average Sleep Duration</p>
                      <p className="font-mono font-bold text-slate-800">
                        {seniorDetail?.baselines?.baseline_sleep_hours?.toFixed(1) || "6.2"} hrs/night
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold">Medication Adherence Tendency</p>
                      <p className="font-mono font-bold text-emerald-700">
                        {(
                          (seniorDetail?.baselines?.baseline_med_adherence_tendency ?? 0.95) * 100
                        ).toFixed(0)}
                        %
                      </p>
                    </div>
                  </div>
                </div>

                {/* ML Early Warning Factors */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-600" />
                    Early Warning Model Risk Explanations
                  </h4>
                  {seniorDetail?.latest_risk_score?.top_contributing_factors?.length ? (
                    <div className="space-y-2">
                      {seniorDetail.latest_risk_score.top_contributing_factors.map(
                        (f, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs"
                          >
                            <div className="flex items-center justify-between font-black text-amber-900">
                              <span>{f.rule_id}</span>
                              <span className="font-mono text-[10px]">
                                +{f.points_contributed} pts
                              </span>
                            </div>
                            <p className="text-slate-800 text-[11px] mt-1 font-medium">
                              {f.evidence}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 italic">
                      No active early warning tripwires triggered. Health trends remain within personal baseline ranges.
                    </div>
                  )}

                  {seniorDetail?.latest_risk_score?.recommended_action && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                      <p className="font-black">Recommended Care Protocol:</p>
                      <p className="mt-0.5 font-medium">{seniorDetail.latest_risk_score.recommended_action}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 3: VISITS (Operational Schedule for this Senior)             */}
            {/* =============================================================== */}
            {activeTab === "visits" && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Care Visit Records
                  </h4>
                  <button
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="px-3 py-1 bg-[#1c3e35] text-white rounded-lg text-xs font-bold hover:bg-[#255246] transition-colors cursor-pointer"
                  >
                    + Book Visit
                  </button>
                </div>

                {seniorVisits.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                    <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      No specific visit logs recorded for this senior
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Use the &quot;Schedule Visit&quot; button below to assign an ad-hoc or recurring field visit.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {seniorVisits.map((v) => (
                      <div
                        key={v.id}
                        className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">
                            {v.scheduled_start.slice(0, 16)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              v.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : v.status === "IN_PROGRESS"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700">
                          {v.visit_purpose || "Routine wellbeing & vitals check"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Caretaker User ID: {v.caretaker_user_id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 4: AI CALL TRANSCRIPT & DIALOGUE                            */}
            {/* =============================================================== */}
            {activeTab === "insights" && (
              <div className="space-y-3 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Daily Automated AI Check-in
                    </h4>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold">
                      Latest: {meta.recent_ai_call.time_label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl leading-relaxed border border-slate-200 font-medium">
                    {meta.recent_ai_call.summary}
                  </p>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                        Turn-by-turn Call Transcript
                      </p>
                      <button
                        onClick={() => setIsTranscriptModalOpen(true)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-950 underline"
                      >
                        Open In Fullscreen Studio &gt;
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {meta.recent_ai_call.dialogue.map((turn, i) => {
                        const isAi = turn.speaker === "Assistant";
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-xl text-xs space-y-1 border ${
                              isAi
                                ? "bg-emerald-50/80 border-emerald-200 ml-3"
                                : "bg-white border-slate-200 mr-3 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-black">
                              <span className={isAi ? "text-emerald-900" : "text-slate-900"}>
                                {isAi ? "Priya • Sahaj AI Agent" : meta.name}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">{turn.time}</span>
                            </div>

                            {turn.hindi_text && (
                              <p className="text-[12px] font-bold text-slate-900 leading-snug">
                                {turn.hindi_text}
                              </p>
                            )}
                            <p className="text-slate-700 leading-relaxed font-medium">
                              {turn.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 5: MESSAGES & COMMUNICATIONS                                */}
            {/* =============================================================== */}
            {activeTab === "messages" && (
              <div className="space-y-3 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    Care Communication Logs
                  </h4>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">SMS Check-in Dispatch</span>
                      <span className="text-[10px] text-slate-400 font-mono">Today 8:00 AM</span>
                    </div>
                    <p className="text-slate-700 text-[11px] font-medium leading-relaxed">
                      &quot;Namaste {meta.name}, your caretaker visit is scheduled for 2:00 PM today. Reply 1 if you need any assistance.&quot;
                    </p>
                    <span className="inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Delivered to {meta.primary_phone}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsMessageModalOpen(true)}
                    className="w-full py-2.5 bg-[#1c3e35] hover:bg-[#255246] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Send Direct Message / SMS
                  </button>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 6: PROFILE DEMOGRAPHICS & DPDP                              */}
            {/* =============================================================== */}
            {activeTab === "profile" && (
              <div className="space-y-3 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-600" />
                    Personal &amp; Guardian Demographics
                  </h4>

                  <div className="space-y-2.5 text-xs divide-y divide-slate-100">
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Residential Address</span>
                      <span className="font-bold text-slate-800 text-right max-w-[220px]">
                        {meta.address}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Primary Contact Phone</span>
                      <span className="font-mono font-bold text-slate-900">
                        {meta.primary_phone}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Emergency Contact Person</span>
                      <span className="font-bold text-slate-900">
                        {meta.emergency_contact_name}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Emergency Phone</span>
                      <span className="font-mono font-bold text-slate-900">
                        {meta.emergency_contact_phone}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">DPDP Consent</span>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-full text-[10px] inline-flex items-center gap-1 border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Active &amp; Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Link to Full Report Page */}
                <Link
                  href={`/city-manager/seniors/${meta.senior_id}`}
                  onClick={onClose}
                  className="w-full py-2.5 bg-[#1c3e35] hover:bg-[#255246] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open Complete Clinical Report</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* PINNED BOTTOM ACTION BAR (MATCHING REFERENCE EXACTLY)               */}
        {/* ------------------------------------------------------------------- */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 justify-between flex-shrink-0">
          {/* Button 1: Call Senior (Deep Dark Green) */}
          <button
            onClick={() => {
              setIsCallModalOpen(true);
              handleStartCall();
            }}
            className="flex-1 py-2.5 px-3 bg-[#134e3a] hover:bg-[#1a634a] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Senior</span>
          </button>

          {/* Button 2: Send Message (Light Mint Green) */}
          <button
            onClick={() => setIsMessageModalOpen(true)}
            className="flex-1 py-2.5 px-3 bg-[#e8f7f0] hover:bg-[#d5f1e3] text-emerald-900 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-200"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
            <span>Send Message</span>
          </button>

          {/* Button 3: Schedule Visit (Light Soft Blue) */}
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex-1 py-2.5 px-3 bg-[#edf4ff] hover:bg-[#ddeaff] text-blue-900 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-blue-200"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <span>Schedule Visit</span>
          </button>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MODAL 1: HIGH-CONTRAST FULLSCREEN TRANSCRIPT MODAL (Z-100)            */}
      {/* ===================================================================== */}
      {isTranscriptModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Call Transcript &amp; Dialogue
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {meta.name} ({meta.senior_id}) • {meta.recent_ai_call.time_label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTranscriptModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audio Bar in Modal */}
            <div className="bg-gradient-to-r from-[#1c3e35] to-[#255246] rounded-2xl p-4 text-white shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="w-10 h-10 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 flex items-center justify-center font-black transition-transform active:scale-95 cursor-pointer shadow-sm"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-slate-950" />
                  ) : (
                    <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                  )}
                </button>
                <div>
                  <p className="text-xs font-black">AI Voice Recording</p>
                  <p className="text-[11px] text-emerald-200 font-mono">
                    {formatSeconds(audioCurrentTime)} / {meta.recent_ai_call.duration}
                  </p>
                </div>
              </div>

              {/* Waveform */}
              <div className="flex items-center gap-1.5 h-6">
                <div className={`w-1 rounded-full bg-emerald-300 ${isPlayingAudio ? "animate-wave-1" : "h-2"}`}></div>
                <div className={`w-1 rounded-full bg-emerald-400 ${isPlayingAudio ? "animate-wave-2" : "h-4"}`}></div>
                <div className={`w-1 rounded-full bg-emerald-300 ${isPlayingAudio ? "animate-wave-3" : "h-3"}`}></div>
                <div className={`w-1 rounded-full bg-emerald-400 ${isPlayingAudio ? "animate-wave-4" : "h-5"}`}></div>
                <div className={`w-1 rounded-full bg-emerald-300 ${isPlayingAudio ? "animate-wave-5" : "h-2"}`}></div>
                <div className={`w-1 rounded-full bg-emerald-400 ${isPlayingAudio ? "animate-wave-2" : "h-4"}`}></div>
              </div>
            </div>

            {/* Turn by turn dialogue list */}
            <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-2">
              {meta.recent_ai_call.dialogue.map((turn, i) => {
                const isAi = turn.speaker === "Assistant";
                return (
                  <div
                    key={i}
                    className={`p-3.5 rounded-2xl border space-y-1.5 shadow-2xs ${
                      isAi
                        ? "bg-emerald-50/90 border-emerald-200 ml-4"
                        : "bg-white border-slate-200 mr-4 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className={isAi ? "text-emerald-900" : "text-slate-900"}>
                        {isAi ? "Priya • Sahaj AI Agent" : meta.name}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">{turn.time}</span>
                    </div>

                    {turn.hindi_text && (
                      <p className="text-[13px] font-bold text-slate-900 leading-snug">
                        {turn.hindi_text}
                      </p>
                    )}
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {turn.text}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsTranscriptModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CALL SENIOR MODAL                                            */}
      {/* ===================================================================== */}
      {isCallModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
              <PhoneCall className={`w-8 h-8 ${callStatus === "ringing" ? "animate-bounce" : ""}`} />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">{meta.name}</h3>
              <p className="font-mono text-xs text-slate-500 mt-0.5">{meta.primary_phone}</p>
              <p className="text-xs font-bold text-emerald-600 mt-2">
                {callStatus === "ringing" && "Connecting through care bridge..."}
                {callStatus === "connected" && `Connected (${callDuration}s)`}
                {callStatus === "ended" && "Call Ended"}
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              {callStatus !== "ended" ? (
                <button
                  onClick={handleEndCall}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  End Call
                </button>
              ) : (
                <button
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: SEND MESSAGE MODAL                                           */}
      {/* ===================================================================== */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Send Message to {meta.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">SMS / WhatsApp Gateway</p>
                </div>
              </div>
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {messageSent ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Message Dispatched!</p>
                <p className="text-xs text-slate-400">Delivered to {meta.primary_phone}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() =>
                      setMessageText(
                        `Namaste ${meta.name}, checking in to confirm your upcoming visit today at 2:00 PM.`
                      )
                    }
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium cursor-pointer"
                  >
                    + Visit Confirmation
                  </button>
                  <button
                    onClick={() =>
                      setMessageText(
                        `Namaste ${meta.name}, please remember to take your afternoon BP medication with water.`
                      )
                    }
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium cursor-pointer"
                  >
                    + Med Reminder
                  </button>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  placeholder={`Type message to ${meta.name}...`}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsMessageModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-[#1c3e35] hover:bg-[#255246] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: SCHEDULE VISIT MODAL                                         */}
      {/* ===================================================================== */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Schedule Visit for {meta.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">Assign Caretaker Visit</p>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scheduleSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Visit Scheduled!</p>
                <p className="text-xs text-slate-400">
                  Assigned for {scheduleDate} at {scheduleTime}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Date &amp; Time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="text-xs p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="text-xs p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Visit Purpose
                  </label>
                  <input
                    type="text"
                    value={schedulePurpose}
                    onChange={(e) => setSchedulePurpose(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleVisit}
                    className="px-4 py-2 bg-[#1c3e35] hover:bg-[#255246] text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
