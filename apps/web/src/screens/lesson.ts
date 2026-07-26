import {
  score,
  type GameResult,
  type Point,
} from "../../../../packages/go-engine/src/index";
import { api } from "../api";
import {
  applyAiReply,
  computeStars,
  createRuntime,
  onPlayerMove,
  type BattleRuntime,
} from "../battle/runtime";
import { capturesHtml, createBoardView, type BoardView } from "../board/view";
import { askCoach, skillTagOf } from "../coach";
import { winSparklesHtml } from "../decor";
import { friendlyError } from "../errors";
import { pickLocaleText, t } from "../i18n";
import { mascotSvg } from "../mascot";
import { navigate } from "../router";
import { escapeHtml, displayName, setScreen } from "../shell";
import { sfx } from "../sfx";
import { persist, state } from "../state";

let view: BoardView | null = null;

function errMsg(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e), state.locale);
}

export async function openLesson(id: string): Promise<void> {
  state.lessonId = id;
  try {
    const res = await api.lesson(id);
    state.lesson = res.lesson;
    state.stepIndex = 0;
    state.phase = "steps";
    state.battle = createRuntime(res.lesson);
    state.completing = false;
    state.earnedStars = 0;
    state.statusMsg = "";
    state.lastMove = null;
    state.nextLessonId = null;
    void api.track("lesson_start", { lessonId: id });
    navigate("lesson");
  } catch (e) {
    state.statusMsg = errMsg(e);
    navigate("map", { push: false });
  }
}

function stepDots(): string {
  const lesson = state.lesson;
  if (!lesson || state.phase !== "steps") return "";
  const total = Math.max(1, lesson.steps.length);
  const cur = Math.min(state.stepIndex + 1, total);
  const dots = lesson.steps
    .map(
      (_, i) =>
        `<span class="dot ${i < state.stepIndex ? "done" : i === state.stepIndex ? "on" : ""}"></span>`,
    )
    .join("");
  return `<div class="step-bar" aria-label="${t(state.locale, "step_of", { cur, total })}">${dots}<span class="muted step-label">${t(state.locale, "step_of", { cur, total })}</span></div>`;
}

function setBubble(msg: string): void {
  state.statusMsg = msg;
  const el = document.querySelector("#bubble");
  if (el) el.textContent = msg;
}

function setThinking(on: boolean): void {
  document.querySelector("#thinking")?.classList.toggle("hidden", !on);
}

