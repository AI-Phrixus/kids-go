/**
 * go-engine v2 test suite — zero-dependency assert runner (run via tsx).
 * `npm run test:engine`
 */
import {
  AI_TUNING,
  captureRaceWinner,
  createEmptyBoard,
  gameResult,
  groupLiberties,
  idx,
  isGameOver,
  isTrueEye,
  listLegalMoves,
  pass,
  pickAiMove,
  play,
  positionKey,
  score,
  territoryMap,
  tryPlay,
} from "./index";
import type { BoardState, Color } from "./types";

let passed = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}

/** Deterministic rng for reproducible AI tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boardWith(
  setup: { x: number; y: number; c: Color }[],
  toPlay: Color = "black",
): BoardState {
  const b = createEmptyBoard(9);
  const g = b.grid.slice();
  for (const s of setup) g[idx(9, s.x, s.y)] = s.c;
  return { ...b, grid: g, toPlay };
}

/* ---------------- basic capture ---------------- */
{
  const b = boardWith([
    { x: 2, y: 2, c: "white" },
    { x: 1, y: 2, c: "black" },
    { x: 3, y: 2, c: "black" },
    { x: 2, y: 1, c: "black" },
  ]);
  const c = tryPlay(b, 2, 3);
  assert(c && c.grid[idx(9, 2, 2)] === null, "capture removes white");
  assert(c!.captured.black === 1, "black capture count");
  assert(c!.toPlay === "white", "turn flips after play");
  assert(c!.moveNumber === 1, "move number increments");
}

/* ---------------- multi-stone capture (was a dead test pre-v2) ---------------- */
{
  // White pair (1,0)(2,0) on the top edge; black covers (0,0),(1,1),(2,1),
  // leaving the pair's last liberty at (3,0).
  const b = boardWith([
    { x: 1, y: 0, c: "white" },
    { x: 2, y: 0, c: "white" },
    { x: 0, y: 0, c: "black" },
    { x: 1, y: 1, c: "black" },
    { x: 2, y: 1, c: "black" },
  ]);
  const r = play(b, 3, 0);
  assert(r.ok, "multi-capture move legal");
  if (r.ok) {
    assert(r.captured.length === 2, `two stones captured, got ${r.captured.length}`);
    assert(r.state.grid[idx(9, 1, 0)] === null, "first white removed");
    assert(r.state.grid[idx(9, 2, 0)] === null, "second white removed");
    assert(r.state.captured.black === 2, "capture count = 2");
  }
}

/* ---------------- illegal moves ---------------- */
{
  const b = boardWith([
    { x: 0, y: 1, c: "white" },
    { x: 1, y: 0, c: "white" },
  ]);
  const r = play(b, 0, 0);
  assert(!r.ok && r.reason === "suicide", "suicide illegal with reason");
  assert(tryPlay(b, 0, 0) === null, "suicide illegal (legacy API)");
}
{
  const b = boardWith([{ x: 4, y: 4, c: "black" }], "white");
  const r = play(b, 4, 4);
  assert(!r.ok && r.reason === "occupied", "occupied with reason");
}
{
  const r1 = play(createEmptyBoard(9), -1, 0);
  const r2 = play(createEmptyBoard(9), 0, 9);
  assert(!r1.ok && r1.reason === "off-board", "oob x");
  assert(!r2.ok && r2.reason === "off-board", "oob y");
}

/* ---------------- pass / game over ---------------- */
{
  const b = createEmptyBoard(9);
  const p1 = pass(b);
  assert(p1.toPlay === "white", "pass to white");
  assert(p1.consecutivePasses === 1, "one pass counted");
  assert(!isGameOver(p1), "not over after one pass");
  const p2 = pass(p1);
  assert(p2.toPlay === "black", "double pass back to black");
  assert(isGameOver(p2), "game over after two passes");
  const r = play(p2, 4, 4);
  assert(!r.ok && r.reason === "game-over", "no play after game over");
  // a play resets the pass counter
  const p1played = tryPlay(p1, 3, 3);
  assert(p1played && p1played.consecutivePasses === 0, "play resets pass count");
}

/* ---------------- legal move generation ---------------- */
assert(listLegalMoves(createEmptyBoard(9)).length === 81, "81 empties");

