"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Mail,
  Shield,
  Briefcase,
  MapPin,
  CheckCircle2,
  Clock,
  Phone,
  Calendar,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { StaffDetail } from "@/types/api";
import { useAuth } from "@/context/AuthContext";

export default function CityManagerCaretakersPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<StaffDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.get<StaffDetail[]>("/api/v1/operational/staff");
      setStaffList(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load city caretaker team directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const cityName = user?.staff_profile?.city_id?.replace("CITY_", "") || "Assigned City";

  const caretakers = staffList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.employee_code && s.employee_code.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = !roleFilter || s.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalCaretakers = staffList.filter((s) => s.role === "CARETAKER").length;
  const activeStaff = staffList.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            {cityName} Caretaker Team Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Care specialists and field staff operating under your municipal jurisdiction.
          </p>
        </div>

        <button
          onClick={fetchStaff}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Team
        </button>
      </div>

      {/* Info Notice on Phase 4 */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 space-y-1">
          <p className="font-semibold text-sky-950">
            Phase 3 Municipal Oversight Scope
          </p>
          <p>
            You are managing staff deployment and supervisory capacity for {cityName}. Daily visit scheduling, GPS-verified check-ins, and mobile field execution logging will activate in Phase 4 Caretaker Portal.
          </p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Staff in City
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{staffList.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Field Caretakers
          </span>
          <p className="text-2xl font-black text-brand-700 mt-1">{totalCaretakers}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Accounts
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{activeStaff}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by caretaker name, email, or employee code..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs appearance-none"
          >
            <option value="">All Roles</option>
            <option value="CARETAKER">Field Caretakers Only</option>
            <option value="CITY_MANAGER">City Managers</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
            Loading city caretaker team...
          </div>
        ) : caretakers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No caretakers or staff matching your query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Employee Code</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Duty Status</th>
                  <th className="px-4 py-3">Active Caseload</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {caretakers.map((member) => (
                  <tr key={member.user_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{member.full_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {member.email}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          member.role === "CARETAKER"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {member.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">
                      {member.employee_code || "N/A"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {member.specialization || "General Care"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800">
                        {member.on_duty_status || "AVAILABLE"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <span className="font-semibold text-slate-900">
                        {member.active_cases_count} active
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {member.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          Inactive
                        </span>
                      )}
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
