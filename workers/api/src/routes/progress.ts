import { Hono } from "hono";
import { LESSONS, getLesson } from "../lessons-data";
import { readJson } from "../middleware/body";
import { requireChild } from "../middleware/guards";
import { rateOk } from "../middleware/rateLimit";
import type { Env } from "../types";
import { uid } from "../crypto";

const progress = new Hono<{ Bindings: Env }>();

progress.get("/lessons", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);

  const rows = await c.env.DB.prepare(
    "SELECT lesson_id, status, stars FROM lesson_progress WHERE child_id = ?",
  )
    .bind(sess.child.id)
    .all<{ lesson_id: string; status: string; stars: number }>();

  const map = new Map((rows.results ?? []).map((r) => [r.lesson_id, r]));

  // Unlock: L01 always; next unlocked if previous completed
  const playable = LESSONS.map((l, i) => {
    const prev = i === 0 ? null : LESSONS[i - 1]!;
    const prevDone = !prev || map.get(prev.id)?.status === "completed";
    const row = map.get(l.id);
    let status = row?.status ?? (prevDone ? "in_progress" : "locked");
    // Never show completed/unlocked if previous station is incomplete
    if (!prevDone) status = "locked";
    else if (row?.status === "completed") status = "completed";
    else if (prevDone && !row) status = "in_progress";
    return {
      id: l.id,
      order: l.order,
      titles: l.titles,
      status,
      stars: row?.stars ?? 0,
      badgeId: l.badgeId,
      playable: prevDone,
    };
  });

  return c.json({
    lessons: playable,
    child: { id: sess.child.id, nickname: sess.child.nickname },
  });
});

progress.get("/lessons/:id", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: "not_found" }, 404);

  // ensure unlocked
  const listRes = await c.env.DB.prepare(
    "SELECT lesson_id, status FROM lesson_progress WHERE child_id = ?",
  )
    .bind(sess.child.id)
    .all<{ lesson_id: string; status: string }>();
  const map = new Map((listRes.results ?? []).map((r) => [r.lesson_id, r.status]));
  const idx = LESSONS.findIndex((l) => l.id === id);
  if (idx < 0) return c.json({ error: "not_found" }, 404);
  if (idx > 0) {
    const prev = LESSONS[idx - 1]!;
    if (map.get(prev.id) !== "completed") {
      return c.json({ error: "locked" }, 403);
    }
  }

  return c.json({ lesson });
});

progress.post("/progress/:lessonId", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const lessonId = c.req.param("lessonId");
  const lesson = getLesson(lessonId);
  if (!lesson) return c.json({ error: "not_found" }, 404);

  // Sequential unlock: cannot complete/skip ahead of previous station
  const idx = LESSONS.findIndex((l) => l.id === lessonId);
  if (idx < 0) return c.json({ error: "not_found" }, 404);
  if (idx > 0) {
    const prev = LESSONS[idx - 1]!;
    const prevRow = await c.env.DB.prepare(
      `SELECT status FROM lesson_progress WHERE child_id = ? AND lesson_id = ?`,
    )
      .bind(sess.child.id, prev.id)
      .first<{ status: string }>();
    if (prevRow?.status !== "completed") {
      return c.json({ error: "locked" }, 403);
    }
  }

  const parsed = await readJson<{
    status?: string;
    stars?: number;
    hintsUsed?: number;
    movesUsed?: number;
  }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;
  // Strict enum validation (v0.8.0): an arbitrary string used to reach the
  // D1 CHECK constraint and surface as an unhandled 500.
  const status =
    body.status === "in_progress" || body.status === "completed" || body.status === undefined
      ? (body.status ?? "completed")
      : null;
  if (!status) return c.json({ error: "invalid_status" }, 400);
  const stars = Math.min(3, Math.max(0, Math.floor(Number(body.stars ?? 1)) || 0));
  const hintsUsed = Math.min(99, Math.max(0, Math.floor(Number(body.hintsUsed ?? 0)) || 0));
  const movesUsed =
    body.movesUsed === undefined ? null : Math.min(999, Math.max(0, Math.floor(Number(body.movesUsed)) || 0));
  const now = Date.now();

  const existing = await c.env.DB.prepare(
    `SELECT stars FROM lesson_progress WHERE child_id = ? AND lesson_id = ?`,
  )
    .bind(sess.child.id, lessonId)
    .first<{ stars: number }>();
  const bestStars = Math.max(existing?.stars ?? 0, stars);
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, hints_used, moves_used, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       stars = excluded.stars,
       hints_used = excluded.hints_used,
       moves_used = excluded.moves_used,
       updated_at = excluded.updated_at`,
  )
    .bind(sess.child.id, lessonId, status, bestStars, hintsUsed, movesUsed, now)
    .run();

  if (status === "completed") {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO badges (child_id, badge_id, earned_at) VALUES (?, ?, ?)`,
    )
      .bind(sess.child.id, lesson.badgeId, now)
      .run();

    // unlock next only when this lesson is legitimately sequential
    const next = LESSONS[idx + 1];
    if (next) {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
         VALUES (?, ?, 'in_progress', 0, ?)`,
      )
        .bind(sess.child.id, next.id, now)
        .run();
    }
  }

  return c.json({ ok: true, stars: bestStars, badgeId: lesson.badgeId });
});

const MAX_MOVES_JSON = 32_768; // 32KB cap (v0.8.0 — was unbounded)

progress.post("/games", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`games:${sess.child.id}`, 10)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{
    lessonId?: string;
    boardSize?: number;
    result?: string;
    moves?: unknown;
    aiLevel?: number;
    scoreBlack?: number;
    scoreWhite?: number;
  }>(c.req, MAX_MOVES_JSON + 4_096);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;
  const movesJson = JSON.stringify(Array.isArray(body.moves) ? body.moves.slice(0, 512) : []);
  if (movesJson.length > MAX_MOVES_JSON) return c.json({ error: "too_large" }, 400);
  const boardSize = body.boardSize === 9 || body.boardSize === 13 ? body.boardSize : 9;
  const aiLevel = body.aiLevel === 1 || body.aiLevel === 2 ? body.aiLevel : 0;
  const result = typeof body.result === "string" ? body.result.slice(0, 16) : null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO games (id, child_id, lesson_id, board_size, result, moves_json, ai_level, score_black, score_white, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      sess.child.id,
      typeof body.lessonId === "string" ? body.lessonId.slice(0, 8) : null,
      boardSize,
      result,
      movesJson,
      aiLevel,
      num(body.scoreBlack),
      num(body.scoreWhite),
      Date.now(),
    )
    .run();
  return c.json({ ok: true, id });
});

progress.get("/badges", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const rows = await c.env.DB.prepare(
    "SELECT badge_id, earned_at FROM badges WHERE child_id = ?",
  )
    .bind(sess.child.id)
    .all();
  return c.json({ badges: rows.results ?? [] });
});

export default progress;
