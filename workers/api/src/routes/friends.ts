import { Hono } from "hono";
import { uid } from "../crypto";
import { sanitizeNickname } from "../sanitize";
import { rateOk } from "../middleware/rateLimit";
import { requireChild } from "../middleware/guards";
import { hasBlockedContent, hasContactInfo } from "../shared/blocklist";
import type { Env } from "../types";

const friends = new Hono<{ Bindings: Env }>();

const MAX_FRIENDS = 30;
const MAX_MSG_LEN = 80;
const MAX_MSGS_FETCH = 40;

/**
 * Light kid-safe filter (not comprehensive moderation).
 * v0.8.0: word/contact rules moved to shared/blocklist.ts so chat and the
 * AI coach output filter can never drift apart.
 */
function sanitizeMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFKC").trim();
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  if (/[<>`]/.test(s)) return null;
  // collapse whitespace
  s = s.replace(/\s+/g, " ");
  if (!s || s.length > MAX_MSG_LEN) return null;
  if (hasContactInfo(s)) return null;
  if (hasBlockedContent(s)) return null;
  return s;
}

function pair(a: string, b: string): { lo: string; hi: string } {
  return a < b ? { lo: a, hi: b } : { lo: b, hi: a };
}

async function findChildByNickname(db: D1Database, nickname: string) {
  const rows = await db
    .prepare(`SELECT id, nickname FROM children WHERE nickname = ? LIMIT 2`)
    .bind(nickname)
    .all<{ id: string; nickname: string }>();
  const list = rows.results ?? [];
  if (list.length === 0) return { error: "not_found" as const };
  if (list.length > 1) return { error: "ambiguous" as const };
  return { child: list[0]! };
}

async function countFriends(db: D1Database, childId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM friendships
       WHERE status = 'accepted' AND (child_lo = ? OR child_hi = ?)`,
    )
    .bind(childId, childId)
    .first<{ n: number }>();
  return Number(row?.n) || 0;
}

/** GET /api/friends — list friends + pending inbound */
friends.get("/friends", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const me = sess.child.id;

  // Single query with JOINs (v0.8.0 — was an N+1 loop of per-friend lookups)
  const rows = await c.env.DB.prepare(
    `SELECT f.id, f.child_lo, f.child_hi, f.requested_by, f.status, f.created_at, f.accepted_at,
            lo.nickname AS lo_nickname, hi.nickname AS hi_nickname
     FROM friendships f
     LEFT JOIN children lo ON lo.id = f.child_lo
     LEFT JOIN children hi ON hi.id = f.child_hi
     WHERE f.child_lo = ? OR f.child_hi = ?
     ORDER BY f.created_at DESC
     LIMIT 80`,
  )
    .bind(me, me)
    .all<{
      id: string;
      child_lo: string;
      child_hi: string;
      requested_by: string;
      status: string;
      created_at: number;
      accepted_at: number | null;
      lo_nickname: string | null;
      hi_nickname: string | null;
    }>();

  const list = rows.results ?? [];
  const nickMap = new Map<string, string>();
  for (const r of list) {
    if (r.lo_nickname) nickMap.set(r.child_lo, r.lo_nickname);
    if (r.hi_nickname) nickMap.set(r.child_hi, r.hi_nickname);
  }

  const accepted = [];
  const pendingIn = [];
  const pendingOut = [];
  for (const r of list) {
    const otherId = r.child_lo === me ? r.child_hi : r.child_lo;
    const item = {
      id: r.id,
      nickname: nickMap.get(otherId) || "?",
      childId: otherId,
      status: r.status,
      createdAt: r.created_at,
    };
    if (r.status === "accepted") accepted.push(item);
    else if (r.requested_by === me) pendingOut.push(item);
    else pendingIn.push(item);
  }

  return c.json({
    me: { id: me, nickname: sess.child.nickname },
    friends: accepted,
    pendingIn,
    pendingOut,
    limits: { maxFriends: MAX_FRIENDS, maxMsgLen: MAX_MSG_LEN },
    shareHint: sess.child.nickname,
  });
});

/** POST /api/friends/add { nickname } — request or mutual accept */
friends.post("/friends/add", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`fadd:${sess.child.id}`, 15)) return c.json({ error: "rate_limited" }, 429);

  const body = await c.req.json<{ nickname?: string }>().catch(() => ({}) as { nickname?: string });
  const nick = sanitizeNickname(body.nickname);
  if (!nick) return c.json({ error: "invalid_input" }, 400);

  const me = sess.child.id;
  if (nick === sess.child.nickname) return c.json({ error: "cannot_add_self" }, 400);

  const found = await findChildByNickname(c.env.DB, nick);
  if ("error" in found && found.error === "not_found") {
    return c.json({ error: "friend_not_found" }, 404);
  }
  if ("error" in found && found.error === "ambiguous") {
    return c.json({ error: "friend_ambiguous" }, 409);
  }
  const other = found.child!;

  if ((await countFriends(c.env.DB, me)) >= MAX_FRIENDS) {
    return c.json({ error: "friend_limit" }, 400);
  }

  const { lo, hi } = pair(me, other.id);
  const existing = await c.env.DB.prepare(
    `SELECT id, status, requested_by FROM friendships WHERE child_lo = ? AND child_hi = ?`,
  )
    .bind(lo, hi)
    .first<{ id: string; status: string; requested_by: string }>();

  const now = Date.now();

  if (existing?.status === "accepted") {
    return c.json({ ok: true, status: "accepted", friendshipId: existing.id, already: true });
  }

  if (existing?.status === "pending") {
    // Mutual request → accept
    if (existing.requested_by !== me) {
      await c.env.DB.prepare(
        `UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE id = ?`,
      )
        .bind(now, existing.id)
        .run();
      return c.json({ ok: true, status: "accepted", friendshipId: existing.id, mutual: true });
    }
    return c.json({ ok: true, status: "pending", friendshipId: existing.id, already: true });
  }

  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO friendships (id, child_lo, child_hi, requested_by, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, lo, hi, me, now)
    .run();

  return c.json({ ok: true, status: "pending", friendshipId: id });
});

