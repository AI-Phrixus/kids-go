import { Hono } from "hono";
import { LESSONS, getLesson } from "../lessons-data";
import { loadSession } from "../session";
import type { Env } from "../types";
import { uid } from "../crypto";
import { consumeDailyQuota } from "../daily-quota";

const progress = new Hono<{ Bindings: Env }>();
const MAX_SAVED_MOVES = 200;
const MAX_MOVES_JSON_BYTES = 8_000;
const gameHits = new Map<string, { n: number; t: number }>();

function canSaveGame(childId: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = gameHits.get(childId);
  if (!row || now - row.t > windowMs) {
    gameHits.set(childId, { n: 1, t: now });
    return true;
  }
  if (row.n >= max) return false;
  row.n += 1;
  return true;
}

async function requireChild(c: {
  env: Env;
  req: { header: (n: string) => string | undefined };
}) {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess?.child) return null;
  return sess;
}

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

  let body: { status?: "in_progress" | "completed"; stars?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "invalid_json" }, 400);
  }
  const status = body.status ?? "completed";
  if (status !== "in_progress" && status !== "completed") {
    return c.json({ error: "invalid_input" }, 400);
  }
  const rawStars = body.stars ?? 1;
  if (!Number.isFinite(rawStars)) return c.json({ error: "invalid_input" }, 400);
  const stars = Math.min(3, Math.max(0, Math.trunc(rawStars)));
  const now = Date.now();

  if (!(await consumeDailyQuota(c.env.DB, `progress:${sess.child.id}`, 200))) {
    return c.json({ error: "daily_limit" }, 429);
  }
  const existing = await c.env.DB.prepare(
    `SELECT status, stars FROM lesson_progress WHERE child_id = ? AND lesson_id = ?`,
  )
    .bind(sess.child.id, lessonId)
    .first<{ status: string; stars: number }>();
  const bestStars = Math.max(existing?.stars ?? 0, stars);
  const bestStatus = existing?.status === "completed" ? "completed" : status;
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(child_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       stars = excluded.stars,
       updated_at = excluded.updated_at`,
  )
    .bind(sess.child.id, lessonId, bestStatus, bestStars, now)
    .run();

  if (bestStatus === "completed") {
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

progress.post("/games", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!canSaveGame(sess.child.id)) return c.json({ error: "rate_limited" }, 429);
  let body: {
    lessonId?: string;
    boardSize?: number;
    result?: string;
    moves?: unknown;
    aiLevel?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "invalid_json" }, 400);
  }
  const boardSize = body.boardSize ?? 9;
  const aiLevel = body.aiLevel ?? 0;
  const lessonId = body.lessonId ?? null;
  if (
    boardSize !== 9 ||
    !Number.isInteger(aiLevel) ||
    aiLevel < 0 ||
    aiLevel > 2 ||
    (lessonId !== null && (typeof lessonId !== "string" || !getLesson(lessonId))) ||
    (body.result !== undefined && typeof body.result !== "string") ||
    !Array.isArray(body.moves) ||
    body.moves.length > MAX_SAVED_MOVES
  ) {
    return c.json({ error: "invalid_input" }, 400);
  }
  const movesJson = JSON.stringify(body.moves);
  if (movesJson.length > MAX_MOVES_JSON_BYTES) {
    return c.json({ error: "payload_too_large" }, 413);
  }
  if (!(await consumeDailyQuota(c.env.DB, `games:${sess.child.id}`, 200))) {
    return c.json({ error: "daily_limit" }, 429);
  }
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO games (id, child_id, lesson_id, board_size, result, moves_json, ai_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      sess.child.id,
      lessonId,
      boardSize,
      body.result?.slice(0, 40) ?? null,
      movesJson,
      aiLevel,
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