export function renderLesson(): void {
  const lesson = state.lesson;
  const L = state.locale;
  if (!lesson) {
    navigate("map", { push: false });
    return;
  }
  view = null;
  const title = pickLocaleText(L, lesson.titles, displayName());

  if (state.phase === "steps") {
    const step = lesson.steps[state.stepIndex];
    let mid = "";
    if (!step || step.type === "story") {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(L, lesson.story, displayName())}</p>
        <p class="muted">${pickLocaleText(L, lesson.goal, displayName())}</p>
        <button class="primary" id="next">${t(L, "next")}</button>`;
    } else if (step.type === "info") {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(L, step.text, displayName())}</p>
        <button class="primary" id="next">${t(L, "next")}</button>`;
    } else {
      mid = `
        ${stepDots()}
        <p class="story">${pickLocaleText(L, step.prompt, displayName())}</p>
        <div id="board-slot"></div>
        <p class="bubble" id="bubble" role="status">${escapeHtml(state.statusMsg)}</p>`;
    }
    const screen = setScreen(`
      <div class="card game-card">
        <div class="row between">
          <h2>${lesson.id} · ${escapeHtml(title)}</h2>
          ${mascotSvg("idle")}
        </div>
        ${mid}
      </div>`);
    screen.querySelector("#next")?.addEventListener("click", () => {
      state.stepIndex++;
      if (state.stepIndex >= lesson.steps.length) enterBattle();
      else renderLesson();
    });
    const slot = screen.querySelector<HTMLElement>("#board-slot");
    if (slot && state.battle) {
      view = createBoardView(slot, state.battle.board, {
        interactive: true,
        onTap: (x, y) => onStepTap(x, y),
      });
    }
    return;
  }

  if (state.phase === "battle") {
    const rt = state.battle!;
    const screen = setScreen(`
      <div class="card game-card">
        <div class="row between">
          <h2>${lesson.id} · ${escapeHtml(title)}</h2>
          <span id="thinking" class="thinking hidden">${mascotSvg("idle")}<em>${t(L, "thinking")}</em></span>
        </div>
        <h3>${t(L, "battle")}</h3>
        <p>${pickLocaleText(L, lesson.goal, displayName())}</p>
        <div class="game-flex">
          <div class="game-main">
            <label class="check"><input type="checkbox" id="libs" ${state.showLibs ? "checked" : ""}/> ${t(L, "show_libs")}</label>
            <div id="board-slot"></div>
            <div id="trays">${capturesHtml(rt.board, { black: t(L, "cap_black"), white: t(L, "cap_white") })}</div>
          </div>
          <div class="game-side">
            <div class="row">
              ${rt.spec.mode === "sequence" || rt.spec.goal?.type === "territory_lead" ? `<button id="pass">${t(L, "pass")}</button>` : ""}
              <button id="ask">${t(L, "ask")}</button>
              <button id="home">${t(L, "home")}</button>
            </div>
            <p class="bubble" id="bubble" role="status">${escapeHtml(state.statusMsg)}</p>
          </div>
        </div>
      </div>`);
    screen.querySelector("#home")?.addEventListener("click", () => navigate("map"));
    screen.querySelector("#ask")?.addEventListener("click", async () => {
      const rtNow = state.battle;
      const summary = rtNow
        ? `toPlay=${rtNow.board.toPlay} capB=${rtNow.board.captured.black} capW=${rtNow.board.captured.white}`
        : undefined;
      if (state.battle) state.battle.hintsUsed++;
      setBubble(await askCoach(summary, skillTagOf(lesson)));
    });
    screen.querySelector("#libs")?.addEventListener("change", (e) => {
      state.showLibs = (e.target as HTMLInputElement).checked;
      persist("libs");
      view?.update(state.battle!.board, { lastMove: state.lastMove, animate: false });
    });
    screen.querySelector("#pass")?.addEventListener("click", () => void onBattlePass());
    const slot = screen.querySelector<HTMLElement>("#board-slot");
    if (slot) {
      view = createBoardView(slot, rt.board, {
        interactive: true,
        onTap: (x, y) => void onBattleTap(x, y),
      });
    }
    return;
  }

  // done — win or lose
  const rt = state.battle;
  const won = rt?.won ?? true;
  const stars = state.earnedStars || (rt ? computeStars(rt) : 2);
  const starStr = "★".repeat(stars) + "☆".repeat(3 - stars);
  const scoreHtml = rt?.result ? scorePanelHtml(rt.result) : "";
  const screen = setScreen(`
    <div class="card game-card">
      <div class="row between">
        <h2>${lesson.id} · ${escapeHtml(title)}</h2>
      </div>
      ${won ? winSparklesHtml() : ""}
      ${won ? confettiHtml() : ""}
      <div class="win-hero">${mascotSvg(won ? "win" : "care")}
        <div>
          <h2 class="win">${won ? t(L, "win") : t(L, "lost_title")}</h2>
          ${
            won
              ? `<p class="stars-line" aria-label="stars ${stars}/3"><span class="stars-anim">${starStr}</span></p>
                 <p><span class="badge-pill badge-unlock">🏅 ${escapeHtml(badgeName())}</span></p>`
              : `<p class="muted">${t(L, "goal_not_met")}</p>`
          }
        </div>
      </div>
      ${scoreHtml}
      <div class="row">
        ${
          won && state.nextLessonId
            ? `<button class="primary" id="next-lesson">${t(L, "next_lesson")} ${state.nextLessonId}</button>`
            : ""
        }
        <button ${won && state.nextLessonId ? "" : 'class="primary"'} id="again">${t(L, "again")}</button>
        <button id="home">${t(L, "home")}</button>
      </div>
      <p class="bubble" id="bubble" role="status">${escapeHtml(state.statusMsg)}</p>
    </div>`);
  screen.querySelector("#home")?.addEventListener("click", () => navigate("map"));
  screen.querySelector("#next-lesson")?.addEventListener("click", () => {
    if (state.nextLessonId) void openLesson(state.nextLessonId);
  });
  screen.querySelector("#again")?.addEventListener("click", () => {
    enterBattle();
  });
}

