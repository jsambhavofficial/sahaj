/** Formatting helpers for the organization manager portal. All accept null (not yet known). */

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

/** Fractions (0-1) from the API as a percentage. */
export function formatShare(fraction: number | null | undefined): string {
  return fraction === null || fraction === undefined ? "—" : `${Math.round(fraction * 100)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? "—" : value.toFixed(digits);
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ageOf(iso: string): string {
  return formatMinutes(Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000));
}

export const SEVERITY_LABEL: Record<string, string> = {
  URGENT_REVIEW: "Urgent",
  HIGH: "High",
  MODERATE: "Moderate",
};

export const SEVERITY_CLASS: Record<string, string> = {
  URGENT_REVIEW: "bg-rose-50 text-rose-800 border-rose-200",
  HIGH: "bg-orange-50 text-orange-800 border-orange-200",
  MODERATE: "bg-amber-50 text-amber-800 border-amber-200",
};

export const SEVERITY_BAR: Record<string, string> = {
  URGENT_REVIEW: "bg-rose-500",
  HIGH: "bg-orange-400",
  MODERATE: "bg-amber-300",
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
};

export const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-sky-50 text-sky-800 border-sky-200",
  ACKNOWLEDGED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  ESCALATED: "bg-rose-50 text-rose-800 border-rose-200",
  RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function pillClass(map: Record<string, string>, key: string): string {
  return `inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[key] || "bg-slate-50 text-slate-700 border-slate-200"}`;
}
