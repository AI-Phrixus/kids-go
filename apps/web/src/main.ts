import {
  captureRaceWinner,
  createEmptyBoard,
  groupLiberties,
  idx,
  pass,
  pickAiMove,
  tryPlay,
  type BoardState,
  type Color,
} from "../../../packages/go-engine/src/index";
import { api, type LessonDetail } from "./api";
import { nextCareText } from "./care-rituals";
import { friendlyError } from "./errors";
import { EyeCareClock } from "./eyecare";
import { fallbackName, pickLocaleText, t, type Locale } from "./i18n";
import { mascotSvg } from "./mascot";
import { setSfxEnabled, sfx, sfxEnabled } from "./sfx";

type Route = "welcome" | "map" | "lesson" | "free" | "settings" | "parent" | "privacy" | "help";
type FreeMode = "casual" | "race5" | "race10";
type AiLevel = 0 | 1 | 2;

let locale: Locale = (localStorage.getItem("kids-go-locale") as Locale) || "zh-Hant";
let route: Route = "welcome";
let nickname = "";
let lessonId = "L01";
let lesson: LessonDetail | null = null;
let stepIndex = 0;
let board: BoardState = createEmptyBoard(9);
let humanMoves = 0;
let phase: "steps" | "battle" | "done" = "steps";
let statusMsg = "";
let authTab: "quick" | "parent" | "login" = "quick";
let completing = false;
let coachBanner = "";
let lastMove: { x: number; y: number } | null = null;
let freeMode: FreeMode = "casual";
let lessonTotal = 20;
let showLibs = localStorage.getItem("kids-go-libs") === "1";
let freeHistory: BoardState[] = [];
let continueLessonId: string | null = null;
let nextLessonId: string | null = null;
let freeAiLevel: AiLevel = (Number(localStorage.getItem("kids-go-ai") || "1") as AiLevel) || 1;
let coachBusyUntil = 0;
let consecutivePasses = 0;
let boardBusy = false;
let focusCell: { x: number; y: number } | null = null;
let allLessonIds: string[] = [];

const clock = new EyeCareClock({ breakEveryMin: 20, breakSec: 20, dailyCapMin: 60 });
clock.onBreak = () => showBreak(true);
clock.onDailyCap = () => {
  coachBanner = t(locale, "daily_cap");
  showBreak(true);
};

const app = document.querySelector<HTMLDivElement>("#app")!;

function name(): string {
  return nickname || fallbackName(locale);
}

function saveLocale() {
  localStorage.setItem("kids-go-locale", locale);
  document.documentElement.lang = locale === "zh-Hant" ? "zh-Hant" : locale;
}

function errMsg(e: unknown): string {
  const code = e instanceof Error ? e.message : String(e);
  return friendlyError(code, locale);
}

function pushNav(r: Route) {
  try {
    history.pushState({ route: r, lessonId }, "", r === "welcome" ? "/" : `#${r}`);
  } catch {
    /* ignore */
  }
}

window.addEventListener("popstate", () => {
  if (route === "welcome") return;
  if (route === "lesson" || route === "free" || route === "settings" || route === "parent" || route === "privacy" || route === "help") {
    route = "map";
    void renderMap();
  }
});

async function boot() {
  saveLocale();
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
  try {
    const me = await api.me();
    nickname = me.child?.nickname || "";
    if (me.child?.preferred_locale) {
      locale = me.child.preferred_locale as Locale;
      saveLocale();
    }
    route = "map";
    void api.track("session_start");
  } catch {
    route = "welcome";
  }
  render();
}

function render() {
  if (route === "welcome") renderWelcome();
  else if (route === "map") void renderMap();
  else if (route === "lesson") renderLesson();
  else if (route === "free") renderFree();
  else if (route === "settings") void renderSettings();
  else if (route === "parent") void renderParent();
  else if (route === "privacy") renderPrivacy();
  else if (route === "help") renderHelp();
  bindBreak();
}

function shell(body: string) {
  const offlineBar =
    typeof navigator !== "undefined" && navigator.onLine === false
      ? `<p class="banner offline-banner" role="status">${t(locale, "offline")}</p>`
      : "";
  app.innerHTML = `
    <header class="top">
      <div>
        <h1>${t(locale, "title")}</h1>
        <p class="sub">${t(locale, "subtitle")}</p>
      </div>
      <label class="lang">${t(locale, "lang")}
        <select id="locale" aria-label="${t(locale, "lang")}">
          <option value="ja" ${locale === "ja" ? "selected" : ""}>日本語</option>
          <option value="zh-Hant" ${locale === "zh-Hant" ? "selected" : ""}>繁體中文</option>
          <option value="en" ${locale === "en" ? "selected" : ""}>English</option>
        </select>
      </label>
    </header>
    ${offlineBar}
    ${body}
    <div class="overlay hidden" id="break" role="dialog" aria-modal="true" aria-labelledby="care-title">
      <div class="panel">
        <h2 id="care-title">${t(locale, "care_break")}</h2>
        <p id="care-text"></p>
        <div class="countdown" id="countdown" aria-live="polite">20</div>
        <button class="primary" id="care-done" disabled>${t(locale, "care_done")}</button>
      </div>
    </div>
    ${coachBanner ? `<p class="banner muted" role="status">${escapeHtml(coachBanner)}</p>` : ""}
    <p class="footer muted">
      v0.6.0 · <span id="mins">0</span> min · Cloudflare Free
      · <a href="#" id="help-link">${t(locale, "help")}</a>
      · <a href="#" id="privacy-link">${t(locale, "privacy")}</a>
      · <button type="button" class="linkish" id="sfx-toggle" aria-label="SFX">${sfxEnabled() ? "🔊" : "🔇"}</button>
    </p>
  `;
  document.querySelector("#sfx-toggle")?.addEventListener("click", () => {
    setSfxEnabled(!sfxEnabled());
    render();
  });
  document.querySelector("#privacy-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    route = "privacy";
    pushNav("privacy");
    render();
  });
  document.querySelector("#help-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    route = "help";
    pushNav("help");
    render();
  });
  document.querySelector("#locale")?.addEventListener("change", (e) => {
    locale = (e.target as HTMLSelectElement).value as Locale;
    saveLocale();
    void api.saveLocale(locale).catch(() => undefined);
    render();
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindEnterSubmit(btnId: string) {
  app.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        (document.querySelector(`#${btnId}`) as HTMLButtonElement | null)?.click();
      }
    });
  });
}

