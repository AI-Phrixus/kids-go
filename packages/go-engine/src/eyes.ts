import { idx, inBounds } from "./board";
import type { BoardState, Color } from "./types";

/**
 * True-eye test for (x,y) and `color`:
 * - the point is empty
 * - all orthogonal neighbors are `color`
 * - diagonals: on the interior at least 3 of 4 must be `color`;
 *   on edge/corner ALL existing diagonals must be `color`.
 * Conservative (a "true enough" eye for teaching AI); false eyes fail the
 * diagonal condition.
 */
export function isTrueEye(state: BoardState, x: number, y: number, color: Color): boolean {
  const { size, grid } = state;
  if (!inBounds(size, x, y)) return false;
  if (grid[idx(size, x, y)] !== null) return false;

  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(size, nx, ny)) continue;
    if (grid[idx(size, nx, ny)] !== color) return false;
  }

  let diagTotal = 0;
  let diagOwn = 0;
  for (const [dx, dy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(size, nx, ny)) continue;
    diagTotal++;
    if (grid[idx(size, nx, ny)] === color) diagOwn++;
  }
  if (diagTotal === 4) return diagOwn >= 3; // interior
  return diagOwn === diagTotal; // edge / corner: all diagonals must be own
}

/** Count true eyes adjacent to the group containing (x,y). */
export function groupEyeCount(state: BoardState, x: number, y: number): number {
  const { size, grid } = state;
  const color = grid[idx(size, x, y)];
  if (!color) return 0;
  // collect group
  const seen = new Set<number>([idx(size, x, y)]);
  const stack = [{ x, y }];
  const adjacentEmpties = new Set<number>();
  while (stack.length) {
    const p = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!inBounds(size, nx, ny)) continue;
      const i = idx(size, nx, ny);
      const c = grid[i];
      if (c === null) adjacentEmpties.add(i);
      else if (c === color && !seen.has(i)) {
        seen.add(i);
        stack.push({ x: nx, y: ny });
      }
    }
  }
  let eyes = 0;
  for (const i of adjacentEmpties) {
    if (isTrueEye(state, i % size, (i / size) | 0, color)) eyes++;
  }
  return eyes;
}
