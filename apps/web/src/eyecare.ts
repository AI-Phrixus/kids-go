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
  private brokeAt = 0;

  constructor(settings: Partial<EyeCareSettings> = {}) {
    this.settings = { ...DEFAULTS, ...settings };
  }

  tick(): void {
    if (!this.running) {
      this.last = Date.now();
      return;
    }
    const now = Date.now();
    this.activeMs += now - this.last;
    this.last = now;
    const every = this.settings.breakEveryMin * 60 * 1000;
    if (this.activeMs - this.brokeAt >= every) {
      this.brokeAt = this.activeMs;
      this.running = false;
      this.onBreak?.();
    }
  }

  resume(): void {
    this.running = true;
    this.last = Date.now();
  }

  pause(): void {
    this.running = false;
    this.last = Date.now();
  }

  activeMinutes(): number {
    return Math.floor(this.activeMs / 60000);
  }
}
