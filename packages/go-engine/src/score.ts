import type { BoardState, Color, GameResult, Score, ScoringRules } from "./types";

/**
 * Territory ownership per point (kid-simplified):
 * - a stone's point belongs to its color
 * - an empty region bordered by exactly one color belongs to that color (地)
 * - an empty region touching both colors (or nothing) is neutral (dame)
 * No dead-stone marking: lessons/free play teach "capture dead stones before
 * you pass" (documented in the in-game guide), so by the time both players
 * pass, dead stones are already prisoners.
 */
export function territoryMap(state: BoardState): (Color | "neutral" | null)[] {
  const { size, grid } = state;
  const n = size * size;
  const out: (Color | "neutral" | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (grid[i]) out[i] = grid[i];

  const visited = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (grid[i] !== null || visited[i]) continue;
    // flood this empty region
    const region: number[] = [];
    let touchesBlack = false;
    let touchesWhite = false;
    const stack = [i];
    visited[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % size;
      const y = (p / size) | 0;
      const neigh: number[] = [];
      if (x + 1 < size) neigh.push(p + 1);
      if (x - 1 >= 0) neigh.push(p - 1);
      if (y + 1 < size) neigh.push(p + size);
      if (y - 1 >= 0) neigh.push(p - size);
      for (const q of neigh) {
        const c = grid[q];
        if (c === null) {
          if (!visited[q]) {
            visited[q] = 1;
            stack.push(q);
          }
        } else if (c === "black") touchesBlack = true;
        else touchesWhite = true;
      }
    }
    const owner: Color | "neutral" =
      touchesBlack && !touchesWhite
        ? "black"
        : touchesWhite && !touchesBlack
          ? "white"
          : "neutral";
    for (const p of region) out[p] = owner;
  }
  return out;
}

export interface ScoreOpts {
  komi?: number;
  /**
   * Default "japanese" (territory + prisoners) — the ruleset Japanese children
   * learn (数目：地＋アゲハマ). "chinese" (area: stones + territory) is kept
   * for completeness but is not the product default.
   */
  rules?: ScoringRules;
}

/**
 * Score the position. Japanese (default): each side counts its surrounded
 * empty points (地) plus the opponent stones it captured (アゲハマ), white adds
 * komi. Chinese: stones on board plus territory.
 */
export function score(state: BoardState, opts: ScoreOpts | number = {}): Score {
  // back-compat: score(state, komi:number)
  const o: ScoreOpts = typeof opts === "number" ? { komi: opts } : opts;
  const komi = o.komi ?? 0;
  const rules: ScoringRules = o.rules ?? "japanese";

  const map = territoryMap(state);
  const { grid } = state;
  let stonesB = 0;
  let stonesW = 0;
  let terrB = 0;
  let terrW = 0;
  let neutral = 0;
  for (let i = 0; i < map.length; i++) {
    const stone = grid[i];
    if (stone === "black") stonesB++;
    else if (stone === "white") stonesW++;
    else if (map[i] === "black") terrB++;
    else if (map[i] === "white") terrW++;
    else if (map[i] === "neutral") neutral++;
  }
  // prisoners: captured.black = white stones black removed = black's prisoners
  const prisB = state.captured.black;
  const prisW = state.captured.white;

  const black = rules === "chinese" ? stonesB + terrB : terrB + prisB;
  const white = (rules === "chinese" ? stonesW + terrW : terrW + prisW) + komi;

  return {
    black,
    white,
    territory: { black: terrB, white: terrW },
    prisoners: { black: prisB, white: prisW },
    stones: { black: stonesB, white: stonesW },
    neutral,
    komi,
    rules,
  };
}

/** Final result. Defaults to Japanese (territory) scoring. */
export function gameResult(state: BoardState, opts: ScoreOpts | number = {}): GameResult {
  const s = score(state, opts);
  const margin = Math.abs(s.black - s.white);
  const winner: GameResult["winner"] =
    s.black > s.white ? "black" : s.white > s.black ? "white" : "draw";
  return { winner, margin, score: s };
}
