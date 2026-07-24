import { Hono } from "hono";
import { LESSONS, getLesson } from "../lessons-data";
import { loadSession } from "../session";
import type { Env } from "../types";
import { uid } from "../crypto";

const progress = new Hono<{ Bindings: Env }>();

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

  const body = await c.req.json<{
    status?: "in_progress" | "completed";
    stars?: number;
  }>();
  const status = body.status ?? "completed";
  const stars = Math.min(3, Math.max(0, body.stars ?? 1));
  const now = Date.now();

  const existing = await c.env.DB.prepare(
    `SELECT stars FROM lesson_progress WHERE child_id = ? AND lesson_id = ?`,
  )
    .bind(sess.child.id, lessonId)
    .first<{ stars: number }>();
  const bestStars = Math.max(existing?.stars ?? 0, stars);
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(child_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       stars = excluded.stars,
       updated_at = excluded.updated_at`,
  )
    .bind(sess.child.id, lessonId, status, bestStars, now)
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

progress.post("/games", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{
    lessonId?: string;
    boardSize?: number;
    result?: string;
    moves?: unknown;
    aiLevel?: number;
  }>();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO games (id, child_id, lesson_id, board_size, result, moves_json, ai_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      sess.child.id,
      body.lessonId ?? null,
      body.boardSize ?? 9,
      body.result ?? null,
      JSON.stringify(body.moves ?? []),
      body.aiLevel ?? 0,
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
