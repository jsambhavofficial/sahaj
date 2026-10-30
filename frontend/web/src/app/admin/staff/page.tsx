"use client";

import React, { useState, useEffect } from "react";
import {
  UserCog,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  Mail,
  Shield,
  Briefcase,
  MapPin,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { StaffDetail, CitySummary } from "@/types/api";

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<StaffDetail[]>([]);
  const [cities, setCities] = useState<CitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("CARETAKER");
  const [cityId, setCityId] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [initialPassword, setInitialPassword] = useState("Password@123!");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffData, citiesData] = await Promise.all([
        defaultApiClient.get<StaffDetail[]>("/api/v1/operational/staff"),
        defaultApiClient.get<CitySummary[]>("/api/v1/operational/cities"),
      ]);
      setStaffList(staffData);
      setCities(citiesData);
    } catch (err: any) {
      setError(err?.message || "Failed to load operational staff directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await defaultApiClient.post("/api/v1/operational/staff", {
        email: email.trim(),
        full_name: fullName.trim(),
        role: role.toUpperCase(),
        city_id: cityId || undefined,
        employee_code: empCode.trim().toUpperCase(),
        specialization: specialization.trim() || undefined,
        initial_password: initialPassword,
      });

      setSuccessMsg(`Staff account for ${fullName} successfully provisioned.`);
      setShowAddModal(false);
      setEmail("");
      setFullName("");
      setEmpCode("");
      setSpecialization("");
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || "Failed to create staff account. Check email/code uniqueness.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.employee_code && s.employee_code.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = !roleFilter || s.role === roleFilter;
    const matchesCity = !cityFilter || s.city_id === cityFilter;

    return matchesSearch && matchesRole && matchesCity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-6 h-6 text-brand-600" />
            Staff & Field Operations Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage administrative personnel, regional City Managers, and Caretaker caseload allocations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee code..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All Roles</option>
            <option value="CITY_MANAGER">City Manager</option>
            <option value="CARETAKER">Caretaker</option>
            <option value="ORGANIZATION_ADMIN">Organization Admin</option>
          </select>
        </div>

        <div>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          >
            <option value="">All City Chapters</option>
            {cities.map((c) => (
              <option key={c.city_id} value={c.city_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading staff roster...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No staff members matched your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Chapter</th>
                  <th className="py-3.5 px-4">Employee Code</th>
                  <th className="py-3.5 px-4">Specialization</th>
                  <th className="py-3.5 px-4 text-center">Active Caseload</th>
                  <th className="py-3.5 px-4 text-center">Duty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStaff.map((s) => (
                  <tr key={s.user_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.full_name}</div>
                      <div className="text-[11px] text-slate-500">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.role === "ORGANIZATION_ADMIN"
                            ? "bg-brand-100 text-brand-800"
                            : s.role === "CITY_MANAGER"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {s.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {s.city_name ? (
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {s.city_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">National HQ</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {s.employee_code || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {s.specialization || "General Eldercare"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {s.role === "CARETAKER" ? s.active_cases_count : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {s.on_duty_status || "AVAILABLE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCog className="w-4 h-4 text-brand-600" />
                Provision Staff Account
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

            <form onSubmit={handleCreateStaff} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Sanjay Rao"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="sanjay@samarth.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="CARETAKER">Caretaker (Field Coordinator)</option>
                    <option value="CITY_MANAGER">City Manager</option>
                    <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700">Assigned Chapter</label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">National HQ (No specific city)</option>
                    {cities.map((c) => (
                      <option key={c.city_id} value={c.city_id}>
                        {c.name} ({c.city_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700">Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="COORD_011"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700">Initial Password</label>
                  <input
                    type="password"
                    required
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700">Clinical / Field Specialization</label>
                <input
                  type="text"
                  placeholder="Geriatric Physiotherapy, Diabetic Nursing..."
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
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
                  {submitting ? "Provisioning..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

