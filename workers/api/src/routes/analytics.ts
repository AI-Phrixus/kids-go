import { Hono } from "hono";
import { uid } from "../crypto";
import { loadSession } from "../session";
import type { Env } from "../types";

const analytics = new Hono<{ Bindings: Env }>();

const ALLOWED = new Set([
  "session_start",
  "lesson_start",
  "lesson_complete",
  "break_complete",
  "free_play_start",
  "capture_race_win",
  "coach_hint",
]);

analytics.post("/events", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  // Require login — block anonymous DB spam
  if (!sess?.user) return c.json({ error: "unauthorized" }, 401);
  let body: { event?: string; payload?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const event = String(body.event || "");
  if (!ALLOWED.has(event)) return c.json({ error: "invalid_event" }, 400);
  const id = uid();
  let payload = "{}";
  try {
    payload = JSON.stringify(body.payload ?? {});
  } catch {
    payload = "{}";
  }
  if (payload.length > 2000) payload = "{}";
  try {
    await c.env.DB.prepare(
      `INSERT INTO usage_events (id, child_id, user_id, event_type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, sess?.child?.id ?? null, sess?.user?.id ?? null, event, payload, Date.now())
      .run();
  } catch {
    // Table missing or transient — never break the game UX
    return c.json({ ok: false, error: "store_failed" }, 200);
  }
  return c.json({ ok: true });
});

analytics.get("/stats", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const childId = sess.child.id;
  const since = Date.now() - 30 * 86_400_000;

  const map: Record<string, number> = {};
  try {
    const rows = await c.env.DB.prepare(
      `SELECT event_type, COUNT(*) as n FROM usage_events
       WHERE child_id = ? AND created_at >= ?
       GROUP BY event_type`,
    )
      .bind(childId, since)
      .all<{ event_type: string; n: number }>();
    for (const r of rows.results ?? []) map[r.event_type] = Number(r.n) || 0;
  } catch {
    /* empty stats if table missing */
  }

  const breaks = map.break_complete || 0;
  const completes = map.lesson_complete || 0;
  const sessions = map.session_start || 0;

  return c.json({
    childId,
    windowDays: 30,
    counts: map,
    summary: {
      sessions,
      lessonsCompleted: completes,
      eyeBreaks: breaks,
      freePlays: map.free_play_start || 0,
      coachHints: map.coach_hint || 0,
      breakPerLesson:
        completes > 0 ? Math.round((breaks / completes) * 100) / 100 : breaks > 0 ? breaks : 0,
    },
  });
});

export default analytics;
