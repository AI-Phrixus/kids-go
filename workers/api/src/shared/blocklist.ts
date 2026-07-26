/**
 * Shared kid-safety text rules — used by BOTH friend chat (inbound, child to
 * child) and the AI coach (outbound, model to child). Single source so the
 * two filters can never drift apart.
 */

/** Crude profanity / unsafe-topic blocklist (zh/ja/en snippets). */
export const BAD_CONTENT_RE =
  /(色情|裸體|裸体|自殺|自杀|殺人|杀人|毒品|操你|傻逼|去死|白痴|廢物|废物|エロ|死ね|バカ野郎|クソガキ|\bfuck\b|\bshit\b|\bbitch\b|\basshole\b|\bkill yourself\b|\bkys\b|\bsuicide\b|\bporn\b|\bsex\b|\bdrugs?\b)/i;

/** URLs / contact-info patterns that must never reach a child from either path. */
export const CONTACT_RE =
  /(https?:\/\/|www\.|@[a-z0-9_]{2,}|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b\d{8,}\b|line id|line：|line:|微信|weixin|wechat|whatsapp|instagram|tiktok|discord)/i;

export function hasBlockedContent(s: string): boolean {
  return BAD_CONTENT_RE.test(s);
}

export function hasContactInfo(s: string): boolean {
  return CONTACT_RE.test(s);
}
