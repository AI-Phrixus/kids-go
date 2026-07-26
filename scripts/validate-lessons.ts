/**
 * Lesson content validator (v0.8.0) — runs in CI (`npm run validate:lessons`).
 *
 * 1. Trilingual completeness of every text (titles/story/goal/skillTag/steps/hints).
 * 2. Setup stones: in bounds, no duplicates, no zero-liberty groups.
 * 3. tap steps and find_atari points: in bounds; find_atari targets really in atari.
 * 4. WINNABILITY: every lesson's battle is SIMULATED against the real engine
 *    and the real battle runtime (the same code the app runs). A lesson that
 *    cannot be completed fails CI — the class of bug where L18 “snapback”
 *    was actually a clamp can no longer ship.
 */
import {
  collectGroup,
  createEmptyBoard,
  idx,
  pickAiMove,
  play,
  type BoardState,
} from "../packages/go-engine/src/index";
import {
  applyAiReply,
  createRuntime,
  evalGoal,
  onPlayerMove,
  onPlayerPass,
  type BattleRuntime,
} from "../apps/web/src/battle/runtime";
import type { LessonDetail } from "../apps/web/src/api";
import { LESSONS, type LessonMeta } from "../workers/api/src/lessons-data";

let failures = 0;
function fail(lesson: string, msg: string): void {
  failures++;
  console.error(`✗ ${lesson}: ${msg}`);
}

const LOCALES = ["ja", "zh-Hant", "en"] as const;

function checkText(lesson: string, label: string, obj: unknown): void {
  if (!obj || typeof obj !== "object") {
    fail(lesson, `${label}: missing locale map`);
    return;
  }
  for (const L of LOCALES) {
    const v = (obj as Record<string, unknown>)[L];
    if (typeof v !== "string" || !v.trim()) fail(lesson, `${label}: missing ${L}`);
  }
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < 9 && y < 9;
}

/* ---------------- static checks ---------------- */

const ids = new Set<string>();
LESSONS.forEach((l, i) => {
  if (ids.has(l.id)) fail(l.id, "duplicate id");
  ids.add(l.id);
  if (l.order !== i + 1) fail(l.id, `order ${l.order} != ${i + 1}`);
  if (!l.badgeId) fail(l.id, "missing badgeId");
  checkText(l.id, "titles", l.titles);
  checkText(l.id, "story", l.story);
  checkText(l.id, "goal", l.goal);
  checkText(l.id, "skillTag", l.skillTag);
  l.steps.forEach((st, si) => {
    if (st.type === "info") checkText(l.id, `step[${si}].text`, st.text);
    if (st.type === "tap") {
      checkText(l.id, `step[${si}].prompt`, st.prompt);
      if (!st.correct.length) fail(l.id, `step[${si}] has no correct points`);
      for (const [x, y] of st.correct) {
        if (!inBounds(x, y)) fail(l.id, `step[${si}] tap point (${x},${y}) out of bounds`);
      }
    }
  });

  const setup = l.battle.setup ?? [];
  const seen = new Set<string>();
  for (const s of setup) {
    if (!inBounds(s.x, s.y)) fail(l.id, `setup stone (${s.x},${s.y}) out of bounds`);
    const key = `${s.x},${s.y}`;
    if (seen.has(key)) fail(l.id, `duplicate setup stone at ${key}`);
    seen.add(key);
  }
  // no zero-liberty groups in the setup position
  const board = boardFor(l);
  for (const s of setup) {
    const libs = collectGroup(board.grid, 9, idx(9, s.x, s.y));
    if (libs === 0) fail(l.id, `setup group at (${s.x},${s.y}) has zero liberties`);
  }

  if (l.battle.mode === "find_atari") {
    for (const [x, y] of l.battle.points) {
      if (!inBounds(x, y)) fail(l.id, `find_atari point (${x},${y}) out of bounds`);
      if (board.grid[idx(9, x, y)] !== "white") {
        fail(l.id, `find_atari point (${x},${y}) is not a white stone`);
      } else if (collectGroup(board.grid, 9, idx(9, x, y)) !== 1) {
        fail(l.id, `find_atari target (${x},${y}) is not actually in atari`);
      }
    }
  }
  if (l.battle.mode === "sequence") {
    if (!l.battle.script.length) fail(l.id, "sequence with empty script");
    for (const [si, step] of l.battle.script.entries()) {
      if (Array.isArray(step.expect)) {
        for (const p of step.expect) {
          if (!inBounds(p.x, p.y)) fail(l.id, `script[${si}] expect (${p.x},${p.y}) OOB`);
        }
      }
      if (step.hint) checkText(l.id, `script[${si}].hint`, step.hint);
    }
  }
});

/* ---------------- winnability simulation ---------------- */

function boardFor(l: LessonMeta): BoardState {
  const b = createEmptyBoard(9);
  const grid = b.grid.slice();
  for (const s of l.battle.setup ?? []) grid[idx(9, s.x, s.y)] = s.color;
  return { ...b, grid };
}

