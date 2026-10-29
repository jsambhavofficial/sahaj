"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Heart, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, loading, isFamily, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600 mb-4" />
        <p className="text-sm font-medium">Verifying family authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Enforce role guard: only FAMILY or ORGANIZATION_ADMIN
  if (!isFamily && !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-amber-900">Restricted Family Access</h2>
          <p className="text-xs text-amber-800 mt-2 max-w-md mx-auto">
            You are signed in as <span className="font-semibold">{user?.role}</span>. The Family Portal is restricted to verified family members with explicit authorized links to senior citizen profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sub-header for Family Portal */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Heart className="w-5 h-5 fill-rose-50" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Family Care Portal</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> Authorized Access
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Transparent elder-care updates, scheduled visits & direct care coordinator contact
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span>Signed in as:</span>
            <span className="font-semibold text-slate-800">{user?.full_name}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