function badgeName(): string {
  const lesson = state.lesson!;
  // Localized badge names (v0.8.0): lessons-data provides skillTag locale map;
  // fall back to the raw id only if nothing localized exists.
  const tag = lesson.skillTag;
  if (tag && typeof tag !== "string") {
    return pickLocaleText(state.locale, tag, displayName()) || lesson.badgeId;
  }
  return lesson.badgeId;
}

function confettiHtml(): string {
  const bits = Array.from({ length: 14 }, (_, i) => {
    const left = 4 + ((i * 7.3) % 92);
    const delay = (i % 7) * 0.12;
    const hue = (i * 47) % 360;
    return `<i style="left:${left}%;animation-delay:${delay}s;background:hsl(${hue} 80% 60%)"></i>`;
  }).join("");
  return `<div class="confetti-burst" aria-hidden="true">${bits}</div>`;
}

function scorePanelHtml(r: GameResult): string {
  const L = state.locale;
  const s = r.score;
  const line =
    r.winner === "draw"
      ? t(L, "draw_game")
      : r.winner === "black"
        ? t(L, "win_by", { name: displayName(), n: r.margin })
        : t(L, "lose_by", { n: r.margin });
  return `
    <div class="score-panel">
      <h3>${t(L, "score_title")}</h3>
      <table class="score-table">
        <tr><th></th><th>● </th><th>○ </th></tr>
        <tr><td>${t(L, "stones_lbl")}</td><td>${s.stones.black}</td><td>${s.stones.white}</td></tr>
        <tr><td>${t(L, "territory")}</td><td>${s.territory.black}</td><td>${s.territory.white}</td></tr>
        <tr><td>${t(L, "komi")}</td><td>—</td><td>${s.komi}</td></tr>
        <tr class="score-total"><td>=</td><td>${s.black}</td><td>${s.white}</td></tr>
      </table>
      <p class="story">${escapeHtml(line)}</p>
    </div>`;
}

function enterBattle(): void {
  const lesson = state.lesson!;
  state.phase = "battle";
  state.battle = createRuntime(lesson);
  state.lastMove = null;
  state.completing = false;
  state.earnedStars = 0;
  state.statusMsg = pickLocaleText(state.locale, lesson.goal, displayName());
  renderLesson();
}

function onStepTap(x: number, y: number): void {
  const lesson = state.lesson;
  if (!lesson || state.phase !== "steps") return;
  const step = lesson.steps[state.stepIndex];
  if (step?.type !== "tap") return;
  const ok = step.correct.some(([cx, cy]) => cx === x && cy === y);
  if (ok) {
    sfx.ok();
    state.statusMsg = t(state.locale, "correct", { name: displayName() });
    state.stepIndex++;
    if (state.stepIndex >= lesson.steps.length) enterBattle();
    else renderLesson();
  } else {
    sfx.wrong();
    setBubble(t(state.locale, "try_again_quiz"));
  }
}

/** AI thinking delay: the opponent replies 350–650ms later, visibly. */
function thinkDelay(): number {
  return 350 + Math.random() * 300;
}

async function onBattleTap(x: number, y: number): Promise<void> {
  const rt = state.battle;
  const lesson = state.lesson;
  if (!rt || !lesson || state.boardBusy || state.phase !== "battle") return;

  const out = onPlayerMove(rt, x, y);
  if (out.verdict === "rejected-illegal") {
    sfx.wrong();
    setBubble(t(state.locale, "illegal"));
    return;
  }
  if (out.verdict === "rejected-wrong") {
    sfx.wrong();
    const hint =
      out.hintKey ??
      (rt.spec.script?.[rt.scriptIndex]?.hint
        ? pickLocaleText(state.locale, rt.spec.script[rt.scriptIndex]!.hint!, displayName())
        : null);
    setBubble(hint || t(state.locale, "try_again_quiz"));
    return;
  }

  state.lastMove = { x, y };
  sfx.place();
  if (out.captured.length) sfx.capture();
  view?.update(rt.board, { lastMove: state.lastMove, captured: out.captured });
  syncTrays();

  if (out.status === "won") return finishBattle(true);
  if (out.status === "lost") return finishBattle(false);

  if (out.aiReply) {
    await playAiReply(out.aiReply);
  }
  updateProgressBubble();
}

