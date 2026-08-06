export function utcQuotaDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function consumeDailyQuota(
  db: D1Database,
  scope: string,
  max: number,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO daily_quota (scope, day, count) VALUES (?, ?, 1)
       ON CONFLICT(scope, day) DO UPDATE SET count = daily_quota.count + 1
       WHERE daily_quota.count < ?`,
    )
    .bind(scope, utcQuotaDay(), max)
    .run();
  return Number(result.meta.changes) > 0;
}
