/**
 * Circuit breaker for coach provider slots (v0.8.0).
 * Failure counts persist in D1 (coach_provider_state, migration 0007) so all
 * isolates share provider health. Before this, dead OpenRouter slugs were
 * retried with a full timeout on EVERY coach request.
 *
 * Policy: 3+ consecutive failures opens the slot for 10min · 2^(n-3), capped
 * at 60min. Any success resets the row.
 */

const OPEN_AFTER = 3;
const BASE_OPEN_MS = 10 * 60_000;
const MAX_OPEN_MS = 60 * 60_000;

export type BreakerState = Map<string, { failCount: number; openUntil: number }>;

export async function loadBreakerState(db: D1Database): Promise<BreakerState> {
  const map: BreakerState = new Map();
  try {
    const rows = await db
      .prepare(`SELECT slug, fail_count, open_until FROM coach_provider_state`)
      .all<{ slug: string; fail_count: number; open_until: number }>();
    for (const r of rows.results ?? []) {
      map.set(r.slug, { failCount: r.fail_count, openUntil: r.open_until });
    }
  } catch {
    /* table missing / transient — treat all slots closed */
  }
  return map;
}

export function isOpen(state: BreakerState, slug: string, now = Date.now()): boolean {
  const row = state.get(slug);
  return Boolean(row && row.openUntil > now);
}

export async function recordFailure(
  db: D1Database,
  state: BreakerState,
  slug: string,
  now = Date.now(),
): Promise<void> {
  const prev = state.get(slug)?.failCount ?? 0;
  const next = prev + 1;
  let openUntil = 0;
  if (next >= OPEN_AFTER) {
    openUntil = now + Math.min(BASE_OPEN_MS * 2 ** (next - OPEN_AFTER), MAX_OPEN_MS);
  }
  state.set(slug, { failCount: next, openUntil });
  try {
    await db
      .prepare(
        `INSERT INTO coach_provider_state (slug, fail_count, open_until, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           fail_count = excluded.fail_count,
           open_until = excluded.open_until,
           updated_at = excluded.updated_at`,
      )
      .bind(slug, next, openUntil, now)
      .run();
  } catch {
    /* best effort */
  }
}

export async function recordSuccess(
  db: D1Database,
  state: BreakerState,
  slug: string,
): Promise<void> {
  const prev = state.get(slug);
  if (!prev || (prev.failCount === 0 && prev.openUntil === 0)) return; // write-on-change only
  state.set(slug, { failCount: 0, openUntil: 0 });
  try {
    await db
      .prepare(
        `UPDATE coach_provider_state SET fail_count = 0, open_until = 0, updated_at = ? WHERE slug = ?`,
      )
      .bind(Date.now(), slug)
      .run();
  } catch {
    /* best effort */
  }
}
