import { describe, it, expect, vi } from "vitest";
import { isOperationalPath, operationalGet, operationalPost } from "../services/operationalAdapter";

const seniors = {
  items: [
    { senior_id: "S0001", display_name: "Shanti Khanna", age: 71, city: "Pune", preferred_language: "hinglish", living_arrangement: "alone", family_consent_level: "full", risk_level: "HIGH" },
    { senior_id: "S0002", display_name: null, age: 80, city: "Pune", preferred_language: "hindi", living_arrangement: "alone", family_consent_level: "urgent_only", risk_level: null },
  ],
};
const coordinators = [{ coordinator_id: "c1", display_name: "Care Coordinator 001", city: "Pune", caseload: 2, open_alerts: 1 }];
const alert = { alert_id: "ALT_1", senior_id: "S0001", status: "OPEN", severity: "HIGH", created_at: "2026-10-01T00:00:00Z", last_updated_at: "2026-10-01T00:00:00Z", triggering_signals: ["missed call", "low steps"], recommended_next_step: "Call today", resolution_reason: null, assigned_to: null };

const get = vi.fn(async (endpoint: string) => {
  if (endpoint.startsWith("/ops/seniors")) return seniors;
  if (endpoint === "/ops/coordinators") return coordinators;
  if (endpoint === "/ops/overview") return { open_alerts: 1, seniors_total: 2 };
  if (endpoint.startsWith("/alerts/ALT_1")) return alert;
  if (endpoint.startsWith("/alerts?")) return { items: [alert] };
  throw new Error(`unexpected ${endpoint}`);
}) as never;

describe("operational adapter", () => {
  it("recognises operational paths", () => {
    expect(isOperationalPath("/api/v1/operational/seniors")).toBe(true);
    expect(isOperationalPath("/api/v1/seniors")).toBe(false);
  });

  it("maps ops seniors to the roster shape", async () => {
    const rows = await operationalGet<{ senior_id: string; name: string; baseline_risk_tier: string; family_consent: boolean }[]>("/api/v1/operational/seniors", get);
    expect(rows[0]).toMatchObject({ name: "Shanti Khanna", baseline_risk_tier: "HIGH", family_consent: true });
    expect(rows[1]).toMatchObject({ name: "S0002", baseline_risk_tier: "LOW", family_consent: false });
  });

  it("maps alerts with senior names and joined signals", async () => {
    const rows = await operationalGet<{ senior_name: string; triggering_signals: string }[]>("/api/v1/operational/alerts?limit=150&status_filter=OPEN", get);
    expect(rows[0]).toMatchObject({ senior_name: "Shanti Khanna", triggering_signals: "missed call; low steps" });
  });

  it("builds the dashboard from overview, coordinators and alerts", async () => {
    const d = await operationalGet<{ open_alerts_count: number; caretakers_count: number; city_name: string; recent_alerts: unknown[] }>("/api/v1/operational/city-manager/dashboard", get);
    expect(d).toMatchObject({ open_alerts_count: 1, caretakers_count: 1, city_name: "Pune" });
    expect(d.recent_alerts).toHaveLength(1);
  });

  it("returns no visits and rejects unsupported actions clearly", async () => {
    expect(await operationalGet("/api/v1/operational/visits", get)).toEqual([]);
    await expect(operationalPost("/api/v1/operational/visits", {}, get)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
  });

  it("forwards acknowledge and resolve to the alerts API", async () => {
    const post = vi.fn(async () => ({}));
    await operationalPost("/api/v1/operational/alerts/ALT_1/acknowledge", { notes: "ok" }, post as never);
    await operationalPost("/api/v1/operational/alerts/ALT_1/resolve", { resolution_reason: "done" }, post as never);
    expect(post).toHaveBeenNthCalledWith(1, "/alerts/ALT_1/acknowledge", { method: "POST", body: JSON.stringify({ note: "ok" }) });
    expect(post).toHaveBeenNthCalledWith(2, "/alerts/ALT_1/resolve", { method: "POST", body: JSON.stringify({ resolution_reason: "done" }) });
  });
});
