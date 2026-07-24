/** L01–L12 playable curriculum (9×9) */

export type LessonMeta = {
  id: string;
  boardSize: 9;
  order: number;
  badgeId: string;
  titles: { ja: string; "zh-Hant": string; en: string };
  story: { ja: string; "zh-Hant": string; en: string };
  goal: { ja: string; "zh-Hant": string; en: string };
  battle: BattleSpec;
  steps: LessonStep[];
};

export type LessonStep =
  | { type: "story" }
  | { type: "tap"; prompt: { ja: string; "zh-Hant": string; en: string }; correct: [number, number][] }
  | { type: "info"; text: { ja: string; "zh-Hant": string; en: string } };

export type BattleSpec =
  | { mode: "place_n"; n: number; aiLevel: 0 | 1 | 2 }
  | { mode: "find_atari"; points: [number, number][]; aiLevel: 0 }
  | { mode: "capture_n"; n: number; aiLevel: 0 | 1 | 2; setup?: SetupStone[] }
  | { mode: "survive_n"; n: number; aiLevel: 0 | 1 | 2; setup?: SetupStone[] };

export type SetupStone = { x: number; y: number; color: "black" | "white" };

const T = {
  story: (zh: string, ja: string, en: string) => ({ "zh-Hant": zh, ja, en }),
  title: (zh: string, ja: string, en: string) => ({ "zh-Hant": zh, ja, en }),
};

function info(zh: string, ja: string, en: string): LessonStep {
  return { type: "info", text: T.story(zh, ja, en) };
}

function tap(
  zh: string,
  ja: string,
  en: string,
  correct: [number, number][],
): LessonStep {
  return { type: "tap", prompt: T.story(zh, ja, en), correct };
}

