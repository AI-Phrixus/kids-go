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

type Route = "welcome" | "map" | "lesson" | "free" | "settings" | "parent" | "privacy";
type FreeMode = "casual" | "race5" | "race10";

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

async function boot() {
  saveLocale();
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
  bindBreak();
}

function shell(body: string) {
  app.innerHTML = `
    <header class="top">
      <div>
        <h1>${t(locale, "title")}</h1>
        <p class="sub">${t(locale, "subtitle")}</p>
      </div>
      <label class="lang">${t(locale, "lang")}
        <select id="locale">
          <option value="ja" ${locale === "ja" ? "selected" : ""}>日本語</option>
          <option value="zh-Hant" ${locale === "zh-Hant" ? "selected" : ""}>繁體中文</option>
          <option value="en" ${locale === "en" ? "selected" : ""}>English</option>
        </select>
      </label>
    </header>
    ${body}
    <div class="overlay hidden" id="break">
      <div class="panel">
        <h2>${t(locale, "care_break")}</h2>
        <p id="care-text"></p>
        <div class="countdown" id="countdown">20</div>
        <button class="primary" id="care-done" disabled>${t(locale, "care_done")}</button>
      </div>
    </div>
    ${coachBanner ? `<p class="banner muted">${escapeHtml(coachBanner)}</p>` : ""}
    <p class="footer muted">
      v0.5.0 · <span id="mins">0</span> min · Cloudflare Free
      · <a href="#" id="privacy-link">${t(locale, "privacy")}</a>
      · <button type="button" class="linkish" id="sfx-toggle">${sfxEnabled() ? "🔊" : "🔇"}</button>
    </p>
  `;
  document.querySelector("#sfx-toggle")?.addEventListener("click", () => {
    setSfxEnabled(!sfxEnabled());
    render();
  });
  document.querySelector("#privacy-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    route = "privacy";
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

function renderWelcome() {
  shell(`
    <div class="card welcome-hero">
      <div class="hero-row">${mascotSvg("idle")}
        <div>
          <h2>${t(locale, "welcome")}</h2>
          <p class="muted">${locale === "zh-Hant" ? "跟著悟空學圍棋 · 金角銀邊草肚皮" : "Learn Go with Wukong"}</p>
        </div>
      </div>
      <div class="tabs">
        <button data-tab="quick" class="${authTab === "quick" ? "on" : ""}">${t(locale, "quick_reg")}</button>
        <button data-tab="parent" class="${authTab === "parent" ? "on" : ""}">${t(locale, "parent_reg")}</button>
        <button data-tab="login" class="${authTab === "login" ? "on" : ""}">${t(locale, "login")}</button>
      </div>
      <div id="auth-form"></div>
      <p class="err" id="err"></p>
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
      <label>${t(locale, "nickname")}<input id="nick" maxlength="12" /></label>
      <label>${t(locale, "pin")}<input id="pin" inputmode="numeric" maxlength="6" /></label>
      <button class="primary" id="go">${t(locale, "start")}</button>
    `;
    document.querySelector("#go")!.addEventListener("click", async () => {
      try {
        const nick = (document.querySelector("#nick") as HTMLInputElement).value.trim();
        const pin = (document.querySelector("#pin") as HTMLInputElement).value.trim();
        await api.registerQuick({ nickname: nick, pin, locale });
        nickname = nick;
        route = "map";
        render();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
  } else if (authTab === "parent") {
    form.innerHTML = `
      <label>${t(locale, "email")}<input id="email" type="email" /></label>
      <label>${t(locale, "password")}<input id="pass" type="password" /></label>
      <label>${t(locale, "nickname")}<input id="nick" maxlength="12" /></label>
      <button class="primary" id="go">${t(locale, "start")}</button>
    `;
    document.querySelector("#go")!.addEventListener("click", async () => {
      try {
        const email = (document.querySelector("#email") as HTMLInputElement).value.trim();
        const password = (document.querySelector("#pass") as HTMLInputElement).value;
        const nick = (document.querySelector("#nick") as HTMLInputElement).value.trim();
        await api.registerParent({ email, password, childNickname: nick, locale });
        nickname = nick;
        route = "map";
        render();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
  } else {
    form.innerHTML = `
      <p class="muted">Quick / Parent</p>
      <label>${t(locale, "nickname")} / ${t(locale, "email")}<input id="id" /></label>
      <label>${t(locale, "pin")} / ${t(locale, "password")}<input id="secret" /></label>
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
        render();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
  }
}

function showErr(msg: string) {
  const el = document.querySelector("#err");
  if (el) el.textContent = msg;
}

async function renderMap() {
  let lessonsHtml = `<p class="muted">…</p>`;
  let progressPct = 0;
  let doneCount = 0;
  try {
    const data = await api.lessons();
    nickname = data.child.nickname;
    lessonTotal = data.lessons.length;
    doneCount = data.lessons.filter((l) => l.status === "completed").length;
    progressPct = Math.round((doneCount / Math.max(1, lessonTotal)) * 100);
    const cont = data.lessons.find((l) => l.status === "in_progress" && l.playable);
    continueLessonId = cont?.id ?? data.lessons.find((l) => l.status !== "locked" && l.status !== "completed")?.id ?? null;
    lessonsHtml = data.lessons
      .map((l, i) => {
        const title = l.titles[locale] || l.titles.en || l.id;
        const locked = l.status === "locked" || !l.playable;
        const done = l.status === "completed";
        const stars = "★".repeat(l.stars) + "☆".repeat(Math.max(0, 3 - l.stars));
        const cls = locked ? "locked" : done ? "done" : "open";
        return `
          <button class="lesson ${cls}" data-id="${l.id}" ${locked ? "disabled" : ""}>
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
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="row">
        ${continueLessonId ? `<button class="primary" id="continue">${t(locale, "continue_lesson")} ${continueLessonId}</button>` : ""}
        <button id="free">${t(locale, "free")}</button>
      </div>
      <div class="map path">${lessonsHtml}</div>
    </div>
  `);
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await api.logout();
    route = "welcome";
    render();
  });
  document.querySelector("#settings")?.addEventListener("click", () => {
    route = "settings";
    render();
  });
  document.querySelector("#parent")?.addEventListener("click", () => {
    route = "parent";
    render();
  });
  document.querySelector("#free")?.addEventListener("click", () => {
    board = createEmptyBoard(9);
    freeHistory = [];
    humanMoves = 0;
    lastMove = null;
    freeMode = "casual";
    statusMsg = "";
    route = "free";
    void api.track("free_play_start", { mode: freeMode });
    render();
  });
  document.querySelector("#continue")?.addEventListener("click", async () => {
    if (!continueLessonId) return;
    lessonId = continueLessonId;
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
      route = "lesson";
      void api.track("lesson_start", { lessonId });
      render();
    } catch (e) {
      alert(errMsg(e));
    }
  });
  document.querySelectorAll(".lesson:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", async () => {
      lessonId = (btn as HTMLElement).dataset.id!;
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
        route = "lesson";
        void api.track("lesson_start", { lessonId });
        render();
      } catch (e) {
        statusMsg = String((e as Error).message);
        alert(statusMsg);
      }
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
        <p class="story">${pickLocaleText(locale, lesson.story, name())}</p>
        <p class="muted">${pickLocaleText(locale, lesson.goal, name())}</p>
        <button class="primary" id="next">${t(locale, "next")}</button>`;
    } else if (step.type === "info") {
      mid = `
        <p class="story">${pickLocaleText(locale, step.text, name())}</p>
        <button class="primary" id="next">${t(locale, "next")}</button>`;
    } else if (step.type === "tap") {
      mid = `
        <p class="story">${pickLocaleText(locale, step.prompt, name())}</p>
        ${boardHtml(board, true)}
        <p class="bubble">${escapeHtml(statusMsg)}</p>`;
    }
  } else if (phase === "battle") {
    mid = `
      <h3>${t(locale, "battle")}</h3>
      <p>${pickLocaleText(locale, lesson.goal, name())}</p>
      ${boardHtml(board, true)}
      <div class="row">
        <button id="ask">${t(locale, "ask")}</button>
        <button id="home">${t(locale, "home")}</button>
      </div>
      <p class="bubble">${escapeHtml(statusMsg)}</p>`;
  } else {
    mid = `
      <div class="win-hero">${mascotSvg("win")}
        <div>
          <h2 class="win">${t(locale, "win")}</h2>
          <p>${escapeHtml(name())} ★★☆ · ${escapeHtml(lesson.badgeId)}</p>
        </div>
      </div>
      <div class="row">
        <button class="primary" id="home">${t(locale, "home")}</button>
        <button id="again">${t(locale, "again")}</button>
      </div>
      <p class="bubble">${escapeHtml(statusMsg)}</p>`;
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
  bindBoardClicks();
}

function renderFree() {
  const raceLabel =
    freeMode === "race5"
      ? locale === "zh-Hant"
        ? "吃子賽 · 先吃 5 子"
        : "Capture race · first to 5"
      : freeMode === "race10"
        ? locale === "zh-Hant"
          ? "吃子賽 · 先吃 10 子"
          : "Capture race · first to 10"
        : locale === "zh-Hant"
          ? "隨意對弈"
          : "Casual";
  shell(`
    <div class="card">
      <div class="row between">
        <h2>${t(locale, "free")}</h2>
        <button id="home">${t(locale, "home")}</button>
      </div>
      <div class="row">
        <button id="mode-casual" class="${freeMode === "casual" ? "primary" : ""}">${locale === "zh-Hant" ? "隨意" : "Casual"}</button>
        <button id="mode-r5" class="${freeMode === "race5" ? "primary" : ""}">${locale === "zh-Hant" ? "先吃5" : "Race5"}</button>
        <button id="mode-r10" class="${freeMode === "race10" ? "primary" : ""}">${locale === "zh-Hant" ? "先吃10" : "Race10"}</button>
        <button id="pass">${locale === "zh-Hant" ? "停一手" : "Pass"}</button>
        <button id="undo" ${freeHistory.length ? "" : "disabled"}>${t(locale, "undo")}</button>
        <button id="reset">${locale === "zh-Hant" ? "重來" : "Reset"}</button>
        <label class="check"><input type="checkbox" id="libs" ${showLibs ? "checked" : ""}/> ${t(locale, "show_libs")}</label>
      </div>
      <p class="muted">${escapeHtml(raceLabel)} · B${board.captured.black} / W${board.captured.white} · ${board.toPlay === "black" ? "●" : "○"}</p>
      ${boardHtml(board, true)}
      <p class="bubble">${escapeHtml(statusMsg || `${name()} vs AI`)}</p>
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
    statusMsg = msg;
    render();
  };
  document.querySelector("#mode-casual")?.addEventListener("click", () => resetBoard("casual", ""));
  document.querySelector("#mode-r5")?.addEventListener("click", () =>
    resetBoard("race5", locale === "zh-Hant" ? "先吃滿 5 子獲勝！" : "First to 5 captures wins!"),
  );
  document.querySelector("#mode-r10")?.addEventListener("click", () =>
    resetBoard("race10", locale === "zh-Hant" ? "先吃滿 10 子獲勝！" : "First to 10 captures wins!"),
  );
  document.querySelector("#pass")?.addEventListener("click", () => {
    freeHistory.push(structuredClone(board));
    board = pass(board);
    const mv = pickAiMove(board, 1);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    statusMsg = locale === "zh-Hant" ? "你停了一手，AI 繼續下。" : "You passed; AI moved.";
    render();
  });
  document.querySelector("#undo")?.addEventListener("click", () => {
    const prev = freeHistory.pop();
    if (!prev) return;
    board = prev;
    lastMove = null;
    statusMsg = t(locale, "undo");
    render();
  });
  document.querySelector("#reset")?.addEventListener("click", () => resetBoard(freeMode, ""));
  document.querySelector("#libs")?.addEventListener("change", (e) => {
    showLibs = (e.target as HTMLInputElement).checked;
    localStorage.setItem("kids-go-libs", showLibs ? "1" : "0");
    render();
  });
  bindBoardClicks();
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
      let libLabel = "";
      if (showLibs && c) {
        const libs = groupLiberties(b, x, y);
        libLabel = `<span class="lib-num">${libs}</span>`;
      }
      return `<button class="cell ${stone}${last}${hoshi}" data-x="${x}" data-y="${y}" ${interactive ? "" : "disabled"}>${libLabel}</button>`;
    })
    .join("");
  return `<div class="board" style="grid-template-columns:repeat(${size},1fr)">${cells}</div>`;
}

function bindBoardClicks() {
  document.querySelectorAll<HTMLButtonElement>(".cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const x = Number(btn.dataset.x);
      const y = Number(btn.dataset.y);
      onTap(x, y);
    });
  });
}

function onTap(x: number, y: number) {
  if (route === "lesson" && phase === "steps" && lesson) {
    const step = lesson.steps[stepIndex];
    if (step?.type === "tap") {
      const ok = step.correct.some(([cx, cy]) => cx === x && cy === y);
      if (ok) {
        sfx.ok();
        statusMsg =
          locale === "zh-Hant"
            ? `${name()}，答對了！`
            : locale === "ja"
              ? `${name()}、せいかい！`
              : `${name()}, correct!`;
        // Quiz taps only highlight — do NOT tryPlay (would flip toPlay and break multi-step quizzes)
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
        statusMsg =
          locale === "zh-Hant"
            ? "再找找看～想想口訣或數一數氣。"
            : locale === "ja"
              ? "もういちど！気を数えよう。"
              : "Try again — count liberties or recall the proverb!";
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
    if (!next) return;
    freeHistory.push(structuredClone(board));
    if (freeHistory.length > 40) freeHistory.shift();
    board = next;
    lastMove = { x, y };
    sfx.place();
    const target = freeMode === "race5" ? 5 : freeMode === "race10" ? 10 : 0;
    let win = target ? captureRaceWinner(board.captured, target) : null;
    if (win === "black") {
      sfx.win();
      void api.track("capture_race_win", { target });
      statusMsg =
        locale === "zh-Hant" ? `${name()} 獲勝！先吃滿 ${target} 子！` : `${name()} wins! First to ${target}!`;
      render();
      return;
    }
    const mv = pickAiMove(board, 1);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    win = target ? captureRaceWinner(board.captured, target) : null;
    if (win === "white") {
      statusMsg =
        locale === "zh-Hant" ? `AI 先吃滿 ${target} 子。再試一次！` : `AI reached ${target}. Try again!`;
    } else if (win === "black") {
      statusMsg =
        locale === "zh-Hant" ? `${name()} 獲勝！` : `${name()} wins!`;
    } else {
      statusMsg = `${name()} · B${board.captured.black}/W${board.captured.white}${target ? ` (目標${target})` : ""}`;
    }
    render();
  }
}

function handleBattleMove(x: number, y: number) {
  if (!lesson) return;
  const mode = lesson.battle.mode;

  if (mode === "find_atari") {
    const pts = lesson.battle.points ?? [];
    const hit = pts.some(([px, py]) => px === x && py === y);
    if (hit || isAtariTarget(x, y, pts)) {
      lastMove = { x, y };
      void completeLesson(3);
    } else {
      statusMsg =
        locale === "zh-Hant" ? "找只剩 1 氣的白子～" : "Find the atari stone!";
      render();
    }
    return;
  }

  const next = tryPlay(board, x, y);
  if (!next) {
    statusMsg = locale === "zh-Hant" ? "這裡不能下" : "Illegal move";
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
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    statusMsg = `${humanMoves}/${need}`;
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
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
    }
    if (board.captured.black >= need) {
      sfx.capture();
      void completeLesson(3);
      return;
    }
    statusMsg =
      locale === "zh-Hant"
        ? `${name()}，再吃 ${need - board.captured.black} 子！`
        : `${name()}, capture ${need - board.captured.black} more!`;
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

async function completeLesson(stars: number) {
  if (!lesson || completing || phase === "done") return;
  completing = true;
  phase = "done";
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
  try {
    void api.track("coach_hint", { lessonId });
    const c = await api.coach({
      tone: "hint",
      speaker: "wukong",
      locale,
      childName: name(),
      lessonId: lessonId,
      boardSummary: `toPlay=${board.toPlay} capB=${board.captured.black}`,
    });
    statusMsg = c.reminder ? `${c.say}\n—— ${c.reminder}` : c.say;
  } catch {
    statusMsg =
      locale === "zh-Hant"
        ? `${name()}，先數數氣再下！金角銀邊草肚皮～`
        : `${name()}, count liberties! Corners before center!`;
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

async function renderParent() {
  let body = `<p class="muted">…</p>`;
  try {
    const s = await api.parentSummary(locale);
    let usageHtml = "";
    try {
      const u = await api.usageStats();
      usageHtml = `
        <h3>${locale === "zh-Hant" ? "近 30 日使用（暑假觀察）" : "Last 30 days"}</h3>
        <div class="stats">
          <div><strong>${u.summary.sessions}</strong><br/>sessions</div>
          <div><strong>${u.summary.lessonsCompleted}</strong><br/>lessons</div>
          <div><strong>${u.summary.eyeBreaks}</strong><br/>eye breaks</div>
          <div><strong>${u.summary.freePlays}</strong><br/>free play</div>
        </div>
        <p class="muted">${locale === "zh-Hant" ? "護眼休息／通關比" : "Breaks per clear"}: ${u.summary.breakPerLesson}</p>`;
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
      <button class="primary" id="home">${t(locale, "home")}</button>
    `;
  } catch (e) {
    body = `<p class="err">${escapeHtml(String((e as Error).message))}</p>
      <button id="home">${t(locale, "home")}</button>`;
  }
  shell(`<div class="card">${body}</div>`);
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
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
        <ul>
          <li>進捗・バッジ・利用イベント（通関・休憩など）を D1 に保存。</li>
          <li>API Key は設定のみ。公開ランキングなし。</li>
          <li>AI は CF 無料→第三者→定型文。第三者利用時はその規約に従う。</li>
        </ul>`
        : `<h2>Privacy</h2>
        <p>Kids Igo stores account, progress, and aggregate usage events (lesson clear, eye breaks) in your Cloudflare D1.</p>
        <ul>
          <li>No public leaderboards or stranger matchmaking.</li>
          <li>Optional third-party AI keys stay in your settings (last 4 chars shown).</li>
          <li>Coach: Cloudflare free AI first, then your BYOK, then offline phrases.</li>
          <li>Parents should help manage PIN/email for children.</li>
        </ul>`;
  shell(
    `<div class="card privacy">${body}<button class="primary" id="home">${t(locale, "home")}</button></div>`,
  );
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
}

async function renderSettings() {
  let body = `<p class="muted">…</p>`;
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
      <p class="err" id="setMsg"></p>
    `;
  } catch (e) {
    body = `<p class="err">${escapeHtml(String((e as Error).message))}</p>
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
      if (msg) msg.textContent = String((err as Error).message);
    }
  });
  document.querySelector("#clearKey")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setMsg");
    try {
      await api.saveAiSettings({ clearApiKey: true });
      if (msg) msg.textContent = t(locale, "saved");
    } catch (err) {
      if (msg) msg.textContent = String((err as Error).message);
    }
  });
  document.querySelector("#testAi")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setMsg");
    if (msg) msg.textContent = "…";
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
      if (msg) msg.textContent = String((err as Error).message);
    }
  });
}

setInterval(() => {
  clock.tick();
  const mins = document.querySelector("#mins");
  if (mins) mins.textContent = String(clock.activeMinutes());
}, 1000);

void (null as unknown as Color);
void boot();
