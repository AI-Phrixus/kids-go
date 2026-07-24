import {
  createEmptyBoard,
  groupLiberties,
  idx,
  pickAiMove,
  tryPlay,
  type BoardState,
  type Color,
} from "../../../packages/go-engine/src/index";
import { api, type LessonDetail } from "./api";
import { EyeCareClock } from "./eyecare";
import { fallbackName, pickLocaleText, t, type Locale } from "./i18n";

type Route = "welcome" | "map" | "lesson" | "free";

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

const clock = new EyeCareClock({ breakEveryMin: 20, breakSec: 20 });
clock.onBreak = () => showBreak(true);

const app = document.querySelector<HTMLDivElement>("#app")!;

function name(): string {
  return nickname || fallbackName(locale);
}

function saveLocale() {
  localStorage.setItem("kids-go-locale", locale);
}

async function boot() {
  try {
    const me = await api.me();
    nickname = me.child?.nickname || "";
    if (me.child?.preferred_locale) {
      locale = me.child.preferred_locale as Locale;
      saveLocale();
    }
    route = "map";
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
    <p class="footer muted">v0.1 · <span id="mins">0</span> min · Cloudflare Free</p>
  `;
  document.querySelector("#locale")?.addEventListener("change", (e) => {
    locale = (e.target as HTMLSelectElement).value as Locale;
    saveLocale();
    render();
  });
}

function renderWelcome() {
  shell(`
    <div class="card">
      <h2>${t(locale, "welcome")}</h2>
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
        showErr(String((e as Error).message));
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
        showErr(String((e as Error).message));
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
        showErr(String((e as Error).message));
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
        showErr(String((e as Error).message));
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
  try {
    const data = await api.lessons();
    nickname = data.child.nickname;
    lessonsHtml = data.lessons
      .map((l) => {
        const title = l.titles[locale] || l.titles.en || l.id;
        const locked = l.status === "locked" || !l.playable;
        const stars = "★".repeat(l.stars) + "☆".repeat(Math.max(0, 3 - l.stars));
        return `
          <button class="lesson ${locked ? "locked" : ""}" data-id="${l.id}" ${locked ? "disabled" : ""}>
            <span class="lid">${l.id}</span>
            <span class="lt">${title}</span>
            <span class="ls">${locked ? t(locale, "locked") : stars}</span>
          </button>`;
      })
      .join("");
  } catch {
    route = "welcome";
    renderWelcome();
    return;
  }

  shell(`
    <div class="card">
      <div class="row between">
        <h2>${t(locale, "map")} · ${name()}</h2>
        <button id="logout">${t(locale, "logout")}</button>
      </div>
      <div class="map">${lessonsHtml}</div>
      <button id="free">${t(locale, "free")}</button>
    </div>
  `);
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await api.logout();
    route = "welcome";
    render();
  });
  document.querySelector("#free")?.addEventListener("click", () => {
    board = createEmptyBoard(9);
    route = "free";
    render();
  });
  document.querySelectorAll(".lesson:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", async () => {
      lessonId = (btn as HTMLElement).dataset.id!;
      const res = await api.lesson(lessonId);
      lesson = res.lesson;
      stepIndex = 0;
      phase = "steps";
      humanMoves = 0;
      statusMsg = "";
      board = setupBoard(lesson);
      route = "lesson";
      render();
    });
  });
}

function setupBoard(l: LessonDetail): BoardState {
  // L02 / L05 atari recognition boards
  if (l.id === "L02") {
    const b = createEmptyBoard(9);
    const g = b.grid.slice();
    g[idx(9, 2, 2)] = "white";
    g[idx(9, 1, 2)] = "black";
    g[idx(9, 3, 2)] = "black";
    g[idx(9, 2, 1)] = "black";
    return { ...b, grid: g };
  }
  if (l.id === "L05") {
    const b = createEmptyBoard(9);
    const g = b.grid.slice();
    g[idx(9, 4, 4)] = "white";
    g[idx(9, 3, 4)] = "black";
    g[idx(9, 5, 4)] = "black";
    g[idx(9, 4, 3)] = "black";
    return { ...b, grid: g };
  }
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
        <p class="bubble">${statusMsg}</p>`;
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
      <p class="bubble">${statusMsg}</p>`;
  } else {
    mid = `
      <h2 class="win">${t(locale, "win")}</h2>
      <p>${name()} ★★☆ · ${lesson.badgeId}</p>
      <div class="row">
        <button class="primary" id="home">${t(locale, "home")}</button>
        <button id="again">${t(locale, "again")}</button>
      </div>`;
  }

  shell(`
    <div class="card">
      <h2>${lesson.id} · ${title}</h2>
      ${mid}
    </div>
  `);

  document.querySelector("#next")?.addEventListener("click", () => {
    stepIndex++;
    if (stepIndex >= lesson!.steps.length) {
      phase = "battle";
      board = setupBoard(lesson!);
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
    humanMoves = 0;
    statusMsg = "";
    render();
  });
  document.querySelector("#ask")?.addEventListener("click", () => void askCoach());
  bindBoardClicks();
}

