"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogIn, Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isAdmin, isCityManager, isCaretaker, isFamily, isSenior } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password@123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to appropriate portal
  React.useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        router.push("/admin");
      } else if (isCityManager) {
        router.push("/city-manager");
      } else if (isCaretaker) {
        router.push("/caretaker");
      } else if (isFamily) {
        router.push("/family");
      } else if (isSenior) {
        router.push("/senior");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isAdmin, isCityManager, isCaretaker, isFamily, isSenior, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ORGANIZATION_ADMIN") {
        router.push("/admin");
      } else if (user.role === "CITY_MANAGER") {
        router.push("/city-manager");
      } else if (user.role === "CARETAKER") {
        router.push("/caretaker");
      } else if (user.role === "FAMILY") {
        router.push("/family");
      } else if (user.role === "SENIOR") {
        router.push("/senior");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid email or password. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string) => {
    setEmail(presetEmail);
    setError(null);
    setLoading(true);
    try {
      const user = await login(presetEmail, "Password@123!");
      if (user.role === "ORGANIZATION_ADMIN") {
        router.push("/admin");
      } else if (user.role === "CITY_MANAGER") {
        router.push("/city-manager");
      } else if (user.role === "CARETAKER") {
        router.push("/caretaker");
      } else if (user.role === "FAMILY") {
        router.push("/family");
      } else if (user.role === "SENIOR") {
        router.push("/senior");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Quick sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div>
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            S
          </div>
          <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-900 tracking-tight">
            SamarthCare AI Portal
          </h2>
          <p className="mt-1 text-center text-xs text-slate-500">
            Sign in to access your authorized elder-care management dashboard
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Login Cards */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick 1-Click Demo Accounts
          </label>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("org_admin@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-brand-200 bg-brand-50/50 hover:bg-brand-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Dr. Ananya Sharma</p>
                <p className="text-[11px] text-brand-700 font-medium">Organization Admin (National HQ)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("bengaluru_mgr@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Rajesh Rao</p>
                <p className="text-[11px] text-blue-700 font-medium">City Manager (Bengaluru Chapter)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("delhi_mgr@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Sunita Verma</p>
                <p className="text-[11px] text-purple-700 font-medium">City Manager (Delhi Chapter)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("caretaker_001@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Aarav Patel</p>
                <p className="text-[11px] text-emerald-700 font-medium">Field Caretaker (Bengaluru)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("family_s0001@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Pooja Gupta</p>
                <p className="text-[11px] text-rose-700 font-medium">Authorized Family Member (Daughter of Ramesh Gupta)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin("senior_s0001@samarth.ai")}
              className="text-left p-2.5 rounded-lg border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">Ramesh Gupta (Age 74)</p>
                <p className="text-[11px] text-teal-700 font-medium">Senior Citizen Portal (Chandigarh)</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            </button>
          </div>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Or enter credentials</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Standard Form */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-700">Work Email Address</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@samarth.ai"
                className="pl-9 block w-full text-xs rounded-lg border border-slate-300 py-2.5 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Password</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="pl-9 block w-full text-xs rounded-lg border border-slate-300 py-2.5 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-[11px] text-slate-400">
            Compliant with DPDP Act 2023 & Clinical Decision Support Standards
          </p>
        </div>
      </div>
    </div>
  );
}

