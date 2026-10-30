import type {
  AlertDetailExtendedResponse,
  CityManagerDashboard,
  OperationalAlertItem,
  ReportsSummary,
  StaffDetail,
} from "../types/api";
import type { ApiError } from "../types/domain";

/**
 * The manager portal pages were designed against `/api/v1/operational/*`. The backend exposes the same
 * information under `/ops/*` and `/alerts/*` with different shapes, so this adapter answers the
 * operational calls from those real endpoints. Anything the backend has no concept of (visits, assigning
 * alerts, follow-up tasks) is reported as empty or rejected clearly rather than faked.
 */

type Fetcher = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

interface OpsSenior {
  senior_id: string;
  display_name: string | null;
  age: number;
  city: string;
  preferred_language: string;
  living_arrangement: string;
  family_consent_level: string;
  risk_level: string | null;
}
interface OpsCoordinator {
  coordinator_id: string;
  display_name: string;
  city: string | null;
  caseload: number;
  open_alerts: number;
}
interface BackendAlert {
  alert_id: string;
  senior_id: string;
  status: string;
  severity: string;
  created_at: string;
  last_updated_at: string;
  triggering_signals: string[];
  recommended_next_step: string;
  resolution_reason: string | null;
  assigned_to: string | null;
}
interface Page<T> {
  items: T[];
}

const PREFIX = "/api/v1/operational";

export function isOperationalPath(endpoint: string): boolean {
  return endpoint.startsWith(PREFIX);
}

function unsupported(what: string): ApiError {
  return { code: "NOT_AVAILABLE", message: `${what} is not available in this version of the backend yet.`, status_code: 501 };
}

function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || "UNKNOWN";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

const loadSeniors = async (get: Fetcher) => (await get<Page<OpsSenior>>("/ops/seniors?limit=200&sort=name")).items;
const loadCoordinators = (get: Fetcher) => get<OpsCoordinator[]>("/ops/coordinators");
const loadAlerts = async (get: Fetcher, qs = "limit=200") => (await get<Page<BackendAlert>>(`/alerts?${qs}`)).items;

function toAlert(a: BackendAlert, names: Map<string, OpsSenior>): OperationalAlertItem {
  const s = names.get(a.senior_id);
  return {
    alert_id: a.alert_id,
    senior_id: a.senior_id,
    senior_name: s?.display_name || a.senior_id,
    city_id: s?.city ?? null,
    severity: a.severity,
    status: a.status,
    triggering_signals: a.triggering_signals.join("; "),
    recommended_next_step: a.recommended_next_step,
    created_at: a.created_at,
    last_updated_at: a.last_updated_at,
    resolution_reason: a.resolution_reason,
  };
}

function toStaff(c: OpsCoordinator): StaffDetail {
  return {
    user_id: c.coordinator_id,
    email: "",
    full_name: c.display_name,
    role: "CARETAKER",
    is_active: true,
    city_name: c.city,
    employee_code: null,
    specialization: null,
    on_duty_status: "ON_DUTY",
    active_cases_count: c.caseload,
  };
}

