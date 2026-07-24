import { listLegalMoves, tryPlay } from "./board";
import type { AiLevel, BoardState, Point } from "./types";

/** Weak teaching AI: pick a legal move by level. Never throws. */
export function pickAiMove(state: BoardState, level: AiLevel = 0): Point | null {
  const legal = listLegalMoves(state);
  if (!legal.length) return null;

  if (level === 0) {
    return legal[Math.floor(Math.random() * legal.length)] ?? null;
  }

  // L1/L2: prefer capturing or escaping — shallow heuristic
  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const m of legal) {
    const next = tryPlay(state, m.x, m.y);
    if (!next) continue;
    let score = Math.random() * 0.3;
    const capt =
      next.captured.black +
      next.captured.white -
      (state.captured.black + state.captured.white);
    score += capt * 10;
    if (level >= 2) {
      // prefer center-ish lightly
      const c = (state.size - 1) / 2;
      score -= (Math.abs(m.x - c) + Math.abs(m.y - c)) * 0.05;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