function renderFree() {
  shell(`
    <div class="card">
      <div class="row between">
        <h2>${t(locale, "free")}</h2>
        <button id="home">${t(locale, "home")}</button>
      </div>
      ${boardHtml(board, true)}
      <p class="bubble">${statusMsg || `${name()} vs AI`}</p>
      <button id="ask">${t(locale, "ask")}</button>
    </div>
  `);
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
  document.querySelector("#ask")?.addEventListener("click", () => void askCoach());
  bindBoardClicks();
}

function boardHtml(b: BoardState, interactive: boolean): string {
  const size = b.size;
  const cells = b.grid
    .map((c, i) => {
      const x = i % size;
      const y = Math.floor(i / size);
      const cls = c === "black" ? "black" : c === "white" ? "white" : "";
      return `<button class="cell ${cls}" data-x="${x}" data-y="${y}" ${interactive ? "" : "disabled"}></button>`;
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
        statusMsg =
          locale === "zh-Hant"
            ? `${name()}，答對了！`
            : locale === "ja"
              ? `${name()}、せいかい！`
              : `${name()}, correct!`;
        stepIndex++;
        if (stepIndex >= lesson.steps.length) {
          phase = "battle";
          board = setupBoard(lesson);
          humanMoves = 0;
        }
        render();
      } else {
        statusMsg =
          locale === "zh-Hant"
            ? "再找找看～"
            : locale === "ja"
              ? "もういちど！"
              : "Try another point!";
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
    board = next;
    const mv = pickAiMove(board, 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) board = after;
    }
    statusMsg = `${name()} · capt B${board.captured.black}/W${board.captured.white}`;
    render();
  }
}

function handleBattleMove(x: number, y: number) {
  if (!lesson) return;
  const mode = lesson.battle.mode;

  if (mode === "find_atari") {
    const pts = lesson.battle.points ?? [];
    const hit = pts.some(([px, py]) => px === x && py === y);
    // also allow empty liberty next to the stone
    if (hit || isAtariTarget(x, y, pts)) {
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
  board = next;
  humanMoves++;

  if (mode === "place_n") {
    const need = lesson.battle.n ?? 10;
    // AI replies weakly
    const mv = pickAiMove(board, lesson.battle.aiLevel ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) board = after;
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
      void completeLesson(3);
      return;
    }
    // weak AI: prefer not to fill last liberty of its own dying stones well
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) board = after;
    }
    if (board.captured.black >= need) {
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
  if (!lesson) return;
  try {
    await api.complete(lesson.id, stars);
    await api.saveGame({
      lessonId: lesson.id,
      boardSize: 9,
      result: "win",
      aiLevel: lesson.battle.aiLevel ?? 0,
      moves: [],
    });
    try {
      const c = await api.coach({
        tone: "celebrate",
        speaker: "wukong",
        locale,
        childName: name(),
        lessonId: lesson.id,
      });
      statusMsg = c.say;
    } catch {
      statusMsg = t(locale, "win");
    }
  } catch {
    statusMsg = t(locale, "win");
  }
  phase = "done";
  render();
}

async function askCoach() {
  try {
    const c = await api.coach({
      tone: "hint",
      speaker: "wukong",
      locale,
      childName: name(),
      lessonId: lessonId,
      boardSummary: `toPlay=${board.toPlay} capB=${board.captured.black}`,
    });
    statusMsg = c.say;
  } catch {
    statusMsg =
      locale === "zh-Hant"
        ? `${name()}，先數數氣再下！`
        : `${name()}, count liberties!`;
  }
  render();
}

let breakTimer: number | null = null;

function showBreak(on: boolean) {
  const el = document.querySelector("#break");
  if (!el) return;
  el.classList.toggle("hidden", !on);
  const text = document.querySelector("#care-text");
  if (text) text.textContent = t(locale, "care_far", { name: name() });
  if (on) {
    clock.pause();
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
  });
  const care = document.querySelector("#care-text");
  if (care) care.textContent = t(locale, "care_far", { name: name() });
}

setInterval(() => {
  clock.tick();
  const mins = document.querySelector("#mins");
  if (mins) mins.textContent = String(clock.activeMinutes());
}, 1000);

void (null as unknown as Color);
void boot();
