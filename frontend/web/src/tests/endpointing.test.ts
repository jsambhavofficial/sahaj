import { describe, it, expect } from "vitest";
import { Endpointer, DEFAULT_ENDPOINT } from "../../../SAHAJ_APP/src/voice/endpointing";

// feed readings every 100 ms: [dB, ...]
function run(readings: number[], opts = DEFAULT_ENDPOINT) {
  const e = new Endpointer(0, opts);
  let t = 0;
  for (const db of readings) {
    t += 100;
    if (e.update(db, t) === "send") return { sentAt: t, heard: e.heardSpeech };
  }
  return { sentAt: null, heard: e.heardSpeech };
}
const quiet = (n: number) => Array(n).fill(-58);
const loud = (n: number) => Array(n).fill(-20);

describe("endpointing", () => {
  it("keeps listening while someone talks and sends after the pause", () => {
    const r = run([...quiet(6), ...loud(20), ...quiet(80)]);
    expect(r.heard).toBe(true);
    // speech ends at reading 26 (2.6 s); 5 s of silence later
    expect(r.sentAt).toBeGreaterThanOrEqual(7500);
    expect(r.sentAt).toBeLessThanOrEqual(7700);
  });

  it("does not send during a short pause inside the answer", () => {
    const r = run([...quiet(6), ...loud(10), ...quiet(30), ...loud(10), ...quiet(5)]);
    expect(r.sentAt).toBeNull();
  });

  it("gives up after a long silence so the server can ask again", () => {
    const r = run(quiet(120));
    expect(r.heard).toBe(false);
    expect(r.sentAt).toBe(9000);
  });

  it("adapts to a noisy room: steady background hum is not speech", () => {
    const hum = Array(120).fill(-35); // loud room, but constant
    const r = run(hum);
    expect(r.heard).toBe(false);
  });

  it("regression: a phone's usual hiss (-48 dB) after the speech is silence, and -160 placeholders are ignored", () => {
    const r = run([-160, -160, ...Array(5).fill(-48), ...loud(20), ...Array(80).fill(-48)]);
    expect(r.heard).toBe(true);
    expect(r.sentAt).not.toBeNull();
    expect(r.sentAt as number).toBeLessThanOrEqual(7700 + 100);
  });

  it("caps one answer at the maximum length", () => {
    const r = run(loud(300));
    expect(r.sentAt).toBe(20000);
  });

  it("ignores missing readings", () => {
    const e = new Endpointer(0);
    expect(e.update(undefined, 100)).toBe("listen");
    expect(e.update(NaN, 200)).toBe("listen");
  });
});
