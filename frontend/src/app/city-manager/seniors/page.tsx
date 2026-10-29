"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Heart,
  Phone,
  Calendar,
  Sparkles,
  UserCheck,
  ChevronRight,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import SeniorProfileDrawer from "../components/SeniorProfileDrawer";
import SeniorAvatar from "../components/SeniorAvatar";
import { getSeniorMetadata } from "../data/seniorDirectory";

interface ScopedSenior {
  senior_id: string;
  name: string;
  age: number;
  city_id: string;
  preferred_language: string;
  living_arrangement: string;
  expected_checkin_frequency: string;
  family_consent: boolean;
  baseline_risk_tier: string;
}

export default function CityManagerSeniorsPage() {
  const { user } = useAuth();
  const [seniors, setSeniors] = useState<ScopedSenior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  // Profile Drawer state
  const [selectedSeniorId, setSelectedSeniorId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchSeniors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.get<ScopedSenior[]>("/api/v1/operational/seniors");
      setSeniors(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load city senior citizens roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeniors();
  }, []);

  const handleOpenDrawer = (seniorId: string) => {
    setSelectedSeniorId(seniorId);
    setIsDrawerOpen(true);
  };

  const filteredSeniors = seniors.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.senior_id.toLowerCase().includes(search.toLowerCase()) ||
      s.preferred_language.toLowerCase().includes(search.toLowerCase());

    const matchesRisk = !riskFilter || s.baseline_risk_tier === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Bengaluru";

  // Quick stats
  const totalCount = seniors.length;
  const criticalCount = seniors.filter((s) => s.baseline_risk_tier === "CRITICAL" || s.baseline_risk_tier === "URGENT").length;
  const highCount = seniors.filter((s) => s.baseline_risk_tier === "HIGH").length;
  const lowCount = seniors.filter((s) => s.baseline_risk_tier === "LOW").length;

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>City Operations</span>
            <span>/</span>
            <span className="text-teal-700 font-bold">Monitored Seniors Roster</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <span>{cityName} Enrolled Seniors Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Real-time longitudinal care caseload & active early warning monitoring within your municipal jurisdiction.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSeniors}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-600" /> Refresh Roster
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setRiskFilter("")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            riskFilter === ""
              ? "bg-white border-teal-500 shadow-md ring-2 ring-teal-500/20"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Enrolled Seniors</span>
            <span className="w-2 h-2 rounded-full bg-teal-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {loading ? "..." : totalCount}
          </div>
          <p className="text-[11px] text-teal-700 font-semibold mt-1">Total Active Caseload</p>
        </div>

        <div
          onClick={() => setRiskFilter(criticalCount > 0 ? (seniors.some(s => s.baseline_risk_tier === "CRITICAL") ? "CRITICAL" : "URGENT") : "")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            riskFilter === "CRITICAL" || riskFilter === "URGENT"
              ? "bg-rose-50 border-rose-500 shadow-md ring-2 ring-rose-500/20"
              : "bg-white border-slate-200 hover:border-rose-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-600">
            <span>Critical / Urgent</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">
            {loading ? "..." : criticalCount}
          </div>
          <p className="text-[11px] text-rose-600 font-semibold mt-1">Immediate Protocol Action</p>
        </div>

        <div
          onClick={() => setRiskFilter("HIGH")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            riskFilter === "HIGH"
              ? "bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-500/20"
              : "bg-white border-slate-200 hover:border-amber-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>High Risk Tier</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">
            {loading ? "..." : highCount}
          </div>
          <p className="text-[11px] text-amber-700 font-semibold mt-1">Close Monitoring Required</p>
        </div>

        <div
          onClick={() => setRiskFilter("LOW")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            riskFilter === "LOW"
              ? "bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200 hover:border-emerald-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>Stable / Routine</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
            {loading ? "..." : lowCount}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Standard Wellness Cycle</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search senior name, S00XX ID, language..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all shadow-inner"
          />
        </div>

        {/* Risk Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: "", label: "All" },
            { id: "CRITICAL", label: "Critical" },
            { id: "HIGH", label: "High" },
            { id: "MEDIUM", label: "Medium" },
            { id: "LOW", label: "Low" },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setRiskFilter(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                riskFilter === chip.id
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seniors Roster View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">
            <RefreshCw className="w-8 h-8 mx-auto text-teal-600 animate-spin mb-3" />
            <p className="font-bold text-slate-700">Loading municipal senior roster...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <p className="font-bold text-slate-900">{error}</p>
            <button
              onClick={fetchSeniors}
              className="px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800"
            >
              Retry
            </button>
          </div>
        ) : filteredSeniors.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-base">No seniors found matching your query</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search or risk filter above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="py-4 px-5">Senior Citizen</th>
                  <th className="py-4 px-4">Living & Jurisdiction</th>
                  <th className="py-4 px-4">Check-in Protocol</th>
                  <th className="py-4 px-4">Consent Status</th>
                  <th className="py-4 px-4 text-center">Risk Level</th>
                  <th className="py-4 px-5 text-right">Care Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSeniors.map((s) => {
                  const meta = getSeniorMetadata(s.senior_id);

                  return (
                    <tr
                      key={s.senior_id}
                      onClick={() => handleOpenDrawer(s.senior_id)}
                      className="hover:bg-teal-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Senior Avatar & Details */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <SeniorAvatar
                            name={s.name}
                            gender={meta.gender}
                            size={44}
                            className="group-hover:ring-2 group-hover:ring-teal-500/50 transition-all"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900 group-hover:text-teal-800 transition-colors flex items-center gap-2">
                              <span>{s.name}</span>
                              <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {s.senior_id}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {s.age} years • {meta.gender} • {s.preferred_language}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Living & City */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 capitalize">
                          {s.living_arrangement.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{meta.city || cityName}</span>
                        </div>
                      </td>

                      {/* Check-in Protocol */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 capitalize">
                          {s.expected_checkin_frequency.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-teal-700 font-semibold mt-0.5">
                          Daily AI Saathi Check-In
                        </div>
                      </td>

                      {/* Family Consent */}
                      <td className="py-3.5 px-4">
                        {s.family_consent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Authorized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full border border-slate-200">
                            Direct Senior Care
                          </span>
                        )}
                      </td>

                      {/* Risk Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-extrabold text-xs tracking-wide shadow-2xs ${
                            s.baseline_risk_tier === "CRITICAL" || s.baseline_risk_tier === "URGENT"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : s.baseline_risk_tier === "HIGH"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : s.baseline_risk_tier === "MEDIUM"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {s.baseline_risk_tier}
                        </span>
                      </td>

                      {/* Quick Profile Actions */}
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Open Floating Drawer */}
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(s.senior_id)}
                            className="px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Quick Profile</span>
                          </button>

                          {/* Link to Full Page Dossier / Clinical Report */}
                          <Link
                            href={`/city-manager/seniors/${s.senior_id}`}
                            className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:bg-teal-50 border border-slate-200 rounded-xl transition-colors inline-flex items-center gap-1 shadow-2xs"
                            title="Open full page clinical report"
                          >
                            <span>Full Report</span>
                            <ArrowRight className="w-3 h-3 text-teal-600" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Animated Senior Profile Drawer */}
      <SeniorProfileDrawer
        key={selectedSeniorId || "closed"}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        seniorId={selectedSeniorId}
      />
    </div>
  );
}
