import { AlertStatus, RiskLevel } from "../types/domain";

/**
 * Human readable label for risk levels
 */
export function formatRiskLevel(level: RiskLevel | string | undefined | null): string {
  if (!level) return "Unknown";
  switch (level.toUpperCase()) {
    case "LOW":
      return "Low Risk";
    case "MODERATE":
      return "Moderate Risk";
    case "HIGH":
      return "High Risk";
    case "URGENT_REVIEW":
      return "Urgent Review";
    default:
      return level;
  }
}

/**
 * Accessible color styling classes for Risk badges and indicators
 */
export function getRiskBadgeClasses(level: RiskLevel | string | undefined | null): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (level?.toUpperCase()) {
    case "LOW":
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        text: "text-emerald-800",
        border: "border-emerald-300",
        dot: "bg-emerald-500",
      };
    case "MODERATE":
      return {
        bg: "bg-amber-50 text-amber-900 border-amber-200",
        text: "text-amber-900",
        border: "border-amber-300",
        dot: "bg-amber-500",
      };
    case "HIGH":
      return {
        bg: "bg-orange-50 text-orange-900 border-orange-200",
        text: "text-orange-900",
        border: "border-orange-300",
        dot: "bg-orange-500",
      };
    case "URGENT_REVIEW":
      return {
        bg: "bg-red-50 text-red-900 border-red-200",
        text: "text-red-900",
        border: "border-red-300",
        dot: "bg-red-600",
      };
    default:
      return {
        bg: "bg-slate-100 text-slate-800 border-slate-200",
        text: "text-slate-800",
        border: "border-slate-300",
        dot: "bg-slate-400",
      };
  }
}

/**
 * Formats Alert status for display
 */
export function formatAlertStatus(status: AlertStatus | string | undefined | null): string {
  if (!status) return "Unknown";
  switch (status.toUpperCase()) {
    case "OPEN":
      return "Active";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "ESCALATED":
      return "Escalated";
    case "RESOLVED":
      return "Resolved";
    default:
      return status;
  }
}

/**
 * Accessible color classes for Alert status
 */
export function getAlertStatusClasses(status: AlertStatus | string | undefined | null): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status?.toUpperCase()) {
    case "OPEN":
      return {
        bg: "bg-red-50 text-red-800 border-red-200",
        text: "text-red-800",
        border: "border-red-300",
        dot: "bg-red-500",
      };
    case "ACKNOWLEDGED":
      return {
        bg: "bg-blue-50 text-blue-800 border-blue-200",
        text: "text-blue-800",
        border: "border-blue-300",
        dot: "bg-blue-500",
      };
    case "ESCALATED":
      return {
        bg: "bg-purple-50 text-purple-800 border-purple-200",
        text: "text-purple-800",
        border: "border-purple-300",
        dot: "bg-purple-600",
      };
    case "RESOLVED":
      return {
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        text: "text-slate-700",
        border: "border-slate-300",
        dot: "bg-slate-400",
      };
    default:
      return {
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        text: "text-slate-700",
        border: "border-slate-300",
        dot: "bg-slate-400",
      };
  }
}

/**
 * Formats scores safely without converting null/undefined into 0
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "N/A";
  }
  return `${Math.round(score)}`;
}

/**
 * Formats dates safely
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format timestamps with time
 */
export function formatDateTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return "N/A";
  try {
    const d = new Date(dateTimeStr);
    if (Number.isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateTimeStr;
  }
}

/**
 * Format city identifier to clean string
 */
export function formatCity(cityId: string | undefined | null): string {
  if (!cityId) return "Unknown";
  return cityId
    .replace(/^CITY_/, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

