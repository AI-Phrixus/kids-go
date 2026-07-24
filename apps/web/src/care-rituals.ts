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

/** Playful posture / spine-friendly tips for chat (not drill-sergeant). */
const POSTURE: Record<Locale, string[]> = {
  "zh-Hant": [
    "🐢 像小烏龜從殼裡探出頭：背輕輕挺直，肩膀鬆鬆的。",
    "☁️ 腳踩穩像踩筋斗雲，不要翹二郎腿～",
    "📱 螢幕別太低，下巴微收，別變成「小蝦米」駝背。",
    "🎹 手指輕輕點鍵盤，像彈琵琶，不用用力砸。",
    "🌬️ 打字也記得偶爾眨眨眼、吸一口氣，再繼續傳訊。",
    "🪑 屁股坐滿椅子，像唐僧坐禪一樣穩穩的。",
  ],
  ja: [
    "🐢 かめさんみたいに背すじすっと。かたの力ぬいてね。",
    "☁️ 足はふんわり雲の上。あぐらより足を床に。",
    "📱 画面は少し高め。エビみたいに丸まらないで。",
    "🎹 指はやさしくタッチ。たたかなくて大丈夫。",
    "🌬️ ときどきまばたきと深呼吸。またおしゃべりへ。",
    "🪑 いすにしっかり座って。三蔵様みたいに安定！",
  ],
  en: [
    "🐢 Peek up like a happy turtle: tall back, soft shoulders.",
    "☁️ Feet on the floor like cloud-walking shoes.",
    "📱 Screen a bit high — no shrimp-curve posture!",
    "🎹 Soft fingertips on the keys, like playing a tiny lute.",
    "🌬️ Blink and breathe, then keep the adventure chat going.",
    "🪑 Sit fully on the chair — steady like Tripitaka at rest.",
  ],
};

let postureIndex = 0;

export function nextPostureTip(locale: Locale): string {
  const list = POSTURE[locale] || POSTURE.en;
  const tip = list[postureIndex % list.length]!;
  postureIndex++;
  return tip;
}
