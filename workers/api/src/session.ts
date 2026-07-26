import type { AuthUser, Child, Env } from "./types";
import { sha256hex, uid } from "./crypto";

const COOKIE = "kids_go_sid";
const DAY = 86_400_000;

/**
 * v0.8.0: session tokens are stored HASHED (sha256) in D1 — a database leak
 * no longer yields usable cookies. The raw token only ever lives in the
 * Set-Cookie header. Legacy plaintext rows (pre-0.8) still resolve via a
 * fallback lookup for one release; the nightly cron purges expired rows.
 */
export async function createSession(
  env: Env,
  userId: string,
  childId: string | null,
): Promise<string> {
  const token = uid();
  const expires = Date.now() + 30 * DAY;
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, child_id, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(await sha256hex(token), userId, childId, expires)
    .run();
  return token;
}

/** Secure on HTTPS production; omit on http localhost for local wrangler. */
export function sessionCookie(id: string, secure = true): string {
  const sec = secure ? "; Secure" : "";
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax${sec}; Max-Age=${30 * 24 * 3600}`;
}

export function clearSessionCookie(secure = true): string {
  const sec = secure ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${sec}; Max-Age=0`;
}

export function cookieSecureFromRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:";
}

export function readSessionId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)kids_go_sid=([^;]+)/);
  return m?.[1] ?? null;
}

export type SessionContext = {
  user: AuthUser;
  child: Child | null;
  /** DB row id (hashed token for v0.8 sessions). */
  sessionId: string;
};

type SessionRow = {
  session_id: string;
  child_id: string | null;
  expires_at: number;
  user_id: string;
  kind: "parent" | "quick";
  email: string | null;
  display_name: string | null;
  preferred_locale: string;
};

const SESSION_SQL = `SELECT s.id as session_id, s.child_id, s.expires_at,
        u.id as user_id, u.kind, u.email, u.display_name, u.preferred_locale
 FROM sessions s JOIN users u ON u.id = s.user_id
 WHERE s.id = ?`;

export async function loadSession(
  env: Env,
  cookieHeader: string | undefined,
): Promise<SessionContext | null> {
  const raw = readSessionId(cookieHeader);
  if (!raw) return null;

  const hashed = await sha256hex(raw);
  let row = await env.DB.prepare(SESSION_SQL).bind(hashed).first<SessionRow>();
  if (!row) {
    // Legacy plaintext session (pre-0.8) — remove this fallback in 0.8.1.
    row = await env.DB.prepare(SESSION_SQL).bind(raw).first<SessionRow>();
  }

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return null;
  }

  let child: Child | null = null;
  if (row.child_id) {
    child = await env.DB.prepare("SELECT * FROM children WHERE id = ?")
      .bind(row.child_id)
      .first<Child>();
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      kind: row.kind,
      email: row.email,
      display_name: row.display_name,
      preferred_locale: (row.preferred_locale as AuthUser["preferred_locale"]) || "ja",
    },
    child,
  };
}

export async function setSessionChild(env: Env, sessionId: string, childId: string) {
  await env.DB.prepare("UPDATE sessions SET child_id = ? WHERE id = ?")
    .bind(childId, sessionId)
    .run();
}

/** Nightly cron: drop expired sessions (legacy plaintext rows age out too). */
export async function purgeExpiredSessions(env: Env): Promise<number> {
  const r = await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?")
    .bind(Date.now())
    .run();
  return r.meta?.changes ?? 0;
}
