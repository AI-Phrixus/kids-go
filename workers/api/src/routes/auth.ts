import { Hono } from "hono";
import { hashPassword, hashPin, uid, verifyPassword, verifyPin } from "../crypto";
import {
  clearSessionCookie,
  cookieSecureFromRequest,
  createSession,
  loadSession,
  sessionCookie,
  setSessionChild,
} from "../session";
import { sanitizeNickname } from "../sanitize";
import { rateOk } from "../middleware/rateLimit";
import { readJson } from "../middleware/body";
import type { Env, Locale } from "../types";

const auth = new Hono<{ Bindings: Env }>();

function setSessionHeader(c: { req: { raw: Request }; header: (k: string, v: string) => void }, sid: string) {
  const secure = cookieSecureFromRequest(c.req.raw);
  c.header("Set-Cookie", sessionCookie(sid, secure));
}

function okLocale(v: unknown): Locale {
  return v === "ja" || v === "zh-Hant" || v === "en" ? v : "ja";
}

/* ---------------- failed-login lockout (v0.8.0) ---------------- */

const LOCK_START_AFTER = 3; // free attempts before backoff kicks in
const LOCK_BASE_MS = 30_000; // 30s, doubling per extra failure
const LOCK_MAX_MS = 15 * 60_000; // 15 min cap

type LockRow = { id: string; failed_login_attempts: number; login_locked_until: number };

function lockedFor(row: LockRow | null | undefined): number {
  if (!row) return 0;
  const left = (row.login_locked_until ?? 0) - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

async function recordLoginFailure(env: Env, userId: string, attempts: number): Promise<void> {
  const next = attempts + 1;
  let lockedUntil = 0;
  if (next >= LOCK_START_AFTER) {
    const ms = Math.min(LOCK_BASE_MS * 2 ** (next - LOCK_START_AFTER), LOCK_MAX_MS);
    lockedUntil = Date.now() + ms;
  }
  await env.DB.prepare(
    `UPDATE users SET failed_login_attempts = ?, login_locked_until = ? WHERE id = ?`,
  )
    .bind(next, lockedUntil, userId)
    .run();
}

async function clearLoginFailures(env: Env, userId: string, attempts: number): Promise<void> {
  if (!attempts) return;
  await env.DB.prepare(
    `UPDATE users SET failed_login_attempts = 0, login_locked_until = 0 WHERE id = ?`,
  )
    .bind(userId)
    .run();
}

/* ---------------- registration ---------------- */

auth.post("/register/parent", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  // Shared NAT (school/home) may share one IP — keep soft but not too tight
  if (!rateOk(`reg:${ip}`, 30, 60_000)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{
    email?: string;
    password?: string;
    childNickname?: string;
    locale?: string;
  }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const nick = sanitizeNickname(body.childNickname);
  const locale = okLocale(body.locale);
  if (!email || password.length < 6 || !nick || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "invalid_input" }, 400);
  }
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (exists) return c.json({ error: "email_taken" }, 409);

  const userId = uid();
  const childId = uid();
  const now = Date.now();
  const pw = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, kind, email, password_hash, display_name, preferred_locale, created_at)
       VALUES (?, 'parent', ?, ?, ?, ?, ?)`,
    ).bind(userId, email, pw, nick, locale, now),
    c.env.DB.prepare(
      `INSERT INTO children (id, user_id, nickname, preferred_locale, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(childId, userId, nick, locale, now),
    c.env.DB.prepare(
      `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
       VALUES (?, 'L01', 'in_progress', 0, ?)`,
    ).bind(childId, now),
  ]);

  const sid = await createSession(c.env, userId, childId);
  setSessionHeader(c, sid);
  return c.json({ ok: true, userId, childId });
});

auth.post("/register/quick", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  if (!rateOk(`reg:${ip}`, 30, 60_000)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{ nickname?: string; pin?: string; locale?: string }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;
  const nick = sanitizeNickname(body.nickname);
  const pin = (body.pin ?? "").trim();
  const locale = okLocale(body.locale);
  if (!nick || !/^\d{4,6}$/.test(pin)) {
    return c.json({ error: "invalid_input", hint: "nickname + 4-6 digit pin" }, 400);
  }
  const taken = await c.env.DB.prepare(
    `SELECT id FROM users WHERE kind = 'quick' AND display_name = ?`,
  )
    .bind(nick)
    .first();
  if (taken) return c.json({ error: "nickname_taken" }, 409);
  const userId = uid();
  const childId = uid();
  const now = Date.now();
  const pinHash = await hashPin(pin);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, kind, display_name, pin_hash, preferred_locale, created_at)
       VALUES (?, 'quick', ?, ?, ?, ?)`,
    ).bind(userId, nick, pinHash, locale, now),
    c.env.DB.prepare(
      `INSERT INTO children (id, user_id, nickname, preferred_locale, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(childId, userId, nick, locale, now),
    c.env.DB.prepare(
      `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
       VALUES (?, 'L01', 'in_progress', 0, ?)`,
    ).bind(childId, now),
  ]);
  const sid = await createSession(c.env, userId, childId);
  setSessionHeader(c, sid);
  return c.json({ ok: true, userId, childId });
});

