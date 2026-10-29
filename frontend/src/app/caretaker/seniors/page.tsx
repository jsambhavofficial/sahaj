"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Phone,
  ShieldAlert,
  MapPin,
  Heart,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { AssignedSeniorProfile } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CaretakerSeniorsPage() {
  const { user } = useAuth();
  const [seniors, setSeniors] = useState<AssignedSeniorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");

  const fetchSeniors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<AssignedSeniorProfile[]>(
        "/api/v1/caretaker/seniors"
      );
      setSeniors(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load assigned seniors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeniors();
  }, []);

  const filtered = seniors.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.senior_id.toLowerCase().includes(search.toLowerCase());
    const matchesRisk =
      riskFilter === "ALL" || s.baseline_risk_tier.toUpperCase() === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/caretaker"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-brand-700">Caseload Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            My Assigned Senior Citizens
          </h1>
          <p className="text-xs text-slate-500">
            {seniors.length} senior citizens under your direct field care
          </p>
        </div>

        <button
          onClick={fetchSeniors}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID (e.g. Ramesh or S0001)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                riskFilter === r
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500">Loading assigned seniors...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold">No assigned seniors found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((senior) => (
            <div
              key={senior.senior_id}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-brand-300 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold block">
                      {senior.senior_id}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">{senior.name}</h3>
                    <p className="text-xs text-slate-500">{senior.age} years old</p>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      senior.baseline_risk_tier === "HIGH"
                        ? "bg-red-100 text-red-800"
                        : senior.baseline_risk_tier === "MEDIUM"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {senior.baseline_risk_tier} RISK
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-600">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{senior.address || "Bengaluru Home Address"}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Living: {senior.living_arrangement?.replace("_", " ") || "Alone"}</span>
                  </p>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {senior.primary_phone && (
                    <a
                      href={`tel:${senior.primary_phone}`}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Call Senior"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-[11px]">Call</span>
                    </a>
                  )}
                  {senior.emergency_contact_phone && (
                    <a
                      href={`tel:${senior.emergency_contact_phone}`}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Emergency Contact"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-[11px]">Emergency</span>
                    </a>
                  )}
                </div>

                <span className="text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  {senior.assignment_role || "PRIMARY CARE"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

