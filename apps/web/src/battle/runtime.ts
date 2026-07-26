import {
  createEmptyBoard,
  gameResult,
  groupEyeCount,
  idx,
  isGameOver,
  pass,
  pickAiMove,
  play,
  type BoardState,
  type Color,
  type GameResult,
  type Point,
} from "../../../../packages/go-engine/src/index";
import type { BattleSpec, LessonDetail, SequenceStep } from "../api";

/**
 * Battle system v2 (v0.8.0).
 * - All four modes (place_n / find_atari / capture_n / sequence) evaluated here.
 * - Optional goal predicates gate completion (v0.7 place_n lessons passed by
 *   just placing N stones anywhere).
 * - Stars are computed from real play quality (moves vs par, hints, mistakes)
 *   instead of the old hardcoded 2/3.
 * - The AI reply is RETURNED, not applied — the screen applies it after a
 *   "thinking" delay so the opponent feels real.
 */

export interface BattleRuntime {
  spec: BattleSpec;
  board: BoardState;
  playerColor: Color;
  playerMoves: number;
  hintsUsed: number;
  mistakes: number;
  scriptIndex: number;
  phase: "script" | "free" | "done";
  won: boolean;
  result: GameResult | null;
}

export function setupBoard(l: LessonDetail): BoardState {
  let b = createEmptyBoard(9);
  const setup = l.battle.setup;
  if (setup?.length) {
    const grid = b.grid.slice();
    for (const s of setup) grid[idx(9, s.x, s.y)] = s.color;
    b = { ...b, grid, toPlay: "black" as Color };
  }
  return b;
}

export function createRuntime(l: LessonDetail): BattleRuntime {
  return {
    spec: l.battle,
    board: setupBoard(l),
    playerColor: l.battle.playerColor ?? "black",
    playerMoves: 0,
    hintsUsed: 0,
    mistakes: 0,
    scriptIndex: 0,
    phase: l.battle.mode === "sequence" ? "script" : "free",
    won: false,
    result: null,
  };
}

/* ---------------- goal predicates ---------------- */

export type GoalPredicate = NonNullable<BattleSpec["goal"]>;

export function evalGoal(goal: GoalPredicate, rt: BattleRuntime): boolean {
  const b = rt.board;
  const me = rt.playerColor;
  switch (goal.type) {
    case "connected": {
      const pts = goal.points;
      if (!pts.length) return true;
      const first = pts[0]!;
      if (b.grid[idx(b.size, first.x, first.y)] !== me) return false;
      // flood the group containing the first point; all others must be inside
      const seen = new Set<number>([idx(b.size, first.x, first.y)]);
      const stack = [first];
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
          if (nx < 0 || ny < 0 || nx >= b.size || ny >= b.size) continue;
          const i = idx(b.size, nx, ny);
          if (b.grid[i] === me && !seen.has(i)) {
            seen.add(i);
            stack.push({ x: nx, y: ny });
          }
        }
      }
      return pts.every((p) => seen.has(idx(b.size, p.x, p.y)));
    }
    case "occupy": {
      const need = goal.anyOf ?? goal.points.length;
      const got = goal.points.filter((p) => b.grid[idx(b.size, p.x, p.y)] === me).length;
      return got >= need;
    }
    case "two_eyes": {
      const g = goal.group;
      if (b.grid[idx(b.size, g.x, g.y)] !== me) return false;
      return groupEyeCount(b, g.x, g.y) >= 2;
    }
    case "group_captured":
      return goal.points.every((p) => b.grid[idx(b.size, p.x, p.y)] === null);
    case "capture_at_least":
      return (me === "black" ? b.captured.black : b.captured.white) >= goal.n;
    case "territory_lead": {
      const r = gameResult(b, goal.komi ?? 0);
      return r.winner === me && r.margin >= (goal.margin ?? 0);
    }
    case "all":
      return goal.of.every((g) => evalGoal(g, rt));
    default:
      return true;
  }
}

/* ---------------- stars ---------------- */

export function defaultPar(spec: BattleSpec): number {
  if (spec.par) return spec.par;
  if (spec.mode === "place_n" || spec.mode === "capture_n") return (spec.n ?? 4) + 4;
  if (spec.mode === "sequence") return (spec.script?.length ?? 4) + 4;
  return 3;
}

