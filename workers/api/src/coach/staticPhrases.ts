import type { CoachRequest, CoachResponse, Locale } from "./contract";

type Pack = Record<string, string>;

const PHRASES: Record<Locale, Pack> = {
  ja: {
    hint: "{{name}}、一息ついて呼吸を数えよう。いい手は急がなくて大丈夫！",
    celebrate: "{{name}}、やったね！孫悟空みたいにひらめいたよ！",
    comfort: "{{name}}、八十一難もあるんだ。もう一回挑戦しよう！",
    parent_summary: "今日は先を読む力を遊びました。褒めてあげてください。",
  },
  "zh-Hant": {
    hint: "{{name}}，先數數氣再下。悟空也會停一秒再出手！",
    celebrate: "{{name}}，過關啦！真有火眼金睛的預見！",
    comfort: "{{name}}，取經有九九八十一難，我們再來一難就好！",
    parent_summary: "今天練習了「預見」與堅持。請溫柔稱讚具體行為。",
  },
  en: {
    hint: "{{name}}, count the liberties first. Even Wukong pauses a second!",
    celebrate: "{{name}}, you did it! That was clever like Monkey King!",
    comfort: "{{name}}, there are many trials on the journey. Let's try again!",
    parent_summary: "Today we practiced foresight and persistence. Praise the effort.",
  },
};

function fill(template: string, name: string): string {
  return template.replaceAll("{{name}}", name || "friend");
}

export function staticCoach(req: CoachRequest): CoachResponse {
  const locale = PHRASES[req.locale] ? req.locale : "en";
  const pack = PHRASES[locale];
  const key = req.tone in pack ? req.tone : "hint";
  const speaker = req.speaker ?? "wukong";
  return {
    say: fill(pack[key] ?? pack.hint!, req.childName),
    tags: req.tone === "hint" ? ["foresight"] : [],
    parentNote: pack.parent_summary,
    tone: req.tone,
    speaker,
    source: "static",
  };
}