export const LESSONS: LessonMeta[] = [
  {
    id: "L01",
    boardSize: 9,
    order: 1,
    badgeId: "first_steps",
    titles: T.title("出長安 · 棋盤與輪流", "出長安 · 盤と順番", "Leaving Chang'an · Board & turns"),
    story: T.story(
      "{{name}}，長安城外。黑白輪流下子，就是西行的第一步！",
      "{{name}}、長安のそと。黒と白が交代で石を置くよ。",
      "{{name}}, outside Chang'an. Black and White take turns!",
    ),
    goal: T.story("用黑子下滿 8 手（無勝負）", "黒で8手置こう", "Play 8 black moves"),
    battle: { mode: "place_n", n: 8, aiLevel: 0 },
    steps: [
      { type: "story" },
      info("子下在交叉點上。相鄰的子會連起來。", "交点に置く。隣はつながる。", "Place on intersections. Adjacent stones connect."),
      tap("點一下天元（正中央）！", "天元をタッチ！", "Tap the center!", [[4, 4]]),
    ],
  },
  {
    id: "L02",
    boardSize: 9,
    order: 2,
    badgeId: "breath",
    titles: T.title("呼吸關 · 氣", "呼吸関 · 気", "Breath Pass · Liberties"),
    story: T.story(
      "{{name}}，棋子也要呼吸（氣）。被圍住就危險了。",
      "{{name}}、石にも呼吸（気）がある。",
      "{{name}}, stones need liberties (breath).",
    ),
    goal: T.story("找出只剩 1 氣的白子並點擊", "1気の白をタッチ", "Tap the white stone with 1 liberty"),
    battle: { mode: "find_atari", points: [[2, 2]], aiLevel: 0 },
    steps: [
      { type: "story" },
      info("旁邊的空點就是「氣」。氣沒了會被提掉。", "空いている隣が気。", "Empty neighbors are liberties."),
      tap("點只剩 1 氣的白子", "1気の白をタッチ", "Tap the atari white stone", [[2, 2]]),
    ],
  },
  {
    id: "L03",
    boardSize: 9,
    order: 3,
    badgeId: "first_capture",
    titles: T.title("初降小妖 · 吃子", "初降小妖 · 取る", "First capture"),
    story: T.story(
      "{{name}}，火眼金睛！把沒氣的對手溫柔收服。",
      "{{name}}、気のない相手をやさしく取ろう。",
      "{{name}}, capture stones with no liberties!",
    ),
    goal: T.story("吃掉至少 1 顆白子", "白を1子以上取る", "Capture ≥1 white stone"),
    battle: {
      mode: "capture_n",
      n: 1,
      aiLevel: 0,
      setup: [
        { x: 2, y: 2, color: "white" },
        { x: 1, y: 2, color: "black" },
        { x: 3, y: 2, color: "black" },
        { x: 2, y: 1, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info("堵住對方最後一氣就能提子。", "最後の気を埋めると取れる。", "Fill the last liberty to capture."),
      tap("吃白的一手在 (2,3)", "取りの一手は(2,3)", "Capturing move at (2,3)", [[2, 3]]),
    ],
  },
  {
    id: "L04",
    boardSize: 9,
    order: 4,
    badgeId: "escape",
    titles: T.title("脫困 · 逃", "脱困", "Escape"),
    story: T.story(
      "{{name}}，被叫吃時先逃！像悟空翻出五行山。",
      "{{name}}、アタリのときは逃げよう！",
      "{{name}}, when in atari — escape first!",
    ),
    goal: T.story("下滿 6 手練習逃與連", "6手おいて逃げと連を練習", "Play 6 moves practicing escape"),
    battle: { mode: "place_n", n: 6, aiLevel: 0 },
    steps: [
      { type: "story" },
      info("只剩 1 氣叫「叫吃」。可以逃到有氣的地方。", "1気はアタリ。逃げ場を探そう。", "1 liberty = atari. Find room to breathe."),
    ],
  },
  {
    id: "L05",
    boardSize: 9,
    order: 5,
    badgeId: "atari_eye",
    titles: T.title("火眼預見 · 叫吃", "火眼予見", "Foresight · Atari"),
    story: T.story(
      "{{name}}，火眼預見一步：對手只剩 1 氣了嗎？",
      "{{name}}、一歩先を読もう。",
      "{{name}}, look one move ahead!",
    ),
    goal: T.story("點出叫吃中的白子", "アタリの白をタッチ", "Tap the white stone in atari"),
    battle: { mode: "find_atari", points: [[4, 4]], aiLevel: 0 },
    steps: [
      { type: "story" },
      info("叫吃 = 再一手就能吃。", "アタリ＝あと一手で取れる。", "Atari = one move from capture."),
      tap("點叫吃的白", "アタリの白をタッチ", "Tap atari white", [[4, 4]]),
    ],
  },
  {
    id: "L06",
    boardSize: 9,
    order: 6,
    badgeId: "double",
    titles: T.title("一變兩用 · 雙叫吃", "一変両用", "Double atari"),
    story: T.story(
      "{{name}}，一子兩用——七十二變的效率！",
      "{{name}}、一石二鳥を狙おう。",
      "{{name}}, one stone, two threats!",
    ),
    goal: T.story("吃掉 1 子感受效率", "1子取って効率を感じる", "Capture 1 stone for efficiency"),
    battle: {
      mode: "capture_n",
      n: 1,
      aiLevel: 0,
      setup: [
        { x: 5, y: 5, color: "white" },
        { x: 4, y: 5, color: "black" },
        { x: 6, y: 5, color: "black" },
        { x: 5, y: 4, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info("一手同時威脅兩處，叫雙叫吃。", "同時に二つのアタリ＝両アタリ。", "Threaten two groups at once."),
    ],
  },
  {
    id: "L07",
    boardSize: 9,
    order: 7,
    badgeId: "rules",
    titles: T.title("守戒 · 禁著", "守戒", "Rules boundary"),
    story: T.story(
      "{{name}}，有些點不能亂下——像緊箍是守護不是懲罰。",
      "{{name}}、置けない点もある。",
      "{{name}}, some points are forbidden — rules protect the game.",
    ),
    goal: T.story("合法地下滿 6 手", "合法に6手", "Play 6 legal moves"),
    battle: { mode: "place_n", n: 6, aiLevel: 0 },
    steps: [
      { type: "story" },
      info("自殺（下完自己沒氣且不吃子）一般不行。", "自殺はダメ（取る手は別）。", "Suicide is usually illegal."),
    ],
  },
  {
    id: "L08",
    boardSize: 9,
    order: 8,
    badgeId: "eyes",
    titles: T.title("辨真假 · 眼", "真偽の眼", "True & false eyes"),
    story: T.story(
      "{{name}}，真眼是活路，假眼會被拆穿。",
      "{{name}}、本物の眼は生きる道。",
      "{{name}}, true eyes mean life.",
    ),
    goal: T.story("下滿 8 手感受做活空間", "8手おいて生きる空間を感じる", "Play 8 moves thinking about life"),
    battle: { mode: "place_n", n: 8, aiLevel: 1 },
    steps: [
      { type: "story" },
      info("兩隻真眼通常就活了。", "二つの真眼で生きやすい。", "Two true eyes usually live."),
    ],
  },
  {
    id: "L09",
    boardSize: 9,
    order: 9,
    badgeId: "order",
    titles: T.title("次序關", "次序", "Move order"),
    story: T.story(
      "{{name}}，先後次序像緊箍咒的節拍——亂了就漏。",
      "{{name}}、手順が大事。",
      "{{name}}, order of moves matters.",
    ),
    goal: T.story("吃掉 1 子（注意次序）", "1子取る（手順注意）", "Capture 1 (mind the order)"),
    battle: {
      mode: "capture_n",
      n: 1,
      aiLevel: 0,
      setup: [
        { x: 3, y: 3, color: "white" },
        { x: 2, y: 3, color: "black" },
        { x: 4, y: 3, color: "black" },
        { x: 3, y: 2, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info("先叫吃再動手，往往更穩。", "まずアタリを作る。", "Make atari first when you can."),
    ],
  },
  {
    id: "L10",
    boardSize: 9,
    order: 10,
    badgeId: "corner",
    titles: T.title("先安營 · 角", "先安営 · 角", "Corners first"),
    story: T.story(
      "{{name}}，先占角——安營再西行。",
      "{{name}}、角から始めよう。",
      "{{name}}, take corners first — make camp.",
    ),
    goal: T.story("下滿 10 手，試著佔角", "10手・角を意識", "Play 10 moves, prefer corners"),
    battle: { mode: "place_n", n: 10, aiLevel: 1 },
    steps: [
      { type: "story" },
      info("角最容易圍地，邊次之，中最難。", "角→辺→中央。", "Corner → side → center."),
      tap("點一個角附近（例如 2,2）", "角付近（例 2,2）", "Tap near a corner e.g. 2,2", [
        [2, 2],
        [2, 6],
        [6, 2],
        [6, 6],
        [1, 1],
        [1, 7],
        [7, 1],
        [7, 7],
      ]),
    ],
  },
  {
    id: "L11",
    boardSize: 9,
    order: 11,
    badgeId: "connect",
    titles: T.title("師徒同心 · 連與斷", "師徒同心", "Connect & cut"),
    story: T.story(
      "{{name}}，師徒不離散——棋子也要連結。",
      "{{name}}、石をつなごう。",
      "{{name}}, stay connected like the pilgrims.",
    ),
    goal: T.story("下滿 10 手保持連結意識", "10手・つながり意識", "Play 10 moves thinking connect"),
    battle: { mode: "place_n", n: 10, aiLevel: 1 },
    steps: [
      { type: "story" },
      info("連起來氣變多；被切斷會變弱。", "つながると強い。", "Connected stones are stronger."),
    ],
  },
  {
    id: "L12",
    boardSize: 9,
    order: 12,
    badgeId: "gate",
    titles: T.title("小山門 · 綜合", "小山門", "Mountain gate trial"),
    story: T.story(
      "{{name}}，小山門考驗：用吃子證明你學會了預見！",
      "{{name}}、総合テスト！",
      "{{name}}, final trial — capture with foresight!",
    ),
    goal: T.story("吃掉 2 顆白子過關", "白を2子取ってクリア", "Capture 2 white stones"),
    battle: {
      mode: "capture_n",
      n: 2,
      aiLevel: 0,
      setup: [
        { x: 2, y: 2, color: "white" },
        { x: 1, y: 2, color: "black" },
        { x: 3, y: 2, color: "black" },
        { x: 2, y: 1, color: "black" },
        { x: 6, y: 6, color: "white" },
        { x: 5, y: 6, color: "black" },
        { x: 7, y: 6, color: "black" },
        { x: 6, y: 5, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info("綜合運用：氣、叫吃、吃子。你已經是小行者了！", "気・アタリ・取りを使おう。", "Use liberties, atari, and capture!"),
    ],
  },
];

export function getLesson(id: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.id === id);
}