export function computeStars(rt: BattleRuntime): 1 | 2 | 3 {
  const par = defaultPar(rt.spec);
  if (rt.hintsUsed === 0 && rt.mistakes === 0 && rt.playerMoves <= par) return 3;
  if (rt.hintsUsed <= 1 && rt.mistakes <= 2 && rt.playerMoves <= par + 3) return 2;
  return 1;
}

/* ---------------- move handling ---------------- */

export interface MoveOutcome {
  verdict: "accepted" | "rejected-wrong" | "rejected-illegal";
  /** stones captured by the accepted player move (for animation) */
  captured: Point[];
  /** AI reply to apply after a thinking delay; null = no reply/AI passes */
  aiReply: Point | "pass" | null;
  status: "ongoing" | "won" | "lost";
  /** localized-status hint key for sequence steps (shown after 2 wrong tries) */
  hintKey?: string;
  sayKey?: string;
}

function matchesExpect(
  rt: BattleRuntime,
  step: SequenceStep,
  x: number,
  y: number,
  captured: Point[],
  boardAfter: BoardState,
): boolean {
  const exp = step.expect;
  if (exp === "any-capture") return captured.length > 0;
  if (exp === "any-atari") {
    // some enemy group at exactly 1 liberty after the move
    const opp: Color = rt.playerColor === "black" ? "white" : "black";
    const seen = new Set<number>();
    for (let i = 0; i < boardAfter.grid.length; i++) {
      if (boardAfter.grid[i] !== opp || seen.has(i)) continue;
      const members: Point[] = [];
      const stack = [i];
      const group = new Set<number>([i]);
      let libs = 0;
      const libSet = new Set<number>();
      while (stack.length) {
        const p = stack.pop()!;
        members.push({ x: p % boardAfter.size, y: (p / boardAfter.size) | 0 });
        const px = p % boardAfter.size;
        const py = (p / boardAfter.size) | 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= boardAfter.size || ny >= boardAfter.size) continue;
          const q = idx(boardAfter.size, nx, ny);
          const c = boardAfter.grid[q];
          if (c === null) libSet.add(q);
          else if (c === opp && !group.has(q)) {
            group.add(q);
            stack.push(q);
          }
        }
      }
      libs = libSet.size;
      for (const g of group) seen.add(g);
      if (libs === 1) return true;
    }
    return false;
  }
  if (exp === "pass") return false; // pass is handled via onPlayerPass
  return (exp as { x: number; y: number }[]).some((p) => p.x === x && p.y === y);
}

/** Player tapped (x,y). Mutates rt. */
export function onPlayerMove(rt: BattleRuntime, x: number, y: number): MoveOutcome {
  const spec = rt.spec;

  // find_atari: tap-only mode, no stone actually played (v0.7 behavior kept)
  if (spec.mode === "find_atari") {
    const pts = spec.points ?? [];
    const hit = pts.some(([px, py]) => px === x && py === y);
    if (hit) {
      rt.won = true;
      rt.phase = "done";
      return { verdict: "accepted", captured: [], aiReply: null, status: "won" };
    }
    rt.mistakes++;
    return { verdict: "rejected-wrong", captured: [], aiReply: null, status: "ongoing" };
  }

  const r = play(rt.board, x, y);
  if (!r.ok) {
    return { verdict: "rejected-illegal", captured: [], aiReply: null, status: "ongoing" };
  }

  if (spec.mode === "sequence" && rt.phase === "script") {
    const step = spec.script?.[rt.scriptIndex];
    if (!step) {
      rt.phase = "free"; // defensive: script exhausted
    } else if (!matchesExpect(rt, step, x, y, r.captured, r.state)) {
      rt.mistakes++;
      // board NOT advanced — the wrong move is rolled back
      return {
        verdict: "rejected-wrong",
        captured: [],
        aiReply: null,
        status: "ongoing",
        hintKey: rt.mistakes >= 2 ? step.hintKey : undefined,
      };
    } else {
      rt.board = r.state;
      rt.playerMoves++;
      rt.scriptIndex++;
      const reply = step.reply;
      let aiReply: Point | "pass" | null = null;
      if (reply === "pass") aiReply = "pass";
      else if (reply === "ai") aiReply = pickAiMove(rt.board, (spec.aiLevel ?? 0) as 0 | 1 | 2) ?? "pass";
      else if (reply) aiReply = { x: reply.x, y: reply.y };
      const scriptDone = rt.scriptIndex >= (spec.script?.length ?? 0);
      if (scriptDone) {
        if ((spec.afterScript ?? "won") === "won") {
          // goal may still apply (e.g. group_captured verified by the script end)
          if (!spec.goal || evalGoal(spec.goal, rt)) {
            rt.won = true;
            rt.phase = "done";
            return { verdict: "accepted", captured: r.captured, aiReply, status: "won", sayKey: step.sayKey };
          }
        }
        rt.phase = "free";
      }
      return { verdict: "accepted", captured: r.captured, aiReply, status: "ongoing", sayKey: step.sayKey };
    }
  }

  // free phase (place_n / capture_n / sequence-after-script)
  rt.board = r.state;
  rt.playerMoves++;

  const status = checkCompletion(rt);
  if (status !== "ongoing") {
    return { verdict: "accepted", captured: r.captured, aiReply: null, status };
  }
  const aiReply = pickAiMove(rt.board, (spec.aiLevel ?? 0) as 0 | 1 | 2) ?? "pass";
  return { verdict: "accepted", captured: r.captured, aiReply, status: "ongoing" };
}

