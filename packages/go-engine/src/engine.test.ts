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

// Intersections at corner/edge/centre have 2/3/4 orthogonal liberties.
{
  const corner = boardWith([{ x: 0, y: 0, c: "black" }]);
  const edge = boardWith([{ x: 4, y: 0, c: "black" }]);
  const centre = boardWith([{ x: 4, y: 4, c: "black" }]);
  assert(groupLiberties(corner, 0, 0) === 2, "corner intersection has two liberties");
  assert(groupLiberties(edge, 4, 0) === 3, "edge intersection has three liberties");
  assert(groupLiberties(centre, 4, 4) === 4, "centre intersection has four liberties");
}

// Corner capture: occupying both adjacent intersections removes the stone.
{
  const before = boardWith(
    [
      { x: 0, y: 0, c: "white" },
      { x: 1, y: 0, c: "black" },
    ],
    "black",
  );
  const after = tryPlay(before, 0, 1);
  assert(after?.grid[idx(9, 0, 0)] === null, "corner stone captured at zero liberties");
  assert(after?.captured.black === 1, "corner capture count");
}

// Connected two-stone edge group is captured as one group.
{
  const b = boardWith([
    { x: 0, y: 0, c: "white" },
    { x: 1, y: 0, c: "white" },
    { x: 0, y: 1, c: "black" },
    { x: 1, y: 1, c: "black" },
  ], "black");
  const after = tryPlay(b, 2, 0);
  assert(after?.grid[idx(9, 0, 0)] === null, "first connected stone removed");
  assert(after?.grid[idx(9, 1, 0)] === null, "second connected stone removed");
  assert(after?.captured.black === 2, "connected group capture count");
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
assert(tryPlay(createEmptyBoard(9), 0, 0)?.grid[idx(9, 0, 0)] === "black", "corner intersection is playable");

// AI returns something at all levels
for (const lv of [0, 1, 2] as const) {
  const m = pickAiMove(createEmptyBoard(9), lv);
  assert(m && m.x >= 0 && m.y >= 0, `ai move level ${lv}`);
}

// classic single-stone ko
// Before black plays * at (1,2):
//   . B . .
//   B W B .
//   W * W .
//   . W . .
// Black captures W at (1,1); the new black stone has only that point as a
// liberty, so an immediate white recapture would repeat the position.
{
  const koSetup = boardWith(
    [
      { x: 1, y: 0, c: "black" },
      { x: 0, y: 1, c: "black" },
      { x: 2, y: 1, c: "black" },
      { x: 1, y: 1, c: "white" },
      { x: 0, y: 2, c: "white" },
      { x: 2, y: 2, c: "white" },
      { x: 1, y: 3, c: "white" },
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
  const blackElse = tryPlay(whiteElse!, 6, 6);
  assert(blackElse, "black answers elsewhere");
  const delayedRecapture = tryPlay(blackElse!, 1, 1);
  assert(delayedRecapture, "ko recapture is legal after an intervening move");
  assert(delayedRecapture!.grid[idx(9, 1, 2)] === null, "delayed ko recapture removes stone");
}

// Capturing one stone does not create ko if the new stone has multiple liberties.
{
  const notKo = boardWith(
    [
      { x: 1, y: 0, c: "black" },
      { x: 0, y: 1, c: "black" },
      { x: 2, y: 1, c: "black" },
      { x: 1, y: 1, c: "white" },
    ],
    "black",
  );
  const after = tryPlay(notKo, 1, 2);
  assert(after?.captured.black === 1, "single stone captured in non-ko shape");
  assert(groupLiberties(after!, 1, 2) > 1, "new stone should have multiple liberties");
  assert(after?.ko === null, "non-repeating single capture incorrectly marked as ko");
}

// capture race helper
assert(captureRaceWinner({ black: 5, white: 2 }, 5) === "black", "race black");
assert(captureRaceWinner({ black: 2, white: 5 }, 5) === "white", "race white");
assert(captureRaceWinner({ black: 4, white: 4 }, 5) === null, "race none");
assert(captureRaceWinner({ black: 6, white: 5 }, 5) === "black", "both over black leads");
assert(captureRaceWinner({ black: 5, white: 7 }, 5) === "white", "both over white leads");
assert(captureRaceWinner({ black: 5, white: 5 }, 5) === null, "both equal draw");

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
