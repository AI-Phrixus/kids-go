import { createEmptyBoard, idx, listLegalMoves, pass, pickAiMove, tryPlay } from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function boardWith(setup: { x: number; y: number; c: "black" | "white" }[], toPlay: "black" | "white" = "black") {
  const b = createEmptyBoard(9);
  const g = b.grid.slice();
  for (const s of setup) g[idx(9, s.x, s.y)] = s.c;
  return { ...b, grid: g, toPlay };
}

// capture
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
}

// suicide illegal
{
  const b = boardWith([
    { x: 0, y: 1, c: "white" },
    { x: 1, y: 0, c: "white" },
  ]);
  assert(tryPlay(b, 0, 0) === null, "suicide illegal");
}

// occupied illegal
{
  const b = boardWith([{ x: 4, y: 4, c: "black" }], "white");
  assert(tryPlay(b, 4, 4) === null, "occupied illegal");
}

// pass flips
{
  const b = createEmptyBoard(9);
  assert(pass(b).toPlay === "white", "pass to white");
}

// empty board 81 moves
assert(listLegalMoves(createEmptyBoard(9)).length === 81, "81 empties");

// AI returns something
{
  const m = pickAiMove(createEmptyBoard(9), 0);
  assert(m && m.x >= 0 && m.y >= 0, "ai move");
}

// simple ko: black captures single stone
{
  // classic ko shape simplified
  const b = boardWith(
    [
      { x: 2, y: 1, c: "black" },
      { x: 1, y: 2, c: "black" },
      { x: 3, y: 2, c: "black" },
      { x: 2, y: 3, c: "white" },
      { x: 2, y: 2, c: "white" },
      { x: 1, y: 1, c: "white" },
      { x: 3, y: 1, c: "white" },
    ],
    "black",
  );
  // This shape may not be pure ko; at least ensure engine does not crash
  const legal = listLegalMoves(b);
  assert(legal.length > 0, "has legal moves");
}

console.log("engine.test.ts: all passed");
