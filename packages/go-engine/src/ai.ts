import { groupLiberties, listLegalMoves, tryPlay } from "./board";
import type { AiLevel, BoardState, Color, Point } from "./types";

function wouldCapture(state: BoardState, m: Point): number {
  const next = tryPlay(state, m.x, m.y);
  if (!next) return 0;
  return (
    next.captured.black +
    next.captured.white -
    (state.captured.black + state.captured.white)
  );
}

function selfInAtariAfter(state: BoardState, m: Point, color: Color): boolean {
  const next = tryPlay(state, m.x, m.y);
  if (!next) return true;
  return groupLiberties(next, m.x, m.y) <= 1;
}

/** Weak teaching AI — prefers capture/escape; avoids obvious self-atari when level≥1. */
export function pickAiMove(state: BoardState, level: AiLevel = 0): Point | null {
  const legal = listLegalMoves(state);
  if (!legal.length) return null;

  if (level === 0) {
    // still slightly prefer capturing so games feel fair for kids
    const caps = legal.filter((m) => wouldCapture(state, m) > 0);
    const pool = caps.length ? caps : legal;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  let best = legal[0]!;
  let bestScore = -Infinity;
  const me = state.toPlay;

  for (const m of legal) {
    const next = tryPlay(state, m.x, m.y);
    if (!next) continue;
    let score = Math.random() * 0.4;
    const capt = wouldCapture(state, m);
    score += capt * 20;
    if (selfInAtariAfter(state, m, me)) score -= 8;
    // prefer extending own 1-liberty groups
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        if (state.grid[y * state.size + x] !== me) continue;
        if (groupLiberties(state, x, y) === 1) {
          // bonus if move is adjacent to this group
          if (Math.abs(m.x - x) + Math.abs(m.y - y) === 1) score += 6;
        }
      }
    }
    if (level >= 2) {
      // mild preference for corners/sides (teaching value)
      const edge =
        m.x === 0 || m.y === 0 || m.x === state.size - 1 || m.y === state.size - 1;
      if (edge) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** Pass for free play / scoring later */
export function pass(state: BoardState): BoardState {
  return {
    ...state,
    toPlay: state.toPlay === "black" ? "white" : "black",
    ko: null,
  };
}
