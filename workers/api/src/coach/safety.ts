import { hasBlockedContent, hasContactInfo } from "../shared/blocklist";
import type { Locale } from "./contract";

export type SafetyVerdict =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "blocklist" | "contact" | "script" | "markdown" };

/**
 * Output safety filter for coach text (v0.8.0). Before this existed, a
 * JSON-parse failure shipped raw model output straight to the child.
 * Checks: blocklist, contact info/links, language-script match, length caps.
 * Any failure → the caller falls through to the static phrase bank.
 */
export function filterCoachOutput(raw: string, locale: Locale): SafetyVerdict {
  let s = (raw ?? "").trim();
  if (!s) return { ok: false, reason: "empty" };

  // Strip markdown fences/emphasis the model may sneak in.
  s = s.replace(/```[\s\S]*?```/g, " ").replace(/[*_#>`]{2,}/g, "").trim();
  if (!s) return { ok: false, reason: "markdown" };

  if (hasBlockedContent(s)) return { ok: false, reason: "blocklist" };
  if (hasContactInfo(s)) return { ok: false, reason: "contact" };

  if (!scriptMatches(s, locale)) return { ok: false, reason: "script" };

  // At most 2 sentences, hard cap 160 chars — cut at a sentence boundary.
  s = capSentences(s, 2, 160);
  if (!s) return { ok: false, reason: "empty" };
  return { ok: true, text: s };
}

/** Language-script verification: the reply must look like the child's locale. */
export function scriptMatches(s: string, locale: Locale): boolean {
  // Never allow scripts far outside the product's three languages.
  if (/[Ѐ-ӿ؀-ۿ가-힯฀-๿]/.test(s)) return false; // Cyrillic/Arabic/Hangul/Thai

  const total = [...s].length || 1;
  const han = countMatches(s, /\p{Script=Han}/gu);
  const kana = countMatches(s, /[぀-ゟ゠-ヿ]/g);
  const latinLetters = countMatches(s, /[A-Za-z]/g);

  if (locale === "ja") {
    // Japanese needs kana (Han alone reads as Chinese); limit Latin share.
    if (kana === 0) return false;
    return latinLetters / total <= 0.4;
  }
  if (locale === "zh-Hant") {
    if (han === 0) return false;
    if (kana > 0) return false; // kana means Japanese leaked through
    // Reject common Simplified-only characters (product is Traditional-only).
    if (/[简体单现设记读话说讲对错误问题让钟广东连击战胜负围观点线练习级别学习开关门时间样条这边军]/.test(s)) {
      return false;
    }
    return latinLetters / total <= 0.3;
  }
  // en: mostly Latin, no CJK
  if (han > 0 || kana > 0) return false;
  return latinLetters > 0;
}

function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

/** Keep at most `maxSentences`, and at most `maxChars` cut at a boundary. */
export function capSentences(s: string, maxSentences: number, maxChars: number): string {
  const parts = s.split(/(?<=[。．！？!?\.])\s*/u).filter(Boolean);
  let out = parts.slice(0, maxSentences).join("");
  if (!out) out = s;
  if ([...out].length > maxChars) {
    const clipped = [...out].slice(0, maxChars).join("");
    // cut back to the last sentence terminator if one exists
    const m = clipped.match(/^[\s\S]*[。．！？!?\.]/u);
    out = (m ? m[0] : clipped).trim();
  }
  return out.trim();
}
