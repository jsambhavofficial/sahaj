"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Volume2,
  RefreshCw,
} from "lucide-react";
import {
  DEFAULT_VOICE_SCENARIO_ID,
  buildEmbedUrl,
  createIframeEventListener,
  fetchSAT,
  recordVoiceEvent,
  SATResponse,
} from "@/lib/ttai";

interface SeniorVoiceCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  seniorName?: string;
  seniorId?: string;
  userEmail?: string;
  onSessionComplete?: (sessionId: string, duration?: number) => void;
}

export default function SeniorVoiceCompanionModal({
  isOpen,
  onClose,
  seniorName = "Aadarneey Senior",
  seniorId = "SENIOR_GUEST",
  userEmail = "",
  onSessionComplete,
}: SeniorVoiceCompanionModalProps) {
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [callStatus, setCallStatus] = useState<"connecting" | "active" | "ended" | "error">("connecting");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [satInfo, setSatInfo] = useState<SATResponse | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or fetch SAT and embed URL when opened
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallStatus("connecting");
      setDurationSeconds(0);
      setActiveSessionId(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    const initVoiceSession = async () => {
      try {
        // Attempt to fetch SAT via backend proxy
        const sat = await fetchSAT({
          scenario_id: DEFAULT_VOICE_SCENARIO_ID,
          duration_hours: 4,
          email: userEmail,
        });

        if (!isMounted) return;
        setSatInfo(sat);

        // Build the target embed URL with dynamic senior context
        const dynamicVars: Record<string, string> = {
          senior_name: seniorName,
          senior_id: seniorId,
          preferred_language: "Hindi",
        };

        const targetUrl = sat.access_token
          ? buildEmbedUrl({
              scenarioId: DEFAULT_VOICE_SCENARIO_ID,
              embedStyle: "basic",
              accessToken: sat.access_token,
              userName: seniorName,
              userEmail: userEmail || undefined,
              name: "Sahaj AI Saathi (Priya)",
              color: "teal-600",
              dynamicVariables: dynamicVars,
              languageCode: "hi",
            })
          : buildEmbedUrl({
              scenarioId: DEFAULT_VOICE_SCENARIO_ID,
              embedStyle: "basic",
              userName: seniorName,
              userEmail: userEmail || undefined,
              name: "Sahaj AI Saathi (Priya)",
              color: "teal-600",
              dynamicVariables: dynamicVars,
              languageCode: "hi",
            });

        setIframeSrc(targetUrl);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn("Backend SAT notice, falling back to direct public scenario embed:", err);
        // Fallback to direct URL
        const fallbackUrl = buildEmbedUrl({
          scenarioId: DEFAULT_VOICE_SCENARIO_ID,
          embedStyle: "basic",
          userName: seniorName,
          userEmail: userEmail || undefined,
          name: "Sahaj AI Saathi (Priya)",
          color: "teal-600",
          dynamicVariables: {
            senior_name: seniorName,
            senior_id: seniorId,
            preferred_language: "Hindi",
          },
          languageCode: "hi",
        });
        setIframeSrc(fallbackUrl);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initVoiceSession();

    return () => {
      isMounted = false;
    };
  }, [isOpen, seniorName, seniorId, userEmail]);

  // Listen for ToughTongue iframe postMessage lifecycle events
  useEffect(() => {
    if (!isOpen) return;

    const cleanup = createIframeEventListener({
      onReady: (scenario) => {
        setLoading(false);
      },
      onStart: (event) => {
        const sessId = event.data.session_id;
        setActiveSessionId(sessId);
        setCallStatus("active");
        setLoading(false);

        // Start call duration timer
        timerRef.current = setInterval(() => {
          setDurationSeconds((prev) => prev + 1);
        }, 1000);

        // Record onStart event on backend
        recordVoiceEvent({
          session_id: sessId,
          scenario_id: DEFAULT_VOICE_SCENARIO_ID,
          event_type: "onStart",
          senior_id: seniorId,
          notes: `Call started with AI Saathi for ${seniorName}`,
        }).catch((e) => console.debug("Record voice event:", e));
      },
      onStop: (event) => {
        const sessId = event.data.session_id;
        const dur = event.data.duration_seconds || durationSeconds;
        setCallStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);

        // Record onStop event on backend
        recordVoiceEvent({
          session_id: sessId,
          scenario_id: DEFAULT_VOICE_SCENARIO_ID,
          event_type: "onStop",
          duration_seconds: dur,
          senior_id: seniorId,
          notes: `Call completed with AI Saathi for ${seniorName}. Duration: ${dur}s`,
        }).catch((e) => console.debug("Record voice event:", e));

        if (onSessionComplete) {
          onSessionComplete(sessId, dur);
        }
      },
      onTerminated: (event) => {
        setCallStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
      },
      onSubmit: (event) => {
        setCallStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
      },
      onError: (err) => {
        setCallStatus("error");
        setErrorMessage(err.message || "Aawaz connect karne mein dikkat aayi.");
        if (timerRef.current) clearInterval(timerRef.current);
      },
    });

    return () => {
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, durationSeconds, seniorId, seniorName, onSessionComplete]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Saathi Voice Companion"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm transition-all"
    >
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">AI Saathi (Priya)</h2>
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-teal-900/60 text-teal-200 px-2.5 py-0.5 rounded-full border border-teal-500/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-300" /> Surakshit Voice Call
                </span>
              </div>
              <p className="text-xs sm:text-sm text-teal-100 font-medium">
                Namaste {seniorName} Ji! Aawaz mein baat karein aur tabiyat batayein.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Call State Pill */}
            {callStatus === "active" && (
              <span className="hidden sm:inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Baatcheet Jaari ({formatDuration(durationSeconds)})
              </span>
            )}
            {callStatus === "ended" && (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Call Samapt
              </span>
            )}

            <button
              onClick={onClose}
              aria-label="Close voice agent modal"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Micro-Help Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs sm:text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Tip:</strong> Bolne ke liye browser par Microphone ko <strong>&quot;Allow&quot;</strong> karein. Priya aapse Hindi mein baatcheet karegi.
            </span>
          </div>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="text-amber-800 hover:text-amber-950 font-bold text-xs underline shrink-0 ml-2"
          >
            {showDiagnostics ? "Technical Chhupayein" : "Details"}
          </button>
        </div>

        {/* Diagnostic info panel (collapsible) */}
        {showDiagnostics && (
          <div className="bg-slate-900 text-slate-200 px-4 py-3 text-xs border-b border-slate-700 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Scenario ID:</strong> <code className="text-teal-400">{DEFAULT_VOICE_SCENARIO_ID}</code>
              </span>
              <span>
                <strong>Auth Mode:</strong>{" "}
                {satInfo?.configured ? (
                  <span className="text-emerald-400 font-bold">SAT Token Active</span>
                ) : (
                  <span className="text-amber-300 font-bold">Direct Public Scenario Embed</span>
                )}
              </span>
              <span>
                <strong>Session ID:</strong> {activeSessionId || "Waiting to connect..."}
              </span>
            </div>
            {satInfo?.message && (
              <p className="text-slate-400 text-[11px] mt-1 border-t border-slate-800 pt-1">
                ℹ️ {satInfo.message} (Set <code className="text-slate-300">TOUGH_TONGUE_API_KEY</code> in backend <code className="text-slate-300">.env</code> to mint private SAT tokens or fetch automated post-session transcripts).
              </p>
            )}
          </div>
        )}

        {/* Iframe Voice Container */}
        <div className="relative flex-1 bg-slate-950 min-h-[520px] sm:min-h-[580px] flex flex-col items-center justify-center">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-3 p-6 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
              <p className="text-lg font-bold text-teal-100">AI Saathi Se Line Mil Rahi Hai...</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Aapka surakshit audio room connect ho raha hai. Kripya 2 second prateeksha karein.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="absolute top-4 left-4 right-4 z-20 bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-center justify-between text-rose-900 text-sm shadow">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setLoading(true);
                  const curr = iframeSrc;
                  setIframeSrc("");
                  setTimeout(() => setIframeSrc(curr), 100);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-rose-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title="Sahaj AI Saathi Voice Agent"
              width="100%"
              height="100%"
              frameBorder="0"
              allow="microphone; camera; autoplay; display-capture"
              className="w-full h-full min-h-[520px] sm:min-h-[580px] border-0"
              onLoad={() => setLoading(false)}
            />
          ) : (
            <div className="p-8 text-center text-slate-400">
              <MicOff className="w-12 h-12 mx-auto mb-2 text-slate-500" />
              <p>Voice Session taiyyar ho raha hai...</p>
            </div>
          )}
        </div>

        {/* Bottom Accessible Action Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  callStatus === "active"
                    ? "bg-emerald-500"
                    : callStatus === "ended"
                      ? "bg-slate-400"
                      : "bg-amber-500 animate-pulse"
                }`}
              />
              {callStatus === "active"
                ? `Baatcheet Chalu Hai (${formatDuration(durationSeconds)})`
                : callStatus === "ended"
                  ? "Call Samapt Hui"
                  : "Connecting..."}
            </span>
            <span className="hidden md:inline text-slate-400">•</span>
            <span className="hidden md:inline text-slate-500">
              Bhasha: <strong className="text-slate-800">Hindi / Hinglish</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
            >
              Band Karein (Close)
            </button>
            {callStatus === "active" && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow transition-colors min-h-[44px]"
              >
                <PhoneOff className="w-4 h-4" />
                Call End Karein
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

