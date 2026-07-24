import type { BoardSize, BoardState, Color, Point } from "./types";

export function createEmptyBoard(size: BoardSize = 9): BoardState {
  return {
    size,
    grid: Array(size * size).fill(null),
    toPlay: "black",
    captured: { black: 0, white: 0 },
    ko: null,
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

/** Liberties of the group containing (x,y). Empty if empty point. */
export function groupLiberties(state: BoardState, x: number, y: number): number {
  const color = state.grid[idx(state.size, x, y)];
  if (!color) return 0;
  const seen = new Set<string>();
  const libs = new Set<string>();
  const stack: Point[] = [{ x, y }];
  seen.add(`${x},${y}`);
  while (stack.length) {
    const p = stack.pop()!;
    for (const n of neighbors(state.size, p.x, p.y)) {
      const c = state.grid[idx(state.size, n.x, n.y)];
      const key = `${n.x},${n.y}`;
      if (!c) libs.add(key);
      else if (c === color && !seen.has(key)) {
        seen.add(key);
        stack.push(n);
      }
    }
  }
  return libs.size;
}

export function opposite(c: Color): Color {
  return c === "black" ? "white" : "black";
}

/**
 * Attempt a play. Returns new state or null if illegal (occupied, suicide, ko).
 * Minimal rules for P0/P1 kids engine — expand with tests in P1.
 */
export function tryPlay(state: BoardState, x: number, y: number): BoardState | null {
  const { size } = state;
  if (!inBounds(size, x, y)) return null;
  if (state.grid[idx(size, x, y)]) return null;
  if (state.ko === `${x},${y}`) return null;

  const color = state.toPlay;
  const grid = state.grid.slice();
  grid[idx(size, x, y)] = color;

  let next: BoardState = {
    ...state,
    grid,
    ko: null,
    captured: { ...state.captured },
  };

  // Capture opponent groups with 0 liberties
  const opp = opposite(color);
  const capturedPoints: Point[] = [];
  for (const n of neighbors(size, x, y)) {
    if (next.grid[idx(size, n.x, n.y)] !== opp) continue;
    if (groupLiberties(next, n.x, n.y) === 0) {
      removeGroup(next, n.x, n.y, capturedPoints);
    }
  }

  // Suicide illegal if still 0 liberties after captures
  if (groupLiberties(next, x, y) === 0) return null;

  if (color === "black") next.captured.black += capturedPoints.length;
  else next.captured.white += capturedPoints.length;

  // Simple single-stone ko
  if (capturedPoints.length === 1) {
    const only = capturedPoints[0]!;
    // if the play was single-stone fill of ko shape — mark return point
    next.ko = `${only.x},${only.y}`;
  }

  next.toPlay = opp;
  return next;
}

function removeGroup(state: BoardState, x: number, y: number, bag: Point[]): void {
  const color = state.grid[idx(state.size, x, y)];
  if (!color) return;
  const stack: Point[] = [{ x, y }];
  const seen = new Set<string>([`${x},${y}`]);
  while (stack.length) {
    const p = stack.pop()!;
    state.grid[idx(state.size, p.x, p.y)] = null;
    bag.push(p);
    for (const n of neighbors(state.size, p.x, p.y)) {
      const key = `${n.x},${n.y}`;
      if (state.grid[idx(state.size, n.x, n.y)] === color && !seen.has(key)) {
        seen.add(key);
        stack.push(n);
      }
    }
  }
}

/** Legal play points for color to move (for weak AI). */
export function listLegalMoves(state: BoardState): Point[] {
  const moves: Point[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (tryPlay(state, x, y)) moves.push({ x, y });
    }
  }
  return moves;
}
