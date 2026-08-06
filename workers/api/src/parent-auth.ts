import { verifyPassword } from "./crypto";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "./login-throttle";
import type { SessionContext } from "./session";
import type { Env } from "./types";

export async function verifyParentAccess(
  env: Env,
  sess: SessionContext,
  password: unknown,
): Promise<boolean> {
  if (sess.user.kind !== "parent" || typeof password !== "string" || password.length > 128) {
    return false;
  }
  const subject = `parent-action:${sess.user.id}`;
  if (!(await loginAllowed(env.DB, subject))) return false;
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(sess.user.id)
    .first<{ password_hash: string | null }>();
  const ok = Boolean(row?.password_hash && (await verifyPassword(password, row.password_hash)));
  if (!ok) {
    await recordLoginFailure(env.DB, subject);
    return false;
  }
  await clearLoginFailures(env.DB, subject);
  return true;
}
