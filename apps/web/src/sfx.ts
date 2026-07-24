/** Tiny Web Audio SFX — no external assets */

let ctx: AudioContext | null = null;
let enabled = localStorage.getItem("kids-go-sfx") !== "0";

function ac(): AudioContext | null {
  if (!enabled || typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function sfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  localStorage.setItem("kids-go-sfx", on ? "1" : "0");
}

function beep(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.08) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime;
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  place: () => beep(320, 0.06, "triangle", 0.06),
  capture: () => {
    beep(220, 0.05, "square", 0.05);
    setTimeout(() => beep(440, 0.08, "sine", 0.07), 40);
  },
  win: () => {
    beep(523, 0.1);
    setTimeout(() => beep(659, 0.1), 90);
    setTimeout(() => beep(784, 0.15), 180);
  },
  wrong: () => beep(160, 0.12, "sawtooth", 0.04),
  ok: () => beep(600, 0.07, "sine", 0.06),
  break: () => beep(400, 0.15, "sine", 0.05),
};
