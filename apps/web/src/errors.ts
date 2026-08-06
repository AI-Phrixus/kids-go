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
    ja: "入力を確認してね（新しいPINは6桁の数字）。",
    "zh-Hant": "請檢查輸入（新 PIN 為 6 位數字）。",
    en: "Check your input (a new PIN must be 6 digits).",
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
  parent_required: {
    ja: "この機能は保護者アカウントで使えます。",
    "zh-Hant": "此功能只供家長帳號使用。",
    en: "This feature is for parent accounts.",
  },
  parent_verification_required: {
    ja: "保護者パスワードを確認できませんでした。もう一度試してください。",
    "zh-Hant": "家長密碼驗證失敗，請再試一次。",
    en: "The parent password could not be verified. Please try again.",
  },
  daily_limit: {
    ja: "今日の利用上限に達しました。明日また試してね。",
    "zh-Hant": "今天的使用次數已達上限，請明天再試。",
    en: "Today's usage limit has been reached. Please try again tomorrow.",
  },
  base_url_must_https: {
    ja: "Base URL は https:// で始めてね。",
    "zh-Hant": "Base URL 必須以 https:// 開頭。",
    en: "Base URL must start with https://.",
  },
  unsafe_base_url: {
    ja: "安全のため、ローカル／プライベートな Base URL は使えません。",
    "zh-Hant": "為了安全，不能使用本機或私人網路的 Base URL。",
    en: "For safety, local and private-network Base URLs are not allowed.",
  },
  friend_not_found: {
    ja: "そのなまえの行者は見つからないよ。つづりを確認してね。",
    "zh-Hant": "找不到這個暱稱的小行者，請再確認一下。",
    en: "No pilgrim with that nickname. Check the spelling.",
  },
  friend_ambiguous: {
    ja: "同じなまえが複数いるよ。別のなまえで試してね。",
    "zh-Hant": "有多個相同暱稱，請換一個更獨特的。",
    en: "That nickname matches more than one account.",
  },
  cannot_add_self: {
    ja: "じぶんには送れないよ！",
    "zh-Hant": "不能加自己當好友喔！",
    en: "You can't add yourself!",
  },
  friend_limit: {
    ja: "ともだちが上限だよ。",
    "zh-Hant": "好友人數已達上限。",
    en: "Friend list is full.",
  },
  not_friends: {
    ja: "まだともだちじゃないよ。先に承認してね。",
    "zh-Hant": "還不是好友，請先互加／接受邀請。",
    en: "Not friends yet — accept the request first.",
  },
  invalid_message: {
    ja: "メッセージが送れないよ（短く・やさしいことばで）。",
    "zh-Hant": "訊息無法送出（請用簡短友善的話，勿貼連結）。",
    en: "Can't send that message (keep it short & kind, no links).",
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