/* ---------------- REAL ko: set, forbidden, cleared ---------------- */
{
  // White stone A at (4,3) in atari (black at (3,3),(4,2),(4,4)).
  // Point B (5,3) is white's eye-ish gap backed by white (6,3),(5,2),(5,4).
  // Black plays B: captures A, black stone at B has exactly 1 liberty → real ko.
  const koSetup = boardWith(
    [
      { x: 3, y: 3, c: "black" },
      { x: 4, y: 2, c: "black" },
      { x: 4, y: 4, c: "black" },
      { x: 4, y: 3, c: "white" },
      { x: 6, y: 3, c: "white" },
      { x: 5, y: 2, c: "white" },
      { x: 5, y: 4, c: "white" },
    ],
    "black",
  );
  assert(groupLiberties(koSetup, 4, 3) === 1, "white A in atari");
  const afterCap = tryPlay(koSetup, 5, 3);
  assert(afterCap, "black captures ko stone");
  assert(afterCap!.grid[idx(9, 4, 3)] === null, "white A removed");
  assert(afterCap!.ko === "4,3", `ko point set, got ${afterCap!.ko}`);
  const retake = play(afterCap!, 4, 3);
  assert(!retake.ok && retake.reason === "ko", "immediate recapture is ko");
  // white plays elsewhere → ko clears; recapture becomes legal (superko allows it:
  // position differs by the extra stone)
  const elsewhere = tryPlay(afterCap!, 0, 0);
  assert(elsewhere && elsewhere.ko === null, "ko cleared after other play");
  const blackElse = tryPlay(elsewhere!, 0, 2);
  const whiteRetakes = play(blackElse!, 4, 3);
  assert(whiteRetakes.ok, "white may retake ko after exchange");
}

/* ---------------- NO false ko (the v0.7 bug): open-board single capture ------- */
{
  // Black (1,0),(0,1),(2,1) around white (1,1); white also holds (0,0),(2,0)
  // so black (1,0) is short of liberties. Black plays (1,2) to capture (1,1) —
  // the capturing stone ends with 4 liberties → NOT a ko shape, so white's
  // immediate counter-capture at (1,1) (taking black (1,0)) must be legal.
  // The v0.7 engine wrongly set ko here and banned it.
  const b = boardWith(
    [
      { x: 1, y: 0, c: "black" },
      { x: 0, y: 1, c: "black" },
      { x: 2, y: 1, c: "black" },
      { x: 1, y: 1, c: "white" },
      { x: 0, y: 0, c: "white" },
      { x: 2, y: 0, c: "white" },
    ],
    "black",
  );
  const after = tryPlay(b, 1, 2);
  assert(after, "capture works");
  assert(after!.ko === null, "no ko on open-board capture (v0.7 bug fixed)");
  const whiteMove = play(after!, 1, 1);
  assert(whiteMove.ok, "white may counter-capture at the vacated point");
  if (whiteMove.ok) {
    assert(whiteMove.captured.length === 1, "white takes black (1,0)");
    assert(whiteMove.state.ko === "1,0", "THAT capture is a real ko");
  }
}

/* ---------------- snapback plays out ---------------- */
{
  // Corner snapback. White group (0,1),(1,1),(2,1),(2,0) has a two-space
  // eye at (0,0),(1,0); black wall (0,2),(1,2),(2,2),(3,1),(3,0) outside.
  const b = boardWith(
    [
      { x: 0, y: 1, c: "white" },
      { x: 1, y: 1, c: "white" },
      { x: 2, y: 1, c: "white" },
      { x: 2, y: 0, c: "white" },
      { x: 0, y: 2, c: "black" },
      { x: 1, y: 2, c: "black" },
      { x: 2, y: 2, c: "black" },
      { x: 3, y: 1, c: "black" },
      { x: 3, y: 0, c: "black" },
    ],
    "black",
  );
  const throwIn = tryPlay(b, 0, 0); // black self-atari throw-in in the eye space
  assert(throwIn, "throw-in legal");
  const whiteCaptures = tryPlay(throwIn!, 1, 0); // white captures the throw-in
  assert(whiteCaptures, "white captures throw-in");
  assert(whiteCaptures!.captured.white === 1, "white captured one");
  assert(whiteCaptures!.ko === null, "capturing with a big group is not ko");
  // snapback: black retakes at (0,0), capturing the whole 5-stone white group
  const snap = play(whiteCaptures!, 0, 0);
  assert(snap.ok, "snapback recapture legal (needs correct ko rule)");
  if (snap.ok) {
    assert(snap.captured.length === 5, `snapback takes 5, got ${snap.captured.length}`);
  }
}

