import { loadSession, type SessionContext } from "../session";
import type { Env } from "../types";

type ReqLike = {
  env: Env;
  req: { header: (n: string) => string | undefined };
};

/** Any logged-in session (user scope). */
export async function requireSession(c: ReqLike): Promise<SessionContext | null> {
  return loadSession(c.env, c.req.header("Cookie"));
}

/** Session with an active child selected (child scope). */
export async function requireChild(
  c: ReqLike,
): Promise<(SessionContext & { child: NonNullable<SessionContext["child"]> }) | null> {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess?.child) return null;
  return sess as SessionContext & { child: NonNullable<SessionContext["child"]> };
}
