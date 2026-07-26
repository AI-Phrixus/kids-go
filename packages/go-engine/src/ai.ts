import { collectGroup, idx, listLegalMoves, opposite, play } from "./board";
import { isTrueEye } from "./eyes";
import type { AiLevel, BoardState, Color, Point } from "./types";

export { pass } from "./board"; // legacy re-export (pass used to live here)

/** Tuning knobs — exported so difficulty can be adjusted in one place. */
export const AI_TUNING = {
  /** level 2 search width */
  topK: 10,
  /** level 2 pick probabilities among NEAR-BEST moves: best / second */
  pickBest: 0.7,
  pickSecond: 0.2,
  /** level 2: moves within this margin of the best count as "near-best" */
  nearMargin: 0.8,
  /** random jitter added to every candidate score */
  jitter: 0.4,
} as const;

interface Cand {
  m: Point;
  next: BoardState;
  captures: number;
  score: number;
}

/** Static evaluation from `me`'s perspective (bigger = better for me). */
function evalState(state: BoardState, me: Color): number {
  const { size, grid } = state;
  const opp = opposite(me);
  let stones = 0;
  const seenGroups = new Set<number>();
  let libDiff = 0;
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (!c) continue;
    if (c === me) stones++;
    else stones--;
    if (!seenGroups.has(i)) {
      const members: number[] = [];
      const libs = collectGroup(grid, size, i, members);
      for (const g of members) seenGroups.add(g);
      libDiff += (c === me ? 1 : -1) * Math.min(libs, 4);
    }
  }
  const capDiff =
    me === "black"
      ? state.captured.black - state.captured.white
      : state.captured.white - state.captured.black;
  return stones + 0.4 * libDiff + 2 * capDiff;
}

/** Generate scored candidates for the player to move (shared by levels 1–2). */
function candidates(state: BoardState, rng: () => number): Cand[] {
  const me = state.toPlay;
  const opp = opposite(me);
  const { size, grid } = state;

  // Precompute my groups in atari / at 2 liberties, and enemy groups at 1–2 libs.
  const groupOf = new Int32Array(size * size).fill(-1);
  const groupLibs: number[] = [];
  const groupColor: Color[] = [];
  const groupMembers: number[][] = [];
  let gId = 0;
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (!c || groupOf[i] !== -1) continue;
    const members: number[] = [];
    const libs = collectGroup(grid, size, i, members);
    for (const m of members) groupOf[m] = gId;
    groupLibs[gId] = libs;
    groupColor[gId] = c;
    groupMembers[gId] = members;
    gId++;
  }

  const out: Cand[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[idx(size, x, y)] !== null) continue;
      // never fill my own true eye
      if (isTrueEye(state, x, y, me)) continue;
      const r = play(state, x, y);
      if (!r.ok) continue;
      const next = r.state;
      const captures = r.captured.length;
      let s = rng() * AI_TUNING.jitter;
      s += captures * 20;

      // my resulting group's liberties
      const myLibs = collectGroup(next.grid, size, idx(size, x, y));
      if (captures === 0 && myLibs === 1) s -= 8; // self-atari

      // adjacency effects, computed per neighboring GROUP (not per stone)
      const touched = new Set<number>();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const g = groupOf[idx(size, nx, ny)];
        if (g === -1 || touched.has(g)) continue;
        touched.add(g);
        if (groupColor[g] === me) {
          if (groupLibs[g] === 1 && myLibs > 1) s += 10; // rescue from atari
          else if (groupLibs[g] === 2 && myLibs > 2) s += 3; // reinforce
        } else {
          // enemy group: does my move reduce it to atari?
          const enemyLibsAfter = collectGroup(next.grid, size, groupMembers[g]![0]!);
          if (groupLibs[g]! > 0 && enemyLibsAfter === 1) s += 5; // atari!
          else if (enemyLibsAfter === 2 && groupLibs[g] === 3) s += 1.5;
        }
      }
      out.push({ m: { x, y }, next, captures, score: s });
    }
  }
  return out;
}

/**
 * Teaching AI.
 * Level 0: random, but takes an available capture (fair-feeling for kids).
 * Level 1: greedy — capture > rescue own atari group > atari enemy > eval.
 * Level 2: level-1 shortlist + 2-ply lookahead (opponent replies greedily),
 *          with softened picks so kids still win often.
 * Returns null to PASS (no legal/sensible move).
 */
export function pickAiMove(
  state: BoardState,
  level: AiLevel = 0,
  rng: () => number = Math.random,
): Point | null {
  const me = state.toPlay;

  if (level === 0) {
    const legal = listLegalMoves(state);
    if (!legal.length) return null;
    const nonEye = legal.filter((m) => !isTrueEye(state, m.x, m.y, me));
    const pool0 = nonEye.length ? nonEye : legal;
    const caps = pool0.filter((m) => {
      const r = play(state, m.x, m.y);
      return r.ok && r.captured.length > 0;
    });
    const pool = caps.length ? caps : pool0;
    return pool[Math.floor(rng() * pool.length)] ?? null;
  }

  const cands = candidates(state, rng);
  if (!cands.length) return null; // nothing sensible left → pass
  cands.sort((a, b) => b.score - a.score);

  // If the opponent just passed and we are clearly ahead, pass to end and win.
  if (state.consecutivePasses === 1 && evalState(state, me) > 2) return null;

  if (level === 1) {
    return cands[0]!.m;
  }

  // level 2: shallow 2-ply over the top-K candidates
  const K = Math.min(AI_TUNING.topK, cands.length);
  const scored: { m: Point; total: number }[] = [];
  for (let i = 0; i < K; i++) {
    const c = cands[i]!;
    // opponent replies greedily (level-1 style, no lookahead)
    const oppCands = candidates(c.next, rng);
    let after = c.next;
    if (oppCands.length) {
      oppCands.sort((a, b) => b.score - a.score);
      after = oppCands[0]!.next;
    }
    // Tactical heuristic keeps full weight; the 2-ply eval adds a penalty for
    // moves that invite a strong reply (and a bonus for moves that don't).
    scored.push({ m: c.m, total: c.score + evalState(after, me) });
  }
  scored.sort((a, b) => b.total - a.total);

  // Soften only among near-best moves: variety for kids, no outright blunders.
  const near = scored.filter((s) => s.total >= scored[0]!.total - AI_TUNING.nearMargin);
  const roll = rng();
  if (roll < AI_TUNING.pickBest || near.length === 1) return near[0]!.m;
  if (roll < AI_TUNING.pickBest + AI_TUNING.pickSecond || near.length === 2)
    return near[1]!.m;
  return near[Math.floor(rng() * near.length)]!.m;
}