/* ---------------- positional superko mechanism ---------------- */
{
  const b = boardWith([{ x: 0, y: 0, c: "white" }], "black");
  const r = play(b, 4, 4);
  assert(r.ok, "baseline move ok");
  if (r.ok) {
    // Re-attempt the same move from a state whose history already contains
    // the resulting position key → must be rejected as superko.
    const poisoned: BoardState = { ...b, history: [...b.history, positionKey(r.state.grid, r.state.toPlay)] };
    const again = play(poisoned, 4, 4);
    assert(!again.ok && again.reason === "superko", "superko repeat rejected");
  }
}

/* ---------------- eyes ---------------- */
{
  // Solid black corner eye at (0,0): black (1,0),(0,1),(1,1)
  const b = boardWith([
    { x: 1, y: 0, c: "black" },
    { x: 0, y: 1, c: "black" },
    { x: 1, y: 1, c: "black" },
  ]);
  assert(isTrueEye(b, 0, 0, "black"), "corner true eye");
  assert(!isTrueEye(b, 0, 0, "white"), "not white's eye");
  // False eye: same shape but white holds the diagonal (1,1)
  const f = boardWith([
    { x: 1, y: 0, c: "black" },
    { x: 0, y: 1, c: "black" },
    { x: 1, y: 1, c: "white" },
  ]);
  assert(!isTrueEye(f, 0, 0, "black"), "false eye rejected");
}

/* ---------------- scoring (Japanese = territory + prisoners, default) ------- */
{
  // Black wall x=3, white wall x=5 → x<3 black territory (27), x>5 white (27),
  // x=4 column neutral (touches both). Stones are NOT counted in Japanese rules.
  const setup: { x: number; y: number; c: Color }[] = [];
  for (let y = 0; y < 9; y++) {
    setup.push({ x: 3, y, c: "black" });
    setup.push({ x: 5, y, c: "white" });
  }
  const b = boardWith(setup);
  const map = territoryMap(b);
  assert(map[idx(9, 0, 0)] === "black", "left is black territory");
  assert(map[idx(9, 8, 8)] === "white", "right is white territory");
  assert(map[idx(9, 4, 4)] === "neutral", "middle column neutral");
  const s = score(b);
  assert(s.rules === "japanese", "default rules = japanese");
  assert(s.territory.black === 27 && s.territory.white === 27, `territories 27/27, got ${s.territory.black}/${s.territory.white}`);
  assert(s.neutral === 9, "9 dame");
  assert(s.black === 27 && s.white === 27, "japanese totals = territory (stones not counted)");
  const draw = gameResult(b);
  assert(draw.winner === "draw", "no komi → draw");
  const withKomi = gameResult(b, 6.5);
  assert(withKomi.winner === "white" && withKomi.margin === 6.5, "komi decides");
  // Chinese (area) option still available for completeness
  const area = score(b, { rules: "chinese" });
  assert(area.black === 36 && area.white === 36, "chinese totals = stones + territory");
}
{
  // Prisoners count in Japanese scoring: black captures a white stone.
  const b = boardWith(
    [
      { x: 2, y: 2, c: "white" },
      { x: 1, y: 2, c: "black" },
      { x: 3, y: 2, c: "black" },
      { x: 2, y: 1, c: "black" },
    ],
    "black",
  );
  const after = tryPlay(b, 2, 3);
  const s = score(after!);
  assert(s.prisoners.black === 1, "black prisoner counted");
  assert(s.black >= 1, "prisoner adds to black's japanese score");
}
{
  // Empty board: single region touching nothing → neutral, drawn game.
  const r = gameResult(createEmptyBoard(9));
  assert(r.winner === "draw" && r.score.neutral === 81, "empty board neutral");
}