function renderWelcome() {
  shell(`
    <div class="card welcome-hero">
      <div class="hero-row">${mascotSvg("idle")}
        <div>
          <h2>${t(locale, "welcome")}</h2>
          <p class="muted">${t(locale, "welcome_tag")}</p>
        </div>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="quick" class="${authTab === "quick" ? "on" : ""}" role="tab">${t(locale, "quick_reg")}</button>
        <button data-tab="parent" class="${authTab === "parent" ? "on" : ""}" role="tab">${t(locale, "parent_reg")}</button>
        <button data-tab="login" class="${authTab === "login" ? "on" : ""}" role="tab">${t(locale, "login")}</button>
      </div>
      <div id="auth-form"></div>
      <p class="err" id="err" role="alert"></p>
    </div>
  `);
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      authTab = (b as HTMLElement).dataset.tab as typeof authTab;
      renderWelcome();
    }),
  );
  const form = document.querySelector("#auth-form")!;
  if (authTab === "quick") {
    form.innerHTML = `
      <label>${t(locale, "nickname")}<input id="nick" maxlength="12" autocomplete="username" /></label>
      <label>${t(locale, "pin")}<input id="pin" inputmode="numeric" maxlength="6" autocomplete="current-password" /></label>
      <button class="primary" id="go">${t(locale, "start")}</button>
    `;
    document.querySelector("#go")!.addEventListener("click", async () => {
      const btn = document.querySelector("#go") as HTMLButtonElement;
      btn.disabled = true;
      try {
        const nick = (document.querySelector("#nick") as HTMLInputElement).value.trim();
        const pin = (document.querySelector("#pin") as HTMLInputElement).value.trim();
        if (!nick || !/^\d{4,6}$/.test(pin)) {
          showErr(friendlyError("invalid_input", locale));
          btn.disabled = false;
          return;
        }
        await api.registerQuick({ nickname: nick, pin, locale });
        nickname = nick;
        route = "map";
        pushNav("map");
        render();
      } catch (e) {
        showErr(errMsg(e));
        btn.disabled = false;
      }
    });
    bindEnterSubmit("go");
  } else if (authTab === "parent") {
    form.innerHTML = `
      <label>${t(locale, "email")}<input id="email" type="email" autocomplete="email" /></label>
      <label>${t(locale, "password")}<input id="pass" type="password" autocomplete="new-password" /></label>
      <label>${t(locale, "nickname")}<input id="nick" maxlength="12" /></label>
      <button class="primary" id="go">${t(locale, "start")}</button>
    `;
    document.querySelector("#go")!.addEventListener("click", async () => {
      const btn = document.querySelector("#go") as HTMLButtonElement;
      btn.disabled = true;
      try {
        const email = (document.querySelector("#email") as HTMLInputElement).value.trim();
        const password = (document.querySelector("#pass") as HTMLInputElement).value;
        const nick = (document.querySelector("#nick") as HTMLInputElement).value.trim();
        await api.registerParent({ email, password, childNickname: nick, locale });
        nickname = nick;
        route = "map";
        pushNav("map");
        render();
      } catch (e) {
        showErr(errMsg(e));
        btn.disabled = false;
      }
    });
    bindEnterSubmit("go");
  } else {
    form.innerHTML = `
      <p class="muted">${t(locale, "login_hint")}</p>
      <label>${t(locale, "nickname")} / ${t(locale, "email")}<input id="id" autocomplete="username" /></label>
      <label>${t(locale, "pin")} / ${t(locale, "password")}<input id="secret" type="password" autocomplete="current-password" /></label>
      <div class="row">
        <button id="lq">${t(locale, "quick_reg")} ${t(locale, "login")}</button>
        <button id="lp">${t(locale, "parent_reg")} ${t(locale, "login")}</button>
      </div>
    `;
    document.querySelector("#lq")!.addEventListener("click", async () => {
      try {
        const id = (document.querySelector("#id") as HTMLInputElement).value.trim();
        const secret = (document.querySelector("#secret") as HTMLInputElement).value;
        await api.loginQuick(id, secret);
        const me = await api.me();
        nickname = me.child?.nickname || id;
        route = "map";
        pushNav("map");
        render();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
    document.querySelector("#lp")!.addEventListener("click", async () => {
      try {
        const id = (document.querySelector("#id") as HTMLInputElement).value.trim();
        const secret = (document.querySelector("#secret") as HTMLInputElement).value;
        await api.loginParent(id, secret);
        const me = await api.me();
        nickname = me.child?.nickname || "";
        route = "map";
        pushNav("map");
        render();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
    bindEnterSubmit("lq");
  }
}

function showErr(msg: string) {
  const el = document.querySelector("#err");
  if (el) el.textContent = msg;
}

async function openLesson(id: string) {
  lessonId = id;
  try {
    const res = await api.lesson(lessonId);
    lesson = res.lesson;
    stepIndex = 0;
    phase = "steps";
    humanMoves = 0;
    completing = false;
    statusMsg = "";
    board = setupBoard(lesson);
    lastMove = null;
    nextLessonId = null;
    route = "lesson";
    pushNav("lesson");
    void api.track("lesson_start", { lessonId });
    render();
  } catch (e) {
    alert(errMsg(e));
  }
}

async function renderMap() {
  let lessonsHtml = `<p class="muted">${t(locale, "loading")}</p>`;
  let progressPct = 0;
  let doneCount = 0;
  try {
    const data = await api.lessons();
    nickname = data.child.nickname;
    lessonTotal = data.lessons.length;
    allLessonIds = data.lessons.map((l) => l.id);
    doneCount = data.lessons.filter((l) => l.status === "completed").length;
    progressPct = Math.round((doneCount / Math.max(1, lessonTotal)) * 100);
    const cont = data.lessons.find((l) => l.status === "in_progress" && l.playable);
    continueLessonId =
      cont?.id ?? data.lessons.find((l) => l.status !== "locked" && l.status !== "completed")?.id ?? null;
    lessonsHtml = data.lessons
      .map((l, i) => {
        const title = l.titles[locale] || l.titles.en || l.id;
        const locked = l.status === "locked" || !l.playable;
        const done = l.status === "completed";
        const stars = "★".repeat(l.stars) + "☆".repeat(Math.max(0, 3 - l.stars));
        const cls = locked ? "locked" : done ? "done" : "open";
        return `
          <button class="lesson ${cls}" data-id="${l.id}" ${locked ? "disabled" : ""} aria-label="${escapeHtml(l.id)} ${escapeHtml(title)}">
            <span class="stop">${i + 1}</span>
            <span class="lid">${l.id}</span>
            <span class="lt">${escapeHtml(title)}</span>
            <span class="ls">${locked ? t(locale, "locked") : done ? stars : "▶"}</span>
          </button>`;
      })
      .join("");
  } catch {
    route = "welcome";
    renderWelcome();
    return;
  }

  try {
    const st = await api.coachStatus(locale);
    coachBanner = st.reminder || "";
  } catch {
    coachBanner = "";
  }

  shell(`
    <div class="card">
      <div class="row between">
        <h2>${t(locale, "journey")} · ${escapeHtml(name())}</h2>
        <div class="row">
          <button id="parent">${t(locale, "parent")}</button>
          <button id="settings">${t(locale, "settings")}</button>
          <button id="logout">${t(locale, "logout")}</button>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label">${t(locale, "progress")}: ${doneCount}/${lessonTotal} · ${progressPct}%</div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="row">
        ${continueLessonId ? `<button class="primary" id="continue">${t(locale, "continue_lesson")} ${continueLessonId}</button>` : ""}
        <button id="free">${t(locale, "free")}</button>
      </div>
      <div class="map path" role="list">${lessonsHtml}</div>
    </div>
  `);
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await api.logout();
    route = "welcome";
    render();
  });
  document.querySelector("#settings")?.addEventListener("click", () => {
    route = "settings";
    pushNav("settings");
    render();
  });
  document.querySelector("#parent")?.addEventListener("click", () => {
    route = "parent";
    pushNav("parent");
    render();
  });
  document.querySelector("#free")?.addEventListener("click", () => {
    board = createEmptyBoard(9);
    freeHistory = [];
    humanMoves = 0;
    lastMove = null;
    freeMode = "casual";
    consecutivePasses = 0;
    statusMsg = "";
    boardBusy = false;
    route = "free";
    pushNav("free");
    void api.track("free_play_start", { mode: freeMode });
    render();
  });
  document.querySelector("#continue")?.addEventListener("click", () => {
    if (continueLessonId) void openLesson(continueLessonId);
  });
  document.querySelectorAll(".lesson:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", () => {
      void openLesson((btn as HTMLElement).dataset.id!);
    });
  });
}

/** Apply lesson battle.setup to board (all lessons) */
function setupBoard(l: LessonDetail): BoardState {
  let b = createEmptyBoard(9);
  const setup = l.battle.setup;
  if (setup?.length) {
    const grid = b.grid.slice();
    for (const s of setup) {
      grid[idx(9, s.x, s.y)] = s.color;
    }
    b = { ...b, grid, toPlay: "black" };
  }
  return b;
}

function stepDots(): string {
  if (!lesson || phase !== "steps") return "";
  const total = Math.max(1, lesson.steps.length);
  const cur = Math.min(stepIndex + 1, total);
  const dots = lesson.steps
    .map((_, i) => `<span class="dot ${i < stepIndex ? "done" : i === stepIndex ? "on" : ""}"></span>`)
    .join("");
  return `<div class="step-bar" aria-label="${t(locale, "step_of", { cur, total })}">${dots}<span class="muted step-label">${t(locale, "step_of", { cur, total })}</span></div>`;
}

function renderLesson() {
  if (!lesson) {
    route = "map";
    void renderMap();
    return;
  }
  const title = pickLocaleText(locale, lesson.titles, name());
  let mid = "";
  if (phase === "steps") {
    const step = lesson.steps[stepIndex];
    if (!step || step.type === "story") {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(locale, lesson.story, name())}</p>
        <p class="muted">${pickLocaleText(locale, lesson.goal, name())}</p>
        <button class="primary" id="next">${t(locale, "next")}</button>`;
    } else if (step.type === "info") {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(locale, step.text, name())}</p>
        <button class="primary" id="next">${t(locale, "next")}</button>`;
    } else if (step.type === "tap") {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(locale, step.prompt, name())}</p>
        ${boardHtml(board, true)}
        <p class="bubble" role="status">${escapeHtml(statusMsg)}</p>`;
    }
  } else if (phase === "battle") {
    mid = `
      <h3>${t(locale, "battle")}</h3>
      <p>${pickLocaleText(locale, lesson.goal, name())}</p>
      <label class="check"><input type="checkbox" id="libs" ${showLibs ? "checked" : ""}/> ${t(locale, "show_libs")}</label>
      ${boardHtml(board, true)}
      <div class="row">
        <button id="ask">${t(locale, "ask")}</button>
        <button id="home">${t(locale, "home")}</button>
      </div>
      <p class="bubble" role="status">${escapeHtml(statusMsg)}</p>`;
  } else {
    mid = `
      <div class="win-hero">${mascotSvg("win")}
        <div>
          <h2 class="win">${t(locale, "win")}</h2>
          <p>${escapeHtml(name())} ★★☆ · ${escapeHtml(lesson.badgeId)}</p>
        </div>
      </div>
      <div class="row">
        ${nextLessonId ? `<button class="primary" id="next-lesson">${t(locale, "next_lesson")} ${nextLessonId}</button>` : `<button class="primary" id="home">${t(locale, "home")}</button>`}
        <button id="again">${t(locale, "again")}</button>
        ${nextLessonId ? `<button id="home">${t(locale, "home")}</button>` : ""}
      </div>
      <p class="bubble" role="status">${escapeHtml(statusMsg)}</p>`;
  }

  shell(`
    <div class="card">
      <div class="row between">
        <h2>${lesson.id} · ${escapeHtml(title)}</h2>
        ${phase === "steps" ? mascotSvg("idle") : ""}
      </div>
      ${mid}
    </div>
  `);

  document.querySelector("#next")?.addEventListener("click", () => {
    stepIndex++;
    if (stepIndex >= lesson!.steps.length) {
      phase = "battle";
      board = setupBoard(lesson!);
      lastMove = null;
      humanMoves = 0;
      statusMsg = pickLocaleText(locale, lesson!.goal, name());
    }
    render();
  });
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
  document.querySelector("#next-lesson")?.addEventListener("click", () => {
    if (nextLessonId) void openLesson(nextLessonId);
  });
  document.querySelector("#again")?.addEventListener("click", () => {
    phase = "battle";
    board = setupBoard(lesson!);
    lastMove = null;
    humanMoves = 0;
    completing = false;
    statusMsg = "";
    render();
  });
  document.querySelector("#ask")?.addEventListener("click", () => void askCoach());
  document.querySelector("#libs")?.addEventListener("change", (e) => {
    showLibs = (e.target as HTMLInputElement).checked;
    localStorage.setItem("kids-go-libs", showLibs ? "1" : "0");
    render();
  });
  bindBoardClicks();
  bindBoardKeyboard();
}

function renderFree() {
  const raceLabel =
    freeMode === "race5"
      ? t(locale, "race5")
      : freeMode === "race10"
        ? t(locale, "race10")
        : t(locale, "casual");
  const turn = board.toPlay === "black" ? t(locale, "turn_black") : t(locale, "turn_white");
  shell(`
    <div class="card">
      <div class="row between">
        <h2>${t(locale, "free")}</h2>
        <button id="home">${t(locale, "home")}</button>
      </div>
      <div class="row">
        <button id="mode-casual" class="${freeMode === "casual" ? "primary" : ""}">${t(locale, "casual")}</button>
        <button id="mode-r5" class="${freeMode === "race5" ? "primary" : ""}">${t(locale, "race5")}</button>
        <button id="mode-r10" class="${freeMode === "race10" ? "primary" : ""}">${t(locale, "race10")}</button>
        <button id="pass">${t(locale, "pass")}</button>
        <button id="undo" ${freeHistory.length ? "" : "disabled"}>${t(locale, "undo")}</button>
        <button id="reset">${t(locale, "reset")}</button>
      </div>
      <div class="row">
        <label class="check"><input type="checkbox" id="libs" ${showLibs ? "checked" : ""}/> ${t(locale, "show_libs")}</label>
        <label class="inline">${t(locale, "ai_level")}
          <select id="ai-level">
            <option value="0" ${freeAiLevel === 0 ? "selected" : ""}>${t(locale, "ai_easy")}</option>
            <option value="1" ${freeAiLevel === 1 ? "selected" : ""}>${t(locale, "ai_normal")}</option>
            <option value="2" ${freeAiLevel === 2 ? "selected" : ""}>${t(locale, "ai_hard")}</option>
          </select>
        </label>
      </div>
      <p class="muted">${escapeHtml(raceLabel)} · B${board.captured.black} / W${board.captured.white} · ${turn}</p>
      ${boardHtml(board, !boardBusy)}
      <p class="bubble" role="status">${escapeHtml(statusMsg || t(locale, "free_vs", { name: name() }))}</p>
      <button id="ask">${t(locale, "ask")}</button>
    </div>
  `);
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
  document.querySelector("#ask")?.addEventListener("click", () => void askCoach());
  const resetBoard = (mode: FreeMode, msg: string) => {
    freeMode = mode;
    board = createEmptyBoard(9);
    freeHistory = [];
    lastMove = null;
    consecutivePasses = 0;
    boardBusy = false;
    statusMsg = msg;
    render();
  };
  document.querySelector("#mode-casual")?.addEventListener("click", () => resetBoard("casual", ""));
  document.querySelector("#mode-r5")?.addEventListener("click", () => resetBoard("race5", t(locale, "race5_goal")));
  document.querySelector("#mode-r10")?.addEventListener("click", () => resetBoard("race10", t(locale, "race10_goal")));
  document.querySelector("#pass")?.addEventListener("click", () => {
    if (boardBusy) return;
    freeHistory.push(structuredClone(board));
    if (freeHistory.length > 40) freeHistory.shift();
    board = pass(board);
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      statusMsg = t(locale, "double_pass");
      render();
      return;
    }
    const mv = pickAiMove(board, freeAiLevel);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
        consecutivePasses = 0;
      } else {
        board = pass(board);
        consecutivePasses++;
      }
    } else {
      board = pass(board);
      consecutivePasses++;
    }
    if (consecutivePasses >= 2) statusMsg = t(locale, "double_pass");
    else statusMsg = t(locale, "you_passed");
    render();
  });
  document.querySelector("#undo")?.addEventListener("click", () => {
    const prev = freeHistory.pop();
    if (!prev) return;
    board = prev;
    lastMove = null;
    consecutivePasses = 0;
    statusMsg = t(locale, "undo");
    render();
  });
  document.querySelector("#reset")?.addEventListener("click", () => resetBoard(freeMode, ""));
  document.querySelector("#libs")?.addEventListener("change", (e) => {
    showLibs = (e.target as HTMLInputElement).checked;
    localStorage.setItem("kids-go-libs", showLibs ? "1" : "0");
    render();
  });
  document.querySelector("#ai-level")?.addEventListener("change", (e) => {
    freeAiLevel = Number((e.target as HTMLSelectElement).value) as AiLevel;
    localStorage.setItem("kids-go-ai", String(freeAiLevel));
  });
  bindBoardClicks();
  bindBoardKeyboard();
}

const HOSHI_9 = new Set(["2,2", "2,6", "4,4", "6,2", "6,6"]);

function boardHtml(b: BoardState, interactive: boolean): string {
  const size = b.size;
  const cells = b.grid
    .map((c, i) => {
      const x = i % size;
      const y = Math.floor(i / size);
      const stone = c === "black" ? "black" : c === "white" ? "white" : "";
      const last = lastMove && lastMove.x === x && lastMove.y === y ? " last" : "";
      const hoshi = !c && HOSHI_9.has(`${x},${y}`) ? " hoshi" : "";
      const focused = focusCell && focusCell.x === x && focusCell.y === y ? " focus" : "";
      let libLabel = "";
      if (showLibs && c) {
        const libs = groupLiberties(b, x, y);
        libLabel = `<span class="lib-num">${libs}</span>`;
      }
      const label = c
        ? `${c} ${x + 1},${y + 1}`
        : `empty ${x + 1},${y + 1}`;
      return `<button type="button" class="cell ${stone}${last}${hoshi}${focused}" data-x="${x}" data-y="${y}" aria-label="${label}" ${interactive ? "" : "disabled"}>${libLabel}</button>`;
    })
    .join("");
  return `<div class="board" role="grid" aria-label="Go board 9x9" style="grid-template-columns:repeat(${size},1fr)" tabindex="0">${cells}</div>`;
}

function bindBoardClicks() {
  document.querySelectorAll<HTMLButtonElement>(".cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const x = Number(btn.dataset.x);
      const y = Number(btn.dataset.y);
      focusCell = { x, y };
      onTap(x, y);
    });
  });
}

function bindBoardKeyboard() {
  const boardEl = document.querySelector(".board") as HTMLElement | null;
  if (!boardEl) return;
  if (!focusCell) focusCell = { x: 4, y: 4 };
  boardEl.addEventListener("keydown", (e) => {
    if (!focusCell) focusCell = { x: 4, y: 4 };
    const k = e.key;
    let moved = false;
    if (k === "ArrowLeft") {
      focusCell = { x: Math.max(0, focusCell.x - 1), y: focusCell.y };
      moved = true;
    } else if (k === "ArrowRight") {
      focusCell = { x: Math.min(board.size - 1, focusCell.x + 1), y: focusCell.y };
      moved = true;
    } else if (k === "ArrowUp") {
      focusCell = { x: focusCell.x, y: Math.max(0, focusCell.y - 1) };
      moved = true;
    } else if (k === "ArrowDown") {
      focusCell = { x: focusCell.x, y: Math.min(board.size - 1, focusCell.y + 1) };
      moved = true;
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      onTap(focusCell.x, focusCell.y);
      return;
    }
    if (moved) {
      e.preventDefault();
      document.querySelectorAll(".cell.focus").forEach((el) => el.classList.remove("focus"));
      const cell = document.querySelector(`.cell[data-x="${focusCell.x}"][data-y="${focusCell.y}"]`);
      cell?.classList.add("focus");
      (cell as HTMLElement | null)?.focus();
    }
  });
}

function onTap(x: number, y: number) {
  if (boardBusy) return;
  if (route === "lesson" && phase === "steps" && lesson) {
    const step = lesson.steps[stepIndex];
    if (step?.type === "tap") {
      const ok = step.correct.some(([cx, cy]) => cx === x && cy === y);
      if (ok) {
        sfx.ok();
        statusMsg = t(locale, "correct", { name: name() });
        lastMove = { x, y };
        stepIndex++;
        if (stepIndex >= lesson.steps.length) {
          phase = "battle";
          board = setupBoard(lesson);
          lastMove = null;
          humanMoves = 0;
          statusMsg = pickLocaleText(locale, lesson.goal, name());
        }
        render();
      } else {
        sfx.wrong();
        statusMsg = t(locale, "try_again_quiz");
        render();
      }
      return;
    }
  }

  if (route === "lesson" && phase === "battle" && lesson) {
    handleBattleMove(x, y);
    return;
  }
  if (route === "free") {
    const next = tryPlay(board, x, y);
    if (!next) {
      statusMsg = t(locale, "illegal");
      render();
      return;
    }
    freeHistory.push(structuredClone(board));
    if (freeHistory.length > 40) freeHistory.shift();
    board = next;
    lastMove = { x, y };
    consecutivePasses = 0;
    sfx.place();
    const target = freeMode === "race5" ? 5 : freeMode === "race10" ? 10 : 0;
    let win = target ? captureRaceWinner(board.captured, target) : null;
    if (win === "black") {
      sfx.win();
      void api.track("capture_race_win", { target });
      statusMsg = t(locale, "race_win", { name: name(), n: target });
      render();
      return;
    }
    boardBusy = true;
    const capBefore = board.captured.white;
    const mv = pickAiMove(board, freeAiLevel);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        if (after.captured.white > capBefore) sfx.capture();
        board = after;
        lastMove = { x: mv.x, y: mv.y };
        consecutivePasses = 0;
      }
    }
    boardBusy = false;
    win = target ? captureRaceWinner(board.captured, target) : null;
    if (win === "white") {
      statusMsg = t(locale, "race_lose", { n: target });
    } else if (win === "black") {
      statusMsg = t(locale, "race_win", { name: name(), n: target });
    } else {
      statusMsg = `${name()} · B${board.captured.black}/W${board.captured.white}${target ? ` (${target})` : ""}`;
    }
    render();
  }
}

function handleBattleMove(x: number, y: number) {
  if (!lesson || boardBusy) return;
  const mode = lesson.battle.mode;

  if (mode === "find_atari") {
    const pts = lesson.battle.points ?? [];
    const hit = pts.some(([px, py]) => px === x && py === y);
    if (hit || isAtariTarget(x, y, pts)) {
      lastMove = { x, y };
      void completeLesson(3);
    } else {
      statusMsg = t(locale, "find_atari");
      render();
    }
    return;
  }

  const next = tryPlay(board, x, y);
  if (!next) {
    statusMsg = t(locale, "illegal");
    render();
    return;
  }
  const beforeBlackCap = board.captured.black;
  board = next;
  lastMove = { x, y };
  humanMoves++;
  sfx.place();
  if (board.captured.black > beforeBlackCap) sfx.capture();

  if (mode === "place_n") {
    const need = lesson.battle.n ?? 10;
    boardBusy = true;
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    boardBusy = false;
    statusMsg = t(locale, "place_progress", { cur: humanMoves, need });
    if (humanMoves >= need) {
      void completeLesson(2);
      return;
    }
    render();
    return;
  }

  if (mode === "capture_n") {
    const need = lesson.battle.n ?? 1;
    if (board.captured.black >= need) {
      sfx.capture();
      void completeLesson(3);
      return;
    }
    boardBusy = true;
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    boardBusy = false;
    if (board.captured.black >= need) {
      sfx.capture();
      void completeLesson(3);
      return;
    }
    statusMsg = t(locale, "capture_more", {
      name: name(),
      n: need - board.captured.black,
    });
    render();
  }
}

function isAtariTarget(x: number, y: number, pts: [number, number][]): boolean {
  for (const [px, py] of pts) {
    if (board.grid[idx(board.size, px, py)] !== "white") continue;
    if (groupLiberties(board, px, py) === 1 && x === px && y === py) return true;
  }
  return false;
}

function computeNextLesson(currentId: string): string | null {
  const i = allLessonIds.indexOf(currentId);
  if (i >= 0 && i + 1 < allLessonIds.length) return allLessonIds[i + 1]!;
  // fallback sequential L01..L20
  const m = /^L(\d+)$/.exec(currentId);
  if (m) {
    const n = Number(m[1]) + 1;
    if (n <= 20) return `L${String(n).padStart(2, "0")}`;
  }
  return null;
}

async function completeLesson(stars: number) {
  if (!lesson || completing || phase === "done") return;
  completing = true;
  phase = "done";
  nextLessonId = computeNextLesson(lesson.id);
  render();
  try {
    await api.complete(lesson.id, stars);
    await api.saveGame({
      lessonId: lesson.id,
      boardSize: 9,
      result: "win",
      aiLevel: lesson.battle.aiLevel ?? 0,
      moves: [],
    });
    void api.track("lesson_complete", { lessonId: lesson.id, stars });
    sfx.win();
    try {
      const c = await api.coach({
        tone: "celebrate",
        speaker: "wukong",
        locale,
        childName: name(),
        lessonId: lesson.id,
      });
      statusMsg = c.reminder ? `${c.say} —— ${c.reminder}` : c.say;
    } catch {
      statusMsg = t(locale, "win");
    }
  } catch {
    statusMsg = t(locale, "win");
  }
  completing = false;
  render();
}

async function askCoach() {
  const now = Date.now();
  if (now < coachBusyUntil) {
    statusMsg = t(locale, "coach_wait");
    render();
    return;
  }
  coachBusyUntil = now + 2500;
  try {
    void api.track("coach_hint", { lessonId });
    const c = await api.coach({
      tone: "hint",
      speaker: "wukong",
      locale,
      childName: name(),
      lessonId: lessonId,
      boardSummary: `toPlay=${board.toPlay} capB=${board.captured.black} capW=${board.captured.white}`,
    });
    statusMsg = c.reminder ? `${c.say}\n—— ${c.reminder}` : c.say;
  } catch {
    statusMsg = t(locale, "try_again_quiz");
  }
  render();
}

let breakTimer: number | null = null;

function showBreak(on: boolean) {
  const el = document.querySelector("#break");
  if (!el) return;
  el.classList.toggle("hidden", !on);
  const text = document.querySelector("#care-text");
  if (text) text.textContent = nextCareText(locale, name());
  if (on) {
    clock.pause();
    sfx.break();
    let left = 20;
    const cd = document.querySelector("#countdown");
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
}

function bindBreak() {
  document.querySelector("#care-done")?.addEventListener("click", () => {
    showBreak(false);
    clock.resume();
    void api.track("break_complete");
  });
}

function goHome() {
  if (nickname) {
    route = "map";
    void renderMap();
  } else {
    route = "welcome";
    render();
  }
}

function renderHelp() {
  shell(`
    <div class="card privacy">
      <h2>${t(locale, "help_title")}</h2>
      <p class="story">${t(locale, "help_body")}</p>
      <button class="primary" id="home">${t(locale, "home")}</button>
    </div>
  `);
  document.querySelector("#home")?.addEventListener("click", () => goHome());
}

async function renderParent() {
  let body = `<p class="muted">${t(locale, "loading")}</p>`;
  try {
    const s = await api.parentSummary(locale);
    let usageHtml = "";
    try {
      const u = await api.usageStats();
      usageHtml = `
        <h3>${t(locale, "usage_30d")}</h3>
        <div class="stats">
          <div><strong>${u.summary.sessions}</strong><br/>${t(locale, "sessions")}</div>
          <div><strong>${u.summary.lessonsCompleted}</strong><br/>${t(locale, "lessons_done")}</div>
          <div><strong>${u.summary.eyeBreaks}</strong><br/>${t(locale, "eye_breaks")}</div>
          <div><strong>${u.summary.freePlays}</strong><br/>${t(locale, "free_plays")}</div>
        </div>
        <p class="muted">${t(locale, "breaks_per")}: ${u.summary.breakPerLesson}</p>`;
    } catch {
      usageHtml = "";
    }
    const skills = s.skills
      .map(
        (sk) =>
          `<li><strong>${escapeHtml(sk.lessonId)}</strong> · ${escapeHtml(sk.skill)} · ${"★".repeat(sk.stars)}</li>`,
      )
      .join("");
    const badges = s.badges.length
      ? s.badges.map((b) => `<span class="badge-pill">${escapeHtml(b.name)}</span>`).join(" ")
      : `<span class="muted">—</span>`;
    const tips = s.parentTips.map((t0) => `<li>${escapeHtml(t0)}</li>`).join("");
    const next = s.nextLesson
      ? `${t(locale, "next_stop")}: ${escapeHtml(s.nextLesson.id)} · ${escapeHtml(s.nextLesson.title)}`
      : "";
    body = `
      <p class="story">${escapeHtml(s.headline)}</p>
      <p class="muted">${escapeHtml(s.note)}</p>
      <div class="stats">
        <div><strong>${s.stats.completedCount}/${s.stats.totalLessons}</strong><br/>${t(locale, "progress")}</div>
        <div><strong>${s.stats.totalStars}</strong><br/>${t(locale, "stars")}</div>
        <div><strong>${s.stats.badgeCount}</strong><br/>${t(locale, "badges")}</div>
        <div><strong>${s.stats.percent}%</strong><br/>%</div>
      </div>
      ${usageHtml}
      <h3>${t(locale, "badges")}</h3>
      <div class="badge-row">${badges}</div>
      <h3>${t(locale, "progress")}</h3>
      <ul class="skill-list">${skills || "<li>—</li>"}</ul>
      <p>${escapeHtml(next)}</p>
      <h3>${t(locale, "parent")}</h3>
      <ul>${tips}</ul>
      <div class="row">
        <button class="primary" id="home">${t(locale, "home")}</button>
        <button id="copy-sum">${t(locale, "copy_summary")}</button>
      </div>
      <p class="muted" id="copy-msg" role="status"></p>
    `;
    // stash plain text for copy
    (window as unknown as { __kidsGoParentCopy?: string }).__kidsGoParentCopy = [
      s.headline,
      `${s.stats.completedCount}/${s.stats.totalLessons} · ★${s.stats.totalStars}`,
      s.nextLesson ? `${s.nextLesson.id} ${s.nextLesson.title}` : "",
      ...s.parentTips,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    body = `<p class="err">${escapeHtml(errMsg(e))}</p>
      <button id="home">${t(locale, "home")}</button>`;
  }
  shell(`<div class="card">${body}</div>`);
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
  document.querySelector("#copy-sum")?.addEventListener("click", async () => {
    const text = (window as unknown as { __kidsGoParentCopy?: string }).__kidsGoParentCopy || "";
    const msg = document.querySelector("#copy-msg");
    try {
      await navigator.clipboard.writeText(text);
      if (msg) msg.textContent = t(locale, "copied");
    } catch {
      if (msg) msg.textContent = text.slice(0, 80);
    }
  });
}

function renderPrivacy() {
  const body =
    locale === "zh-Hant"
      ? `<h2>隱私與資料說明</h2>
        <p>本服務「Kids Igo」供家庭學習圍棋使用，部署於 Cloudflare。</p>
        <h3>我們收集什麼</h3>
        <ul>
          <li><strong>帳號</strong>：家長郵箱（可選）或暱稱+PIN；密碼／PIN 僅存雜湊。</li>
          <li><strong>進度</strong>：課通關、星數、徽章、對局摘要。</li>
          <li><strong>使用事件</strong>（近 30 日統計用）：開局、通關、護眼休息、自由對弈、教練提示次數——不含聊天全文。</li>
          <li><strong>AI 設定</strong>：你自願填寫的第三方 Base URL／API Key／Model（Key 回傳只顯示末四位）。</li>
        </ul>
        <h3>我們不做什麼</h3>
        <ul>
          <li>無公開排行榜、無陌生人對戰、不出售個資。</li>
          <li>不強制收集真實姓名、學校、地理位置。</li>
        </ul>
        <h3>AI 與跨境</h3>
        <ul>
          <li>預設優先 Cloudflare Workers AI（免費額）；額度到了才用你設定的第三方或本地句庫。</li>
          <li>若使用第三方 API，請求內容（盤面摘要、暱稱）會送往該供應商，受其隱私政策約束。</li>
        </ul>
        <h3>兒童與家長</h3>
        <ul>
          <li>建議由家長協助註冊與保管 PIN／郵箱。</li>
          <li>「家長摘要」僅供已登入家庭帳號查看該孩子進度。</li>
        </ul>
        <h3>保存與刪除</h3>
        <ul>
          <li>資料保存在你的 Cloudflare 帳戶下 D1；操作者可依 Cloudflare 工具匯出或清除。</li>
          <li>若需刪帳，請聯繫部署者（本專案自建）。</li>
        </ul>`
      : locale === "ja"
        ? `<h2>プライバシー</h2>
        <p>Kids Igo は家庭で囲碁を学ぶためのサービスです（Cloudflare 上）。</p>
        <h3>集めるもの</h3>
        <ul>
          <li><strong>アカウント</strong>：保護者メール（任意）またはなまえ+PIN。パスワード／PIN はハッシュのみ保存。</li>
          <li><strong>進捗</strong>：通関・星・バッジ・対局要約。</li>
          <li><strong>利用イベント</strong>（直近30日）：起動・通関・目休め・自由対局・ヒント回数。会話全文は保存しません。</li>
          <li><strong>AI 設定</strong>：任意の第三者 Base URL／API Key／Model（Key は末尾4桁のみ表示）。</li>
        </ul>
        <h3>しないこと</h3>
        <ul>
          <li>公開ランキング・見知らぬ人との対局・個人情報の販売なし。</li>
          <li>本名・学校・位置情報の強制収集なし。</li>
        </ul>
        <h3>AI</h3>
        <ul>
          <li>優先：Cloudflare Workers AI（無料枠）→ 第三者 BYOK → 定型文。</li>
          <li>第三者 API 利用時は盤面要約・なまえがその規約に従います。</li>
        </ul>
        <h3>お子さまと保護者</h3>
        <ul>
          <li>PIN／メールは保護者と一緒に管理してください。</li>
          <li>保護者まとめはその家庭の進捗のみ。</li>
        </ul>`
        : `<h2>Privacy</h2>
        <p>Kids Igo stores account, progress, and aggregate usage events (lesson clear, eye breaks) in your Cloudflare D1.</p>
        <ul>
          <li>No public leaderboards or stranger matchmaking.</li>
          <li>Optional third-party AI keys stay in your settings (last 4 chars shown).</li>
          <li>Coach: Cloudflare free AI first, then your BYOK, then offline phrases.</li>
          <li>Parents should help manage PIN/email for children.</li>
          <li>We do not sell personal data or force real name/school/location.</li>
        </ul>`;
  shell(
    `<div class="card privacy">${body}<button class="primary" id="home">${t(locale, "home")}</button></div>`,
  );
  document.querySelector("#home")?.addEventListener("click", () => goHome());
}

async function renderSettings() {
  let body = `<p class="muted">${t(locale, "loading")}</p>`;
  try {
    const data = await api.getAiSettings();
    const c = data.config;
    const hint =
      locale === "zh-Hant"
        ? data.hints.zhHant
        : locale === "ja"
          ? data.hints.ja
          : data.hints.en;
    const presets = data.presets
      .map(
        (p) =>
          `<option value="${p.id}" data-url="${escapeHtml(p.baseUrl)}" data-model="${escapeHtml(p.model)}" data-provider="${escapeHtml(p.provider)}">${escapeHtml(p.label)}</option>`,
      )
      .join("");
    body = `
      <p class="muted">${escapeHtml(hint || "")}</p>
      <label>${t(locale, "preset")}
        <select id="preset"><option value="">—</option>${presets}</select>
      </label>
      <label>${t(locale, "provider")}
        <select id="provider">
          <option value="auto" ${c.provider === "auto" ? "selected" : ""}>auto</option>
          <option value="openai_compatible" ${c.provider === "openai_compatible" ? "selected" : ""}>openai_compatible</option>
          <option value="xai" ${c.provider === "xai" ? "selected" : ""}>xai</option>
          <option value="google" ${c.provider === "google" ? "selected" : ""}>google</option>
          <option value="workers_ai" ${c.provider === "workers_ai" ? "selected" : ""}>workers_ai only</option>
          <option value="none" ${c.provider === "none" ? "selected" : ""}>none</option>
        </select>
      </label>
      <label>${t(locale, "base_url")}
        <input id="baseUrl" type="url" placeholder="https://api.x.ai/v1" value="${escapeHtml(c.baseUrl)}" />
      </label>
      <label>${t(locale, "api_key")}
        <input id="apiKey" type="password" autocomplete="off" placeholder="${escapeHtml(c.apiKeyHint || "sk-…")}" />
      </label>
      <label>${t(locale, "model")}
        <input id="model" value="${escapeHtml(c.model)}" />
      </label>
      <label class="check">
        <input type="checkbox" id="preferByok" ${c.preferByok ? "checked" : ""} />
        ${t(locale, "prefer_byok")}
      </label>
      <div class="row">
        <button class="primary" id="saveAi">${t(locale, "save")}</button>
        <button id="testAi">${t(locale, "test_ai")}</button>
        <button id="clearKey">${t(locale, "clear_key")}</button>
        <button id="home">${t(locale, "home")}</button>
      </div>
      <p class="err" id="setMsg" role="status"></p>
    `;
  } catch (e) {
    body = `<p class="err">${escapeHtml(errMsg(e))}</p>
      <button id="home">${t(locale, "home")}</button>`;
  }

  shell(`
    <div class="card">
      <h2>${t(locale, "settings_title")}</h2>
      ${body}
    </div>
  `);

  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
  document.querySelector("#preset")?.addEventListener("change", (e) => {
    const opt = (e.target as HTMLSelectElement).selectedOptions[0];
    if (!opt || !opt.value) return;
    const bu = document.querySelector("#baseUrl") as HTMLInputElement | null;
    const md = document.querySelector("#model") as HTMLInputElement | null;
    const pr = document.querySelector("#provider") as HTMLSelectElement | null;
    if (bu) bu.value = opt.dataset.url || "";
    if (md) md.value = opt.dataset.model || "";
    if (pr) pr.value = opt.dataset.provider || "openai_compatible";
  });
  document.querySelector("#saveAi")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setMsg");
    try {
      await api.saveAiSettings({
        provider: (document.querySelector("#provider") as HTMLSelectElement).value,
        baseUrl: (document.querySelector("#baseUrl") as HTMLInputElement).value.trim(),
        apiKey: (document.querySelector("#apiKey") as HTMLInputElement).value,
        model: (document.querySelector("#model") as HTMLInputElement).value.trim(),
        preferByok: (document.querySelector("#preferByok") as HTMLInputElement).checked,
      });
      if (msg) msg.textContent = t(locale, "saved");
      const k = document.querySelector("#apiKey") as HTMLInputElement | null;
      if (k) k.value = "";
    } catch (err) {
      if (msg) msg.textContent = errMsg(err);
    }
  });
  document.querySelector("#clearKey")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setMsg");
    try {
      await api.saveAiSettings({ clearApiKey: true });
      if (msg) msg.textContent = t(locale, "saved");
    } catch (err) {
      if (msg) msg.textContent = errMsg(err);
    }
  });
  document.querySelector("#testAi")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setMsg");
    if (msg) msg.textContent = t(locale, "testing");
    try {
      const key = (document.querySelector("#apiKey") as HTMLInputElement)?.value;
      if (key) {
        await api.saveAiSettings({
          provider: (document.querySelector("#provider") as HTMLSelectElement).value,
          baseUrl: (document.querySelector("#baseUrl") as HTMLInputElement).value.trim(),
          apiKey: key,
          model: (document.querySelector("#model") as HTMLInputElement).value.trim(),
          preferByok: (document.querySelector("#preferByok") as HTMLInputElement).checked,
        });
      }
      const r = await api.testAiSettings();
      if (msg) msg.textContent = r.ok ? `OK: ${r.sample || "ok"}` : r.error || "fail";
    } catch (err) {
      if (msg) msg.textContent = errMsg(err);
    }
  });
}

setInterval(() => {
  clock.tick();
  const mins = document.querySelector("#mins");
  if (mins) mins.textContent = String(clock.activeMinutes());
}, 1000);

function syncOfflineBanner() {
  const existing = document.querySelector(".offline-banner");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline && !existing) {
    const bar = document.createElement("p");
    bar.className = "banner offline-banner";
    bar.setAttribute("role", "status");
    bar.textContent = t(locale, "offline");
    const header = document.querySelector("header.top");
    header?.insertAdjacentElement("afterend", bar);
  } else if (!offline && existing) {
    existing.remove();
  }
}
window.addEventListener("online", () => syncOfflineBanner());
window.addEventListener("offline", () => syncOfflineBanner());

void (null as unknown as Color);
void boot();
