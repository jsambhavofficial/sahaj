"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { CitySummary } from "@/types/api";

export default function AdminCitiesPage() {
  const [cities, setCities] = useState<CitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newCityId, setNewCityId] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [newCityState, setNewCityState] = useState("");
  const [newCityTier, setNewCityTier] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.get<CitySummary[]>("/api/v1/operational/cities");
      setCities(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load operational cities list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await defaultApiClient.post("/api/v1/operational/cities", {
        id: newCityId.trim(),
        name: newCityName.trim(),
        state: newCityState.trim(),
        tier: Number(newCityTier),
      });
      setSuccessMsg(`City ${newCityName} successfully registered.`);
      setShowAddModal(false);
      setNewCityId("");
      setNewCityName("");
      setNewCityState("");
      await fetchCities();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || "Failed to create city. Check ID or name uniqueness.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.state.toLowerCase().includes(search.toLowerCase()) ||
    c.city_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            Operating Regional Chapters
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage geographic municipal chapters, regional staff allocations, and senior population boundaries.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Chapter
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search city by name, state, or ID code..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>
        <button
          onClick={fetchCities}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading operational cities...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredCities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No operating cities matched your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">City Name</th>
                  <th className="py-3.5 px-4">Identifier Code</th>
                  <th className="py-3.5 px-4">Tier</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4 text-center">Active Seniors</th>
                  <th className="py-3.5 px-4 text-center">Caretakers</th>
                  <th className="py-3.5 px-4 text-center">Open Alerts</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredCities.map((c) => (
                  <tr key={c.city_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {c.city_id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      Tier {c.tier}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {c.state}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {c.senior_count}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-700">
                      {c.caretaker_count}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          c.open_alerts_count > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.open_alerts_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/cities/${c.city_id}`}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 rounded transition-colors inline-flex items-center gap-1"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add City Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                Register New City Chapter
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCity} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700">City Code / ID</label>
                <input
                  type="text"
                  required
                  placeholder="CITY_HYDERABAD"
                  value={newCityId}
                  onChange={(e) => setNewCityId(e.target.value.toUpperCase())}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700">City Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="Hyderabad"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700">Tier Classification</label>
                  <select
                    value={newCityTier}
                    onChange={(e) => setNewCityTier(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-xs"
                  >
                    <option value={1}>Tier 1 (Metro)</option>
                    <option value={2}>Tier 2 (Emerging)</option>
                    <option value={3}>Tier 3 (Regional)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700">State / Territory</label>
                  <input
                    type="text"
                    required
                    placeholder="Telangana"
                    value={newCityState}
                    onChange={(e) => setNewCityState(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Chapter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