/** Points where the given (white) target group still breathes. */
function targetLiberties(b: BoardState, pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const out = new Set<number>();
  for (const p of pts) {
    if (b.grid[idx(9, p.x, p.y)] === null) continue;
    const members: number[] = [];
    collectGroup(b.grid, 9, idx(9, p.x, p.y), members);
    for (const m of members) {
      const mx = m % 9;
      const my = (m / 9) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = mx + dx;
        const ny = my + dy;
        if (!inBounds(nx, ny)) continue;
        if (b.grid[idx(9, nx, ny)] === null) out.add(idx(9, nx, ny));
      }
    }
  }
  return [...out].map((i) => ({ x: i % 9, y: (i / 9) | 0 }));
}

/** Pick the solver's next move in a free (non-scripted) phase. */
function solverMove(rt: BattleRuntime, l: LessonMeta): { x: number; y: number } | "pass" {
  const spec = rt.spec;
  const b = rt.board;
  // goal-directed candidates first
  const wishes: { x: number; y: number }[] = [];
  const goal = spec.goal;
  if (goal?.type === "group_captured") wishes.push(...targetLiberties(b, goal.points));
  if (goal?.type === "occupy") {
    for (const p of goal.points) if (b.grid[idx(9, p.x, p.y)] === null) wishes.push(p);
  }
  if (goal?.type === "connected" || goal?.type === "two_eyes") {
    // key point comes from the lesson's tap steps
    for (const st of l.steps) {
      if (st.type === "tap") for (const [x, y] of st.correct) wishes.push({ x, y });
    }
  }
  for (const w of wishes) {
    const r = play(b, w.x, w.y);
    if (r.ok) {
      // don't leave the placed stone in silly self-atari unless it captures
      if (r.captured.length > 0) return w;
      const libs = collectGroup(r.state.grid, 9, idx(9, w.x, w.y));
      if (libs >= 1 && (goal?.type !== "group_captured" || libs >= 1)) return w;
    }
  }
  const mv = pickAiMove(b, 2);
  return mv ?? "pass";
}

function simulateOnce(l: LessonMeta): boolean {
  const rt = createRuntime(l as unknown as LessonDetail);

  if (l.battle.mode === "find_atari") {
    const [x, y] = l.battle.points[0]!;
    // the app accepts a tap on the listed point
    const out = onPlayerMove(rt, x, y);
    return out.status === "won";
  }

  let guard = 0;
  while (rt.phase !== "done" && guard++ < 200) {
    let move: { x: number; y: number } | "pass" | null = null;

    if (rt.phase === "script" && l.battle.mode === "sequence") {
      const step = l.battle.script[rt.scriptIndex]!;
      if (Array.isArray(step.expect)) {
        // choose the first LEGAL expected point
        for (const p of step.expect) {
          if (play(rt.board, p.x, p.y).ok) {
            move = p;
            break;
          }
        }
        if (!move) return false; // no expected move is legal — content bug
      } else if (step.expect === "pass") {
        move = "pass";
      } else {
        // search for a satisfying move (capture / atari)
        for (let y = 0; y < 9 && !move; y++) {
          for (let x = 0; x < 9 && !move; x++) {
            const r = play(rt.board, x, y);
            if (!r.ok) continue;
            if (step.expect === "any-capture" && r.captured.length > 0) move = { x, y };
            if (step.expect === "any-atari") {
              // cheap: try it through the runtime and see if it's accepted
              const probe = structuredClone(rt);
              const o = onPlayerMove(probe, x, y);
              if (o.verdict === "accepted") move = { x, y };
            }
          }
        }
        if (!move) return false;
      }
    } else {
      move = solverMove(rt, l);
    }

    if (move === "pass") {
      const out = onPlayerPass(rt);
      if (out.status === "won") return true;
      if (out.status === "lost") return false;
      if (out.aiReply) applyAiReply(rt, out.aiReply);
      continue;
    }

    const out = onPlayerMove(rt, move.x, move.y);
    if (out.verdict !== "accepted") {
      // solver picked a rejected move in script phase = content bug
      if (rt.phase === "script") return false;
      // in free phase just try passing (rare dead-end)
      const p = onPlayerPass(rt);
      if (p.status === "won") return true;
      if (p.status === "lost") return false;
      if (p.aiReply) applyAiReply(rt, p.aiReply);
      continue;
    }
    if (out.status === "won") return true;
    if (out.status === "lost") return false;
    if (out.aiReply) {
      const res = applyAiReply(rt, out.aiReply);
      if (res.status === "won") return true;
      if (res.status === "lost") return false;
    }
  }
  return false;
}

for (const l of LESSONS) {
  const trials = 6;
  let wins = 0;
  for (let i = 0; i < trials; i++) if (simulateOnce(l)) wins++;
  // AI replies are stochastic; the intended solution must win most of the time
  const need = l.battle.mode === "sequence" || l.battle.mode === "find_atari" ? trials : 4;
  if (wins < Math.min(need, trials)) {
    fail(l.id, `winnability: solved ${wins}/${trials} trials`);
  } else {
    console.log(`✓ ${l.id} solvable (${wins}/${trials})`);
  }
}

if (failures) {
  console.error(`validate-lessons: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`validate-lessons: all ${LESSONS.length} lessons valid & winnable`);
