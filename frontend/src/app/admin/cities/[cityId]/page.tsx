"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  Users,
  UserCog,
  Bell,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  MapPin,
  Shield,
  Activity,
} from "lucide-react";
import { defaultApiClient } from "@/services/apiClient";
import { CityDetail } from "@/types/api";

export default function AdminCityDetailPage() {
  const params = useParams();
  const cityId = params?.cityId as string;

  const [city, setCity] = useState<CityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCityDetail = async () => {
    if (!cityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.get<CityDetail>(
        `/api/v1/operational/cities/${cityId}`
      );
      setCity(data);
    } catch (err: any) {
      setError(err?.message || `Failed to load details for city chapter ${cityId}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCityDetail();
  }, [cityId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-200 animate-pulse rounded"></div>
        <div className="h-28 bg-slate-100 animate-pulse rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 animate-pulse rounded-2xl"></div>
          <div className="h-64 bg-slate-100 animate-pulse rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-lg font-bold text-red-900">Chapter Not Found or Access Denied</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
        <Link
          href="/admin/cities"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Cities Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/cities"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Chapters
        </Link>
      </div>

      {/* City Hero Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {city.name}
            </h1>
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {city.city_id}
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
              Tier {city.tier} Chapter
            </span>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {city.state}, India • Operational jurisdiction active
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200/60">
            <p className="text-[10px] uppercase font-bold text-slate-400">Seniors</p>
            <p className="text-lg font-black text-slate-900">{city.senior_count}</p>
          </div>
          <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200/60">
            <p className="text-[10px] uppercase font-bold text-slate-400">Caretakers</p>
            <p className="text-lg font-black text-slate-900">{city.caretakers.length}</p>
          </div>
          <div className="text-center px-4 py-2 bg-amber-50 rounded-xl border border-amber-200/60">
            <p className="text-[10px] uppercase font-bold text-amber-600">Open Alerts</p>
            <p className="text-lg font-black text-amber-800">{city.open_alerts_count}</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/admin/seniors?city_id=${city.city_id}`}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between group transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                View Monitored Seniors in {city.name}
              </p>
              <p className="text-[11px] text-slate-500">{city.senior_count} active senior profiles</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          href={`/admin/alerts?city_id=${city.city_id}`}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between group transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Triage Alerts in {city.name}
              </p>
              <p className="text-[11px] text-slate-500">{city.open_alerts_count} alerts pending review</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
        </Link>
      </div>

      {/* Staff Rosters in this City */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* City Managers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Shield className="w-4 h-4 text-purple-600" />
              <h3>Assigned City Managers</h3>
            </div>
            <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              {city.managers.length} Assigned
            </span>
          </div>

          {city.managers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No City Manager is currently assigned to this chapter.
            </p>
          ) : (
            <div className="space-y-2.5">
              {city.managers.map((m) => (
                <div
                  key={m.user_id}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{m.full_name}</p>
                    <p className="text-[11px] text-slate-500">{m.email}</p>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-700">
                    {m.employee_code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Field Caretakers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <UserCog className="w-4 h-4 text-emerald-600" />
              <h3>Caretaker Caseload Team</h3>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
              {city.caretakers.length} Active
            </span>
          </div>

          {city.caretakers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No field caretakers assigned to this city yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {city.caretakers.map((ct) => (
                <div
                  key={ct.user_id}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{ct.full_name}</p>
                    <p className="text-[11px] text-slate-500">{ct.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-700">
                      {ct.employee_code}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                      {ct.on_duty_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

