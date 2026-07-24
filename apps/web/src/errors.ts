import type { Locale } from "./i18n";

const MAP: Record<string, Record<Locale, string>> = {
  nickname_taken: {
    ja: "そのなまえは使われています。別のなまえにしてね。",
    "zh-Hant": "這個暱稱已被使用，請換一個。",
    en: "That nickname is taken. Try another.",
  },
  email_taken: {
    ja: "このメールは登録済みです。",
    "zh-Hant": "此郵箱已註冊，請直接登入。",
    en: "Email already registered. Please log in.",
  },
  auth_failed: {
    ja: "なまえ／PIN またはメール／パスワードが違います。",
    "zh-Hant": "暱稱／PIN 或郵箱／密碼不正確。",
    en: "Wrong nickname/PIN or email/password.",
  },
  rate_limited: {
    ja: "操作が多すぎます。少し待ってね。",
    "zh-Hant": "操作太頻繁，請稍後再試。",
    en: "Too many tries. Please wait a moment.",
  },
  invalid_input: {
    ja: "入力を確認してね（PINは4〜6桁の数字）。",
    "zh-Hant": "請檢查輸入（PIN 為 4～6 位數字）。",
    en: "Check your input (PIN must be 4–6 digits).",
  },
  locked: {
    ja: "まだロック中。前の駅をクリアしてね。",
    "zh-Hant": "尚未解鎖，請先完成上一課。",
    en: "Locked — finish the previous lesson first.",
  },
  unauthorized: {
    ja: "もう一度ログインしてね。",
    "zh-Hant": "請重新登入。",
    en: "Please log in again.",
  },
  base_url_must_https: {
    ja: "Base URL は https:// で始めてね。",
    "zh-Hant": "Base URL 必須以 https:// 開頭。",
    en: "Base URL must start with https://.",
  },
};

const FALLBACK: Record<Locale, string> = {
  ja: "うまくいかなかったよ。もういちど試してね。",
  "zh-Hant": "出了點問題，請再試一次。",
  en: "Something went wrong. Please try again.",
};

export function friendlyError(code: string, locale: Locale): string {
  const row = MAP[code];
  if (row) return row[locale] || row.en;
  // Kids-friendly fallback instead of raw error codes
  return FALLBACK[locale] || FALLBACK.en;
}
