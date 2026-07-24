import type { Locale } from "./i18n";

/** Short go / journey lines for shadow-typing practice (≤80 chars for chat). */
const PHRASES: Record<Locale, string[]> = {
  "zh-Hant": [
    "金角銀邊草肚皮",
    "先數氣再下子",
    "你好！一起學圍棋吧",
    "角落很重要",
    "連起來比較安全",
    "加油小行者",
    "今天也要照顧眼睛",
    "我在西行路上等你",
    "叫吃要快逃",
    "謝謝你當我的好友",
  ],
  ja: [
    "金角銀辺草肚皮",
    "気を数えよう",
    "こんにちは！囲碁を一緒に",
    "角が大切だよ",
    "つながると強い",
    "がんばって行者さん",
    "目も休めよう",
    "西への旅で待ってる",
    "アタリに注意",
    "ともだちありがとう",
  ],
  en: [
    "Count liberties first",
    "Corners before center",
    "Hello! Let's learn Go",
    "Connect your stones",
    "Good job, little pilgrim",
    "Rest your eyes too",
    "See you on the board",
    "Atari means one liberty",
    "Thanks for being my friend",
    "Practice makes progress",
  ],
};

export type TypeCheck = {
  accuracy: number;
  matched: number;
  total: number;
  exact: boolean;
  /** per-char: match | wrong | extra | pending */
  marks: ("ok" | "bad" | "extra" | "todo")[];
};

/** Normalize for fair compare (fullwidth digits/letters → halfwidth). */
export function normalizeType(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

export function pickPracticePhrase(locale: Locale, avoid?: string): string {
  const list = PHRASES[locale] || PHRASES.en;
  if (list.length <= 1) return list[0] || "hello";
  let p = list[Math.floor(Math.random() * list.length)]!;
  let guard = 0;
  while (avoid && p === avoid && guard++ < 8) {
    p = list[Math.floor(Math.random() * list.length)]!;
  }
  return p;
}

/**
 * Compare typed input to target character-by-character (good for touch-typing drills).
 * Extra typed chars beyond target length count as wrong.
 */
export function checkTyping(target: string, typed: string): TypeCheck {
  const t = [...normalizeType(target)];
  const u = [...normalizeType(typed)];
  const marks: TypeCheck["marks"] = [];
  let matched = 0;
  const n = Math.max(t.length, u.length);
  for (let i = 0; i < n; i++) {
    const tc = t[i];
    const uc = u[i];
    if (tc === undefined) {
      marks.push("extra");
    } else if (uc === undefined) {
      marks.push("todo");
    } else if (tc === uc) {
      marks.push("ok");
      matched++;
    } else {
      marks.push("bad");
    }
  }
  const denom = Math.max(t.length, u.length, 1);
  const accuracy = Math.round((matched / denom) * 100);
  return {
    accuracy,
    matched,
    total: t.length,
    exact: u.length === t.length && matched === t.length,
    marks,
  };
}

/** HTML for target with per-char status from current input. */
export function targetHtml(target: string, typed: string): string {
  const { marks } = checkTyping(target, typed);
  const t = [...normalizeType(target)];
  const u = [...normalizeType(typed)];
  let html = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i] === " " ? "·" : t[i]!;
    const m = marks[i] || "todo";
    const cls = m === "ok" ? "ty-ok" : m === "bad" ? "ty-bad" : "ty-todo";
    const cur = i === u.length ? " ty-cur" : "";
    html += `<span class="ty-ch ${cls}${cur}">${escape(ch)}</span>`;
  }
  // show extras indicator
  if (u.length > t.length) {
    html += `<span class="ty-ch ty-extra">+${u.length - t.length}</span>`;
  }
  return html;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
