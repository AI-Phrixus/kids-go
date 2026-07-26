/**
 * Soft budget for Cloudflare Workers AI free tier.
 * Free plan: hard stop ~10_000 Neurons/day (UTC), no overage charge if you stay Free.
 * Soft limit (default 7_500) switches to BYOK third-party before the hard wall.
 */

export type QuotaRow = {
  day: string;
  cf_success: number;
  cf_fail_quota: number;
  byok_success: number;
  static_fallback: number;
  cf_blocked_soft: number;
  last_alert: string | null;
};

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function ensureQuotaTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS coach_quota (
        day TEXT PRIMARY KEY,
        cf_success INTEGER NOT NULL DEFAULT 0,
        cf_fail_quota INTEGER NOT NULL DEFAULT 0,
        byok_success INTEGER NOT NULL DEFAULT 0,
        static_fallback INTEGER NOT NULL DEFAULT 0,
        cf_blocked_soft INTEGER NOT NULL DEFAULT 0,
        last_alert TEXT
      )`,
    )
    .run();
}

export async function getQuota(db: D1Database, day: string): Promise<QuotaRow> {
  await ensureQuotaTable(db);
  const row = await db
    .prepare(`SELECT * FROM coach_quota WHERE day = ?`)
    .bind(day)
    .first<QuotaRow>();
  if (row) return row;
  await db
    .prepare(`INSERT OR IGNORE INTO coach_quota (day) VALUES (?)`)
    .bind(day)
    .run();
  return {
    day,
    cf_success: 0,
    cf_fail_quota: 0,
    byok_success: 0,
    static_fallback: 0,
    cf_blocked_soft: 0,
    last_alert: null,
  };
}

export async function bumpQuota(
  db: D1Database,
  day: string,
  field:
    | "cf_success"
    | "cf_fail_quota"
    | "byok_success"
    | "static_fallback"
    | "cf_blocked_soft",
): Promise<void> {
  await ensureQuotaTable(db);
  await db
    .prepare(
      `INSERT INTO coach_quota (day, ${field}) VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET ${field} = coach_quota.${field} + 1`,
    )
    .bind(day)
    .run();
}

export async function setAlert(db: D1Database, day: string, msg: string): Promise<void> {
  await ensureQuotaTable(db);
  await db
    .prepare(
      `INSERT INTO coach_quota (day, last_alert) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET last_alert = excluded.last_alert`,
    )
    .bind(day, msg)
    .run();
}

/**
 * Soft cap: count successful CF calls as proxy for neurons.
 * Default soft max calls/day — tune via COACH_CF_SOFT_MAX_CALLS.
 * ~10k neurons/day free; short coach msgs ~ dozens–hundreds neurons each.
 * Conservative default: 40 calls/day for kids app.
 */
export function softMaxCalls(env: { COACH_CF_SOFT_MAX_CALLS?: string }): number {
  const n = Number(env.COACH_CF_SOFT_MAX_CALLS ?? 40);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40;
}

export function shouldSkipWorkersAi(q: QuotaRow, maxCalls: number): boolean {
  if (q.cf_fail_quota > 0) return true; // hard quota hit today
  if (q.cf_success >= maxCalls) return true; // soft budget
  return false;
}

export function quotaStatusMessage(q: QuotaRow, maxCalls: number, locale: string): string {
  const used = q.cf_success;
  const left = Math.max(0, maxCalls - used);
  if (locale === "zh-Hant") {
    if (q.cf_fail_quota > 0) {
      return `今日 Cloudflare 免費 AI 額度已用盡，已改用備援（第三方或本地句庫）。明日 00:00 UTC 重置。`;
    }
    if (left <= 5) {
      return `提醒：今日 CF 免費教練約剩 ${left} 次（軟上限 ${maxCalls}）。用盡後自動切第三方/本地，避免踩硬限。`;
    }
    return `CF 免費教練今日已用 ${used}/${maxCalls} 次。`;
  }
  if (locale === "ja") {
    if (q.cf_fail_quota > 0) {
      return `本日の Cloudflare 無料AI枠を使い切りました。予備（外部API/定型文）に切替済み。UTC 0時にリセット。`;
    }
    if (left <= 5) {
      return `注意：本日のCF無料コーチ残り約 ${left} 回（上限 ${maxCalls}）。`;
    }
    return `CF無料コーチ本日 ${used}/${maxCalls} 回使用。`;
  }
  if (q.cf_fail_quota > 0) {
    return `Cloudflare free AI quota exhausted for today; using backup (BYOK or static). Resets 00:00 UTC.`;
  }
  if (left <= 5) {
    return `Reminder: ~${left} free CF coach calls left today (soft cap ${maxCalls}).`;
  }
  return `CF free coach used ${used}/${maxCalls} today.`;
}
