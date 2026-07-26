import type { BoardState, Color, GameResult, Score } from "./types";

/**
 * Territory ownership per point (area/Chinese counting, kid-simplified):
 * - a stone's point belongs to its color
 * - an empty region bordered by exactly one color belongs to that color
 * - an empty region touching both colors (or nothing) is neutral (dame)
 * No dead-stone marking: lessons/free play teach "capture dead stones before
 * you pass" (documented in the in-game guide).
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

/** Area score (stones + territory); komi added to white. */
export function score(state: BoardState, komi = 0): Score {
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
  return {
    black: stonesB + terrB,
    white: stonesW + terrW + komi,
    territory: { black: terrB, white: terrW },
    stones: { black: stonesB, white: stonesW },
    neutral,
    komi,
  };
}

/** Final result from area scoring. */
export function gameResult(state: BoardState, komi = 0): GameResult {
  const s = score(state, komi);
  const margin = Math.abs(s.black - s.white);
  const winner: GameResult["winner"] =
    s.black > s.white ? "black" : s.white > s.black ? "white" : "draw";
  return { winner, margin, score: s };
}
