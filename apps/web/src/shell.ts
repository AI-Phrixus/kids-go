import { api } from "./api";
import { nextCareText } from "./care-rituals";
import { EyeCareClock } from "./eyecare";
import { fallbackName, t } from "./i18n";
import { setSfxEnabled, sfx, sfxEnabled } from "./sfx";
import { skyOrnamentHtml } from "./decor";
import { persist, state } from "./state";
import { APP_VERSION } from "./version";

/**
 * v0.8.0 shell: the chrome (header, tip banner, break overlay, footer,
 * friends modal) renders ONCE at boot and persists. Screens only replace
 * the #screen container. This fixes the v0.7 bug where async screens
 * re-created the DOM after bindBreak() ran, leaving the eye-care overlay's
 * Continue button without a listener (the overlay could not be dismissed).
 */

export const EYECARE_CONFIG = { breakEveryMin: 20, breakSec: 20, dailyCapMin: 60 };

export const clock = new EyeCareClock(EYECARE_CONFIG);

let appEl: HTMLDivElement;
let breakTimer: number | null = null;
let navigateHook: ((route: string) => void) | null = null;

export function onNavigate(fn: (route: string) => void): void {
  navigateHook = fn;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function displayName(): string {
  return state.nickname || fallbackName(state.locale);
}

export function initShell(): void {
  appEl = document.querySelector<HTMLDivElement>("#app")!;
  renderChrome();
  clock.onBreak = () => showBreak();
  clock.onDailyCap = () => {
    setCoachBanner(t(state.locale, "daily_cap"));
    showBreak();
  };
  window.setInterval(() => {
    clock.tick();
    const mins = document.querySelector("#mins");
    if (mins) mins.textContent = String(clock.activeMinutes());
  }, 1000);
  window.addEventListener("online", syncOfflineBanner);
  window.addEventListener("offline", syncOfflineBanner);
}

/** Full chrome render — called at boot and on locale change only. */
export function renderChrome(): void {
  const L = state.locale;
  appEl.innerHTML = `
    ${skyOrnamentHtml()}
    <header class="top">
      <div>
        <h1>${t(L, "title")}</h1>
        <p class="sub">${t(L, "subtitle")}</p>
      </div>
      <label class="lang">${t(L, "lang")}
        <select id="locale" aria-label="${t(L, "lang")}">
          <option value="ja" ${L === "ja" ? "selected" : ""}>日本語</option>
          <option value="zh-Hant" ${L === "zh-Hant" ? "selected" : ""}>繁體中文</option>
          <option value="en" ${L === "en" ? "selected" : ""}>English</option>
        </select>
      </label>
    </header>
    <div id="tip-slot"></div>
    <main id="screen"></main>
    <p class="banner muted hidden" id="coach-banner" role="status"></p>
    <p class="footer muted">
      v${APP_VERSION} · <span id="mins">0</span> min
      · <a href="#" id="help-link">${t(L, "guide")}</a>
      · <a href="#" id="privacy-link">${t(L, "privacy")}</a>
      · <button type="button" class="linkish" id="sfx-toggle" aria-label="SFX">${sfxEnabled() ? "🔊" : "🔇"}</button>
    </p>
    <div class="overlay hidden" id="break" role="dialog" aria-modal="true" aria-labelledby="care-title">
      <div class="panel">
        <h2 id="care-title">${t(L, "care_break")}</h2>
        <p id="care-text"></p>
        <div class="countdown" id="countdown" aria-live="polite">${EYECARE_CONFIG.breakSec}</div>
        <button class="primary" id="care-done" disabled>${t(L, "care_done")}</button>
      </div>
    </div>
    <div class="overlay hidden" id="friends-modal" role="dialog" aria-modal="true">
      <div class="panel friends-panel" id="friends-panel"></div>
    </div>
  `;
  syncOfflineBanner();
  setCoachBanner(state.coachBanner);

  // Chrome listeners — bound exactly once per chrome render.
  document.querySelector("#sfx-toggle")?.addEventListener("click", (e) => {
    setSfxEnabled(!sfxEnabled());
    (e.currentTarget as HTMLElement).textContent = sfxEnabled() ? "🔊" : "🔇";
  });
  document.querySelector("#privacy-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigateHook?.("privacy");
  });
  document.querySelector("#help-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigateHook?.("help");
  });
  document.querySelector("#locale")?.addEventListener("change", (e) => {
    state.locale = (e.target as HTMLSelectElement).value as typeof state.locale;
    persist("locale");
    document.documentElement.lang = state.locale === "zh-Hant" ? "zh-Hant" : state.locale;
    void api.saveLocale(state.locale).catch(() => undefined);
    renderChrome();
    navigateHook?.(state.route);
  });
  // Break overlay: listener lives in the persistent chrome — always works.
  document.querySelector("#care-done")?.addEventListener("click", () => {
    hideBreak();
    clock.resume();
    void api.track("break_complete");
  });
}

export function setScreen(html: string): HTMLElement {
  const screen = document.querySelector<HTMLElement>("#screen")!;
  screen.innerHTML = html;
  renderTipSlot();
  return screen;
}

function renderTipSlot(): void {
  const slot = document.querySelector("#tip-slot");
  if (!slot) return;
  const show = !state.tipDismissed && state.route === "map";
  slot.innerHTML = show
    ? `<div class="tip-banner" role="status">
        <span>${t(state.locale, "tip_first")}</span>
        <span class="tip-actions">
          <a href="#" id="tip-guide">${t(state.locale, "guide")}</a>
          <button type="button" class="linkish" id="tip-dismiss">${t(state.locale, "tip_ok")}</button>
        </span>
      </div>`
    : "";
  slot.querySelector("#tip-dismiss")?.addEventListener("click", () => {
    state.tipDismissed = true;
    persist("tip");
    renderTipSlot();
  });
  slot.querySelector("#tip-guide")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigateHook?.("help");
  });
}

export function setCoachBanner(msg: string): void {
  state.coachBanner = msg;
  const el = document.querySelector("#coach-banner");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

/* ---------------- eye-care break overlay ---------------- */

export function showBreak(): void {
  const el = document.querySelector("#break");
  if (!el) return;
  el.classList.remove("hidden");
  const text = document.querySelector("#care-text");
  if (text) text.textContent = nextCareText(state.locale, displayName());
  clock.pause();
  sfx.break();
  // Countdown reads the configured break length (v0.7 hardcoded 20 here).
  let left = EYECARE_CONFIG.breakSec;
  const cd = document.querySelector("#countdown");
  if (cd) cd.textContent = String(left);
  const done = document.querySelector("#care-done") as HTMLButtonElement | null;
  if (done) done.disabled = true;
  if (breakTimer) window.clearInterval(breakTimer);
  breakTimer = window.setInterval(() => {
    left--;
    if (cd) cd.textContent = String(Math.max(0, left));
    if (left <= 0) {
      if (breakTimer) window.clearInterval(breakTimer);
      if (done) done.disabled = false;
    }
  }, 1000);
}

export function hideBreak(): void {
  document.querySelector("#break")?.classList.add("hidden");
}

/* ---------------- offline banner ---------------- */

function syncOfflineBanner(): void {
  const existing = document.querySelector(".offline-banner");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline && !existing) {
    const bar = document.createElement("p");
    bar.className = "banner offline-banner";
    bar.setAttribute("role", "status");
    bar.textContent = t(state.locale, "offline");
    document.querySelector("header.top")?.insertAdjacentElement("afterend", bar);
  } else if (!offline && existing) {
    existing.remove();
  }
}
