import type { CoachRequest, CoachResponse, Locale } from "./contract";

/**
 * Static phrase bank — the guaranteed offline coach path.
 * v0.8.0: hints are grouped by lesson skillTag so the fallback stays
 * pedagogically useful from L01 to L26 (was: the same 5 generic hints for
 * every lesson). Each group has ≥4 variants to avoid visible repetition.
 */

type HintBank = Record<string, string[]>; // skillTag → phrases ("_default" fallback)
type Pack = {
  hint: HintBank;
  celebrate: string[];
  comfort: string[];
  parent_summary: string[];
};

const PHRASES: Record<Locale, Pack> = {
  "zh-Hant": {
    hint: {
      _default: [
        "{{name}}，先數數氣再下。悟空也會停一秒再出手！",
        "{{name}}，連起來比較安全，孤棋容易被提。",
        "{{name}}，先找有沒有能提的子，再考慮大模樣。",
        "{{name}}，看看每一串棋還有幾口氣，最少的那串最緊急！",
      ],
      capture: [
        "{{name}}，對方那串棋只剩 1 口氣了嗎？補上最後一口就能提子！",
        "{{name}}，提子前先確認：下這手棋自己安不安全？",
        "{{name}}，把對方的氣一口一口堵住，就像悟空收妖一樣！",
        "{{name}}，先看對方哪串棋氣最少，那裡就是突破口。",
      ],
      atari: [
        "{{name}}，只剩 1 口氣就叫「叫吃」。找找看哪顆子快沒氣了？",
        "{{name}}，被叫吃不用慌——逃跑或反擊，先數氣再決定。",
        "{{name}}，火眼金睛：下一手誰會只剩 1 口氣？",
        "{{name}}，叫吃就像悟空大喝一聲——對方就得回應！",
      ],
      connect: [
        "{{name}}，師徒同心！把自己的棋連成一串，氣會變多。",
        "{{name}}，斷開的地方是弱點——先把自己連好，再想進攻。",
        "{{name}}，兩串棋中間只差一步？連起來就安全了。",
        "{{name}}，看看對方哪裡沒連好，那就是可以切斷的地方。",
      ],
      corner: [
        "{{name}}，金角銀邊草肚皮——先佔角，再走邊，最後才是中央。",
        "{{name}}，角落用最少的棋就能圍最多的地！",
        "{{name}}，先安營紮寨（佔角），再出門探路（走邊）。",
        "{{name}}，中央看起來大，其實角落才容易守住喔。",
      ],
      ladder: [
        "{{name}}，征子像筋斗雲——每一步都把對方逼到只剩 1 口氣！",
        "{{name}}，征子前先看路：路上有對方的接應子嗎？",
        "{{name}}，把對方往棋盤邊上趕，路越走越窄！",
        "{{name}}，如果征子路上有敵人接應，就要換一招（試試門吃）。",
      ],
      ko: [
        "{{name}}，打劫時不能馬上提回來——先在別處下一手（劫材）！",
        "{{name}}，找劫材：哪一手棋對方一定要回應？",
        "{{name}}，緊箍咒的規則：同樣的局面不能馬上重來。",
        "{{name}}，劫爭比的是耐心——數數你有幾個劫材？",
      ],
      life: [
        "{{name}}，兩隻真眼才是活棋——一隻眼還不夠喔！",
        "{{name}}，做眼要趁早，等被圍住就來不及了。",
        "{{name}}，人參果要兩顆才保命——眼位也是！",
        "{{name}}，看看你的地盤能分成兩個家（兩隻眼）嗎？",
      ],
      kill: [
        "{{name}}，想吃掉對方？先破壞他做第二隻眼的地方！",
        "{{name}}，假眼騙不了火眼金睛——斜角被佔的眼是假的。",
        "{{name}}，點進對方眼位的要點，他就做不出兩隻眼了。",
        "{{name}}，先數：對方能做出幾隻真眼？",
      ],
      semeai: [
        "{{name}}，對殺先數氣！你幾口、對方幾口？",
        "{{name}}，氣多的一方贏對殺——像數沙子一樣仔細數。",
        "{{name}}，對殺時先堵對方的外氣，自己的氣留到最後。",
        "{{name}}，氣一樣多的話，先動手的那方贏！",
      ],
      territory: [
        "{{name}}，收官就是把邊界關好——每一手都是寶物！",
        "{{name}}，數地時：你的空點＋你的棋子＝你的分數。",
        "{{name}}，邊界關好了才能數地——別留缺口喔。",
        "{{name}}，沒棋可下就可以 pass。兩人都 pass，就開始數寶物！",
      ],
    },
    celebrate: [
      "{{name}}，過關啦！真有火眼金睛的預見！",
      "{{name}}，這一難過了！西行又進一站！",
      "{{name}}，做得好，星星收下！",
      "{{name}}，太棒了！連悟空都要為你鼓掌！",
    ],
    comfort: [
      "{{name}}，取經有九九八十一難，我們再來一難就好！",
      "{{name}}，沒關係，再數一次氣就會更清楚。",
      "{{name}}，八戒也會摔跤——站起來再走！",
      "{{name}}，每一次重來，你都比上次更強一點。",
    ],
    parent_summary: [
      "今天練習了「預見」與堅持。請溫柔稱讚具體行為。",
      "請稱讚「數氣／再試一次」的過程，而不只結果。",
    ],
  },
  ja: {
    hint: {
      _default: [
        "{{name}}、一息ついて呼吸を数えよう。いい手は急がなくて大丈夫！",
        "{{name}}、つながると強い。ばらばらは取られやすいよ。",
        "{{name}}、取れる石があるか見てみよう。悟空も一呼吸おいてから！",
        "{{name}}、どの石のグループが一番ピンチか、気を数えてみよう。",
      ],
      capture: [
        "{{name}}、相手の石の気は残り1つ？最後の気をふさげば取れるよ！",
        "{{name}}、取る前に確認：その手、自分は安全かな？",
        "{{name}}、気を1つずつふさごう。悟空の妖怪退治みたいに！",
        "{{name}}、一番気が少ない石を探そう。そこがチャンス！",
      ],
      atari: [
        "{{name}}、気が残り1つは「アタリ」。どの石があぶない？",
        "{{name}}、アタリされてもあわてない。逃げるか反撃か、気を数えて決めよう。",
        "{{name}}、火眼金睛！次の一手でどの石が気1つになる？",
        "{{name}}、アタリは悟空の一喝！相手は応えるしかない！",
      ],
      connect: [
        "{{name}}、師弟は離れない！石をつなげば気が増えるよ。",
        "{{name}}、切れているところが弱点。まず自分をつなごう。",
        "{{name}}、あと一歩でつながる？つなげば安全だよ。",
        "{{name}}、相手のつながっていない所は、切るチャンス！",
      ],
      corner: [
        "{{name}}、金の角・銀の辺・草のお腹。まず角から！",
        "{{name}}、角は少ない石でたくさん囲えるよ！",
        "{{name}}、まずキャンプを作って（角）、それから道へ（辺）。",
        "{{name}}、真ん中は広く見えるけど、角のほうが守りやすいよ。",
      ],
      ladder: [
        "{{name}}、シチョウは筋斗雲！毎回相手を気1つに追い込むよ！",
        "{{name}}、シチョウの前に道を見て。敵の味方の石はない？",
        "{{name}}、相手を盤の端へ追いつめよう。道はだんだん狭くなる！",
        "{{name}}、シチョウの道に敵がいたら、別の技（ゲタ）を試そう。",
      ],
      ko: [
        "{{name}}、コウはすぐ取り返せない。まず別の場所に一手（コウ材）！",
        "{{name}}、コウ材を探そう：相手が必ず応える手はどれ？",
        "{{name}}、緊箍呪のルール：同じ形はすぐには戻せないんだ。",
        "{{name}}、コウはがまん比べ。コウ材はいくつある？",
      ],
      life: [
        "{{name}}、本物の眼が2つで生きる。1つじゃ足りないよ！",
        "{{name}}、眼作りは早めに。囲まれてからでは遅いんだ。",
        "{{name}}、人参果は2つで命が守れる。眼も2つ！",
        "{{name}}、自分の陣地を2つの部屋に分けられるかな？",
      ],
      kill: [
        "{{name}}、相手を取りたい？2つ目の眼を作る場所をこわそう！",
        "{{name}}、偽物の眼は火眼金睛にはお見通し。ナナメを取られた眼は偽物だよ。",
        "{{name}}、眼の急所に打てば、2つの眼は作れない。",
        "{{name}}、まず数えて：相手は本物の眼をいくつ作れる？",
      ],
      semeai: [
        "{{name}}、攻め合いはまず気を数える！自分は何個？相手は何個？",
        "{{name}}、気が多いほうが勝つ。砂を数えるみたいに丁寧に！",
        "{{name}}、攻め合いは外の気からふさごう。共通の気は最後だよ。",
        "{{name}}、気が同じ数なら、先に打ったほうが勝ち！",
      ],
      territory: [
        "{{name}}、ヨセは境界を閉じること。一手一手が宝物！",
        "{{name}}、数え方：自分の空き地＋自分の石＝自分の点数。",
        "{{name}}、境界を閉じてから数えよう。すき間に注意！",
        "{{name}}、打つ所がなければパス。2人ともパスで宝物を数えるよ！",
      ],
    },
    celebrate: [
      "{{name}}、やったね！孫悟空みたいにひらめいたよ！",
      "{{name}}、クリア！取経の道、また一歩！",
      "{{name}}、よくがんばった。星をゲットだ！",
      "{{name}}、すごい！悟空も拍手してるよ！",
    ],
    comfort: [
      "{{name}}、八十一難もあるんだ。もう一回挑戦しよう！",
      "{{name}}、失敗は学び。気を数えなおそう。",
      "{{name}}、大丈夫。八戒だって転ぶんだから！",
      "{{name}}、やり直すたびに、前より強くなってるよ。",
    ],
    parent_summary: [
      "今日は先を読む力を遊びました。褒めてあげてください。",
      "具体的な努力（気を数えた・もう一度挑戦）を認めてあげてください。",
    ],
  },
  en: {
    hint: {
      _default: [
        "{{name}}, count the liberties first. Even Wukong pauses a second!",
        "{{name}}, connected stones are safer; lonely stones get captured.",
        "{{name}}, look for a capture first, then big shapes.",
        "{{name}}, which group has the fewest liberties? That one is urgent!",
      ],
      capture: [
        "{{name}}, is that group down to one liberty? Fill the last one to capture!",
        "{{name}}, before you capture, check: is your own stone safe there?",
        "{{name}}, block the liberties one by one, like Wukong rounding up monsters!",
        "{{name}}, find the enemy group with the fewest liberties — that's your opening.",
      ],
      atari: [
        "{{name}}, one liberty left means atari! Which stone is in danger?",
        "{{name}}, in atari? Don't panic — run or fight back, count liberties first.",
        "{{name}}, fiery golden eyes: whose group drops to one liberty next move?",
        "{{name}}, atari is Wukong's battle shout — the enemy must answer!",
      ],
      connect: [
        "{{name}}, stay together like the pilgrims! Connected stones share liberties.",
        "{{name}}, a gap is a weak point — connect your stones first.",
        "{{name}}, one move from connecting? Do it and be safe.",
        "{{name}}, see where the enemy is NOT connected — that's where to cut.",
      ],
      corner: [
        "{{name}}, gold corners, silver sides, grass belly — corners first!",
        "{{name}}, corners need the fewest stones to hold the most land!",
        "{{name}}, set up camp first (corner), then explore the road (sides).",
        "{{name}}, the center looks big, but corners are easier to keep.",
      ],
      ladder: [
        "{{name}}, a ladder is like the cloud somersault — every step leaves one liberty!",
        "{{name}}, before you ladder, check the road: any enemy helpers ahead?",
        "{{name}}, chase them toward the edge — the road gets narrower!",
        "{{name}}, if a ladder-breaker waits ahead, switch plans (try a net).",
      ],
      ko: [
        "{{name}}, in a ko you can't retake right away — play elsewhere first (a ko threat)!",
        "{{name}}, find a ko threat: which move MUST your opponent answer?",
        "{{name}}, the headband rule: the same position can't repeat immediately.",
        "{{name}}, a ko fight is about patience — how many threats do you have?",
      ],
      life: [
        "{{name}}, two real eyes make a group alive — one is not enough!",
        "{{name}}, make eyes early; once surrounded, it's too late.",
        "{{name}}, two ginseng fruits keep you alive — same with eyes!",
        "{{name}}, can your territory split into two rooms (two eyes)?",
      ],
      kill: [
        "{{name}}, to capture a group, wreck the spot where its second eye would be!",
        "{{name}}, a false eye can't fool golden eyes — stolen diagonals make it fake.",
        "{{name}}, play the vital point and they can't make two eyes.",
        "{{name}}, first count: how many REAL eyes can they make?",
      ],
      semeai: [
        "{{name}}, in a capturing race, count liberties first! Yours vs theirs?",
        "{{name}}, more liberties wins the race — count like counting sand grains.",
        "{{name}}, fill their outside liberties first; save shared ones for last.",
        "{{name}}, equal liberties? Then whoever moves first wins!",
      ],
      territory: [
        "{{name}}, the endgame means closing your borders — every move is treasure!",
        "{{name}}, counting: your empty points + your stones = your score.",
        "{{name}}, close the borders before counting — no gaps!",
        "{{name}}, nothing left to play? Pass. Two passes and we count the treasure!",
      ],
    },
    celebrate: [
      "{{name}}, you did it! That was clever like Monkey King!",
      "{{name}}, cleared! One more stop on the journey!",
      "{{name}}, great work — stars for you!",
      "{{name}}, amazing! Even Wukong is clapping!",
    ],
    comfort: [
      "{{name}}, there are many trials on the journey. Let's try again!",
      "{{name}}, mistakes teach us. Count liberties again.",
      "{{name}}, even Pigsy falls — stand up and go!",
      "{{name}}, every retry makes you a little stronger.",
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

/** Map a lesson skillTag to a phrase-bank key. */
function bankFor(pack: Pack, skillTag?: string): string[] {
  if (!skillTag) return pack.hint._default!;
  const key = skillTag.toLowerCase();
  if (pack.hint[key]) return pack.hint[key]!;
  // loose aliases from lesson skillTags to banks
  const alias: Record<string, string> = {
    liberties: "atari",
    liberty: "atari",
    foresight: "atari",
    cut: "connect",
    net_capture: "ladder",
    net: "ladder",
    clamp: "capture",
    snapback: "capture",
    liberty_race: "semeai",
    eyes: "life",
    two_eyes: "life",
    endgame: "territory",
    scoring: "territory",
  };
  const mapped = alias[key];
  if (mapped && pack.hint[mapped]) return pack.hint[mapped]!;
  return pack.hint._default!;
}

export function staticCoach(req: CoachRequest): CoachResponse {
  const locale = PHRASES[req.locale] ? req.locale : "en";
  const pack = PHRASES[locale];
  const speaker = req.speaker ?? "wukong";
  let list: string[];
  if (req.tone === "celebrate") list = pack.celebrate;
  else if (req.tone === "comfort") list = pack.comfort;
  else if (req.tone === "parent_summary") list = pack.parent_summary;
  else list = bankFor(pack, req.skillTag);
  return {
    say: fill(pick(list), req.childName),
    tags: req.tone === "hint" ? [req.skillTag || "foresight"] : [],
    parentNote: pick(pack.parent_summary),
    tone: req.tone,
    speaker,
    source: "static",
  };
}
