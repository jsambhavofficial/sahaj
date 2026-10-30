"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const {
    login,
    pairSenior,
    isAuthenticated,
    isAdmin,
    isCityManager,
    isCaretaker,
    isFamily,
    isSenior,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"staff" | "senior">("staff");
  const [email, setEmail] = useState("ops@demo.samarth.local");
  const [password, setPassword] = useState("test@1122");
  const [pairingCode, setPairingCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickPills, setShowQuickPills] = useState(true);

  const redirectByRole = (userRole: string) => {
    const r = (userRole || "").toLowerCase();
    if (r === "ops" || r === "city_manager") {
      router.push("/city-manager");
    } else if (r === "coordinator" || r === "caretaker") {
      router.push("/caretaker");
    } else if (r === "admin" || r === "organization_admin") {
      router.push("/city-manager");
    } else if (r === "family") {
      router.push("/family");
    } else if (r === "senior") {
      router.push("/senior");
    } else {
      router.push("/city-manager");
    }
  };

  // If already authenticated, redirect to respective portal
  React.useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        router.push("/city-manager");
      } else if (isCityManager) {
        router.push("/city-manager");
      } else if (isCaretaker) {
        router.push("/caretaker");
      } else if (isFamily) {
        router.push("/family");
      } else if (isSenior) {
        router.push("/senior");
      } else {
        router.push("/city-manager");
      }
    }
  }, [isAuthenticated, isAdmin, isCityManager, isCaretaker, isFamily, isSenior, router]);

  const normalizeEmail = (val: string) => {
    return val.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (activeTab === "senior") {
        if (!pairingCode.trim()) {
          throw new Error("Please enter your senior device pairing code.");
        }
        const user = await pairSenior(pairingCode.trim());
        redirectByRole(user.role);
      } else {
        const normalizedEmail = normalizeEmail(email);
        const user = await login(normalizedEmail, password);
        redirectByRole(user.role);
      }
    } catch (err: any) {
      setError(err?.message || "Invalid credentials or pairing code. Please verify.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string, roleRoute?: string) => {
    setEmail(presetEmail);
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = normalizeEmail(presetEmail);
      const user = await login(normalizedEmail, "test@1122");
      if (roleRoute) {
        router.push(roleRoute);
      } else {
        redirectByRole(user.role);
      }
    } catch (err: any) {
      setError(err?.message || "Quick sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSeniorPair = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await pairSenior("PAIR_S0001_DEMO");
      redirectByRole(user.role);
    } catch (err: any) {
      setError(err?.message || "Senior demo pairing failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen max-h-screen w-screen overflow-hidden flex items-center justify-center p-2 sm:p-4 lg:p-6 select-none bg-[#38bdf8]">
      {/* 1. Illustrated City Skyline Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: "url('/images/auth/city_clean_bg.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-sky-500/10 backdrop-brightness-[1.02]" />
      </div>

      {/* 2. Outer Rounded Framing Border */}
      <div className="relative z-10 w-full max-w-[1340px] h-[94vh] max-h-[95vh] border-2 sm:border-[3px] border-white/80 rounded-[24px] sm:rounded-[36px] flex flex-col justify-between p-3 sm:p-5 lg:p-7 shadow-2xl backdrop-blur-[0.5px] overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between w-full shrink-0">
          <nav className="flex items-center gap-6 sm:gap-9 text-xs sm:text-sm font-black text-[#0a2540] uppercase tracking-wider drop-shadow-xs">
            <Link
              href="/login"
              className="hover:text-emerald-900 transition-colors cursor-pointer"
            >
              HOME
            </Link>
            <Link
              href="/city-manager"
              className="hover:text-emerald-900 transition-colors cursor-pointer"
            >
              ABOUT
            </Link>
            <Link
              href="/city-manager/reports"
              className="hover:text-emerald-900 transition-colors cursor-pointer"
            >
              HELP
            </Link>
          </nav>

          {/* Right Help Pill Button */}
          <div className="flex items-center gap-3">
            <Link
              href="/city-manager/reports"
              className="inline-flex items-center gap-1.5 bg-[#0c2438] hover:bg-[#14334c] text-white px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black">
                ?
              </div>
              <span className="uppercase tracking-wider text-[11px]">HELP</span>
            </Link>
          </div>
        </header>

        {/* Center Main Stage: Floating Login Card (Left) & Large Sahaj AI Title (Right) */}
        <main className="w-full flex-1 my-auto py-2 sm:py-3 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-6 lg:gap-12 min-h-0">
          {/* LEFT: Floating Login Box */}
          <div className="w-full max-w-[410px] bg-white rounded-[28px] p-5 sm:p-6 shadow-2xl border border-white/90 space-y-3.5 shrink-0 animate-scaleUp">
            {/* Top Avatar Badge */}
            <div className="flex justify-center -mt-1">
              <div className="w-16 h-16 rounded-full bg-[#f8b185] flex items-center justify-center shadow-md border-2 border-white">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#0d2133]" />
                  <div className="w-9 h-4 sm:w-10 sm:h-5 rounded-t-full bg-[#0d2133] mt-0.5" />
                </div>
              </div>
            </div>

            {/* The web portal is for organization managers only; coordinators and seniors use the mobile app */}
            <div className="rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <div className="py-1.5 rounded-lg text-center bg-white text-slate-900 shadow-xs">
                Organization Manager Login
              </div>
              <p className="px-2 pt-1.5 pb-0.5 text-center text-[10px] font-semibold text-slate-500">
                Coordinators and seniors sign in on the Sahaj mobile app.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {activeTab === "staff" ? (
                <>
                  {/* Field 1: Email / Employee ID */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Email or Employee ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="coord_001@demo.samarth.local"
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 rounded-xl text-sm font-bold border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Field 2: Password with Eye Toggle */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 rounded-xl text-sm font-bold border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Senior Device Pairing Code */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Senior Device Pairing Code
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={pairingCode}
                        onChange={(e) => setPairingCode(e.target.value)}
                        placeholder="Enter QR/Pairing code (e.g. PAIR_S0001_DEMO)"
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 rounded-xl text-sm font-bold border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                      Generated by your Care Coordinator via <code>POST /auth/senior/pairing-code</code>.
                    </p>
                  </div>
                </>
              )}

              {/* Orange Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-[#f97316] via-[#fa7930] to-[#fb923c] hover:from-[#ea580c] hover:to-[#f97316] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>{activeTab === "senior" ? "PAIR & LAUNCH APP" : "LOGIN"}</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>

              {activeTab === "staff" && (
                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => alert("Password reset instructions sent to registered administrator email.")}
                    className="text-xs font-bold text-[#2563eb] hover:text-[#1d4ed8] underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </form>

            {/* Quick Demo Switcher Pills */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Demo logins:</span>
                <button
                  type="button"
                  onClick={() => setShowQuickPills(!showQuickPills)}
                  className="text-[10px] text-teal-800 hover:underline cursor-pointer font-bold"
                >
                  {showQuickPills ? "Hide" : "Show"}
                </button>
              </div>

              {showQuickPills && (
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("ops@demo.samarth.local", "/city-manager")}
                    className="p-1.5 text-left bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-950 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Building2 className="w-3 h-3 text-teal-700 shrink-0" />
                    <span className="truncate">Ops (ops@demo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin("admin@demo.samarth.local", "/city-manager")}
                    className="p-1.5 text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-950 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck className="w-3 h-3 text-indigo-700 shrink-0" />
                    <span className="truncate">Admin (admin@demo)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Big Bold Sahaj AI Branding (High Contrast & Crystal-Clear Readability) */}
          <div className="text-center lg:text-left space-y-3 sm:space-y-4 max-w-xl bg-white/65 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white/90 shadow-xl">
            <div className="flex items-center justify-center lg:justify-start gap-3.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-md border-2 border-white bg-white p-1 shrink-0">
                <Image
                  src="/images/logo/sahaj_logo.jpg"
                  alt="Sahaj AI Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain rounded-xl"
                  priority
                />
              </div>
              <div className="hidden sm:block text-left">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-100/90 text-teal-900 text-[10px] font-black uppercase tracking-wider border border-teal-300/60">
                  Municipal Eldercare Platform
                </span>
                <p className="text-xs font-bold text-slate-700 mt-0.5">Government of Karnataka • Sahaj AI</p>
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0a2540] tracking-tight leading-none drop-shadow-sm">
                Sahaj AI
              </h1>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0a2540] tracking-tight leading-none drop-shadow-sm">
                Organization Manager Portal
              </h2>
            </div>

            {/* Teal underline accent bar */}
            <div className="w-20 h-1.5 bg-[#0d9488] rounded-full mx-auto lg:mx-0 shadow-sm" />

            <p className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 tracking-wide pt-1 leading-relaxed">
              Connecting seniors with safer, smarter care.
            </p>
          </div>
        </main>

        {/* Footer info within frame */}
        <footer className="w-full shrink-0 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-black text-[#0a2540] pt-2 border-t border-white/50">
          <span className="bg-white/40 backdrop-blur-xs px-3 py-0.5 rounded-full border border-white/60">
            Sahaj AI Eldercare Operations Platform v3.0
          </span>
          <span className="bg-white/40 backdrop-blur-xs px-3 py-0.5 rounded-full border border-white/60 mt-1 sm:mt-0">
            DPDP 2023 Compliant • 24/7 AI Voice Monitoring
          </span>
        </footer>
      </div>
    </div>
  );
}
