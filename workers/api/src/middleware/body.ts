/**
 * Safe JSON body parsing: malformed input becomes a 400, never a 500,
 * and bodies over `maxBytes` are rejected (D1 free tier protection).
 */

export type ParsedBody<T> = { ok: true; body: T } | { ok: false; error: "invalid_json" | "too_large" };

export async function readJson<T>(
  req: { raw: Request },
  maxBytes = 16_384,
): Promise<ParsedBody<T>> {
  try {
    const text = await req.raw.text();
    if (text.length > maxBytes) return { ok: false, error: "too_large" };
    if (!text.trim()) return { ok: true, body: {} as T };
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}
