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
import { nextCareText } from "./care-rituals";
import { EyeCareClock } from "./eyecare";
import { fallbackName, pickLocaleText, t, type Locale } from "./i18n";

type Route = "welcome" | "map" | "lesson" | "free" | "settings" | "parent" | "privacy";

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
      v0.2.0 · <span id="mins">0</span> min · Cloudflare Free
      · <a href="#" id="privacy-link">${t(locale, "privacy")}</a>
    </p>
  `;
  document.querySelector("#privacy-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    route = "privacy";
    render();
  });
  document.querySelector("#locale")?.addEventListener("change", (e) => {
    locale = (e.target as HTMLSelectElement).value as Locale;
    saveLocale();
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
  let progressPct = 0;
  let doneCount = 0;
  try {
    const data = await api.lessons();
    nickname = data.child.nickname;
    doneCount = data.lessons.filter((l) => l.status === "completed").length;
    progressPct = Math.round((doneCount / Math.max(1, data.lessons.length)) * 100);
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
        <div class="progress-label">${t(locale, "progress")}: ${doneCount}/12 · ${progressPct}%</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="map path">${lessonsHtml}</div>
      <div class="row">
        <button id="free">${t(locale, "free")}</button>
      </div>
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
    humanMoves = 0;
    lastMove = null;
    statusMsg = "";
    route = "free";
    render();
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
        render();
      } catch (e) {
        statusMsg = String((e as Error).message);
        alert(statusMsg);
      }
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

const HOSHI_9 = new Set(["2,2", "2,6", "4,4", "6,2", "6,6"]);

function boardHtml(b: BoardState, interactive: boolean): string {
  const size = b.size;
  const cells = b.grid
    .map((c, i) => {
      const x = i % size;
      const y = Math.floor(i / size);
      const stone = c === "black" ? "black" : c === "white" ? "white" : "";
      const last =
        lastMove && lastMove.x === x && lastMove.y === y ? " last" : "";
      const hoshi = !c && HOSHI_9.has(`${x},${y}`) ? " hoshi" : "";
      return `<button class="cell ${stone}${last}${hoshi}" data-x="${x}" data-y="${y}" ${interactive ? "" : "disabled"}></button>`;
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
    lastMove = { x, y };
    const mv = pickAiMove(board, 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
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
  lastMove = { x, y };
  humanMoves++;

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
      void completeLesson(3);
      return;
    }
    // weak AI: prefer not to fill last liberty of its own dying stones well
    const mv = pickAiMove(board, (lesson.battle.aiLevel as 0 | 1 | 2) ?? 0);
    if (mv) {
      const after = tryPlay(board, mv.x, mv.y);
      if (after) {
        board = after;
        lastMove = { x: mv.x, y: mv.y };
      }
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
          <option value="auto" ${c.provider === "auto" ? "selected" : ""}>auto（BYOK 種類自動）</option>
          <option value="openai_compatible" ${c.provider === "openai_compatible" ? "selected" : ""}>openai_compatible（第三方種類）</option>
          <option value="xai" ${c.provider === "xai" ? "selected" : ""}>xai（第三方種類）</option>
          <option value="google" ${c.provider === "google" ? "selected" : ""}>google（第三方種類）</option>
          <option value="workers_ai" ${c.provider === "workers_ai" ? "selected" : ""}>僅 CF（無第三方）</option>
          <option value="none" ${c.provider === "none" ? "selected" : ""}>僅本地句庫</option>
        </select>
        <p class="muted">預設永遠：CF 免費 → 第三方 → 本地。選 openai/xai/google 只表示「第三方怎麼連」，不會跳過 CF。</p>
      </label>
      <label>${t(locale, "base_url")}
        <input id="baseUrl" type="url" placeholder="https://api.x.ai/v1" value="${escapeHtml(c.baseUrl)}" />
      </label>
      <label>${t(locale, "api_key")}
        <input id="apiKey" type="password" autocomplete="off" placeholder="${escapeHtml(c.apiKeyHint || "sk-…")}" />
      </label>
      <label>${t(locale, "model")}
        <input id="model" value="${escapeHtml(c.model)}" placeholder="grok-4.5 / llama-3.1-8b-instant" />
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
    const url = opt.dataset.url || "";
    const model = opt.dataset.model || "";
    const provider = opt.dataset.provider || "openai_compatible";
    const bu = document.querySelector("#baseUrl") as HTMLInputElement | null;
    const md = document.querySelector("#model") as HTMLInputElement | null;
    const pr = document.querySelector("#provider") as HTMLSelectElement | null;
    if (bu) bu.value = url;
    if (md) md.value = model;
    if (pr) pr.value = provider;
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
      // clear password field after save
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
      // save first if fields filled
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

async function askCoach() {
  try {
    const c = await api.coach({
      tone: "hint",
      speaker: "wukong",
      locale,
      childName: name(),
      lessonId: lessonId,
      boardSummary: `toPlay=${board.toPlay} capB=${board.captured.black}`,
    }) as { say: string; reminder?: string; source?: string };
    statusMsg = c.reminder ? `${c.say}\n—— ${c.reminder}` : c.say;
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
  if (text) text.textContent = nextCareText(locale, name());
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
}

async function renderParent() {
  let body = `<p class="muted">…</p>`;
  try {
    const s = await api.parentSummary(locale);
    const skills = s.skills
      .map((sk) => `<li><strong>${escapeHtml(sk.lessonId)}</strong> · ${escapeHtml(sk.skill)} · ${"★".repeat(sk.stars)}</li>`)
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
      ? `<h2>隱私說明</h2>
        <ul>
          <li>暱稱與進度存在你的 Cloudflare D1 帳號資料庫。</li>
          <li>第三方 AI Key 只存在你的用戶設定，介面只顯示末四位。</li>
          <li>無公開排行榜、無陌生人對戰。</li>
          <li>教練可先走 Cloudflare 免費 AI；額度到了才用你填的第三方或本地句庫。</li>
        </ul>`
      : locale === "ja"
        ? `<h2>プライバシー</h2>
        <ul>
          <li>ニックネームと進捗は Cloudflare D1 に保存されます。</li>
          <li>第三者 API Key はあなたの設定にのみ保存（表示は末尾のみ）。</li>
          <li>公開ランキングや見知らぬ人との対局はありません。</li>
        </ul>`
        : `<h2>Privacy</h2>
        <ul>
          <li>Nickname and progress are stored in your Cloudflare D1 database.</li>
          <li>Third-party API keys stay in your account settings (UI shows last 4 chars only).</li>
          <li>No public leaderboards or stranger matchmaking.</li>
          <li>Coach uses Cloudflare free AI first, then your BYOK, then offline phrases.</li>
        </ul>`;
  shell(`<div class="card">${body}<button class="primary" id="home">${t(locale, "home")}</button></div>`);
  document.querySelector("#home")?.addEventListener("click", () => {
    route = "map";
    void renderMap();
  });
}

setInterval(() => {
  clock.tick();
  const mins = document.querySelector("#mins");
  if (mins) mins.textContent = String(clock.activeMinutes());
}, 1000);

void (null as unknown as Color);
void boot();
