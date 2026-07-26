import {
  captureRaceWinner,
  createEmptyBoard,
  gameResult,
  isGameOver,
  pass,
  pickAiMove,
  play,
  territoryMap,
  type BoardState,
  type Point,
} from "../../../../packages/go-engine/src/index";
import { api } from "../api";
import { capturesHtml, createBoardView, type BoardView } from "../board/view";
import { askCoach } from "../coach";
import { t } from "../i18n";
import { mascotSvg } from "../mascot";
import { navigate } from "../router";
import { escapeHtml, displayName, setScreen } from "../shell";
import { sfx } from "../sfx";
import { persist, state, type AiLevel, type FreeMode } from "../state";

let view: BoardView | null = null;

function cloneBoard(b: BoardState): BoardState {
  return {
    size: b.size,
    grid: b.grid.slice(),
    toPlay: b.toPlay,
    captured: { ...b.captured },
    ko: b.ko,
    consecutivePasses: b.consecutivePasses,
    moveNumber: b.moveNumber,
    history: [...b.history],
  };
}

export function startFreePlay(): void {
  state.board = createEmptyBoard(9);
  state.freeHistory = [];
  state.lastMove = null;
  state.boardBusy = false;
  state.statusMsg =
    state.freeMode === "race5"
      ? t(state.locale, "race5_goal")
      : state.freeMode === "race10"
        ? t(state.locale, "race10_goal")
        : "";
  void api.track("free_play_start", { mode: state.freeMode });
  navigate("free");
}

function setBubble(msg: string): void {
  state.statusMsg = msg;
  const el = document.querySelector("#bubble");
  if (el) el.textContent = msg;
}

function setThinking(on: boolean): void {
  document.querySelector("#thinking")?.classList.toggle("hidden", !on);
}

function syncStatusLine(): void {
  const b = state.board!;
  const L = state.locale;
  const turn = b.toPlay === "black" ? t(L, "turn_black") : t(L, "turn_white");
  const raceLabel =
    state.freeMode === "race5"
      ? t(L, "race5")
      : state.freeMode === "race10"
        ? t(L, "race10")
        : t(L, "casual");
  const line = document.querySelector("#free-status");
  if (line) line.textContent = `${raceLabel} · ${turn}`;
  const trays = document.querySelector("#trays");
  if (trays) {
    trays.innerHTML = capturesHtml(b, { black: t(L, "cap_black"), white: t(L, "cap_white") });
  }
  const undoBtn = document.querySelector("#undo") as HTMLButtonElement | null;
  if (undoBtn) undoBtn.disabled = !state.freeHistory.length;
}

