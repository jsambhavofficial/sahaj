"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDataService } from "@/services";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, formatDay, formatNumber, formatShare } from "@/lib/opsFormat";

const VITAL_LABELS: Record<string, string> = {
  blood_pressure_systolic: "BP systolic",
  blood_pressure_diastolic: "BP diastolic",
  heart_rate: "Heart rate",
  spo2: "Oxygen (SpO₂)",
  blood_glucose: "Blood sugar",
  weight: "Weight",
  temperature: "Temperature",
};

const card = "bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5";
const h2 = "text-sm font-black text-slate-900";

export default function SeniorDetailPage() {
  const params = useParams<{ seniorId: string }>();
  const seniorId = decodeURIComponent(String(params?.seniorId ?? ""));

  const { data, loading, error, reload } = useAsync(async () => {
    const svc = getDataService();
    const [detail, risk, meds, vitals, calls, cues] = await Promise.all([
      svc.getContractSeniorDetail(seniorId),
      svc.getSeniorContractRiskHistory(seniorId),
      svc.getSeniorMedications(seniorId),
      svc.getSeniorVitals(seniorId),
      svc.getSeniorCalls(seniorId),
      svc.getSeniorCues(seniorId),
    ]);
    return { detail, risk, meds, vitals, calls, cues };
  }, [seniorId]);

  const latestVitals = useMemo(() => {
    const latest = new Map<string, NonNullable<typeof data>["vitals"][number]>();
    [...(data?.vitals ?? [])]
      .filter((v) => v.quality_status !== "device_artifact")
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      .forEach((v) => latest.set(v.measurement_type, v));
    return Array.from(latest.values());
  }, [data]);

  if (loading && !data) return <LoadingState message="Loading senior…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { detail, risk, meds, calls, cues } = data;
  const trend = risk.slice(-30);
  const latest = risk[risk.length - 1];
  const maxScore = Math.max(1, ...trend.map((r) => r.risk_score));
  const activeCues = cues.filter((c) => c.cue_value === "present" && !c.negated).slice(-8).reverse();

  return (
    <div className="space-y-5">
      <Link href="/city-manager/seniors" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline">
        <ArrowLeft className="w-4 h-4" /> All seniors
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{detail.display_name || detail.senior_id}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {detail.senior_id} · {detail.age} years · {detail.city} · <span className="capitalize">{detail.preferred_language}</span>
          </p>
        </div>
        {latest && (
          <div className="flex items-center gap-3">
            <RiskBadge level={latest.risk_level} />
            <span className="text-2xl font-black text-slate-900">{latest.risk_score}</span>
            <span className="text-xs text-slate-500">as of {formatDay(latest.date)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className={`${card} lg:col-span-2`}>
          <h2 className={h2}>Risk, last {trend.length} days</h2>
          {trend.length === 0 ? (
            <EmptyState title="No risk scores yet" />
          ) : (
            <div className="mt-4 flex items-end gap-1 h-28" role="img" aria-label="Daily risk score trend">
              {trend.map((r) => (
                <div key={r.date} className="flex-1 flex flex-col justify-end" title={`${formatDay(r.date)}: ${r.risk_score} (${r.risk_level})`}>
                  <div
                    className={r.risk_score >= 75 ? "bg-rose-500" : r.risk_score >= 50 ? "bg-orange-400" : r.risk_score >= 25 ? "bg-amber-300" : "bg-emerald-400"}
                    style={{ height: `${Math.max(4, (r.risk_score / maxScore) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          )}
          {latest && (
            <div className="mt-4 space-y-2 text-xs">
              {latest.recommended_action && <p className="text-slate-700"><span className="font-bold">Suggested action:</span> {latest.recommended_action}</p>}
              {latest.top_factors?.length > 0 && (
                <ul className="list-disc pl-5 text-slate-600 space-y-1">
                  {latest.top_factors.map((f, i) => <li key={i}>{f.evidence}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Profile</h2>
          <dl className="mt-3 space-y-1.5 text-xs">
            {[
              ["Living", String(detail.living_arrangement).replace(/_/g, " ")],
              ["Family sharing", String(detail.family_consent_level ?? "—").replace(/_/g, " ")],
              ["Cognition", detail.health_profile?.cognitive_status ?? "—"],
              ["Fall risk", detail.health_profile?.fall_risk_level ?? "—"],
              ["Mobility aid", detail.health_profile?.mobility_aid ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-slate-800 capitalize text-right">{v}</dd></div>
            ))}
          </dl>
          {(detail.conditions?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detail.conditions!.map((c, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">{c.condition.replace(/_/g, " ")}</span>)}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className={card}>
          <h2 className={h2}>Latest vitals</h2>
          {latestVitals.length === 0 ? <EmptyState title="No vitals recorded" /> : (
            <table className="w-full text-xs mt-3">
              <tbody className="divide-y divide-slate-100">
                {latestVitals.map((v) => (
                  <tr key={v.measurement_type}>
                    <td className="py-2 text-slate-600">{VITAL_LABELS[v.measurement_type] ?? v.measurement_type}</td>
                    <td className="py-2 font-bold text-slate-900 text-right">{formatNumber(Number(v.value), 1)} {v.unit}</td>
                    <td className="py-2 text-slate-500 text-right">{formatDateTime(v.measured_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Medicines</h2>
          <p className="text-xs text-slate-600 mt-1">
            Taken on time: <b>{meds.adherence.last_7d_pct}%</b> over 7 days, <b>{meds.adherence.last_30d_pct}%</b> over 30 days
            {meds.adherence.missed_critical_7d > 0 && <span className="text-rose-700 font-bold"> · {meds.adherence.missed_critical_7d} critical doses missed this week</span>}
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-xs">
            {meds.schedules.filter((m) => m.is_active).map((m) => (
              <li key={m.medication_id} className="py-2 flex justify-between gap-3">
                <span><b className="text-slate-800">{m.drug_name}</b> {m.dosage}<br /><span className="text-slate-500">{m.indication}</span></span>
                <span className="text-slate-500 text-right">{m.scheduled_times.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className={card}>
          <h2 className={h2}>Recent coordinator calls</h2>
          {calls.length === 0 ? <EmptyState title="No calls yet" /> : (
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {calls.slice(0, 5).map((c) => (
                <li key={c.id} className="py-2.5">
                  <div className="flex justify-between text-slate-500"><span>{formatDateTime(c.started_at)}</span><span>{c.status.replace(/_/g, " ")}{c.urgency_flag ? " · urgent" : ""}</span></div>
                  {c.summary && <p className="text-slate-700 mt-1">{c.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>What the senior has mentioned recently</h2>
          {activeCues.length === 0 ? <EmptyState title="Nothing concerning mentioned" /> : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeCues.map((c, i) => <span key={i} className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">{c.cue_type.replace(/_/g, " ")} · {formatDay(c.at)}</span>)}
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-4">Signals from calls and voice notes. They help prioritise follow-up and are not a diagnosis. Overall medicine adherence: {formatShare(meds.adherence.last_30d_pct / 100)}.</p>
        </section>
      </div>
    </div>
  );
}
