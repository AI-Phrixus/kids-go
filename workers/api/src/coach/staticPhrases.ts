import type { CoachRequest, CoachResponse, Locale } from "./contract";

type Pack = Record<string, string[]>;

const PHRASES: Record<Locale, Pack> = {
  ja: {
    hint: [
      "{{name}}、一息ついて呼吸を数えよう。いい手は急がなくて大丈夫！",
      "{{name}}、相手の石の「気」はいくつ？1ならアタリだよ。",
      "{{name}}、金角・銀辺・草肚皮。角→辺→中央の順がやさしいよ。",
      "{{name}}、つながると強い。ばらばらは取られやすいよ。",
      "{{name}}、取れる石があるか見てみよう。悟空も一呼吸おいてから！",
    ],
    celebrate: [
      "{{name}}、やったね！孫悟空みたいにひらめいたよ！",
      "{{name}}、クリア！取経の道、また一歩！",
      "{{name}}、よくがんばった。星をゲットだ！",
    ],
    comfort: [
      "{{name}}、八十一難もあるんだ。もう一回挑戦しよう！",
      "{{name}}、失敗は学び。気を数えなおそう。",
      "{{name}}、大丈夫。八戒だって転ぶんだから！",
    ],
    parent_summary: [
      "今日は先を読む力を遊びました。褒めてあげてください。",
      "具体的な努力（気を数えた・もう一度挑戦）を認めてあげてください。",
    ],
  },
  "zh-Hant": {
    hint: [
      "{{name}}，先數數氣再下。悟空也會停一秒再出手！",
      "{{name}}，對方那串棋還剩幾口氣？只剩 1 氣就是叫吃。",
      "{{name}}，記住：金角銀邊草肚皮——角→邊→中央。",
      "{{name}}，連起來比較安全，孤棋容易被提。",
      "{{name}}，先找有沒有能提的子，再考慮大模樣。",
    ],
    celebrate: [
      "{{name}}，過關啦！真有火眼金睛的預見！",
      "{{name}}，這一難過了！西行又進一站！",
      "{{name}}，做得好，星星收下！",
    ],
    comfort: [
      "{{name}}，取經有九九八十一難，我們再來一難就好！",
      "{{name}}，沒關係，再數一次氣就會更清楚。",
      "{{name}}，八戒也會摔跤——站起來再走！",
    ],
    parent_summary: [
      "今天練習了「預見」與堅持。請溫柔稱讚具體行為。",
      "請稱讚「數氣／再試一次」的過程，而不只結果。",
    ],
  },
  en: {
    hint: [
      "{{name}}, count the liberties first. Even Wukong pauses a second!",
      "{{name}}, how many liberties does that group have? One means atari!",
      "{{name}}, gold corners, silver sides, grass belly — corners first.",
      "{{name}}, connected stones are safer; lonely stones get captured.",
      "{{name}}, look for a capture first, then big shapes.",
    ],
    celebrate: [
      "{{name}}, you did it! That was clever like Monkey King!",
      "{{name}}, cleared! One more stop on the journey!",
      "{{name}}, great work — stars for you!",
    ],
    comfort: [
      "{{name}}, there are many trials on the journey. Let's try again!",
      "{{name}}, mistakes teach us. Count liberties again.",
      "{{name}}, even Pigsy falls — stand up and go!",
    ],
    parent_summary: [
      "Today we practiced foresight and persistence. Praise the effort.",
      "Praise counting liberties and trying again — not only winning.",
    ],
  },
};

function fill(template: string, name: string): string {
  return template.replaceAll("{{name}}", name || "friend");
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? list[0]!;
}

export function staticCoach(req: CoachRequest): CoachResponse {
  const locale = PHRASES[req.locale] ? req.locale : "en";
  const pack = PHRASES[locale];
  const key = req.tone in pack ? req.tone : "hint";
  const list = pack[key] ?? pack.hint!;
  const speaker = req.speaker ?? "wukong";
  return {
    say: fill(pick(list), req.childName),
    tags: req.tone === "hint" ? ["foresight"] : [],
    parentNote: pick(pack.parent_summary ?? pack.hint!),
    tone: req.tone,
    speaker,
    source: "static",
  };
}