/** POST /api/friends/accept { friendshipId } */
friends.post("/friends/accept", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`facc:${sess.child.id}`, 15)) return c.json({ error: "rate_limited" }, 429);
  const body = await c.req.json<{ friendshipId?: string }>().catch(() => ({}) as { friendshipId?: string });
  const fid = String(body.friendshipId || "");
  if (!fid) return c.json({ error: "invalid_input" }, 400);

  const me = sess.child.id;
  const row = await c.env.DB.prepare(
    `SELECT id, child_lo, child_hi, requested_by, status FROM friendships WHERE id = ?`,
  )
    .bind(fid)
    .first<{
      id: string;
      child_lo: string;
      child_hi: string;
      requested_by: string;
      status: string;
    }>();

  if (!row || (row.child_lo !== me && row.child_hi !== me)) {
    return c.json({ error: "not_found" }, 404);
  }
  if (row.status === "accepted") return c.json({ ok: true, status: "accepted" });
  if (row.requested_by === me) return c.json({ error: "cannot_accept_own" }, 400);

  if ((await countFriends(c.env.DB, me)) >= MAX_FRIENDS) {
    return c.json({ error: "friend_limit" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE id = ?`,
  )
    .bind(Date.now(), fid)
    .run();

  return c.json({ ok: true, status: "accepted" });
});

/** POST /api/friends/remove { friendshipId } */
friends.post("/friends/remove", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`frem:${sess.child.id}`, 15)) return c.json({ error: "rate_limited" }, 429);
  const body = await c.req.json<{ friendshipId?: string }>().catch(() => ({}) as { friendshipId?: string });
  const fid = String(body.friendshipId || "");
  const me = sess.child.id;
  const row = await c.env.DB.prepare(
    `SELECT id, child_lo, child_hi FROM friendships WHERE id = ?`,
  )
    .bind(fid)
    .first<{ id: string; child_lo: string; child_hi: string }>();
  if (!row || (row.child_lo !== me && row.child_hi !== me)) {
    return c.json({ error: "not_found" }, 404);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM friend_messages WHERE friendship_id = ?`).bind(fid),
    c.env.DB.prepare(`DELETE FROM friendships WHERE id = ?`).bind(fid),
  ]);
  return c.json({ ok: true });
});

/** GET /api/friends/messages?friendshipId= */
friends.get("/friends/messages", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const fid = c.req.query("friendshipId") || "";
  if (!fid) return c.json({ error: "invalid_input" }, 400);
  const me = sess.child.id;

  const fr = await c.env.DB.prepare(
    `SELECT id, child_lo, child_hi, status FROM friendships WHERE id = ?`,
  )
    .bind(fid)
    .first<{ id: string; child_lo: string; child_hi: string; status: string }>();
  if (!fr || (fr.child_lo !== me && fr.child_hi !== me) || fr.status !== "accepted") {
    return c.json({ error: "not_friends" }, 403);
  }

  const since = Number(c.req.query("since") || 0) || 0;
  const rows = await c.env.DB.prepare(
    `SELECT id, from_child_id, body, created_at FROM friend_messages
     WHERE friendship_id = ? AND created_at > ?
     ORDER BY created_at ASC
     LIMIT ?`,
  )
    .bind(fid, since, MAX_MSGS_FETCH)
    .all<{ id: string; from_child_id: string; body: string; created_at: number }>();

  return c.json({
    messages: (rows.results ?? []).map((m) => ({
      id: m.id,
      fromMe: m.from_child_id === me,
      body: m.body,
      at: m.created_at,
    })),
  });
});

/** POST /api/friends/messages { friendshipId, body } */
friends.post("/friends/messages", async (c) => {
  const sess = await requireChild(c);
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`fmsg:${sess.child.id}`, 30)) return c.json({ error: "rate_limited" }, 429);

  const body = await c.req.json<{ friendshipId?: string; body?: string }>().catch(() => ({}) as { friendshipId?: string; body?: string });
  const fid = String(body.friendshipId || "");
  const text = sanitizeMessage(body.body);
  if (!fid || !text) return c.json({ error: "invalid_message" }, 400);

  const me = sess.child.id;
  const fr = await c.env.DB.prepare(
    `SELECT id, child_lo, child_hi, status FROM friendships WHERE id = ?`,
  )
    .bind(fid)
    .first<{ id: string; child_lo: string; child_hi: string; status: string }>();
  if (!fr || (fr.child_lo !== me && fr.child_hi !== me) || fr.status !== "accepted") {
    return c.json({ error: "not_friends" }, 403);
  }

  const id = uid();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO friend_messages (id, friendship_id, from_child_id, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, fid, me, text, now)
    .run();

  return c.json({ ok: true, message: { id, fromMe: true, body: text, at: now } });
});

export default friends;
