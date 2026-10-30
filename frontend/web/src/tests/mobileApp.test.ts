// Tests for the mobile app's pure logic (SAHAJ_APP). They live here because this project already has a test runner.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  avatarColorOf, chartGeometry, doseId, doseStatus, formatWhen, greetingFor, initialsOf, istClock, latestVitals,
  levelLabel, mapHomeDoses, mapProfile, mapRiskHistory, mapScheduleDoses, mapTodayItem, parseDoseId,
  recentReadings, riskGroupOf, riskTrend, timeSlotOf, vitalSeries, ZERO_VITALS,
} from "../../../SAHAJ_APP/src/api/mappers";
import { ApiError, configureAuth, request } from "../../../SAHAJ_APP/src/api/http";

describe("mobile data mappers", () => {
  it("formats IST clock time from any offset", () => {
    expect(istClock("2026-10-11T08:30:00+05:30")).toEqual({ hour: 8, minute: 30 });
    expect(istClock("2026-10-11T15:00:00Z")).toEqual({ hour: 20, minute: 30 });
    expect(timeSlotOf("2026-10-11T08:00:00+05:30")).toBe("Morning (8:00 AM)");
    expect(timeSlotOf("2026-10-11T15:00:00Z")).toBe("Evening (8:30 PM)");
    expect(timeSlotOf("2026-10-11T14:00:00+05:30")).toBe("Afternoon (2:00 PM)");
  });

  it("gives every dose its own id and reads it back", () => {
    const id = doseId("MED_S0094_03", "2026-10-11T08:00:00+05:30");
    expect(parseDoseId(id)).toEqual({ medicationId: "MED_S0094_03", scheduledAt: "2026-10-11T08:00:00+05:30" });
    expect(parseDoseId("plain")).toEqual({ medicationId: "plain", scheduledAt: "" });
  });

  it("maps recorded dose outcomes to taken / missed / pending", () => {
    expect(["taken", "double_dose", "sos_taken"].map(doseStatus)).toEqual(["taken", "taken", "taken"]);
    expect(doseStatus("missed")).toBe("missed");
    expect(doseStatus("unknown")).toBe("pending");
    expect(doseStatus(undefined)).toBe("pending");
  });

  it("keeps the morning and evening dose of one medicine apart (senior home list)", () => {
    const doses = mapHomeDoses([
      { medication_id: "M1", drug_name: "Carvedilol", dosage: "3 mg", scheduled_at: "2026-10-11T20:00:00+05:30", status: "taken" },
      { medication_id: "M1", drug_name: "Carvedilol", dosage: "3 mg", scheduled_at: "2026-10-11T08:00:00+05:30", status: "unknown" },
    ]);
    expect(new Set(doses.map((d) => d.medication_id)).size).toBe(2);
    expect(doses.map((d) => [d.time_slot, d.status])).toEqual([["Morning (8:00 AM)", "pending"], ["Evening (8:00 PM)", "taken"]]);
  });

  it("joins a coordinator's schedule with what was recorded", () => {
    const doses = mapScheduleDoses(
      [{ medication_id: "M1", drug_name: "Inhaler", dosage: "2 puffs", indication: "breathing", scheduled_times: ["08:30", "20:30"], is_active: true },
       { medication_id: "M2", drug_name: "Old", dosage: "1", scheduled_times: ["09:00"], is_active: false }],
      [{ medication_id: "M1", scheduled_at: "2026-10-11T03:00:00Z", status: "taken" },     // 08:30 IST
       { medication_id: "M1", scheduled_at: "2026-10-11T15:00:00Z", status: "missed" }],  // 20:30 IST
      "2026-10-11"
    );
    expect(doses.map((d) => d.status)).toEqual(["taken", "missed"]);
    expect(doses[0].medication_id).toBe("M1|2026-10-11T08:30:00+05:30");
    expect(doses).toHaveLength(2); // the inactive schedule is left out
  });

  it("treats a dose with no record as pending", () => {
    const [d] = mapScheduleDoses([{ medication_id: "M1", drug_name: "A", dosage: "1", scheduled_times: ["08:00"], is_active: true }], [], "2026-10-11");
    expect(d.status).toBe("pending");
  });

  it("picks the latest good reading of each vital and ignores faulty devices", () => {
    const v = latestVitals([
      { measured_at: "2026-10-10T08:00:00Z", measurement_type: "blood_pressure_systolic", value: 130 },
      { measured_at: "2026-10-11T08:00:00Z", measurement_type: "blood_pressure_systolic", value: 142.04 },
      { measured_at: "2026-10-12T08:00:00Z", measurement_type: "blood_pressure_systolic", value: 999, quality_status: "device_artifact" },
      { measured_at: "2026-10-11T08:00:00Z", measurement_type: "heart_rate", value: 71 },
      { measured_at: "2026-10-11T08:00:00Z", measurement_type: "temperature", value: 98.6 }, // not shown in the app
    ]);
    expect(v).toEqual({ ...ZERO_VITALS, bpSystolic: 142, pulse: 71 });
  });

  it("maps a priority-list entry for the dashboard", () => {
    const s = mapTodayItem({
      rank: 1, risk_score: 79, risk_level: "URGENT_REVIEW", alert_id: "ALT_1",
      reasons: ["A low oxygen level was recorded (92%)."], suggested_action: "Call now",
      senior: { senior_id: "S0094", display_name: "Mohan Singh", age: 72, city: "Bengaluru", preferred_language: "hinglish" },
    });
    expect(s).toMatchObject({ senior_id: "S0094", display_name: "Mohan Singh", avatarInitials: "MS", alert_id: "ALT_1", risk_level: "URGENT_REVIEW" });
    expect(s.avatarColor).toBe(avatarColorOf("S0094"));
  });

  it("handles missing names gracefully", () => {
    expect(initialsOf("Mohan ji")).toBe("MO");
    expect(initialsOf("")).toBe("–");
    expect(mapTodayItem({ rank: 1, risk_score: 0, risk_level: "LOW", senior: { senior_id: "S1" } }).display_name).toBe("S1");
  });
});

