import { describe, it, expect } from "vitest";
import { formatPairingCode, pairingDigits } from "../../../SAHAJ_APP/src/api/mappers";

describe("pairing code input", () => {
  it("keeps only digits, at most six", () => {
    expect(pairingDigits("482 915")).toBe("482915");
    expect(pairingDigits("4-8-2.9a1b5x7")).toBe("482915");
    expect(pairingDigits("")).toBe("");
  });

  it("groups as 3 + 3 for reading out", () => {
    expect(formatPairingCode("482915")).toBe("482 915");
    expect(formatPairingCode("4829")).toBe("482 9");
    expect(formatPairingCode("48")).toBe("48");
    expect(formatPairingCode("482 915 77")).toBe("482 915");
  });
});