export function renderFree(): void {
  const L = state.locale;
  if (!state.board) state.board = createEmptyBoard(9);
  view = null;
  const screen = setScreen(`
    <div class="card game-card">
      <div class="row between">
        <h2>${t(L, "free")}</h2>
        <span id="thinking" class="thinking hidden">${mascotSvg("idle")}<em>${t(L, "thinking")}</em></span>
        <button id="home">${t(L, "home")}</button>
      </div>
      <div class="row">
        <button id="mode-casual" class="${state.freeMode === "casual" ? "primary" : ""}">${t(L, "casual")}</button>
        <button id="mode-r5" class="${state.freeMode === "race5" ? "primary" : ""}">${t(L, "race5")}</button>
        <button id="mode-r10" class="${state.freeMode === "race10" ? "primary" : ""}">${t(L, "race10")}</button>
        <button id="pass">${t(L, "pass")}</button>
        <button id="undo" ${state.freeHistory.length ? "" : "disabled"}>${t(L, "undo")}</button>
        <button id="reset">${t(L, "reset")}</button>
      </div>
      <div class="row">
        <label class="check"><input type="checkbox" id="libs" ${state.showLibs ? "checked" : ""}/> ${t(L, "show_libs")}</label>
        <label class="inline">${t(L, "ai_level")}
          <select id="ai-level">
            <option value="0" ${state.freeAiLevel === 0 ? "selected" : ""}>${t(L, "ai_easy")}</option>
            <option value="1" ${state.freeAiLevel === 1 ? "selected" : ""}>${t(L, "ai_normal")}</option>
            <option value="2" ${state.freeAiLevel === 2 ? "selected" : ""}>${t(L, "ai_hard")}</option>
          </select>
        </label>
        ${
          state.freeMode === "casual"
            ? `<label class="inline">${t(L, "komi")}
                <select id="komi">
                  <option value="0" ${state.freeKomi === 0 ? "selected" : ""}>0</option>
                  <option value="3.5" ${state.freeKomi === 3.5 ? "selected" : ""}>3.5</option>
                  <option value="6.5" ${state.freeKomi === 6.5 ? "selected" : ""}>6.5</option>
                </select>
              </label>`
            : ""
        }
      </div>
      <div class="game-flex">
        <div class="game-main">
          <p class="muted" id="free-status"></p>
          <div id="board-slot"></div>
          <div id="trays"></div>
        </div>
        <div class="game-side">
          <p class="bubble" id="bubble" role="status">${escapeHtml(state.statusMsg || t(L, "free_vs", { name: displayName() }))}</p>
          <div id="score-slot"></div>
          <button id="ask">${t(L, "ask")}</button>
        </div>
      </div>
    </div>
  `);

  screen.querySelector("#home")?.addEventListener("click", () => navigate("map"));
  screen.querySelector("#ask")?.addEventListener("click", async () => {
    const b = state.board!;
    setBubble(await askCoach(`toPlay=${b.toPlay} capB=${b.captured.black} capW=${b.captured.white}`));
  });

  const resetBoard = (mode: FreeMode, msg: string) => {
    state.freeMode = mode;
    persist("free-mode");
    state.board = createEmptyBoard(9);
    state.freeHistory = [];
    state.lastMove = null;
    state.boardBusy = false;
    state.statusMsg = msg;
    renderFree();
  };
  screen.querySelector("#mode-casual")?.addEventListener("click", () => resetBoard("casual", ""));
  screen.querySelector("#mode-r5")?.addEventListener("click", () => resetBoard("race5", t(L, "race5_goal")));
  screen.querySelector("#mode-r10")?.addEventListener("click", () => resetBoard("race10", t(L, "race10_goal")));
  screen.querySelector("#reset")?.addEventListener("click", () => resetBoard(state.freeMode, ""));
  screen.querySelector("#libs")?.addEventListener("change", (e) => {
    state.showLibs = (e.target as HTMLInputElement).checked;
    persist("libs");
    view?.update(state.board!, { lastMove: state.lastMove, animate: false });
  });
  screen.querySelector("#ai-level")?.addEventListener("change", (e) => {
    state.freeAiLevel = Number((e.target as HTMLSelectElement).value) as AiLevel;
    persist("ai");
  });
  screen.querySelector("#komi")?.addEventListener("change", (e) => {
    state.freeKomi = Number((e.target as HTMLSelectElement).value) || 0;
    persist("komi");
  });
  screen.querySelector("#pass")?.addEventListener("click", () => void onPass());
  screen.querySelector("#undo")?.addEventListener("click", () => {
    const prev = state.freeHistory.pop();
    if (!prev) return;
    state.board = prev;
    state.lastMove = null;
    setBubble(t(L, "undo"));
    view?.update(prev, { lastMove: null, animate: false });
    view?.setTerritory(null);
    syncStatusLine();
  });

  const slot = screen.querySelector<HTMLElement>("#board-slot");
  if (slot) {
    view = createBoardView(slot, state.board, {
      interactive: !state.boardBusy,
      onTap: (x, y) => void onTap(x, y),
    });
  }
  syncStatusLine();
}

function raceTarget(): number {
  return state.freeMode === "race5" ? 5 : state.freeMode === "race10" ? 10 : 0;
}

async function onTap(x: number, y: number): Promise<void> {
  if (state.boardBusy || !state.board) return;
  if (isGameOver(state.board)) return;
  const r = play(state.board, x, y);
  if (!r.ok) {
    sfx.wrong();
    setBubble(t(state.locale, "illegal"));
    return;
  }
  state.freeHistory.push(cloneBoard(state.board));
  if (state.freeHistory.length > 40) state.freeHistory.shift();
  state.board = r.state;
  state.lastMove = { x, y };
  sfx.place();
  if (r.captured.length) sfx.capture();
  view?.update(state.board, { lastMove: state.lastMove, captured: r.captured });
  syncStatusLine();

  const target = raceTarget();
  if (target) {
    const win = captureRaceWinner(state.board.captured, target);
    if (win === "black") {
      sfx.win();
      void api.track("capture_race_win", { target });
      setBubble(t(state.locale, "race_win", { name: displayName(), n: target }));
      return;
    }
  }
  await aiTurn();
}

