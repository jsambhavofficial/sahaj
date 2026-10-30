import { describe, it, expect } from "vitest";
import {
  MOCK_SENIORS,
  MOCK_ALERTS,
  computeDashboardMetrics,
} from "../mocks/fixtures";

describe("Domain Models and Fixtures", () => {
  it("fixtures contain deterministic test cases", () => {
    expect(MOCK_SENIORS.length).toBeGreaterThanOrEqual(5);
    expect(MOCK_ALERTS.length).toBeGreaterThanOrEqual(3);

    // Verify all four risk levels exist in fixtures
    const levels = new Set(MOCK_SENIORS.map((s) => s.current_risk_level));
    expect(levels.has("LOW")).toBe(true);
    expect(levels.has("MODERATE")).toBe(true);
    expect(levels.has("HIGH")).toBe(true);
    expect(levels.has("URGENT_REVIEW")).toBe(true);
  });

  it("includes senior with missing score / missing telemetry test case", () => {
    const missingSenior = MOCK_SENIORS.find((s) => s.current_risk_score === null);
    expect(missingSenior).toBeDefined();
    expect(missingSenior?.risk_history).toHaveLength(0);
    expect(missingSenior?.recent_vitals).toHaveLength(0);
  });

  it("includes senior with 0 related alerts", () => {
    const zeroAlertSenior = MOCK_SENIORS.find((s) => s.active_alert_count === 0);
    expect(zeroAlertSenior).toBeDefined();
  });

  it("computes dashboard metrics deterministically from underlying fixtures", () => {
    const metrics = computeDashboardMetrics(MOCK_SENIORS, MOCK_ALERTS);

    expect(metrics.total_seniors).toBe(MOCK_SENIORS.length);

    // Sum of categorized risk levels must equal total seniors
    const sumRisk =
      metrics.by_risk_level.LOW +
      metrics.by_risk_level.MODERATE +
      metrics.by_risk_level.HIGH +
      metrics.by_risk_level.URGENT_REVIEW;
    expect(sumRisk).toBe(MOCK_SENIORS.length);

    // Active alerts count must match open + escalated alerts
    const actualActive = MOCK_ALERTS.filter(
      (a) => a.status === "OPEN" || a.status === "ESCALATED"
    ).length;
    expect(metrics.active_alerts_count).toBe(actualActive);

    // Confirms is_mock_data is true
    expect(metrics.is_mock_data).toBe(true);
  });
});

