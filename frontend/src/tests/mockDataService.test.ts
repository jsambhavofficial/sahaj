import { describe, it, expect, beforeEach } from "vitest";
import { MockDataService } from "../services/mockDataService";

describe("MockDataService", () => {
  let service: MockDataService;

  beforeEach(() => {
    service = new MockDataService();
  });

  describe("listSeniors", () => {
    it("returns all seniors when no filter is provided", async () => {
      const seniors = await service.listSeniors();
      expect(seniors.length).toBeGreaterThan(0);
    });

    it("filters seniors by search string matching ID or name", async () => {
      const result = await service.listSeniors({ search: "S0001" });
      expect(result.length).toBe(1);
      expect(result[0].senior_id).toBe("S0001");
    });

    it("filters seniors by risk level", async () => {
      const urgentSeniors = await service.listSeniors({
        risk_level: "URGENT_REVIEW",
      });
      expect(urgentSeniors.length).toBeGreaterThan(0);
      urgentSeniors.forEach((s) => {
        expect(s.current_risk_level).toBe("URGENT_REVIEW");
      });
    });

    it("sorts seniors by risk score deterministically with null scores at the end", async () => {
      const sortedDesc = await service.listSeniors({
        sort_by: "risk_score",
        sort_direction: "desc",
      });
      // Top score should be >= second score
      expect(sortedDesc[0].current_risk_score).toBeGreaterThanOrEqual(
        sortedDesc[1].current_risk_score!
      );

      // Last item should be the one with null score
      const last = sortedDesc[sortedDesc.length - 1];
      expect(last.current_risk_score).toBeNull();
    });
  });

  describe("getSeniorById", () => {
    it("returns complete profile for valid senior ID", async () => {
      const profile = await service.getSeniorById("S0001");
      expect(profile).not.toBeNull();
      expect(profile?.senior_id).toBe("S0001");
      expect(profile?.risk_history.length).toBeGreaterThan(0);
      expect(profile?.recent_vitals.length).toBeGreaterThan(0);
    });

    it("returns null for unknown senior ID without crashing", async () => {
      const profile = await service.getSeniorById("S9999");
      expect(profile).toBeNull();
    });
  });

  describe("getSeniorRiskHistory", () => {
    it("returns date-filtered history", async () => {
      const history = await service.getSeniorRiskHistory(
        "S0001",
        "2026-03-28",
        "2026-03-30"
      );
      expect(history.length).toBe(3);
      history.forEach((h) => {
        expect(h.date >= "2026-03-28").toBe(true);
        expect(h.date <= "2026-03-30").toBe(true);
      });
    });

    it("returns empty array for unknown senior ID", async () => {
      const history = await service.getSeniorRiskHistory("S9999");
      expect(history).toEqual([]);
    });
  });

  describe("listAlerts", () => {
    it("filters alerts by status", async () => {
      const openAlerts = await service.listAlerts({ status: "OPEN" });
      expect(openAlerts.length).toBeGreaterThan(0);
      openAlerts.forEach((a) => {
        expect(a.status).toBe("OPEN");
      });
    });

    it("filters alerts by severity", async () => {
      const urgentAlerts = await service.listAlerts({
        severity: "URGENT_REVIEW",
      });
      expect(urgentAlerts.length).toBeGreaterThan(0);
      urgentAlerts.forEach((a) => {
        expect(a.severity).toBe("URGENT_REVIEW");
      });
    });
  });

  describe("Alert Lifecycle Actions", () => {
    it("acknowledges an alert without resolving it", async () => {
      const initialMetrics = await service.getDashboardMetrics();
      const openAlerts = await service.listAlerts({ status: "OPEN" });
      const targetAlert = openAlerts[0];

      const acknowledged = await service.acknowledgeAlert(
        targetAlert.alert_id,
        "COORD_001",
        "Call initiated with senior"
      );

      expect(acknowledged.status).toBe("ACKNOWLEDGED");
      expect(acknowledged.acknowledgement_notes).toContain("Call initiated");

      // Verify that acknowledging DID NOT resolve the alert
      expect(acknowledged.resolution_reason).toBeNull();

      // Check updated dashboard metrics
      const updatedMetrics = await service.getDashboardMetrics();
      expect(updatedMetrics.acknowledged_alerts_count).toBe(
        initialMetrics.acknowledged_alerts_count + 1
      );
      expect(updatedMetrics.active_alerts_count).toBe(
        initialMetrics.active_alerts_count - 1
      );
    });

    it("resolves an alert and updates senior active alert count", async () => {
      const initialMetrics = await service.getDashboardMetrics();
      const openAlerts = await service.listAlerts({ status: "OPEN" });
      const targetAlert = openAlerts[0];

      const resolved = await service.resolveAlert(
        targetAlert.alert_id,
        "COORD_001",
        "Clinical review concluded no acute fracture or distress."
      );

      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolution_reason).toContain("Clinical review concluded");

      // Check updated metrics
      const updatedMetrics = await service.getDashboardMetrics();
      expect(updatedMetrics.resolved_alerts_count).toBe(
        initialMetrics.resolved_alerts_count + 1
      );
    });

    it("throws a descriptive error when acknowledging unknown alert ID", async () => {
      await expect(
        service.acknowledgeAlert("ALT_UNKNOWN", "COORD_001")
      ).rejects.toThrow("Alert with ID ALT_UNKNOWN not found");
    });
  });
});