/** Apply the AI's reply (after the thinking delay). Returns captured stones. */
export function applyAiReply(rt: BattleRuntime, reply: Point | "pass"): { captured: Point[]; status: "ongoing" | "won" | "lost" } {
  if (reply === "pass") {
    rt.board = pass(rt.board);
  } else {
    const r = play(rt.board, reply.x, reply.y);
    if (r.ok) {
      rt.board = r.state;
      const status = checkCompletion(rt);
      return { captured: r.captured, status };
    }
    rt.board = pass(rt.board);
  }
  return { captured: [], status: checkCompletion(rt) };
}

/** Player passes (free phase / endgame lessons). */
export function onPlayerPass(rt: BattleRuntime): { status: "ongoing" | "won" | "lost"; aiReply: Point | "pass" | null } {
  rt.board = pass(rt.board);
  if (isGameOver(rt.board)) {
    return { status: settleGameOver(rt), aiReply: null };
  }
  const aiReply = pickAiMove(rt.board, (rt.spec.aiLevel ?? 0) as 0 | 1 | 2) ?? "pass";
  return { status: "ongoing", aiReply };
}

function settleGameOver(rt: BattleRuntime): "won" | "lost" {
  const goal = rt.spec.goal;
  rt.result = gameResult(rt.board, goal?.type === "territory_lead" ? (goal.komi ?? 0) : 0);
  const won = goal ? evalGoal(goal, rt) : rt.result.winner === rt.playerColor;
  rt.won = won;
  rt.phase = "done";
  return won ? "won" : "lost";
}

function checkCompletion(rt: BattleRuntime): "ongoing" | "won" | "lost" {
  const spec = rt.spec;
  if (isGameOver(rt.board)) return settleGameOver(rt);

  const goalOk = spec.goal ? evalGoal(spec.goal, rt) : true;

  if (spec.mode === "place_n") {
    const need = spec.n ?? 10;
    if (rt.playerMoves >= need && goalOk && spec.goal) {
      rt.won = true;
      rt.phase = "done";
      return "won";
    }
    if (!spec.goal && rt.playerMoves >= need) {
      rt.won = true;
      rt.phase = "done";
      return "won";
    }
    // goal not yet met: allow extra moves up to par + 4, then it's a retry
    if (spec.goal && rt.playerMoves >= defaultPar(spec) + 4) {
      rt.phase = "done";
      return "lost";
    }
    return "ongoing";
  }

  if (spec.mode === "capture_n") {
    const need = spec.n ?? 1;
    const caps = rt.playerColor === "black" ? rt.board.captured.black : rt.board.captured.white;
    if (caps >= need && goalOk) {
      rt.won = true;
      rt.phase = "done";
      return "won";
    }
    return "ongoing";
  }

  if (spec.mode === "sequence" && rt.phase === "free") {
    if (spec.goal && evalGoal(spec.goal, rt)) {
      rt.won = true;
      rt.phase = "done";
      return "won";
    }
    // lose condition: player's own key group captured? handled via game over/goal
    return "ongoing";
  }

  return "ongoing";
}
