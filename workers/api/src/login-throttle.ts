const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_FAILURES = 5;

type ThrottleRow = {
  attempts: number;
  window_started: number;
  locked_until: number;
};

export async function loginAllowed(db: D1Database, subject: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT attempts, window_started, locked_until FROM login_throttle WHERE subject = ?")
    .bind(subject)
    .first<ThrottleRow>();
  return !row || row.locked_until <= Date.now();
}

export async function recordLoginFailure(db: D1Database, subject: string): Promise<void> {
  const now = Date.now();
  const row = await db
    .prepare("SELECT attempts, window_started, locked_until FROM login_throttle WHERE subject = ?")
    .bind(subject)
    .first<ThrottleRow>();
  const freshWindow = !row || now - row.window_started > WINDOW_MS;
  const attempts = freshWindow ? 1 : row.attempts + 1;
  const lockedUntil = attempts >= MAX_FAILURES ? now + LOCK_MS : 0;
  await db
    .prepare(
      `INSERT INTO login_throttle (subject, attempts, window_started, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(subject) DO UPDATE SET
         attempts = excluded.attempts,
         window_started = excluded.window_started,
         locked_until = excluded.locked_until`,
    )
    .bind(subject, attempts, freshWindow ? now : row!.window_started, lockedUntil)
    .run();
}

export async function clearLoginFailures(db: D1Database, subject: string): Promise<void> {
  await db.prepare("DELETE FROM login_throttle WHERE subject = ?").bind(subject).run();
}
