import type { Locale } from "./i18n";

/** Local offline care rituals (Journey-flavored). */
const RITUALS: Record<Locale, string[]> = {
  ja: [
    "{{name}}、悟空と遠い山にこんにちは。20秒ながめよう。",
    "{{name}}、まばたきを雨みたいにやさしく。",
    "{{name}}、目でゆっくり円を描こう（金箍棒）。",
    "{{name}}、手のひらを温めて目の上に。",
    "{{name}}、肩の力をぬいて荷物をおろすように。",
    "{{name}}、水をひとくち。甘い泉だよ。",
    "{{name}}、背すじを伸ばして。心が定まるよ。",
  ],
  "zh-Hant": [
    "{{name}}，和悟空一起向遠方的山點頭，看約 20 秒。",
    "{{name}}，像天庭小雨一樣輕輕眨眼。",
    "{{name}}，眼睛跟著金箍棒慢慢畫一圈。",
    "{{name}}，搓熱手心，溫柔蓋上眼睛。",
    "{{name}}，像沙僧放下行李，肩膀放鬆。",
    "{{name}}，喝一小口水再上路。",
    "{{name}}，像唐僧一樣坐端正，心就定了。",
  ],
  en: [
    "{{name}}, say hello to something far away with Wukong for ~20 seconds.",
    "{{name}}, blink gently like soft rain.",
    "{{name}}, draw a slow circle with your eyes.",
    "{{name}}, warm your palms and rest them over closed eyes.",
    "{{name}}, drop your shoulders like setting luggage down.",
    "{{name}}, take a sip of water, then continue.",
    "{{name}}, sit tall and calm like Tripitaka.",
  ],
};

let ritualIndex = 0;

export function nextCareText(locale: Locale, name: string): string {
  const list = RITUALS[locale] || RITUALS.en;
  const raw = list[ritualIndex % list.length]!;
  ritualIndex++;
  return raw.replaceAll("{{name}}", name || "friend");
}
