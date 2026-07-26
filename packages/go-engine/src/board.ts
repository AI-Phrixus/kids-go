import type {
  BoardSize,
  BoardState,
  Color,
  PlayResult,
  Point,
} from "./types";

export function createEmptyBoard(size: BoardSize = 9): BoardState {
  return {
    size,
    grid: Array(size * size).fill(null),
    toPlay: "black",
    captured: { black: 0, white: 0 },
    ko: null,
    consecutivePasses: 0,
    moveNumber: 0,
    history: [],
  };
}

export function idx(size: number, x: number, y: number): number {
  return y * size + x;
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function neighbors(size: number, x: number, y: number): Point[] {
  const out: Point[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(size, nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function opposite(c: Color): Color {
  return c === "black" ? "white" : "black";
}

/** Compact position key for superko checks: one char per point + player to move. */
export function positionKey(grid: (Color | null)[], toPlay: Color): string {
  let s = toPlay === "black" ? "b:" : "w:";
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    s += c === null ? "." : c === "black" ? "b" : "w";
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Flood-fill helpers (integer-index based — no string keys)           */
/* ------------------------------------------------------------------ */

const NBUF: number[] = [0, 0, 0, 0];

/** Write up to 4 neighbor indices of i into NBUF, return count. */
function neighborIdx(size: number, i: number): number {
  const x = i % size;
  const y = (i / size) | 0;
  let n = 0;
  if (x + 1 < size) NBUF[n++] = i + 1;
  if (x - 1 >= 0) NBUF[n++] = i - 1;
  if (y + 1 < size) NBUF[n++] = i + size;
  if (y - 1 >= 0) NBUF[n++] = i - size;
  return n;
}

/**
 * Collect the group containing index i (same color) into `out` (if given).
 * Returns the group's liberty count. 0 if the point is empty.
 */
export function collectGroup(
  grid: (Color | null)[],
  size: number,
  i: number,
  out?: number[],
): number {
  const color = grid[i];
  if (!color) return 0;
  const libs = new Set<number>();
  const seen = new Set<number>([i]);
  const stack = [i];
  while (stack.length) {
    const p = stack.pop()!;
    if (out) out.push(p);
    const n = neighborIdx(size, p);
    for (let k = 0; k < n; k++) {
      const q = NBUF[k]!;
      const c = grid[q];
      if (c === null) libs.add(q);
      else if (c === color && !seen.has(q)) {
        seen.add(q);
        stack.push(q);
      }
    }
  }
  return libs.size;
}

/** Liberties of the group containing (x,y). 0 if empty point. */
export function groupLiberties(state: BoardState, x: number, y: number): number {
  const i = idx(state.size, x, y);
  if (!state.grid[i]) return 0;
  return collectGroup(state.grid, state.size, i);
}

/* ------------------------------------------------------------------ */
/* Playing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Attempt a play with a rich result (v2 API).
 * Enforces: bounds, occupancy, suicide, simple ko (correct rule) and
 * positional superko, and rejects play after two consecutive passes.
 */
export function play(state: BoardState, x: number, y: number): PlayResult {
  const { size } = state;
  if (state.consecutivePasses >= 2) return { ok: false, reason: "game-over" };
  if (!inBounds(size, x, y)) return { ok: false, reason: "off-board" };
  const at = idx(size, x, y);
  if (state.grid[at]) return { ok: false, reason: "occupied" };
  if (state.ko === `${x},${y}`) return { ok: false, reason: "ko" };

  const color = state.toPlay;
  const opp = opposite(color);
  const grid = state.grid.slice();
  grid[at] = color;

  // Capture adjacent opponent groups with 0 liberties.
  const capturedPoints: Point[] = [];
  const capturedIdx = new Set<number>();
  const nb = neighborIdx(size, at);
  const nbs = NBUF.slice(0, nb);
  for (const q of nbs) {
    if (grid[q] !== opp || capturedIdx.has(q)) continue;
    const members: number[] = [];
    const libs = collectGroup(grid, size, q, members);
    if (libs === 0) {
      for (const m of members) {
        capturedIdx.add(m);
        grid[m] = null;
        capturedPoints.push({ x: m % size, y: (m / size) | 0 });
      }
    }
  }

  // Suicide: illegal if our stone's group still has 0 liberties after captures.
  if (collectGroup(grid, size, at) === 0) return { ok: false, reason: "suicide" };

  // Positional superko: reject recreating any earlier position (same player to move).
  const key = positionKey(grid, opp);
  if (state.history.includes(key)) return { ok: false, reason: "superko" };

  // Simple ko (fast path): single-stone capture by a single stone that is
  // itself left in atari — the classic immediately-retakeable shape.
  let ko: string | null = null;
  if (capturedPoints.length === 1) {
    const ourGroup: number[] = [];
    const ourLibs = collectGroup(grid, size, at, ourGroup);
    if (ourGroup.length === 1 && ourLibs === 1) {
      const only = capturedPoints[0]!;
      ko = `${only.x},${only.y}`;
    }
  }

  const captured = { ...state.captured };
  if (color === "black") captured.black += capturedPoints.length;
  else captured.white += capturedPoints.length;

  const next: BoardState = {
    size,
    grid,
    toPlay: opp,
    captured,
    ko,
    consecutivePasses: 0,
    moveNumber: state.moveNumber + 1,
    history: [...state.history, key],
  };
  return { ok: true, state: next, captured: capturedPoints };
}

/**
 * Legacy API: returns the new state or null if illegal.
 * Kept for existing callers; new code should use `play` for rich errors
 * and the captured-stone list (animations).
 */
export function tryPlay(state: BoardState, x: number, y: number): BoardState | null {
  const r = play(state, x, y);
  return r.ok ? r.state : null;
}

/** Pass: flips turn, clears ko, counts toward game end. */
export function pass(state: BoardState): BoardState {
  return {
    ...state,
    grid: state.grid.slice(),
    captured: { ...state.captured },
    toPlay: opposite(state.toPlay),
    ko: null,
    consecutivePasses: (state.consecutivePasses ?? 0) + 1,
    moveNumber: (state.moveNumber ?? 0) + 1,
    history: state.history ?? [],
  };
}

/** Two consecutive passes end the game. */
export function isGameOver(state: BoardState): boolean {
  return (state.consecutivePasses ?? 0) >= 2;
}

/** Legal play points for the player to move. */
export function listLegalMoves(state: BoardState): Point[] {
  const moves: Point[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (play(state, x, y).ok) moves.push({ x, y });
    }
  }
  return moves;
}
