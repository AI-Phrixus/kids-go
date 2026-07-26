/**
 * Best-effort in-memory rate limiter (per isolate — Workers Free has no
 * durable limiter binding). Single shared implementation for all routes;
 * expired entries are evicted opportunistically so the map cannot grow
 * without bound.
 */

type Row = { n: number; t: number };

const hits = new Map<string, Row>();
let lastSweep = 0;

function sweep(now: number, windowMs: number): void {
  // At most one sweep per 30s; drops entries older than the largest window.
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [k, v] of hits) {
    if (now - v.t > Math.max(windowMs, 120_000)) hits.delete(k);
  }
}

/** Returns true when the call is allowed. */
export function rateOk(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const row = hits.get(key);
  if (!row || now - row.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return true;
  }
  if (row.n >= max) return false;
  row.n += 1;
  return true;
}

/** Test hook. */
export function _resetRateLimits(): void {
  hits.clear();
  lastSweep = 0;
}
