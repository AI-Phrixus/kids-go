/** Active screen timer + break overlay hooks (no network). */

export type EyeCareSettings = {
  breakEveryMin: number;
  breakSec: number;
  dailyCapMin: number;
};

const DEFAULTS: EyeCareSettings = {
  breakEveryMin: 20,
  breakSec: 20,
  dailyCapMin: 60,
};

export class EyeCareClock {
  settings: EyeCareSettings;
  activeMs = 0;
  private last = Date.now();
  private running = true;
  onBreak: (() => void) | null = null;
  /** Fired once when daily soft cap is reached */
  onDailyCap: (() => void) | null = null;
  private brokeAt = 0;
  private dailyFired = false;
  private dayKey = EyeCareClock.todayKey();

  constructor(settings: Partial<EyeCareSettings> = {}) {
    this.settings = { ...DEFAULTS, ...settings };
    this.loadToday();
  }

  private static todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private storageKey(): string {
    return `kids-go-eye-ms-${this.dayKey}`;
  }

  private breakStorageKey(): string {
    return `kids-go-eye-break-ms-${this.dayKey}`;
  }

  private loadToday(): void {
    this.dayKey = EyeCareClock.todayKey();
    const raw = localStorage.getItem(this.storageKey());
    this.activeMs = raw ? Number(raw) || 0 : 0;
    const breakRaw = localStorage.getItem(this.breakStorageKey());
    this.brokeAt = breakRaw ? Number(breakRaw) || 0 : 0;
    this.dailyFired = this.activeMs >= this.settings.dailyCapMin * 60_000;
  }

  private persist(): void {
    localStorage.setItem(this.storageKey(), String(this.activeMs));
  }

  tick(): void {
    if (EyeCareClock.todayKey() !== this.dayKey) {
      this.loadToday();
      this.brokeAt = 0;
    }
    if (!this.running) {
      this.last = Date.now();
      return;
    }
    const now = Date.now();
    this.activeMs += now - this.last;
    this.last = now;
    this.persist();
    const every = this.settings.breakEveryMin * 60 * 1000;
    if (this.activeMs - this.brokeAt >= every) {
      this.brokeAt = this.activeMs;
      localStorage.setItem(this.breakStorageKey(), String(this.brokeAt));
      this.running = false;
      this.onBreak?.();
    }
    const capMs = this.settings.dailyCapMin * 60 * 1000;
    if (!this.dailyFired && this.activeMs >= capMs) {
      this.dailyFired = true;
      this.onDailyCap?.();
    }
  }

  resume(): void {
    this.running = true;
    this.last = Date.now();
  }

  pause(): void {
    this.running = false;
    this.last = Date.now();
    this.persist();
  }

  activeMinutes(): number {
    return Math.floor(this.activeMs / 60000);
  }

  dailyCapReached(): boolean {
    return this.activeMs >= this.settings.dailyCapMin * 60_000;
  }
}
