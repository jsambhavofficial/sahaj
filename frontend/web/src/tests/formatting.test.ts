import { describe, it, expect } from "vitest";
import {
  formatRiskLevel,
  getRiskBadgeClasses,
  formatAlertStatus,
  getAlertStatusClasses,
  formatScore,
  formatDate,
  formatCity,
} from "../lib/formatting";

describe("Formatting Utilities", () => {
  describe("formatRiskLevel", () => {
    it("formats known risk levels correctly", () => {
      expect(formatRiskLevel("LOW")).toBe("Low Risk");
      expect(formatRiskLevel("MODERATE")).toBe("Moderate Risk");
      expect(formatRiskLevel("HIGH")).toBe("High Risk");
      expect(formatRiskLevel("URGENT_REVIEW")).toBe("Urgent Review");
    });

    it("handles null and undefined gracefully", () => {
      expect(formatRiskLevel(null)).toBe("Unknown");
      expect(formatRiskLevel(undefined)).toBe("Unknown");
    });
  });

  describe("getRiskBadgeClasses", () => {
    it("returns appropriate color tokens with readable contrast", () => {
      const low = getRiskBadgeClasses("LOW");
      expect(low.bg).toContain("emerald");
      expect(low.text).toContain("emerald");

      const urgent = getRiskBadgeClasses("URGENT_REVIEW");
      expect(urgent.bg).toContain("red");
      expect(urgent.text).toContain("red");
    });
  });

  describe("formatScore", () => {
    it("formats valid scores into rounded numbers", () => {
      expect(formatScore(68.4)).toBe("68");
      expect(formatScore(100)).toBe("100");
      expect(formatScore(0)).toBe("0");
    });

    it("does NOT convert null, undefined, or NaN to 0", () => {
      expect(formatScore(null)).toBe("N/A");
      expect(formatScore(undefined)).toBe("N/A");
      expect(formatScore(NaN)).toBe("N/A");
    });
  });

  describe("formatAlertStatus", () => {
    it("maps internal status enum to coordinator friendly labels", () => {
      expect(formatAlertStatus("OPEN")).toBe("Active");
      expect(formatAlertStatus("ACKNOWLEDGED")).toBe("Acknowledged");
      expect(formatAlertStatus("ESCALATED")).toBe("Escalated");
      expect(formatAlertStatus("RESOLVED")).toBe("Resolved");
      expect(formatAlertStatus(null)).toBe("Unknown");
    });
  });

  describe("formatDate and formatCity", () => {
    it("formats dates safely without throwing", () => {
      expect(formatDate(null)).toBe("N/A");
      expect(formatDate("2026-03-31")).toBeDefined();
    });

    it("formats city prefixes cleanly", () => {
      expect(formatCity("CITY_DELHI")).toBe("Delhi");
      expect(formatCity("CITY_CHANDIGARH")).toBe("Chandigarh");
      expect(formatCity(null)).toBe("Unknown");
    });
  });
});

