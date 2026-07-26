import type { CoachRequest, CoachResponse } from "./contract";

/**
 * Coach response cache (v0.8.0) — Cloudflare Cache API, zero D1 writes.
 * Responses are cached in {{name}}-placeholder form (prompts use the literal
 * placeholder), so one cached hint serves every child safely. Per-colo scope
 * is fine for a single-family user base.
 */

const CACHE_TTL_SEC = 86_400;

async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cacheKeyFor(req: CoachRequest): Promise<string> {
  const board = await sha256hex(
    JSON.stringify([req.boardSummary ?? "", req.recentMoves ?? [], req.storyBeat ?? ""]),
  );
  return `https://coach-cache.internal/v1/${req.locale}/${req.tone}/${req.speaker ?? "wukong"}/${req.lessonId ?? "-"}/${req.skillTag ?? "-"}/${board}`;
}

function getCacheApi(): Cache | null {
  try {
    const c = (globalThis as { caches?: { default?: Cache } }).caches;
    return c?.default ?? null;
  } catch {
    return null;
  }
}

export async function cacheGet(req: CoachRequest): Promise<CoachResponse | null> {
  const cache = getCacheApi();
  if (!cache) return null;
  try {
    const hit = await cache.match(new Request(await cacheKeyFor(req)));
    if (!hit) return null;
    return (await hit.json()) as CoachResponse;
  } catch {
    return null;
  }
}

export async function cachePut(req: CoachRequest, res: CoachResponse): Promise<void> {
  const cache = getCacheApi();
  if (!cache) return;
  try {
    await cache.put(
      new Request(await cacheKeyFor(req)),
      new Response(JSON.stringify(res), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${CACHE_TTL_SEC}`,
        },
      }),
    );
  } catch {
    /* best effort */
  }
}
