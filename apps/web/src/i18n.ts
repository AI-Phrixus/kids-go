export type Locale = "ja" | "zh-Hant" | "en";

const dict: Record<Locale, Record<string, string>> = {
  ja: {
    title: "Kids Igo · 西遊の旅",
    subtitle: "囲碁で戦略を楽しく · 目も大切に",
    name_label: "なまえ",
    name_ph: "例：たろう",
    start: "旅をはじめる",
    ask_wukong: "悟空に聞く",
    play_demo: "9路お試し",
    care_break: "休憩の時間だよ",
    care_far: "{{name}}、遠くの山にこんにちはしよう。20秒がんばろう！",
    care_done: "再開する",
    lang: "ことば",
    screen_time: "画面タイム",
  },
  "zh-Hant": {
    title: "Kids Igo · 西遊圍棋",
    subtitle: "快樂練戰略思維 · 也照顧眼睛",
    name_label: "暱稱",
    name_ph: "例：小明",
    start: "開始西行",
    ask_wukong: "問悟空",
    play_demo: "9 路試下",
    care_break: "路邊歇腳站",
    care_far: "{{name}}，和悟空一起向遠方點頭打招呼，大約 20 秒！",
    care_done: "繼續上路",
    lang: "語言",
    screen_time: "螢幕時間",
  },
  en: {
    title: "Kids Igo · Journey Go",
    subtitle: "Strategy with joy · care for your eyes",
    name_label: "Nickname",
    name_ph: "e.g. Alex",
    start: "Start journey",
    ask_wukong: "Ask Wukong",
    play_demo: "Try 9×9",
    care_break: "Rest station",
    care_far: "{{name}}, say hello to something far away with Wukong — about 20 seconds!",
    care_done: "Continue",
    lang: "Language",
    screen_time: "Screen time",
  },
};

export function t(locale: Locale, key: string, vars?: { name?: string }): string {
  const raw = dict[locale]?.[key] ?? dict.en[key] ?? key;
  return raw.replaceAll("{{name}}", vars?.name?.trim() || fallbackName(locale));
}

function fallbackName(locale: Locale): string {
  if (locale === "ja") return "きみ";
  if (locale === "zh-Hant") return "小朋友";
  return "friend";
}
