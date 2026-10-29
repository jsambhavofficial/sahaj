"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  User,
  Heart,
  Calendar,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SeniorSummary, RiskLevel } from "@/types/domain";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { SelectFilter } from "@/components/ui/SelectFilter";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatScore, formatCity } from "@/lib/formatting";

function SeniorsDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { service, lastUpdated } = useApp();

  const initialRisk = searchParams.get("risk_level") || "ALL";
  const initialMissing = searchParams.get("missing") === "true";

  const [seniors, setSeniors] = useState<SeniorSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>(initialRisk);
  const [missingFilter, setMissingFilter] = useState<boolean>(initialMissing);
  const [sortBy, setSortBy] = useState<"risk_score" | "senior_id" | "age" | "last_observation_date">("risk_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const loadSeniors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await service.listSeniors({
        search: search.trim() || undefined,
        risk_level: riskFilter !== "ALL" ? riskFilter : undefined,
        sort_by: sortBy,
        sort_direction: sortDirection,
        limit: 100,
      });

      let filtered = data;
      if (missingFilter) {
        filtered = filtered.filter(
          (s) => s.current_risk_score === null || !s.last_observation_date
        );
      }

      setSeniors(filtered);
    } catch (err: any) {
      setError(err.message || "Failed to load seniors directory.");
    } finally {
      setLoading(false);
    }
  }, [service, search, riskFilter, missingFilter, sortBy, sortDirection]);

  useEffect(() => {
    loadSeniors();
  }, [loadSeniors, lastUpdated]);

  const handleClearFilters = () => {
    setSearch("");
    setRiskFilter("ALL");
    setMissingFilter(false);
    setSortBy("risk_score");
    setSortDirection("desc");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    riskFilter !== "ALL" ||
    missingFilter ||
    sortBy !== "risk_score" ||
    sortDirection !== "desc";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Seniors Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, and monitor longitudinal risk levels for enrolled seniors.
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by ID (e.g. S0001) or display name..."
            />
          </div>

          {/* Risk Level Filter */}
          <div className="md:col-span-3">
            <SelectFilter
              id="risk-filter"
              label="Risk Band"
              value={riskFilter}
              options={[
                { value: "ALL", label: "All Bands" },
                { value: "LOW", label: "Low Risk (0-24)" },
                { value: "MODERATE", label: "Moderate Risk (25-49)" },
                { value: "HIGH", label: "High Risk (50-74)" },
                { value: "URGENT_REVIEW", label: "Urgent Review (75-100)" },
              ]}
              onChange={setRiskFilter}
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-4 flex items-center gap-2">
            <SelectFilter
              id="sort-filter"
              label="Sort By"
              value={sortBy}
              options={[
                { value: "risk_score", label: "Risk Score" },
                { value: "age", label: "Age" },
                { value: "senior_id", label: "Senior ID" },
                { value: "last_observation_date", label: "Last Checked" },
              ]}
              onChange={(val) => setSortBy(val as any)}
              className="flex-1"
            />

            <button
              type="button"
              onClick={() =>
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              aria-label={`Toggle sort direction. Currently ${
                sortDirection === "asc" ? "ascending" : "descending"
              }`}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center justify-center shrink-0"
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={missingFilter}
                onChange={(e) => setMissingFilter(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium">
                Show missing telemetry / sparse data only
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{seniors.length}</strong> senior{seniors.length === 1 ? "" : "s"}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 focus:outline-none focus:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Directory Content State */}
      {loading ? (
        <LoadingState message="Loading seniors records..." />
      ) : error ? (
        <ErrorState
          title="Failed to Load Seniors"
          message={error}
          onRetry={loadSeniors}
        />
      ) : seniors.length === 0 ? (
        <EmptyState
          title="No Seniors Match Current Filters"
          description="Try broadening your search term or selecting 'All Bands' to display more records."
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Reset Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">
                    Senior ID & Name
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Risk Band
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Risk Score
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Demographics
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Last Observation
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Attention Reason
                  </th>
                  <th scope="col" className="py-3 px-4 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {seniors.map((s) => (
                  <tr
                    key={s.senior_id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium">
                      <Link
                        href={`/seniors/${s.senior_id}`}
                        className="font-bold text-slate-900 hover:text-brand-600 block focus:outline-none focus:underline"
                      >
                        {s.display_name}
                      </Link>
                      <span className="text-[11px] font-mono text-slate-400">
                        {s.senior_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RiskBadge level={s.current_risk_level} />
                      {s.active_alert_count > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            {s.active_alert_count} alert{s.active_alert_count > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-bold text-sm text-slate-900">
                        {formatScore(s.current_risk_score)}
                      </span>
                      {s.current_risk_score !== null && (
                        <span className="text-slate-400 text-[10px]">/100</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div>Age {s.age} • {formatCity(s.city_id)}</div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {s.preferred_language} • {s.living_arrangement.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      {formatDate(s.last_observation_date)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      {s.attention_reason ? (
                        <p className="text-xs text-slate-600 truncate" title={s.attention_reason}>
                          {s.attention_reason}
                        </p>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          Routine steady state
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <Link
                        href={`/seniors/${s.senior_id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 transition-colors"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-slate-100">
            {seniors.map((s) => (
              <div key={s.senior_id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/seniors/${s.senior_id}`}
                      className="font-bold text-slate-900 hover:text-brand-600 text-sm block"
                    >
                      {s.display_name}
                    </Link>
                    <span className="font-mono text-xs text-slate-400">
                      {s.senior_id} • Age {s.age} • {formatCity(s.city_id)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-slate-900 block">
                      {formatScore(s.current_risk_score)}
                      {s.current_risk_score !== null && (
                        <span className="text-slate-400 text-xs">/100</span>
                      )}
                    </span>
                    <RiskBadge level={s.current_risk_level} />
                  </div>
                </div>

                {s.attention_reason && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong className="text-slate-700">Signal: </strong>
                    {s.attention_reason}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Last Checked: {formatDate(s.last_observation_date)}</span>
                  <Link
                    href={`/seniors/${s.senior_id}`}
                    className="font-semibold text-brand-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>Full Profile</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeniorsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading directory..." />}>
      <SeniorsDirectoryContent />
    </Suspense>
  );
}

