/**
 * Decides when the senior has finished talking, from the microphone level (dB, about -160 quiet to 0 loud).
 * Pure so it can be tested: feed it one reading at a time, it says whether to keep listening or send now.
 */
export interface EndpointOptions {
  /** Silence after speech that ends the answer. */
  silenceMs: number;
  /** Give up and send if nobody speaks for this long (the server then asks again). */
  noSpeechMs: number;
  /** Hard cap on one answer. */
  maxMs: number;
  /** How long at the start is used to measure the room's background noise. */
  calibrateMs: number;
  /** How far above the background noise counts as speech. */
  marginDb: number;
}

export const DEFAULT_ENDPOINT: EndpointOptions = { silenceMs: 5000, noSpeechMs: 9000, maxMs: 20000, calibrateMs: 500, marginDb: 12 };

export type Decision = 'listen' | 'send';

const WINDOW = 30; // about 3 seconds of readings at one every 100 ms
const LOWEST = -100; // Android reports exactly -160 for "no data"; anything this low is not a real reading

export class Endpointer {
  private recent: number[] = [];
  private lastLoudAt: number | null = null;
  constructor(private startedAt: number, private opts: EndpointOptions = DEFAULT_ENDPOINT) {}

  /**
   * Speech is anything clearly above the quietest level of the last few seconds (the room's background noise),
   * kept within sane bounds so a phone's usual hiss (around -50 dB) is never mistaken for talking.
   */
  threshold(): number {
    const floor = this.recent.length ? Math.min(...this.recent) : -60;
    return Math.min(-25, Math.max(-45, floor + this.opts.marginDb));
  }

  update(db: number | undefined, now: number): Decision {
    const elapsed = now - this.startedAt;
    const valid = typeof db === 'number' && Number.isFinite(db) && db > LOWEST;
    if (valid) {
      this.recent.push(db as number);
      if (this.recent.length > WINDOW) this.recent.shift();
    }
    if (elapsed >= this.opts.maxMs) return 'send';
    if (valid && elapsed >= this.opts.calibrateMs && (db as number) > this.threshold()) this.lastLoudAt = now;
    if (this.lastLoudAt !== null) return now - this.lastLoudAt >= this.opts.silenceMs ? 'send' : 'listen';
    return elapsed >= this.opts.noSpeechMs ? 'send' : 'listen';
  }

  get heardSpeech(): boolean {
    return this.lastLoudAt !== null;
  }
}