/* ---------------- login (with lockout) ---------------- */

auth.post("/login", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  if (!rateOk(`login:${ip}`, 40, 60_000)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{
    mode?: "parent" | "quick";
    email?: string;
    password?: string;
    nickname?: string;
    pin?: string;
  }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;

  if (body.mode === "quick") {
    const nick = (body.nickname ?? "").trim();
    const pin = (body.pin ?? "").trim();
    const user = await c.env.DB.prepare(
      `SELECT id, pin_hash, failed_login_attempts, login_locked_until
       FROM users WHERE kind = 'quick' AND display_name = ?`,
    )
      .bind(nick)
      .first<LockRow & { pin_hash: string }>();
    const lockLeft = lockedFor(user);
    if (lockLeft > 0) {
      return c.json({ error: "account_locked", retryAfterSec: lockLeft }, 429);
    }
    if (!user?.pin_hash || !(await verifyPin(pin, user.pin_hash))) {
      if (user) await recordLoginFailure(c.env, user.id, user.failed_login_attempts ?? 0);
      return c.json({ error: "auth_failed" }, 401);
    }
    await clearLoginFailures(c.env, user.id, user.failed_login_attempts ?? 0);
    const child = await c.env.DB.prepare(
      "SELECT id FROM children WHERE user_id = ? ORDER BY created_at LIMIT 1",
    )
      .bind(user.id)
      .first<{ id: string }>();
    const sid = await createSession(c.env, user.id, child?.id ?? null);
    setSessionHeader(c, sid);
    return c.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = await c.env.DB.prepare(
    `SELECT id, password_hash, failed_login_attempts, login_locked_until
     FROM users WHERE kind = 'parent' AND email = ?`,
  )
    .bind(email)
    .first<LockRow & { password_hash: string }>();
  const lockLeft = lockedFor(user);
  if (lockLeft > 0) {
    return c.json({ error: "account_locked", retryAfterSec: lockLeft }, 429);
  }
  if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
    if (user) await recordLoginFailure(c.env, user.id, user.failed_login_attempts ?? 0);
    return c.json({ error: "auth_failed" }, 401);
  }
  await clearLoginFailures(c.env, user.id, user.failed_login_attempts ?? 0);
  const child = await c.env.DB.prepare(
    "SELECT id FROM children WHERE user_id = ? ORDER BY created_at LIMIT 1",
  )
    .bind(user.id)
    .first<{ id: string }>();
  const sid = await createSession(c.env, user.id, child?.id ?? null);
  setSessionHeader(c, sid);
  return c.json({ ok: true });
});

/* ---------------- session-scoped endpoints ---------------- */

auth.post("/logout", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (sess) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sess.sessionId).run();
  }
  c.header("Set-Cookie", clearSessionCookie(cookieSecureFromRequest(c.req.raw)));
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const children = await c.env.DB.prepare(
    "SELECT id, nickname, preferred_locale, avatar_id, eyecare_json FROM children WHERE user_id = ?",
  )
    .bind(sess.user.id)
    .all();
  return c.json({
    user: sess.user,
    child: sess.child,
    children: children.results ?? [],
  });
});

auth.post("/children", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const parsed = await readJson<{ nickname?: string; locale?: string }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const nick = sanitizeNickname(parsed.body.nickname);
  if (!nick) return c.json({ error: "invalid_input" }, 400);
  const locale = okLocale(parsed.body.locale ?? sess.user.preferred_locale);
  const childId = uid();
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO children (id, user_id, nickname, preferred_locale, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(childId, sess.user.id, nick, locale, now),
    c.env.DB.prepare(
      `INSERT INTO lesson_progress (child_id, lesson_id, status, stars, updated_at)
       VALUES (?, 'L01', 'in_progress', 0, ?)`,
    ).bind(childId, now),
  ]);
  await setSessionChild(c.env, sess.sessionId, childId);
  return c.json({ ok: true, childId });
});

auth.patch("/locale", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const parsed = await readJson<{ locale?: string }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const locale = okLocale(parsed.body.locale);
  await c.env.DB.prepare(`UPDATE users SET preferred_locale = ? WHERE id = ?`)
    .bind(locale, sess.user.id)
    .run();
  if (sess.child) {
    await c.env.DB.prepare(`UPDATE children SET preferred_locale = ? WHERE id = ?`)
      .bind(locale, sess.child.id)
      .run();
  }
  return c.json({ ok: true, locale });
});

auth.post("/children/:id/select", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const child = await c.env.DB.prepare(
    "SELECT id FROM children WHERE id = ? AND user_id = ?",
  )
    .bind(id, sess.user.id)
    .first();
  if (!child) return c.json({ error: "not_found" }, 404);
  await setSessionChild(c.env, sess.sessionId, id);
  return c.json({ ok: true });
});

export default auth;