async function onBattlePass(): Promise<void> {
  const rt = state.battle;
  if (!rt || state.boardBusy || state.phase !== "battle") return;
  const { onPlayerPass } = await import("../battle/runtime");
  const out = onPlayerPass(rt);
  setBubble(t(state.locale, "you_passed"));
  view?.update(rt.board, { lastMove: null, animate: false });
  if (out.status === "won") return finishBattle(true);
  if (out.status === "lost") return finishBattle(false);
  if (out.aiReply) await playAiReply(out.aiReply);
}

async function playAiReply(reply: Point | "pass"): Promise<void> {
  const rt = state.battle!;
  state.boardBusy = true;
  view?.setInteractive(false);
  setThinking(true);
  await new Promise((r) => setTimeout(r, thinkDelay()));
  const res = applyAiReply(rt, reply);
  setThinking(false);
  state.boardBusy = false;
  view?.setInteractive(true);
  if (reply !== "pass") {
    state.lastMove = { x: reply.x, y: reply.y };
    if (res.captured.length) sfx.capture();
  } else {
    state.lastMove = null;
  }
  view?.update(rt.board, { lastMove: state.lastMove, captured: res.captured });
  syncTrays();
  if (res.status === "won") return finishBattle(true);
  if (res.status === "lost") return finishBattle(false);
}

function syncTrays(): void {
  const rt = state.battle;
  const trays = document.querySelector("#trays");
  if (rt && trays) {
    trays.innerHTML = capturesHtml(rt.board, {
      black: t(state.locale, "cap_black"),
      white: t(state.locale, "cap_white"),
    });
  }
}

function updateProgressBubble(): void {
  const rt = state.battle;
  const lesson = state.lesson;
  if (!rt || !lesson) return;
  const L = state.locale;
  if (rt.spec.mode === "place_n") {
    setBubble(t(L, "place_progress", { cur: rt.playerMoves, need: rt.spec.n ?? 10 }));
  } else if (rt.spec.mode === "capture_n") {
    const need = (rt.spec.n ?? 1) - rt.board.captured.black;
    if (need > 0) setBubble(t(L, "capture_more", { name: displayName(), n: need }));
  }
}

async function finishBattle(won: boolean): Promise<void> {
  const rt = state.battle!;
  const lesson = state.lesson!;
  if (state.completing || state.phase === "done") return;
  state.phase = "done";
  if (rt.result === null && rt.spec.goal?.type === "territory_lead") {
    // ensure the score panel has data even on scripted wins
    rt.result = { winner: won ? "black" : "white", margin: 0, score: scoreOf(rt) };
  }
  if (!won) {
    sfx.wrong();
    renderLesson();
    return;
  }
  state.completing = true;
  const stars = computeStars(rt);
  state.earnedStars = stars;
  state.nextLessonId = computeNextLesson(lesson.id);
  sfx.win();
  renderLesson();
  try {
    await api.complete(lesson.id, stars, { hintsUsed: rt.hintsUsed, movesUsed: rt.playerMoves });
    await api.saveGame({
      lessonId: lesson.id,
      boardSize: 9,
      result: "win",
      aiLevel: rt.spec.aiLevel ?? 0,
      moves: [],
      scoreBlack: rt.result?.score.black,
      scoreWhite: rt.result?.score.white,
    });
    void api.track("lesson_complete", { lessonId: lesson.id, stars });
    try {
      const c = await api.coach({
        tone: "celebrate",
        speaker: "wukong",
        locale: state.locale,
        childName: displayName(),
        lessonId: lesson.id,
        skillTag: skillTagOf(lesson),
      });
      setBubble(c.reminder ? `${c.say} —— ${c.reminder}` : c.say);
    } catch {
      setBubble(t(state.locale, "win"));
    }
  } catch {
    setBubble(t(state.locale, "win"));
  }
  state.completing = false;
}

function scoreOf(rt: BattleRuntime) {
  return score(rt.board, 0);
}

function computeNextLesson(currentId: string): string | null {
  const i = state.allLessonIds.indexOf(currentId);
  if (i >= 0 && i + 1 < state.allLessonIds.length) return state.allLessonIds[i + 1]!;
  const m = /^L(\d+)$/.exec(currentId);
  if (m) {
    const n = Number(m[1]) + 1;
    if (n <= 26) return `L${String(n).padStart(2, "0")}`;
  }
  return null;
}
