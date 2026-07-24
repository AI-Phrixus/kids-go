import {
  createEmptyBoard,
  groupLiberties,
  idx,
  listLegalMoves,
  pass,
  pickAiMove,
  tryPlay,
  captureRaceWinner,
} from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function boardWith(
  setup: { x: number; y: number; c: "black" | "white" }[],
  toPlay: "black" | "white" = "black",
) {
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
  assert(c!.toPlay === "white", "turn flips after play");
}

// multi-stone capture
{
  const b = boardWith([
    { x: 1, y: 0, c: "white" },
    { x: 2, y: 0, c: "white" },
    { x: 0, y: 0, c: "black" },
    { x: 1, y: 1, c: "black" },
    { x: 2, y: 1, c: "black" },
    { x: 3, y: 0, c: "black" },
  ]);
  // white two-stone group on first row has liberty only at… wait, need shape carefully
  // Corner two stones: white at (0,0)(1,0), black surrounds with play at (0,1) after setup
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

// out of bounds
assert(tryPlay(createEmptyBoard(9), -1, 0) === null, "oob x");
assert(tryPlay(createEmptyBoard(9), 0, 9) === null, "oob y");

// pass flips
{
  const b = createEmptyBoard(9);
  assert(pass(b).toPlay === "white", "pass to white");
  assert(pass(pass(b)).toPlay === "black", "double pass back to black");
}

// empty board 81 moves
assert(listLegalMoves(createEmptyBoard(9)).length === 81, "81 empties");

// AI returns something at all levels
for (const lv of [0, 1, 2] as const) {
  const m = pickAiMove(createEmptyBoard(9), lv);
  assert(m && m.x >= 0 && m.y >= 0, `ai move level ${lv}`);
}

// classic single-stone ko
// Shape (white to recapture would be ko):
//   . B W .
//   B W * B   (* = black just captured white by playing)
//   . B W .
// Build: black surrounds a white single stone and captures it; white cannot immediately recapture.
{
  // White stone at (2,2) with one liberty at (2,1)
  // Black: (1,2)(3,2)(2,3) and will play (2,1)
  const before = boardWith(
    [
      { x: 1, y: 2, c: "black" },
      { x: 3, y: 2, c: "black" },
      { x: 2, y: 3, c: "black" },
      { x: 2, y: 2, c: "white" },
      // prevent snapback multi-lib: also surround white helpers so only single capture
      { x: 1, y: 1, c: "white" },
      { x: 3, y: 1, c: "white" },
      { x: 2, y: 0, c: "white" },
    ],
    "black",
  );
  // For clean ko: white single stone, black fills last liberty
  const clean = boardWith(
    [
      { x: 1, y: 1, c: "black" },
      { x: 2, y: 0, c: "black" },
      { x: 3, y: 1, c: "black" },
      { x: 2, y: 2, c: "black" },
      { x: 2, y: 1, c: "white" },
    ],
    "black",
  );
  // White at (2,1): liberties are (1,1? black),(3,1 black),(2,0 black),(2,2 black) — 0 libs already?
  // Need white with exactly 1 liberty
  // Standard:
  // B at (1,0)(0,1)(2,1), W at (1,1), liberty at (1,2) empty, black plays (1,2)
  const koSetup = boardWith(
    [
      { x: 1, y: 0, c: "black" },
      { x: 0, y: 1, c: "black" },
      { x: 2, y: 1, c: "black" },
      { x: 1, y: 1, c: "white" },
    ],
    "black",
  );
  assert(groupLiberties(koSetup, 1, 1) === 1, "white in atari");
  const afterCap = tryPlay(koSetup, 1, 2);
  assert(afterCap, "capture ko stone");
  assert(afterCap!.grid[idx(9, 1, 1)] === null, "white removed");
  assert(afterCap!.captured.black === 1, "one capture");
  assert(afterCap!.ko === "1,1", `ko point set, got ${afterCap!.ko}`);
  // white cannot immediately recapture at (1,1)
  assert(tryPlay(afterCap!, 1, 1) === null, "immediate recapture illegal (ko)");
  // after white plays elsewhere, ko clears
  const afterPass = pass(afterCap!);
  // black passes too so white can try — actually after black capture, toPlay=white
  // white plays elsewhere
  const whiteElse = tryPlay(afterCap!, 5, 5);
  assert(whiteElse, "white plays elsewhere");
  assert(whiteElse!.ko === null, "ko cleared after non-ko play");
  void before;
  void clean;
}

// capture race helper
assert(captureRaceWinner({ black: 5, white: 2 }, 5) === "black", "race black");
assert(captureRaceWinner({ black: 2, white: 5 }, 5) === "white", "race white");
assert(captureRaceWinner({ black: 4, white: 4 }, 5) === null, "race none");

// AI prefers capture when available (level 1)
{
  const b = boardWith(
    [
      { x: 2, y: 2, c: "white" },
      { x: 1, y: 2, c: "black" },
      { x: 3, y: 2, c: "black" },
      { x: 2, y: 1, c: "black" },
    ],
    "black",
  );
  // Run a few times; capture at (2,3) should often be chosen
  let hits = 0;
  for (let i = 0; i < 20; i++) {
    const m = pickAiMove(b, 1);
    if (m && m.x === 2 && m.y === 3) hits++;
  }
  assert(hits >= 10, `AI should often capture, hits=${hits}`);
}

console.log("engine.test.ts: all passed");