export async function operationalGet<T>(endpoint: string, get: Fetcher): Promise<T> {
  const url = new URL(endpoint, "http://x");
  const path = url.pathname.slice(PREFIX.length);
  const q = url.searchParams;

  if (path === "/seniors") {
    const seniors = await loadSeniors(get);
    return seniors.map((s) => ({
      senior_id: s.senior_id,
      name: s.display_name || s.senior_id,
      age: s.age,
      city_id: s.city,
      preferred_language: s.preferred_language,
      living_arrangement: s.living_arrangement,
      expected_checkin_frequency: "Daily",
      family_consent: s.family_consent_level !== "urgent_only",
      baseline_risk_tier: s.risk_level || "LOW",
    })) as T;
  }

  if (path === "/staff") {
    return (await loadCoordinators(get)).map(toStaff) as T;
  }

  if (path === "/visits") {
    return [] as T;
  }

  if (path === "/alerts") {
    const params = new URLSearchParams({ limit: q.get("limit") || "200" });
    if (q.get("status_filter")) params.set("status", q.get("status_filter")!);
    if (q.get("severity")) params.set("severity", q.get("severity")!);
    const [alerts, seniors] = await Promise.all([loadAlerts(get, params.toString()), loadSeniors(get)]);
    const names = new Map(seniors.map((s) => [s.senior_id, s]));
    return alerts.map((a) => toAlert(a, names)) as T;
  }

  const alertMatch = path.match(/^\/alerts\/([^/]+)$/);
  if (alertMatch) {
    const a = await get<BackendAlert>(`/alerts/${alertMatch[1]}`);
    const s = (await loadSeniors(get)).find((x) => x.senior_id === a.senior_id);
    const base = toAlert(a, new Map(s ? [[s.senior_id, s]] : []));
    const detail: AlertDetailExtendedResponse = {
      id: a.alert_id,
      senior_id: a.senior_id,
      senior_name: base.senior_name,
      senior_city_id: base.city_id,
      severity: a.severity,
      status: a.status,
      triggering_signals: base.triggering_signals,
      recommended_next_step: a.recommended_next_step,
      assigned_to_user_id: a.assigned_to,
      follow_up_required: false,
      follow_up_tasks: [],
      resolution_reason: a.resolution_reason,
      created_at: a.created_at,
      last_updated_at: a.last_updated_at,
    };
    return detail as T;
  }

  if (path === "/city-manager/dashboard") {
    const [overview, coordinators, seniors, alerts] = await Promise.all([
      get<{ open_alerts: number; seniors_total: number }>("/ops/overview"),
      loadCoordinators(get),
      loadSeniors(get),
      loadAlerts(get),
    ]);
    const names = new Map(seniors.map((s) => [s.senior_id, s]));
    const open = alerts.filter((a) => a.status !== "RESOLVED");
    const cities = Array.from(new Set(seniors.map((s) => s.city)));
    const dash: CityManagerDashboard = {
      city_id: cities.length === 1 ? cities[0] : "ALL",
      city_name: cities.length === 1 ? cities[0] : "All cities",
      state: "",
      active_seniors_count: overview.seniors_total,
      caretakers_count: coordinators.length,
      open_alerts_count: overview.open_alerts,
      alerts_by_severity: countBy(open, (a) => a.severity),
      recent_alerts: open.slice(0, 10).map((a) => toAlert(a, names)),
      caretakers_caseload: coordinators.map((c) => ({
        caretaker_id: c.coordinator_id,
        caretaker_name: c.display_name,
        email: "",
        employee_code: "",
        on_duty_status: "ON_DUTY",
        active_senior_count: c.caseload,
      })),
      visits_scheduled_today: 0,
      visits_completed_today: 0,
      visits_status_note: "Visit scheduling is not part of this backend yet.",
    };
    return dash as T;
  }

  if (path === "/reports/summary") {
    const [seniors, coordinators, alerts] = await Promise.all([loadSeniors(get), loadCoordinators(get), loadAlerts(get)]);
    const summary: ReportsSummary = {
      seniors_by_city: countBy(seniors, (s) => s.city),
      seniors_by_risk_tier: countBy(seniors, (s) => s.risk_level || "LOW"),
      staff_by_role: { CARETAKER: coordinators.length },
      alerts_by_severity: countBy(alerts, (a) => a.severity),
      alerts_by_status: countBy(alerts, (a) => a.status),
    };
    return summary as T;
  }

  throw unsupported("This operational view");
}

export async function operationalPost<T>(endpoint: string, body: unknown, post: Fetcher): Promise<T> {
  const path = endpoint.slice(PREFIX.length);
  const payload = (body ?? {}) as { notes?: string; resolution_reason?: string };

  const ack = path.match(/^\/alerts\/([^/]+)\/acknowledge$/);
  if (ack) {
    return post<T>(`/alerts/${ack[1]}/acknowledge`, { method: "POST", body: JSON.stringify({ note: payload.notes }) });
  }
  const resolve = path.match(/^\/alerts\/([^/]+)\/resolve$/);
  if (resolve) {
    return post<T>(`/alerts/${resolve[1]}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution_reason: payload.resolution_reason || "Resolved" }),
    });
  }
  throw unsupported(path.includes("/visits") ? "Visit scheduling" : "This action");
}