describe("mobile screens: real values instead of sample data", () => {
  const history = (scores: number[]) => scores.map((s, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, score: s, level: "LOW" }));

  it("compares this week's risk with last week's, and stays silent without enough days", () => {
    expect(riskTrend(history([10, 10, 10]))).toBeNull();
    expect(riskTrend(history(Array(8).fill(20)))?.text).toBe("No change from last week"); // 1 earlier day is enough to compare
    expect(riskTrend(history([20, 20, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 30, 30]))).toEqual({ delta: 10, text: "10 points higher than last week" });
    expect(riskTrend(history([30, 30, 30, 30, 30, 30, 30, 29, 29, 29, 29, 29, 29, 29]))?.text).toBe("1 point lower than last week");
    expect(riskTrend(history(Array(14).fill(40)))?.text).toBe("No change from last week");
  });

  it("sorts the risk history and groups levels for the dashboard", () => {
    expect(mapRiskHistory([{ date: "2026-10-02", risk_score: 5, risk_level: "LOW" }, { date: "2026-10-01", risk_score: 9, risk_level: "HIGH" }]).map((r) => r.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(["URGENT_REVIEW", "HIGH", "MODERATE", "LOW"].map(riskGroupOf)).toEqual(["critical", "critical", "moderate", "low"]);
    expect(levelLabel("URGENT_REVIEW")).toBe("Urgent review");
  });

  it("builds the profile from the senior detail, with readable condition names", () => {
    const p = mapProfile({ gender: "M", living_arrangement: "with_spouse", conditions: [{ condition: "chf" }, { condition: "copd_asthma" }, { condition: "type_2_diabetes" }],
      baseline: { sbp_median: 123.5, dbp_median: 75, spo2_median: 92, weight_kg_median: 69.1, glucose_fasting_median: null } });
    expect(p).toEqual({ gender: "Male", living: "Lives with spouse", conditions: ["CHF", "COPD asthma", "Type 2 diabetes"],
      baseline: { sbp: 123.5, dbp: 75, sugar: null, spo2: 92, weight: 69.1 } });
    expect(mapProfile({}).conditions).toEqual([]);
    expect(mapProfile({ living_arrangement: "alone" }).living).toBe("Lives alone");
  });

  const reading = (type: string, at: string, value: number, quality = "valid") => ({ measurement_type: type, measured_at: at, value, quality_status: quality });
  const bp = [
    reading("blood_pressure_systolic", "2026-10-09T04:00:00Z", 120), reading("blood_pressure_diastolic", "2026-10-09T04:00:00Z", 80),
    reading("blood_pressure_systolic", "2026-10-10T04:00:00Z", 130), reading("blood_pressure_diastolic", "2026-10-10T04:00:00Z", 84),
    reading("blood_pressure_systolic", "2026-10-10T14:00:00Z", 140), reading("blood_pressure_diastolic", "2026-10-10T14:00:00Z", 88),
    reading("blood_pressure_systolic", "2026-10-11T04:00:00Z", 999, "device_artifact"),
  ];

  it("averages a vital per day for the chart and ignores faulty readings", () => {
    expect(vitalSeries(bp, "BP", 7)).toEqual([
      { day: "2026-10-09", label: "9 Oct", a: 120, b: 80 },
      { day: "2026-10-10", label: "10 Oct", a: 135, b: 86 },
    ]);
    expect(vitalSeries(bp, "Pulse")).toEqual([]);
    expect(vitalSeries(bp, "BP", 1).map((p) => p.day)).toEqual(["2026-10-10"]);
  });

  it("draws a chart from the points, and nothing when there are none", () => {
    expect(chartGeometry([])).toBeNull();
    const g = chartGeometry(vitalSeries(bp, "BP"))!;
    expect(g.a.dots).toHaveLength(2);
    expect(g.b?.dots).toHaveLength(2);
    expect(g.xLabels.map((l) => l.label)).toEqual(["9 Oct", "10 Oct"]);
    expect(g.a.dots[1].y).toBeLessThan(g.a.dots[0].y); // 135 is higher than 120, so it sits higher on screen
    const single = chartGeometry([{ day: "2026-10-09", label: "9 Oct", a: 97 }])!;
    expect(single.b).toBeNull();
    expect(Number.isFinite(single.a.dots[0].y)).toBe(true);
  });

  it("lists the latest readings, pairing systolic with diastolic", () => {
    expect(recentReadings(bp, "BP", 2).map((x) => x.text)).toEqual(["140/88 mmHg", "130/84 mmHg"]);
    expect(recentReadings(bp, "Weight")).toEqual([]);
  });

  it("formats times in India time and greets by the hour", () => {
    expect(formatWhen("2026-10-10T12:12:00Z")).toBe("10 Oct, 5:42 PM");
    expect([9, 14, 20].map(greetingFor)).toEqual(["Good morning", "Good afternoon", "Good evening"]);
  });
});

describe("mobile HTTP client", () => {
  let tokens: { access: string | null; refresh: string | null };
  const expired = vi.fn();
  const renew = vi.fn();
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  beforeEach(() => {
    tokens = { access: "old", refresh: "ref" };
    expired.mockReset();
    renew.mockReset();
    configureAuth({
      getTokens: () => tokens,
      setTokens: (a, r) => { tokens = { access: a, refresh: r }; },
      renew,
      onExpired: expired,
    });
  });

  it("sends the bearer token and returns JSON", async () => {
    const f = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", f);
    expect(await request("/x", { query: { a: 1, b: undefined } })).toEqual({ ok: 1 });
    expect(f.mock.calls[0][0]).toMatch(/\/x\?a=1$/);
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer old");
  });

  it("does not send a token on login calls", async () => {
    const f = vi.fn().mockResolvedValue(json(200, {}));
    vi.stubGlobal("fetch", f);
    await request("/auth/login", { method: "POST", auth: false, body: { email: "a" } });
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("refreshes an expired token once and retries", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "no" } }))
      .mockResolvedValueOnce(json(200, { access_token: "new", refresh_token: "ref2" }))
      .mockResolvedValueOnce(json(200, { data: true }));
    vi.stubGlobal("fetch", f);
    expect(await request("/me/home")).toEqual({ data: true });
    expect(tokens).toEqual({ access: "new", refresh: "ref2" });
    expect(f.mock.calls[2][1].headers.Authorization).toBe("Bearer new");
    expect(expired).not.toHaveBeenCalled();
  });

  it("falls back to the device token for a paired senior phone", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(401, {})) // refresh fails
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", f);
    renew.mockImplementation(async () => { tokens = { access: "fresh", refresh: null }; return true; });
    expect(await request("/me/home")).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledOnce();
    expect(expired).not.toHaveBeenCalled();
  });

  it("signs the user out when nothing can renew the session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, {})));
    renew.mockResolvedValue(false);
    await expect(request("/me/home")).rejects.toMatchObject({ status: 401, code: "session_expired" });
    expect(expired).toHaveBeenCalledOnce();
  });

  it("shows the server's own error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(400, { error: { code: "consent_required", message: "Consent needed." } })));
    await expect(request("/calls/connect", { method: "POST", body: {} })).rejects.toMatchObject({ message: "Consent needed.", status: 400, code: "consent_required" });
  });

  it("explains an unreachable server instead of falling back to sample data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    const err = (await request("/me/home").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Cannot reach the Sahaj server/);
  });
});