async function onPass(): Promise<void> {
  if (state.boardBusy || !state.board) return;
  if (isGameOver(state.board)) return;
  state.freeHistory.push(cloneBoard(state.board));
  if (state.freeHistory.length > 40) state.freeHistory.shift();
  state.board = pass(state.board);
  state.lastMove = null;
  view?.update(state.board, { lastMove: null, animate: false });
  if (isGameOver(state.board)) return settleGame();
  setBubble(t(state.locale, "you_passed"));
  await aiTurn();
}

async function aiTurn(): Promise<void> {
  const b = state.board!;
  state.boardBusy = true;
  view?.setInteractive(false);
  setThinking(true);
  await new Promise((res) => setTimeout(res, 350 + Math.random() * 300));
  const mv: Point | null = pickAiMove(b, state.freeAiLevel);
  let captured: Point[] = [];
  if (mv) {
    const r = play(state.board!, mv.x, mv.y);
    if (r.ok) {
      state.board = r.state;
      state.lastMove = mv;
      captured = r.captured;
    } else {
      state.board = pass(state.board!);
      state.lastMove = null;
    }
  } else {
    state.board = pass(state.board!);
    state.lastMove = null;
  }
  setThinking(false);
  state.boardBusy = false;
  view?.setInteractive(true);
  if (captured.length) sfx.capture();
  view?.update(state.board!, { lastMove: state.lastMove, captured });
  syncStatusLine();

  if (isGameOver(state.board!)) return settleGame();

  const target = raceTarget();
  if (target) {
    const win = captureRaceWinner(state.board!.captured, target);
    if (win === "white") setBubble(t(state.locale, "race_lose", { n: target }));
    else if (win === "black") setBubble(t(state.locale, "race_win", { name: displayName(), n: target }));
    else {
      const b2 = state.board!;
      setBubble(`${displayName()} · B${b2.captured.black}/W${b2.captured.white} (${target})`);
    }
  }
}

/** Double pass → real area scoring with a territory overlay (v0.8.0). */
function settleGame(): void {
  const b = state.board!;
  const L = state.locale;
  const komi = state.freeMode === "casual" ? state.freeKomi : 0;
  const r = gameResult(b, komi);
  view?.setTerritory(territoryMap(b));
  const line =
    r.winner === "draw"
      ? t(L, "draw_game")
      : r.winner === "black"
        ? t(L, "win_by", { name: displayName(), n: r.margin })
        : t(L, "lose_by", { n: r.margin });
  if (r.winner === "black") sfx.win();
  setBubble(`${t(L, "double_pass")} ${line}`);
  const slot = document.querySelector("#score-slot");
  if (slot) {
    const s = r.score;
    slot.innerHTML = `
      <div class="score-panel">
        <h3>${t(L, "score_title")}</h3>
        <table class="score-table">
          <tr><th></th><th>●</th><th>○</th></tr>
          <tr><td>${t(L, "stones_lbl")}</td><td>${s.stones.black}</td><td>${s.stones.white}</td></tr>
          <tr><td>${t(L, "territory")}</td><td>${s.territory.black}</td><td>${s.territory.white}</td></tr>
          <tr><td>${t(L, "komi")}</td><td>—</td><td>${s.komi}</td></tr>
          <tr class="score-total"><td>=</td><td>${s.black}</td><td>${s.white}</td></tr>
        </table>
      </div>`;
  }
  void api.saveGame({
    boardSize: 9,
    result: r.winner === "draw" ? "draw" : r.winner === "black" ? `B+${r.margin}` : `W+${r.margin}`,
    aiLevel: state.freeAiLevel,
    moves: [],
    scoreBlack: r.score.black,
    scoreWhite: r.score.white,
  });
}
