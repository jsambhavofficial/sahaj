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
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";

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

  const filteredSeniors = seniors.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.senior_id.toLowerCase().includes(search.toLowerCase());

    const matchesRisk = !riskFilter || s.baseline_risk_tier === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Assigned City";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            {cityName} Monitored Seniors Roster
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enrolled senior citizens residing within your municipal care management jurisdiction.
          </p>
        </div>

        <button
          onClick={fetchSeniors}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Roster
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Senior ID or name..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All Risk Tiers</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Review</option>
          </select>
        </div>
      </div>

      {/* Seniors Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading senior citizen records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredSeniors.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No senior citizens found in your jurisdiction matching the query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Senior ID</th>
                  <th className="py-3.5 px-4">Name / Age</th>
                  <th className="py-3.5 px-4">Living Arrangement</th>
                  <th className="py-3.5 px-4">Check-in Protocol</th>
                  <th className="py-3.5 px-4">Family Data Sharing</th>
                  <th className="py-3.5 px-4 text-center">Baseline Risk</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSeniors.map((s) => (
                  <tr key={s.senior_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {s.senior_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.age} yrs • {s.preferred_language}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">
                      {s.living_arrangement.replace("_", " ")}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">
                      {s.expected_checkin_frequency.replace("_", " ")}
                    </td>
                    <td className="py-3.5 px-4">
                      {s.family_consent ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                          Consent Granted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                          Direct Care
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          s.baseline_risk_tier === "CRITICAL"
                            ? "bg-red-100 text-red-800"
                            : s.baseline_risk_tier === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : s.baseline_risk_tier === "MEDIUM"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {s.baseline_risk_tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/seniors/${s.senior_id}`}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 rounded transition-colors inline-flex items-center gap-1"
                      >
                        Profile <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