/* ---------------- AI levels ---------------- */
for (const lv of [0, 1, 2] as const) {
  const m = pickAiMove(createEmptyBoard(9), lv, mulberry32(7 + lv));
  assert(m && m.x >= 0 && m.y >= 0, `ai move level ${lv}`);
}
{
  // AI captures when available (levels 0–2)
  const b = boardWith(
    [
      { x: 2, y: 2, c: "white" },
      { x: 1, y: 2, c: "black" },
      { x: 3, y: 2, c: "black" },
      { x: 2, y: 1, c: "black" },
    ],
    "black",
  );
  for (const lv of [0, 1, 2] as const) {
    let hits = 0;
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const m = pickAiMove(b, lv, rng);
      if (m && m.x === 2 && m.y === 3) hits++;
    }
    assert(hits >= (lv === 0 ? 20 : 15), `L${lv} captures (hits=${hits})`);
  }
}
{
  // L1 rescues its own group from atari
  const b = boardWith(
    [
      { x: 4, y: 4, c: "black" }, // black group in atari…
      { x: 3, y: 4, c: "white" },
      { x: 5, y: 4, c: "white" },
      { x: 4, y: 3, c: "white" },
    ],
    "black",
  );
  const m = pickAiMove(b, 1, mulberry32(1));
  assert(m && m.x === 4 && m.y === 5, `L1 escapes atari, got ${m?.x},${m?.y}`);
}
{
  // AI never fills its own true eye
  const setup: { x: number; y: number; c: Color }[] = [];
  // black everywhere except two eyes at (0,0) and (8,8)
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      if ((x === 0 && y === 0) || (x === 8 && y === 8)) continue;
      setup.push({ x, y, c: "black" });
    }
  const b = boardWith(setup, "black");
  const m1 = pickAiMove(b, 1, mulberry32(3));
  assert(m1 === null, "L1 passes rather than fill own eyes");
  const m2 = pickAiMove(b, 2, mulberry32(3));
  assert(m2 === null, "L2 passes rather than fill own eyes");
}

/* ---------------- self-play: L2 beats L1; L1 beats L0 ---------------- */
function selfPlay(
  levelBlack: 0 | 1 | 2,
  levelWhite: 0 | 1 | 2,
  games: number,
  seed: number,
): { black: number; white: number; draws: number } {
  const tally = { black: 0, white: 0, draws: 0 };
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(seed + g * 977);
    let s = createEmptyBoard(9);
    let moves = 0;
    while (!isGameOver(s) && moves < 200) {
      const lv = s.toPlay === "black" ? levelBlack : levelWhite;
      const m = pickAiMove(s, lv, rng);
      if (m === null) {
        s = pass(s);
      } else {
        const r = play(s, m.x, m.y);
        s = r.ok ? r.state : pass(s); // defensive: illegal pick = pass
      }
      moves++;
    }
    const res = gameResult(s, 0);
    if (res.winner === "draw") tally.draws++;
    else tally[res.winner]++;
  }
  return tally;
}
{
  const t21 = selfPlay(2, 1, 10, 1234);
  const t12 = selfPlay(1, 2, 10, 5678);
  const l2wins = t21.black + t12.white;
  assert(l2wins >= 12, `L2 beats L1 (won ${l2wins}/20)`);
  const t10 = selfPlay(1, 0, 10, 999);
  const t01 = selfPlay(0, 1, 10, 888);
  const l1wins = t10.black + t01.white;
  assert(l1wins >= 13, `L1 beats L0 (won ${l1wins}/20)`);
}

/* ---------------- performance budget ---------------- */
{
  // mid-game board via 30 random moves
  const rng = mulberry32(2024);
  let s = createEmptyBoard(9);
  for (let i = 0; i < 30; i++) {
    const legal = listLegalMoves(s);
    if (!legal.length) break;
    const m = legal[Math.floor(rng() * legal.length)]!;
    const r = play(s, m.x, m.y);
    if (r.ok) s = r.state;
  }
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) pickAiMove(s, 2, rng);
  const per = (Date.now() - t0) / 10;
  assert(per < 50, `L2 move under 50ms (got ${per.toFixed(1)}ms)`);
}

/* ---------------- capture race helper (unchanged) ---------------- */
assert(captureRaceWinner({ black: 5, white: 2 }, 5) === "black", "race black");
assert(captureRaceWinner({ black: 2, white: 5 }, 5) === "white", "race white");
assert(captureRaceWinner({ black: 4, white: 4 }, 5) === null, "race none");
assert(captureRaceWinner({ black: 6, white: 5 }, 5) === "black", "both over black leads");
assert(captureRaceWinner({ black: 5, white: 7 }, 5) === "white", "both over white leads");
assert(captureRaceWinner({ black: 5, white: 5 }, 5) === null, "both equal draw");

/* ---------------- AI_TUNING sanity ---------------- */
assert(AI_TUNING.pickBest + AI_TUNING.pickSecond < 1, "tuning probabilities leave room for exploration");

console.log(`engine.test.ts: all ${passed} assertions passed`);
