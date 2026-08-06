import type { AuthUser, Child, Env } from "./types";
import { uid } from "./crypto";

const COOKIE = "kids_go_sid";
const DAY = 86_400_000;

export async function createSession(
  env: Env,
  userId: string,
  childId: string | null,
): Promise<string> {
  const id = uid();
  const expires = Date.now() + 30 * DAY;
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, child_id, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, userId, childId, expires)
    .run();
  return id;
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
  sessionId: string;
};

export async function loadSession(
  env: Env,
  cookieHeader: string | undefined,
): Promise<SessionContext | null> {
  const sid = readSessionId(cookieHeader);
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.id as session_id, s.child_id, s.expires_at,
            u.id as user_id, u.kind, u.email, u.display_name, u.preferred_locale
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(sid)
    .first<{
      session_id: string;
      child_id: string | null;
      expires_at: number;
      user_id: string;
      kind: "parent" | "quick";
      email: string | null;
      display_name: string | null;
      preferred_locale: string;
    }>();

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
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
