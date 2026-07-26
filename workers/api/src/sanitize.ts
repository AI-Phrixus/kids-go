/**
 * Kid-safe nickname: letters (any script), numbers, spaces, limited punctuation.
 * Blocks HTML/script injection characters.
 */
export function sanitizeNickname(raw: unknown, maxLen = 12): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFKC").trim();
  // strip control chars
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  // ban markup / quotes that break attributes
  if (/[<>&`"\\/]/.test(s)) return null;
  // no pure whitespace after trim
  if (!s) return null;
  // length after normalize
  if (s.length > maxLen) s = s.slice(0, maxLen);
  // must contain at least one letter or number (any unicode letter/number)
  if (!/[\p{L}\p{N}]/u.test(s)) return null;
  return s;
}

export function sanitizeChildName(raw: unknown, fallback = "friend"): string {
  const n = sanitizeNickname(raw, 12);
  return n || fallback;
}
