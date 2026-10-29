"use client";

import React, { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { ToastContainer } from "../ui/ToastContainer";

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">
            SamarthCare AI Early Warning & Remote Senior Wellbeing Decision-Support System
          </p>
          <p>
            Regulatory & Medical Notice: This application is a decision-support and workflow coordination tool. Risk scores and signals do not constitute medical diagnoses or emergency dispatch instructions.
          </p>
          <p className="text-[11px] text-slate-400">
            Phase 1 Frontend Architecture & Mock Fixtures • Strict Privacy & Anonymization Preserved
          </p>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
};

