/**
 * L01–L12 兒童圍棋啟蒙課綱
 * 參考：少兒圍棋啟蒙常見路徑（氣→吃→叫吃→連斷→雙吃→眼→
 * 「金角銀邊草肚皮」→吃子綜合練習），西遊包裝。
 */

export type LessonMeta = {
  id: string;
  boardSize: 9;
  order: number;
  badgeId: string;
  titles: { ja: string; "zh-Hant": string; en: string };
  story: { ja: string; "zh-Hant": string; en: string };
  goal: { ja: string; "zh-Hant": string; en: string };
  /** 本課對應的兒童啟蒙主題（內部/家長用） */
  skillTag: { ja: string; "zh-Hant": string; en: string };
  battle: BattleSpec;
  steps: LessonStep[];
};

export type LessonStep =
  | { type: "story" }
  | { type: "tap"; prompt: { ja: string; "zh-Hant": string; en: string }; correct: [number, number][] }
  | { type: "info"; text: { ja: string; "zh-Hant": string; en: string } };

export type Pt = { x: number; y: number };

/** v0.8.0: optional completion gates — place_n lessons used to pass by just
 *  placing N stones anywhere. */
export type GoalPredicate =
  | { type: "connected"; points: Pt[] }
  | { type: "occupy"; points: Pt[]; anyOf?: number }
  | { type: "two_eyes"; group: Pt }
  | { type: "group_captured"; points: Pt[] }
  | { type: "capture_at_least"; n: number }
  | { type: "territory_lead"; margin?: number; komi?: number }
  | { type: "all"; of: GoalPredicate[] };

/** v0.8.0: scripted multi-move exchanges — ladders, ko fights and snapbacks
 *  cannot be expressed as a single tap. */
export type SequenceStep = {
  expect: Pt[] | "any-capture" | "any-atari" | "pass";
  reply?: Pt | "pass" | "ai";
  hint?: { ja: string; "zh-Hant": string; en: string };
  sayKey?: string;
};

export type BattleBase = {
  aiLevel: 0 | 1 | 2;
  setup?: SetupStone[];
  playerColor?: "black" | "white";
  goal?: GoalPredicate;
  /** move budget used by the 3-star rating */
  par?: number;
};

export type BattleSpec =
  | (BattleBase & { mode: "place_n"; n: number })
  | (BattleBase & { mode: "find_atari"; points: [number, number][] })
  | (BattleBase & { mode: "capture_n"; n: number })
  | (BattleBase & { mode: "sequence"; script: SequenceStep[]; afterScript?: "won" | "free-to-goal" });

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

/** 角附近（九路） */
const CORNERS: [number, number][] = [
  [2, 2],
  [2, 6],
  [6, 2],
  [6, 6],
  [1, 1],
  [1, 7],
  [7, 1],
  [7, 7],
  [0, 0],
  [0, 8],
  [8, 0],
  [8, 8],
  [2, 1],
  [1, 2],
  [6, 7],
  [7, 6],
];

/** 邊的中段（非角） */
const SIDES: [number, number][] = [
  [0, 4],
  [4, 0],
  [8, 4],
  [4, 8],
  [0, 3],
  [0, 5],
  [3, 0],
  [5, 0],
  [8, 3],
  [8, 5],
  [3, 8],
  [5, 8],
];

/** 中央「草肚皮」區域 */
const CENTER: [number, number][] = [
  [4, 4],
  [3, 3],
  [3, 4],
  [3, 5],
  [4, 3],
  [4, 5],
  [5, 3],
  [5, 4],
  [5, 5],
];

export const LESSONS: LessonMeta[] = [
  {
    id: "L01",
    boardSize: 9,
    order: 1,
    badgeId: "first_steps",
    skillTag: T.title("棋盤・輪流・交叉點", "盤・順番・交点", "Board, turns, intersections"),
    titles: T.title("出長安 · 棋子與棋盤", "出長安 · 石と盤", "Leaving Chang'an · Stones & board"),
    story: T.story(
      "{{name}}，長安城外。棋盤是取經的地圖：子下在交叉點，黑白輪流走。",
      "{{name}}、長安のそと。石は交点に置く。黒と白が交代！",
      "{{name}}, outside Chang'an. Place on intersections; Black and White take turns!",
    ),
    goal: T.story("用黑子輪流下滿 8 手（無勝負）", "黒で8手（勝敗なし）", "Play 8 black moves (no win/loss)"),
    battle: { mode: "place_n", n: 8, aiLevel: 0 },
    steps: [
      { type: "story" },
      info(
        "棋盤有線。子下在線的「交叉點」上，不是格子中間。",
        "線の交点に置くよ（マスの中ではない）。",
        "Stones go on intersections of lines, not inside squares.",
      ),
      info(
        "黑先白後，一人一手。相鄰（上下左右）的同色子會連成一塊。",
        "黒が先。隣（上下左右）の同じ色はつながる。",
        "Black first. Orthogonally adjacent same-color stones connect.",
      ),
      tap("先點一下天元（正中央），認識棋盤中心。", "天元（中央）をタッチ。", "Tap tengen (center) to learn the board.", [
        [4, 4],
      ]),
    ],
  },
  {
    id: "L02",
    boardSize: 9,
    order: 2,
    badgeId: "breath",
    skillTag: T.title("氣（呼吸）", "気（呼吸）", "Liberties (breath)"),
    titles: T.title("呼吸關 · 氣", "呼吸関 · 気", "Breath Pass · Liberties"),
    story: T.story(
      "{{name}}，棋子也要呼吸！旁邊的空交叉點就是「氣」。氣沒了就不能活。",
      "{{name}}、石にも呼吸がある！空いている隣が「気」。",
      "{{name}}, stones need breath! Empty adjacent points are liberties.",
    ),
    goal: T.story("找出只剩 1 氣的白子並點擊", "1気の白をタッチ", "Tap the white stone with only 1 liberty"),
    battle: {
      mode: "find_atari",
      points: [[2, 2]],
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
      info(
        "一顆子最多 4 氣（上下左右）。在邊角氣會更少。",
        "一子は最大4気。辺と角は少ない。",
        "A stone has up to 4 liberties. Edges and corners have fewer.",
      ),
      info(
        "連在一起的子共用氣。練習時先數「還剩幾口氣」。",
        "つながった石は気を共有する。まず数えよう。",
        "Connected stones share liberties. Practice counting.",
      ),
      tap("圖中白子只剩 1 氣——點它！", "1気の白をタッチ！", "Tap the white stone with 1 liberty!", [[2, 2]]),
    ],
  },
  {
    id: "L03",
    boardSize: 9,
    order: 3,
    badgeId: "first_capture",
    skillTag: T.title("提子／吃子", "取り", "Capture"),
    titles: T.title("初降小妖 · 吃子", "初降小妖 · 取る", "First capture"),
    story: T.story(
      "{{name}}，火眼金睛！對方氣被全部堵住，就可以「提子」（溫柔收服小妖）。",
      "{{name}}、相手の気を全部ふさいだら取れる！",
      "{{name}}, fill the last liberty — you capture (gently)!",
    ),
    goal: T.story("吃掉至少 1 顆白子", "白を1子以上取る", "Capture at least 1 white stone"),
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
      info(
        "提子＝吃子：最後一氣被堵住，對方子從盤上拿掉。",
        "最後の気を埋めると取る。",
        "Capture = fill the last liberty; stones come off the board.",
      ),
      info(
        "兒童練習常從「吃子遊戲」開始——先學會抓，再學圍空。",
        "子どもはまず取りゲームから。",
        "Kids often start with capture games before territory.",
      ),
      tap("最後一手吃白在這裡——點 (2,3)！", "取りの一手は(2,3)！", "Capturing move: tap (2,3)!", [[2, 3]]),
    ],
  },
  {
    id: "L04",
    boardSize: 9,
    order: 4,
    badgeId: "escape",
    skillTag: T.title("叫吃・逃・長", "アタリ・逃げ・長", "Atari, escape, extend"),
    titles: T.title("脫困 · 叫吃與逃", "脱困 · アタリと逃げ", "Escape · Atari & run"),
    story: T.story(
      "{{name}}，只剩 1 氣叫「叫吃」（アタリ）！像被妖怪碰到——先逃、長氣！",
      "{{name}}、1気はアタリ！まず逃げて気をふやそう。",
      "{{name}}, 1 liberty = atari! Escape and extend first!",
    ),
    goal: T.story("練習逃跑：點出逃生的一手，再下幾手", "逃げの一手をタッチしてから対局", "Tap the escape move, then play"),
    battle: {
      mode: "place_n",
      n: 4,
      aiLevel: 1,
      par: 6,
      // v0.8.0 goal: the atari group must actually be saved (escape at 4,5)
      goal: { type: "connected", points: [{ x: 4, y: 4 }, { x: 4, y: 5 }] },
      setup: [
        { x: 4, y: 4, color: "black" },
        { x: 3, y: 4, color: "white" },
        { x: 5, y: 4, color: "white" },
        { x: 4, y: 3, color: "white" },
        // black liberty only at 4,5 — escape there
      ],
    },
    steps: [
      { type: "story" },
      info(
        "叫吃＝再被對方下一手就會被吃。看到叫吃要處理！",
        "アタリ＝あと一手で取られる。",
        "Atari means one move from being captured. Handle it!",
      ),
      info(
        "逃的方法：往有空處「長」——走到還有氣的方向。",
        "逃げる＝空いている方へ長する。",
        "Escape by extending into empty space (more liberties).",
      ),
      tap("黑子被叫吃了！點逃生點 (4,5)。", "逃げは(4,5)！", "Escape at (4,5)!", [[4, 5]]),
    ],
  },
  {
    id: "L05",
    boardSize: 9,
    order: 5,
    badgeId: "atari_eye",
    skillTag: T.title("預見叫吃", "アタリを予見", "Spotting atari"),
    titles: T.title("火眼預見 · 找叫吃", "火眼 · アタリ探し", "Fiery eyes · Find atari"),
    story: T.story(
      "{{name}}，悟空火眼：哪顆白子只剩 1 氣？先看到才能先動手！",
      "{{name}}、どれが1気？見つける力！",
      "{{name}}, which white stone has 1 liberty? Spot it first!",
    ),
    goal: T.story("點出叫吃中的白子", "アタリの白をタッチ", "Tap the white stone in atari"),
    battle: {
      mode: "find_atari",
      points: [[4, 4]],
      aiLevel: 0,
      setup: [
        { x: 4, y: 4, color: "white" },
        { x: 3, y: 4, color: "black" },
        { x: 5, y: 4, color: "black" },
        { x: 4, y: 3, color: "black" },
        { x: 1, y: 1, color: "white" },
        { x: 6, y: 6, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "好棋手不是只會吃，而是「提前看到」誰快被吃。",
        "取る前にアタリを見る。",
        "Strong play starts by seeing atari early.",
      ),
      tap("點出正在叫吃的白子（中間那顆）。", "アタリの白（中央付近）をタッチ。", "Tap the atari white near the center.", [
        [4, 4],
      ]),
    ],
  },
  {
    id: "L06",
    boardSize: 9,
    order: 6,
    badgeId: "connect",
    skillTag: T.title("連接", "つなげる", "Connection"),
    titles: T.title("師徒同心 · 連接", "師徒同心 · 連結", "Together · Connect"),
    story: T.story(
      "{{name}}，師徒不離散——同色棋子連起來，氣變多、更安全！",
      "{{name}}、つながると気が増えて強くなる！",
      "{{name}}, connect your stones — more liberties, safer!",
    ),
    goal: T.story("點出能把兩顆黑子連起來的點，再練習幾手", "つなぐ点をタッチしてから対局", "Tap the connecting point, then play"),
    battle: {
      mode: "place_n",
      n: 4,
      aiLevel: 1,
      par: 6,
      // v0.8.0 goal: the two black stones must end up in ONE group
      goal: { type: "connected", points: [{ x: 2, y: 4 }, { x: 4, y: 4 }] },
      setup: [
        { x: 2, y: 4, color: "black" },
        { x: 4, y: 4, color: "black" },
        // connect at 3,4
        { x: 6, y: 2, color: "white" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "上下左右相鄰＝連接。斜角不算連（兒童常混）。",
        "上下左右が連結。斜めはつながっていない。",
        "Orthogonal adjacency connects; diagonal does NOT.",
      ),
      info(
        "散開的孤子容易被吃；連成一塊像師徒抱團。",
        "バラバラは危ない。かたまりは強い。",
        "Scattered stones are weak; groups are strong.",
      ),
      tap("點 (3,4)，把兩顆黑子連起來！", "(3,4)で黒をつなごう！", "Tap (3,4) to connect the black stones!", [
        [3, 4],
      ]),
    ],
  },
  {
    id: "L07",
    boardSize: 9,
    order: 7,
    badgeId: "double",
    skillTag: T.title("雙叫吃", "両アタリ", "Double atari"),
    titles: T.title("一變兩用 · 雙叫吃", "一変両用 · 両アタリ", "Double atari"),
    story: T.story(
      "{{name}}，七十二變：一手同時叫吃兩邊——對方顧此失彼！",
      "{{name}}、一手で二つのアタリ！",
      "{{name}}, one move, two ataris — double threat!",
    ),
    goal: T.story("下出雙叫吃，再吃掉一邊", "両アタリを打って片方を取る", "Play the double atari, then capture one side"),
    battle: {
      // v0.8.0: a genuine double-atari shape — one move puts BOTH white
      // stones in atari; white saves one side, you take the other.
      mode: "sequence",
      aiLevel: 1,
      par: 3,
      setup: [
        { x: 3, y: 4, color: "white" },
        { x: 5, y: 4, color: "white" },
        { x: 2, y: 4, color: "black" },
        { x: 3, y: 3, color: "black" },
        { x: 6, y: 4, color: "black" },
        { x: 5, y: 3, color: "black" },
      ],
      script: [
        {
          expect: [{ x: 4, y: 4 }],
          reply: { x: 3, y: 5 },
          hint: T.story("找一個同時碰到兩顆白子的點！", "二つの白に同時に当たる点！", "Find the point touching BOTH white stones!"),
        },
        {
          expect: "any-capture",
          hint: T.story("白救了左邊——右邊那顆只剩一口氣！", "左を助けた——右は残り1気！", "White saved the left — the right one has 1 liberty!"),
        },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "雙叫吃：一手讓對方兩處都變成叫吃。啟蒙高頻練習題。",
        "両アタリは入門の定番問題。",
        "Double atari is a classic beginner drill.",
      ),
      info(
        "對方只能救一邊，另一邊往往就能吃到。",
        "片方しか助けられない。",
        "Opponent can only save one side — you take the other.",
      ),
      tap("先完成吃子練習：點 (5,6) 提白。", "まず(5,6)で取ろう。", "Capture at (5,6).", [[5, 6]]),
    ],
  },
  {
    id: "L08",
    boardSize: 9,
    order: 8,
    badgeId: "cut",
    skillTag: T.title("切斷", "切断", "Cut"),
    titles: T.title("盤絲洞 · 切斷", "盤糸 · 切断", "Cut the link"),
    story: T.story(
      "{{name}}，妖怪想拆散師徒——切斷就是把對方連線打斷！",
      "{{name}}、相手のつながりを切ろう！",
      "{{name}}, a cut breaks the opponent’s connection!",
    ),
    goal: T.story("點出切斷白棋連接的點，再練習", "切断点をタッチしてから対局", "Tap the cutting point, then play"),
    battle: {
      mode: "place_n",
      n: 4,
      aiLevel: 1,
      par: 6,
      // v0.8.0 goal: the cutting point must actually be taken
      goal: { type: "occupy", points: [{ x: 4, y: 3 }] },
      setup: [
        { x: 3, y: 3, color: "white" },
        { x: 5, y: 3, color: "white" },
        // cut at 4,3
        { x: 4, y: 5, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "切斷與連接相反：下在對方兩子中間的關鍵點。",
        "相手の二子の間に打って切る。",
        "Cut by playing the key point between enemy stones.",
      ),
      info(
        "被切斷的棋會變弱、氣變分散——攻防都重要。",
        "切られると弱くなる。",
        "Cut groups become weaker and harder to save.",
      ),
      tap("點 (4,3)，切斷兩顆白子！", "(4,3)で白を切ろう！", "Tap (4,3) to cut white!", [[4, 3]]),
    ],
  },
  {
    id: "L09",
    boardSize: 9,
    order: 9,
    badgeId: "eyes",
    skillTag: T.title("真眼・假眼", "真眼・仮眼", "True & false eyes"),
    titles: T.title("辨真假 · 眼", "真偽の眼", "True & false eyes"),
    story: T.story(
      "{{name}}，做活要有「眼」。真眼是穩穩的活路，假眼會被拆穿。",
      "{{name}}、生きるには眼。本物の眼が大事。",
      "{{name}}, life needs eyes. True eyes live; false eyes break.",
    ),
    goal: T.story("補上關鍵一手，做出兩隻真眼", "急所に打って二眼を作る", "Play the key point to make two real eyes"),
    battle: {
      // v0.8.0: a real life exercise — the group must end with two true eyes
      mode: "place_n",
      n: 1,
      aiLevel: 1,
      par: 3,
      goal: { type: "two_eyes", group: { x: 1, y: 0 } },
      setup: [
        { x: 1, y: 0, color: "black" },
        { x: 0, y: 1, color: "black" },
        { x: 1, y: 1, color: "black" },
        { x: 2, y: 1, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 4, y: 0, color: "white" },
        { x: 4, y: 1, color: "white" },
        { x: 0, y: 2, color: "white" },
        { x: 1, y: 2, color: "white" },
        { x: 2, y: 2, color: "white" },
        { x: 3, y: 2, color: "white" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "眼：己方圍住的小空。兩隻真眼通常就「活」了。",
        "二つの真眼で生きやすい。",
        "Two true eyes usually mean a living group.",
      ),
      info(
        "假眼：看起來像眼，但對方能下進去或拆掉。啟蒙只記「要牢牢圍住」。",
        "仮眼は壊されやすい。",
        "False eyes can be destroyed — surround firmly.",
      ),
      tap("黑棋已有一隻眼（左下角）。點 (3,0)，做出第二隻眼！", "(3,0)で二つ目の眼！", "Tap (3,0) to make the second eye!", [[3, 0]]),
    ],
  },
  {
    id: "L10",
    boardSize: 9,
    order: 10,
    badgeId: "corner",
    skillTag: T.title("金角銀邊草肚皮", "金角銀辺草中腹", "Golden corner, silver side, grassy center"),
    titles: T.title(
      "金角銀邊草肚皮",
      "金角・銀辺・草の中",
      "Golden corners · Silver sides · Grassy center",
    ),
    story: T.story(
      "{{name}}，師父傳口訣：**金角、銀邊、草肚皮**！先占角（最易圍地），再佔邊，中央最後——像先安營再趕路。",
      "{{name}}、口訣：**角が金、辺が銀、中央は草**！まず角から。",
      "{{name}}, proverb: **Golden corner, silver side, grassy center**! Corners first, then sides, center last.",
    ),
    goal: T.story("佔到 3 個「金角」附近的點", "金の角を3つ取る", "Occupy 3 golden-corner points"),
    battle: {
      mode: "place_n",
      n: 8,
      aiLevel: 1,
      par: 12,
      // v0.8.0 goal: at least 3 stones on corner-area points
      goal: { type: "occupy", points: CORNERS.map(([x, y]) => ({ x, y })), anyOf: 3 },
    },
    steps: [
      { type: "story" },
      info(
        "【金角】角上兩條邊幫忙圍空，最省子、最穩——像要塞。",
        "角は二辺が味方。囲いやすい＝金。",
        "Corners: two edges help you enclose — most efficient (gold).",
      ),
      info(
        "【銀邊】邊上有一條邊幫忙，次好——像官道。",
        "辺は一辺が味方＝銀。",
        "Sides: one edge helps — next best (silver).",
      ),
      info(
        "【草肚皮】中央四面都要自己圍，最難、最花子——初學別一開始往肚皮擠。",
        "中央は草。最初から真ん中に集まらない。",
        "Center is “grass”: hardest to enclose — don’t rush the belly first.",
      ),
      tap("點一個「金角」附近（角上的點）。", "金の角をタッチ！", "Tap a golden corner point!", CORNERS),
      tap("點一個「銀邊」中段（邊上，不是角）。", "銀の辺をタッチ！", "Tap a silver side point (not corner)!", SIDES),
      tap("這是「草肚皮」——中央區域，點一下認識它（先別急著佔）。", "草の中（中央）を認識。", "Tap the grassy center to recognize it.", CENTER),
    ],
  },
  {
    id: "L11",
    boardSize: 9,
    order: 11,
    badgeId: "side_camp",
    skillTag: T.title("邊的感覺（銀邊）", "辺の感覚", "Side sense (silver)"),
    titles: T.title("官道 · 銀邊練習", "官道 · 銀辺", "Silver side practice"),
    story: T.story(
      "{{name}}，角安好了，走官道——在邊上發展。記住：邊比中央好佔！",
      "{{name}}、角の次は辺。中央より辺！",
      "{{name}}, after corners, grow on the sides — better than the center!",
    ),
    goal: T.story("佔到 3 個「銀邊」的點", "銀の辺を3つ取る", "Occupy 3 silver-side points"),
    battle: {
      mode: "place_n",
      n: 8,
      aiLevel: 1,
      par: 12,
      // v0.8.0 goal: at least 3 stones on side points
      goal: { type: "occupy", points: SIDES.map(([x, y]) => ({ x, y })), anyOf: 3 },
      setup: [
        { x: 2, y: 2, color: "black" },
        { x: 6, y: 6, color: "white" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "複習口訣：金角 → 銀邊 → 草肚皮。",
        "復習：角→辺→中央。",
        "Review: corner → side → center.",
      ),
      info(
        "邊上落子時，想想「靠著邊線圍」。",
        "辺は辺線を使って囲う。",
        "On the side, use the edge to help enclose.",
      ),
      tap("再點一個銀邊位置練習。", "もう一度辺をタッチ。", "Tap a side point again.", SIDES),
    ],
  },
  {
    id: "L12",
    boardSize: 9,
    order: 12,
    badgeId: "gate",
    skillTag: T.title("吃子綜合練習", "取り総合", "Capture drills (review)"),
    titles: T.title("小山門 · 吃子綜合", "小山門 · 取り総合", "Gate · Capture review"),
    story: T.story(
      "{{name}}，小山門考驗：氣、叫吃、吃子、連接——全部用上！兒童圍棋最常練的就是吃子感覺。",
      "{{name}}、総合！気・アタリ・取り・連結。",
      "{{name}}, final drill: liberties, atari, capture, connect — classic kids practice!",
    ),
    goal: T.story("吃掉 2 顆白子過關", "白を2子取ってクリア", "Capture 2 white stones to clear"),
    battle: {
      mode: "capture_n",
      n: 2,
      aiLevel: 0,
      par: 4,
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
      info(
        "綜合清單：數氣 → 看叫吃 → 能吃就吃 → 自己要連、對手可斷。",
        "気→アタリ→取り→連結。",
        "Count liberties → spot atari → capture → stay connected.",
      ),
      info(
        "還記得嗎？金角銀邊草肚皮——開局別只往中央擠。",
        "角・辺・中央の順番も忘れずに。",
        "And remember: corners and sides before the grassy center.",
      ),
      tap("先吃掉第一處叫吃白：點 (2,3)。", "まず(2,3)で1つ目。", "First capture point (2,3).", [[2, 3]]),
    ],
  },
  {
    id: "L13",
    boardSize: 9,
    order: 13,
    badgeId: "net_capture",
    skillTag: T.title("門吃（關門吃）", "門食べ", "Net / gate capture"),
    titles: T.title("盤絲陣 · 門吃", "門食べ", "Gate capture (net)"),
    story: T.story(
      "{{name}}，門吃：像關城門——把對方趕進「口袋」，再把門關上！",
      "{{name}}、門食べ＝袋小路に追い込んで取る！",
      "{{name}}, gate capture: drive them into a pocket, then shut the gate!",
    ),
    goal: T.story("先關門，再提子", "門を閉めてから取る", "Shut the gate, then capture"),
    battle: {
      // v0.8.0: two-move sequence — close the gate, then take the stone
      mode: "sequence",
      aiLevel: 1,
      par: 3,
      setup: [
        // white in a "corridor" — classic simplified net
        { x: 4, y: 2, color: "white" },
        { x: 3, y: 2, color: "black" },
        { x: 5, y: 2, color: "black" },
        { x: 3, y: 3, color: "black" },
        { x: 5, y: 3, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 5, y: 1, color: "black" },
        { x: 4, y: 0, color: "black" },
      ],
      script: [
        {
          expect: [{ x: 4, y: 3 }],
          reply: "ai",
          hint: T.story("先把門關上——堵住白子往下的路！", "まず門を閉めよう！", "Close the gate below the white stone first!"),
        },
        {
          expect: "any-capture",
          hint: T.story("門關上了，白只剩一口氣——提子！", "残り1気——取ろう！", "Gate shut — white has one liberty left. Capture!"),
        },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "門吃（關門吃）：不讓對方逃出去，把逃路堵成「死胡同」再吃。",
        "逃げ道をふさいでから取る。",
        "Net capture: block escape routes, then capture.",
      ),
      info(
        "和雙叫吃不同：門吃常靠「圍＋關門」多步完成。",
        "両アタリとは違い、囲ってから閉じる。",
        "Unlike double atari, nets often need several surrounding moves.",
      ),
      tap("點 (4,3)，封住白子往下的路（關門）！", "(4,3)で門を閉じよう！", "Tap (4,3) to shut the gate!", [[4, 3]]),
    ],
  },
  {
    id: "L14",
    boardSize: 9,
    order: 14,
    badgeId: "clamp",
    skillTag: T.title("抱吃", "抱え込み", "Clamp / hug capture"),
    titles: T.title("緊箍 · 抱吃", "抱え取り", "Clamp capture"),
    story: T.story(
      "{{name}}，抱吃：從兩邊「抱住」對方，讓他無處可逃。",
      "{{name}}、両側から抱えて取る！",
      "{{name}}, clamp: hug from both sides so they cannot run!",
    ),
    goal: T.story("吃掉被抱住的白子", "抱えた白を取る", "Capture the clamped white stone"),
    battle: {
      mode: "capture_n",
      n: 1,
      aiLevel: 1,
      par: 2,
      setup: [
        { x: 4, y: 4, color: "white" },
        { x: 3, y: 4, color: "black" },
        { x: 5, y: 4, color: "black" },
        { x: 4, y: 3, color: "black" },
        // capture at 4,5
      ],
    },
    steps: [
      { type: "story" },
      info(
        "抱吃：左右（或上下）已經有己方子，再補最後一氣。",
        "両側を押さえて最後の気。",
        "Clamp: you already press both sides; fill the last liberty.",
      ),
      tap("點 (4,5) 完成抱吃！", "(4,5)で抱え取り！", "Tap (4,5) to finish the clamp!", [[4, 5]]),
    ],
  },
  {
    id: "L15",
    boardSize: 9,
    order: 15,
    badgeId: "ladder",
    skillTag: T.title("征子入門", "シチョウ入門", "Ladder intro"),
    titles: T.title("筋斗雲 · 征子入門", "シチョウ入門", "Ladder intro"),
    story: T.story(
      "{{name}}，征子（梯子）：一直叫吃、對方一直逃，像追著筋斗雲——方向對就能吃到！",
      "{{name}}、シチョウ＝追いかけて取る形！",
      "{{name}}, ladder: keep giving atari as they run — chase correctly to capture!",
    ),
    goal: T.story("沿對角線一路叫吃，把白子追到邊上吃掉", "斜めに追いつめて取る", "Chase white diagonally to the edge and capture"),
    battle: {
      // v0.8.0: a REAL ladder — engine-verified 6-exchange chase to the edge.
      mode: "sequence",
      aiLevel: 1,
      par: 8,
      setup: [
        { x: 5, y: 5, color: "white" },
        { x: 4, y: 5, color: "black" },
        { x: 5, y: 4, color: "black" },
        { x: 4, y: 6, color: "black" },
      ],
      script: [
        { expect: [{ x: 6, y: 5 }], reply: { x: 5, y: 6 },
          hint: T.story("從右邊叫吃，讓白只剩一口氣！", "右からアタリ！", "Atari from the right — one liberty left!") },
        { expect: [{ x: 5, y: 7 }], reply: { x: 6, y: 6 },
          hint: T.story("白往下逃了——從下面再叫吃！", "下からまたアタリ！", "White ran down — atari from below!") },
        { expect: [{ x: 7, y: 6 }], reply: { x: 6, y: 7 },
          hint: T.story("換右邊！保持只給白一口氣。", "また右から！", "Right side again — keep white at one liberty.") },
        { expect: [{ x: 7, y: 7 }], reply: { x: 6, y: 8 },
          hint: T.story("繼續斜著追！", "斜めに追う！", "Keep chasing diagonally!") },
        { expect: [{ x: 7, y: 8 }], reply: { x: 5, y: 8 },
          hint: T.story("白快到邊了——堵住右邊！", "端はもうすぐ！", "White is near the edge — block the right!") },
        { expect: "any-capture",
          hint: T.story("白已無路可逃——點最後一口氣，全部提子！", "最後の気をふさごう！", "No escape left — fill the last liberty and capture!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "征子：你叫吃 → 對方逃 → 你再叫吃，沿著對角線追。",
        "アタリ→逃げ→またアタリ、斜めに追う。",
        "Ladder: atari → escape → atari again, chasing diagonally.",
      ),
      info(
        "口訣：追的時候永遠讓對方「只剩一口氣」。",
        "常に相手を1気にする。",
        "Rule of thumb: keep the runner at exactly one liberty.",
      ),
    ],
  },
  {
    id: "L16",
    boardSize: 9,
    order: 16,
    badgeId: "ko_intro",
    skillTag: T.title("打劫入門", "コウ入門", "Ko intro"),
    titles: T.title("緊箍咒 · 打劫入門", "コウ入門", "Ko intro"),
    story: T.story(
      "{{name}}，打劫：同一個來回收就會沒完沒了——所以規則說：不能立刻提回，要先「找劫材」！",
      "{{name}}、コウ＝すぐ取り返すのは禁止！",
      "{{name}}, ko: no instant recapture — play elsewhere first (ko threat)!",
    ),
    goal: T.story("提劫、看白不能立刻提回、再把劫補牢", "コウを取り、埋めて固める", "Take the ko, see the rule, then fill it solid"),
    battle: {
      // v0.8.0: a REAL ko shape (was a plain capture). Take the ko; white
      // CANNOT retake immediately and plays elsewhere; then fill the ko.
      mode: "sequence",
      aiLevel: 1,
      par: 3,
      setup: [
        { x: 3, y: 3, color: "black" },
        { x: 4, y: 2, color: "black" },
        { x: 4, y: 4, color: "black" },
        { x: 4, y: 3, color: "white" },
        { x: 6, y: 3, color: "white" },
        { x: 5, y: 2, color: "white" },
        { x: 5, y: 4, color: "white" },
      ],
      script: [
        { expect: [{ x: 5, y: 3 }], reply: { x: 0, y: 0 },
          hint: T.story("提劫的點在白子唯一的氣上！", "コウを取る点は白の最後の気！", "Take the ko on white's last liberty!") },
        { expect: [{ x: 4, y: 3 }],
          hint: T.story("白不能立刻提回，去了別處——趁現在把劫「補牢」！", "白は取り返せない——今のうちに埋めよう！", "White couldn't retake and played elsewhere — fill the ko NOW!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "若允許同點來回提，棋會無限循環。所以：剛被提的那點，下一手不能立刻提回。",
        "同じ点の取り合い禁止＝コウ。",
        "Immediate recapture on the same point is forbidden — that is ko.",
      ),
      info(
        "兒童先記住口訣：「提了劫，先去別處下一手。」",
        "取ったら一度よそへ。",
        "Kid mnemonic: after a ko capture, play somewhere else first.",
      ),
      info(
        "這一關試試看：你提劫 → 白只好去別處 → 你把劫填上，變成鐵壁！",
        "取る→白はよそへ→埋めて固める！",
        "Try it: take the ko → white must play elsewhere → fill it solid!",
      ),
    ],
  },
  {
    id: "L17",
    boardSize: 9,
    order: 17,
    badgeId: "ladder2",
    skillTag: T.title("征子多步", "シチョウ多手", "Ladder multi-step"),
    titles: T.title("筋斗雲 · 征子多步", "シチョウ多手", "Ladder multi-step"),
    story: T.story(
      "{{name}}，征子要追兩步：先叫吃，對方逃，你再叫吃——方向對就能追上！",
      "{{name}}、シチョウは二手追う。方向が命！",
      "{{name}}, ladder needs two chase moves — keep the atari direction!",
    ),
    goal: T.story("十二段筋斗雲：把白子從中腹一路追到底線提光", "12手のシチョウで取り切る", "A 12-exchange ladder from center to the edge"),
    battle: {
      // v0.8.0: the FULL engine-verified diagonal ladder across the board.
      mode: "sequence",
      aiLevel: 1,
      par: 14,
      setup: [
        { x: 2, y: 2, color: "white" },
        { x: 1, y: 2, color: "black" },
        { x: 2, y: 1, color: "black" },
        { x: 1, y: 3, color: "black" },
      ],
      script: [
        { expect: [{ x: 3, y: 2 }], reply: { x: 2, y: 3 },
          hint: T.story("從右邊叫吃！", "右からアタリ！", "Atari from the right!") },
        { expect: [{ x: 2, y: 4 }], reply: { x: 3, y: 3 },
          hint: T.story("從下面堵住！讓白只剩一口氣。", "下からふさぐ！", "Block from below — one liberty!") },
        { expect: [{ x: 4, y: 3 }], reply: { x: 3, y: 4 },
          hint: T.story("再從右邊！", "また右！", "Right side again!") },
        { expect: [{ x: 3, y: 5 }], reply: { x: 4, y: 4 },
          hint: T.story("再從下面！之字形前進。", "また下！ジグザグ。", "Below again — zigzag!") },
        { expect: [{ x: 5, y: 4 }], reply: { x: 4, y: 5 },
          hint: T.story("右！", "右！", "Right!") },
        { expect: [{ x: 4, y: 6 }], reply: { x: 5, y: 5 },
          hint: T.story("下！", "下！", "Below!") },
        { expect: [{ x: 6, y: 5 }], reply: { x: 5, y: 6 },
          hint: T.story("右！", "右！", "Right!") },
        { expect: [{ x: 5, y: 7 }], reply: { x: 6, y: 6 },
          hint: T.story("下！", "下！", "Below!") },
        { expect: [{ x: 7, y: 6 }], reply: { x: 6, y: 7 },
          hint: T.story("右！", "右！", "Right!") },
        { expect: [{ x: 7, y: 7 }], reply: { x: 6, y: 8 },
          hint: T.story("白到底線了！", "端に到達！", "White hit the edge!") },
        { expect: [{ x: 7, y: 8 }], reply: { x: 5, y: 8 },
          hint: T.story("關右門！", "右をふさぐ！", "Shut the right door!") },
        { expect: "any-capture",
          hint: T.story("最後一口氣——全部提子！", "最後の気！全部取ろう！", "The last liberty — capture them all!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "征子多步：①叫吃 ②對方逃 ③你再叫吃。每一步都堵「往外的氣」。",
        "アタリ→逃げ→アタリ。",
        "Atari → escape → atari again.",
      ),
      info(
        "之字形：右、下、右、下……方向對，白永遠只有一口氣。",
        "ジグザグ：右・下・右・下……",
        "Zigzag: right, below, right, below… white never gets a second liberty.",
      ),
    ],
  },
  {
    id: "L18",
    boardSize: 9,
    order: 18,
    badgeId: "snapback",
    skillTag: T.title("倒撲入門", "ウッテガエシ", "Snapback intro"),
    titles: T.title("乾坤倒轉 · 倒撲", "ウッテガエシ", "Snapback"),
    story: T.story(
      "{{name}}，倒撲：對方以為吃了你，結果被你反吃——像筋斗翻轉！",
      "{{name}}、取ったつもりが取られる！",
      "{{name}}, snapback: they think they capture you — you capture more!",
    ),
    goal: T.story("先送一子進虎口，再一口氣反吃五子！", "一子を捨てて五子を取り返す！", "Sacrifice one stone, snap back five!"),
    battle: {
      // v0.8.0: a REAL snapback (the old setup was byte-identical to L14's
      // clamp). Requires the fixed ko rule — the recapture used to be illegal.
      mode: "sequence",
      aiLevel: 1,
      par: 4,
      setup: [
        { x: 0, y: 1, color: "white" },
        { x: 1, y: 1, color: "white" },
        { x: 2, y: 1, color: "white" },
        { x: 2, y: 0, color: "white" },
        { x: 0, y: 2, color: "black" },
        { x: 1, y: 2, color: "black" },
        { x: 2, y: 2, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 3, y: 0, color: "black" },
      ],
      script: [
        { expect: [{ x: 0, y: 0 }], reply: { x: 1, y: 0 },
          hint: T.story("把一顆黑子「送」進白的眼裡（0,0）！", "白の眼に一子入れよう(0,0)！", "Throw one stone INTO white's eye at (0,0)!") },
        { expect: "any-capture",
          hint: T.story("白吃了你一子——但現在整塊白只剩一口氣！再點 (0,0)！", "白は取ったが残り1気！もう一度(0,0)！", "White captured your stone — but now the whole group has ONE liberty. Play (0,0) again!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "倒撲：故意送一子讓對方吃——吃完他反而只剩一口氣，你再全部提回！",
        "捨て石→相手が取る→逆に全部取れる！",
        "Sacrifice a stone; after they capture, THEY are left with one liberty!",
      ),
      info(
        "提子前要想一步：吃了這子，我自己安全嗎？",
        "取る前に一手読む。",
        "Before capturing, always read one move ahead.",
      ),
    ],
  },
  {
    id: "L19",
    boardSize: 9,
    order: 19,
    badgeId: "liberty_race",
    skillTag: T.title("對殺入門（氣多少）", "セメアイ入門", "Capturing race intro"),
    titles: T.title("對峙 · 氣的對殺", "気の戦い", "Liberty race"),
    story: T.story(
      "{{name}}，兩邊都要死活時：比誰的氣更少、誰先動手——這是對殺入門。",
      "{{name}}、気の数を比べよう！",
      "{{name}}, when both groups are in danger: compare liberties!",
    ),
    goal: T.story("黑白各剩一口氣——先動手的贏！", "両方あと1気——先に打った方が勝ち！", "Both groups at one liberty — first to move wins!"),
    battle: {
      // v0.8.0: a REAL capturing race — your corner pair is ALSO in atari;
      // hesitate and white takes you first.
      mode: "capture_n",
      n: 2,
      aiLevel: 2,
      par: 3,
      goal: { type: "group_captured", points: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
      setup: [
        { x: 0, y: 0, color: "black" },
        { x: 1, y: 0, color: "black" },
        { x: 0, y: 2, color: "black" },
        { x: 1, y: 2, color: "black" },
        { x: 0, y: 1, color: "white" },
        { x: 1, y: 1, color: "white" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "對殺：先數雙方氣。你的角上黑子幾口氣？白呢？",
        "気を数えよう。黒は？白は？",
        "Count liberties: your corner pair vs the white pair.",
      ),
      info(
        "氣一樣多的時候——先動手的那方贏！",
        "同じ数なら先に打った方の勝ち！",
        "Equal liberties: whoever moves first wins!",
      ),
      tap("白的最後一口氣在 (2,1)——現在就下手！", "(2,1)が白の最後の気！", "White's last liberty is (2,1) — strike now!", [[2, 1]]),
    ],
  },
  {
    id: "L20",
    boardSize: 9,
    order: 20,
    badgeId: "graduation",
    skillTag: T.title("啟蒙畢業綜合", "入門卒業", "Foundation graduation"),
    titles: T.title("西天門 · 啟蒙畢業", "西天門 · 卒業", "West gate · Graduation"),
    story: T.story(
      "{{name}}，西天門前：氣、吃、叫吃、連斷、金角銀邊、門吃抱吃——全部用上，畢業啦！",
      "{{name}}、入門の総仕上げ！",
      "{{name}}, graduation: use everything you've learned!",
    ),
    goal: T.story("吃掉 2 子通過畢業關", "2子取って卒業", "Capture 2 stones to graduate"),
    battle: {
      mode: "capture_n",
      n: 2,
      aiLevel: 1,
      par: 5,
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
      info(
        "畢業清單：數氣、叫吃、吃子、連接、切斷、金角銀邊、門吃抱吃、征劫概念。",
        "気・アタリ・取り・連結・角辺・門・シチョウ・コウ。",
        "Liberties, atari, capture, connect, corners, nets, ladder, ko.",
      ),
      tap("先吃第一子 (2,3)。", "まず(2,3)。", "First capture (2,3).", [[2, 3]]),
    ],
  },
  /* ================= v0.8.0 — 取經歸途 L21–L26 ================= */
  {
    id: "L21",
    boardSize: 9,
    order: 21,
    badgeId: "ladder_reader",
    skillTag: T.title("引征與改招", "シチョウアタリと変化", "Ladder-breakers & switching plans"),
    titles: T.title("通天河 · 老黿渡 · 引征", "通天河 · 引きシチョウ", "Tongtian River · Ladder-breaker"),
    story: T.story(
      "{{name}}，歸途第一站！老黿說：征子前先看路——路上有白的接應子（引征），追過去會反被咬！這時要改用關門。",
      "{{name}}、帰り道の最初の駅！追う前に道を見る。敵の応援（シチョウアタリ）がいたら、門で取ろう！",
      "{{name}}, first stop home! Before laddering, check the road — an enemy helper (ladder-breaker) means: switch to a net!",
    ),
    goal: T.story("看見引征子→放棄征子→改用關門吃", "応援を見たら門で取る", "See the breaker → skip the ladder → use the net"),
    battle: {
      // The distant white stone at (7,7) is a ladder-breaker: chasing from
      // the corridor would eventually fail. The correct plan: shut the gate.
      mode: "sequence",
      aiLevel: 2,
      par: 3,
      setup: [
        { x: 4, y: 2, color: "white" },
        { x: 7, y: 7, color: "white" },
        { x: 3, y: 2, color: "black" },
        { x: 5, y: 2, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 5, y: 1, color: "black" },
        { x: 3, y: 3, color: "black" },
        { x: 5, y: 3, color: "black" },
        { x: 4, y: 0, color: "black" },
      ],
      script: [
        { expect: [{ x: 4, y: 3 }], reply: "ai",
          hint: T.story("遠處有白的接應——別追！關門的點在白子下方。", "応援がいる——追わずに門を閉めよう。", "A helper waits far away — don't chase! Shut the gate below.") },
        { expect: "any-capture",
          hint: T.story("門關上了——提子！", "門は閉じた——取ろう！", "Gate closed — capture!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "引征：征子路上如果有對方的子接應，追到那裡就會失敗。",
        "シチョウの道に敵の石があると失敗する。",
        "If an enemy stone waits on the ladder path, the chase fails.",
      ),
      tap("先用火眼金睛找出白的「接應子」——點它！", "応援の白石をタッチ！", "Spot the white ladder-breaker — tap it!", [[7, 7]]),
      info(
        "看到引征就改招：門吃、抱吃都是好選擇。",
        "見つけたら作戦変更：門やゲタで取る。",
        "Seen it? Switch plans: nets and clamps still work.",
      ),
    ],
  },
  {
    id: "L22",
    boardSize: 9,
    order: 22,
    badgeId: "ko_fighter",
    skillTag: T.title("劫材與劫爭", "コウ材とコウ争い", "Ko threats & the ko fight"),
    titles: T.title("火焰山回望 · 劫爭", "火焔山 · コウ争い", "Flaming Mountain · The ko fight"),
    story: T.story(
      "{{name}}，火焰山的火又冒出來了！這次是真正的劫爭：提劫、找劫材、應劫、再提回——比的是誰的劫材多！",
      "{{name}}、今度は本物のコウ争い！コウ材を探して戦おう！",
      "{{name}}, a REAL ko fight this time: take, threaten, answer, retake — whoever has more threats wins!",
    ),
    goal: T.story("打贏一場完整劫爭：提劫→應劫材→找劫材→再提→補劫", "コウ争いに勝つ", "Win a full ko fight"),
    battle: {
      mode: "sequence",
      aiLevel: 2,
      par: 7,
      setup: [
        { x: 3, y: 3, color: "black" },
        { x: 4, y: 2, color: "black" },
        { x: 4, y: 4, color: "black" },
        { x: 4, y: 3, color: "white" },
        { x: 6, y: 3, color: "white" },
        { x: 5, y: 2, color: "white" },
        { x: 5, y: 4, color: "white" },
        { x: 0, y: 4, color: "black" },
        { x: 1, y: 4, color: "black" },
        { x: 0, y: 3, color: "white" },
        { x: 1, y: 3, color: "white" },
        { x: 2, y: 4, color: "white" },
        { x: 7, y: 0, color: "white" },
        { x: 8, y: 0, color: "white" },
        { x: 7, y: 1, color: "black" },
      ],
      script: [
        { expect: [{ x: 5, y: 3 }], reply: { x: 0, y: 5 },
          hint: T.story("先提劫！白唯一的氣上。", "まずコウを取る！", "Take the ko first!") },
        { expect: [{ x: 1, y: 5 }], reply: { x: 4, y: 3 },
          hint: T.story("白在威脅你左邊的兩顆子（劫材）——先救它們！", "白の脅し（コウ材）に応えよう！", "White threatened your left pair (a ko threat) — answer it!") },
        { expect: [{ x: 8, y: 1 }], reply: { x: 6, y: 0 },
          hint: T.story("白提回劫了——輪到你找劫材！右上白兩子只剩兩口氣。", "今度は君のコウ材！右上の白！", "White retook the ko — YOUR turn to threaten! The white pair top-right.") },
        { expect: [{ x: 5, y: 3 }], reply: "pass",
          hint: T.story("白應了你的劫材——現在可以再提劫！", "白が応えた——もう一度コウを取れる！", "White answered your threat — retake the ko now!") },
        { expect: [{ x: 4, y: 3 }],
          hint: T.story("最後把劫填上，劫爭勝利！", "コウを埋めて勝ち！", "Fill the ko — the fight is won!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "劫爭流程：提劫 → 對方不能立刻提回 → 他下「劫材」逼你回應 → 他再提回 → 你也找劫材 → 你再提回。",
        "コウの流れ：取る→相手はコウ材→取り返す→自分もコウ材→また取る。",
        "The cycle: take → they threaten → they retake → you threaten → you retake.",
      ),
      info(
        "劫材＝對方一定要回應的威脅。數數自己有幾個！",
        "コウ材＝相手が必ず応える脅し。",
        "A ko threat = a move the opponent MUST answer. Count yours!",
      ),
    ],
  },
  {
    id: "L23",
    boardSize: 9,
    order: 23,
    badgeId: "two_eyes",
    skillTag: T.title("做眼求活", "眼を作って生きる", "Making two eyes (life)"),
    titles: T.title("五莊觀 · 人參果 · 做眼", "五荘観 · 人参果 · 眼作り", "Ginseng Grove · Two eyes"),
    story: T.story(
      "{{name}}，五莊觀的人參果一顆保平安、兩顆保長生！棋也一樣：兩隻真眼，這塊棋就永遠吃不掉。",
      "{{name}}、人参果は二つで長生き！石も真眼二つで永遠に取られない。",
      "{{name}}, two ginseng fruits grant long life — and two real eyes make a group uncapturable!",
    ),
    goal: T.story("在白棋圍攻下做出兩隻真眼", "白に囲まれても二眼で生きる", "Make two real eyes under attack"),
    battle: {
      mode: "place_n",
      n: 1,
      aiLevel: 1,
      par: 3,
      goal: { type: "two_eyes", group: { x: 1, y: 0 } },
      setup: [
        { x: 1, y: 0, color: "black" },
        { x: 0, y: 1, color: "black" },
        { x: 1, y: 1, color: "black" },
        { x: 2, y: 1, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 4, y: 1, color: "black" },
        { x: 5, y: 0, color: "white" },
        { x: 5, y: 1, color: "white" },
        { x: 0, y: 2, color: "white" },
        { x: 1, y: 2, color: "white" },
        { x: 2, y: 2, color: "white" },
        { x: 3, y: 2, color: "white" },
        { x: 4, y: 2, color: "white" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "眼位要「分成兩間房」：一大間會被一手點破，兩小間才安全。",
        "大きな一部屋より、二つの小部屋！",
        "One big room can be invaded; TWO small rooms are safe.",
      ),
      info(
        "看棋盤：黑棋左下已有一隻眼 (0,0)。眼位空間還剩 (2,0)(3,0)(4,0)。",
        "左下に一眼あり。残りのスペースを見て。",
        "You already have one eye at (0,0). Space remains at (2,0)(3,0)(4,0).",
      ),
      tap("在 (3,0) 隔出第二隻眼！", "(3,0)で二つ目の眼！", "Partition at (3,0) for the second eye!", [[3, 0]]),
    ],
  },
  {
    id: "L24",
    boardSize: 9,
    order: 24,
    badgeId: "eye_breaker",
    skillTag: T.title("點眼殺棋", "眼をつぶして取る", "Killing by destroying eyes"),
    titles: T.title("白骨洞回顧 · 殺眼", "白骨洞 · 眼つぶし", "White-Bone Cave · Kill the eye"),
    story: T.story(
      "{{name}}，白骨精又變身了！這塊白棋看起來要活——用火眼金睛點進「要點」，讓它做不出第二隻眼！",
      "{{name}}、白骨精の変身を見破れ！急所に打てば二眼はできない！",
      "{{name}}, see through the disguise! Hit the vital point so white can never make a second eye!",
    ),
    goal: T.story("點入要點，殺死白棋全部提子", "急所に打って白を全部取る", "Play the vital point and capture the whole group"),
    battle: {
      mode: "sequence",
      aiLevel: 1,
      par: 8,
      afterScript: "free-to-goal",
      goal: { type: "group_captured", points: [{ x: 1, y: 0 }, { x: 1, y: 1 }] },
      setup: [
        { x: 1, y: 0, color: "white" },
        { x: 0, y: 1, color: "white" },
        { x: 1, y: 1, color: "white" },
        { x: 2, y: 1, color: "white" },
        { x: 3, y: 1, color: "white" },
        { x: 0, y: 2, color: "black" },
        { x: 1, y: 2, color: "black" },
        { x: 2, y: 2, color: "black" },
        { x: 3, y: 2, color: "black" },
        { x: 4, y: 1, color: "black" },
        { x: 4, y: 0, color: "black" },
      ],
      script: [
        { expect: [{ x: 3, y: 0 }], reply: "ai",
          hint: T.story("白想在 (2,0)(3,0) 做第二隻眼——點進要點 (3,0)！", "急所は(3,0)！", "White wants a second eye at (2,0)(3,0) — hit (3,0)!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "殺棋順序：①先數對方能做幾隻真眼 ②點進做眼的要點 ③外面收氣提光。",
        "①眼を数える ②急所に打つ ③外から詰める。",
        "Kill plan: count their eyes → hit the vital point → fill from outside.",
      ),
      info(
        "白左下 (0,0) 已是真眼；右邊那間房是它最後的希望。",
        "(0,0)は本物。右の部屋が最後の望み。",
        "White's (0,0) eye is real; the right-side room is its last hope.",
      ),
    ],
  },
  {
    id: "L25",
    boardSize: 9,
    order: 25,
    badgeId: "liberty_counter",
    skillTag: T.title("對殺數氣進階", "セメアイの数え方", "Semeai liberty counting"),
    titles: T.title("流沙河 · 數沙 · 對殺", "流沙河 · 砂数え · セメアイ", "Flowing-Sand River · Count the race"),
    story: T.story(
      "{{name}}，沙悟淨數過流沙河的每一粒沙！對殺就是數氣比賽：先堵對方的「外氣」，一口都不能數錯！",
      "{{name}}、悟浄は砂を全部数えた！セメアイは気の数え合い。外の気から詰めよう！",
      "{{name}}, Wujing counted every sand grain! A capturing race is a counting contest — fill THEIR outside liberties first!",
    ),
    goal: T.story("兩塊棋纏鬥：數清楚氣，先提掉白棋", "気を数えて白を先に取る", "Count carefully and capture white first"),
    battle: {
      mode: "capture_n",
      n: 2,
      aiLevel: 2,
      par: 4,
      goal: { type: "group_captured", points: [{ x: 4, y: 4 }, { x: 4, y: 5 }] },
      setup: [
        { x: 4, y: 4, color: "white" },
        { x: 4, y: 5, color: "white" },
        { x: 5, y: 4, color: "black" },
        { x: 5, y: 5, color: "black" },
        { x: 4, y: 3, color: "black" },
        { x: 3, y: 4, color: "black" },
        { x: 5, y: 3, color: "white" },
        { x: 6, y: 4, color: "white" },
        // outer seal: the race area is closed — extending gains nothing
        { x: 2, y: 5, color: "black" },
        { x: 3, y: 6, color: "black" },
        { x: 4, y: 7, color: "black" },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "先數：白的race棋（中央兩顆）幾口氣？你的呢？",
        "まず数える：白は何気？黒は？",
        "Count first: the white race pair vs YOUR race pair.",
      ),
      info(
        "口訣：先堵對方外氣，自己的氣留到最後。",
        "外の気から詰める。共有の気は最後。",
        "Fill their OUTSIDE liberties first; save shared ones for last.",
      ),
      tap("白的外氣在 (3,5)——從這裡開始收！", "(3,5)から詰める！", "Start at white's outside liberty (3,5)!", [[3, 5]]),
    ],
  },
  {
    id: "L26",
    boardSize: 9,
    order: 26,
    badgeId: "graduate_master",
    skillTag: T.title("官子與數地（畢業）", "ヨセと地の計算（卒業）", "Endgame & counting (graduation)"),
    titles: T.title("長安凱旋 · 數寶大典", "長安凱旋 · 宝数え", "Triumphant return · Counting the treasure"),
    story: T.story(
      "{{name}}，回到長安了！最後一課：把邊界關好（官子），然後兩人都 pass，一起數寶物（數地）——多一目也是贏！",
      "{{name}}、長安に帰ってきた！最後はヨセ。境界を閉じて、パスして、宝（地）を数えよう！",
      "{{name}}, back in Chang'an! Final lesson: close the borders, pass, and count the treasure — one point is enough to win!",
    ),
    goal: T.story("搶到更多邊界點，終局數地獲勝", "境界を多く取り、計算で勝つ", "Grab more boundary points and win on the count"),
    battle: {
      mode: "sequence",
      aiLevel: 2,
      par: 12,
      afterScript: "free-to-goal",
      goal: { type: "territory_lead", komi: 0 },
      setup: [
        { x: 3, y: 0, color: "black" },
        { x: 3, y: 1, color: "black" },
        { x: 3, y: 2, color: "black" },
        { x: 3, y: 3, color: "black" },
        { x: 3, y: 4, color: "black" },
        { x: 3, y: 5, color: "black" },
        { x: 3, y: 6, color: "black" },
        { x: 3, y: 7, color: "black" },
        { x: 3, y: 8, color: "black" },
        { x: 5, y: 0, color: "white" },
        { x: 5, y: 1, color: "white" },
        { x: 5, y: 2, color: "white" },
        { x: 5, y: 3, color: "white" },
        { x: 5, y: 4, color: "white" },
        { x: 5, y: 5, color: "white" },
        { x: 5, y: 6, color: "white" },
        { x: 5, y: 7, color: "white" },
        { x: 5, y: 8, color: "white" },
      ],
      script: [
        { expect: [{ x: 4, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 8 }], reply: "ai",
          hint: T.story("中間一排（x=4）誰下到就是誰的分——先搶！", "真ん中の列は早い者勝ち！", "The middle column scores for whoever fills it — grab it!") },
        { expect: [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 4, y: 8 }], reply: "ai",
          hint: T.story("繼續搶邊界點！", "境界を取り続けよう！", "Keep taking boundary points!") },
      ],
    },
    steps: [
      { type: "story" },
      info(
        "數地（中國規則）：你的棋子＋你圍住的空點＝你的分數。",
        "石＋囲った空点＝点数（中国ルール）。",
        "Area counting: your stones + your surrounded points = your score.",
      ),
      info(
        "官子：把邊界關好。每搶到一個邊界點，就多一分！",
        "ヨセ＝境界を閉じる。1点ずつ積み上げ！",
        "Endgame: close borders. Every boundary point you take is +1!",
      ),
      info(
        "沒棋可下就 pass。兩人都 pass → 開始數寶物！",
        "打つ所がなければパス。二人パスで計算！",
        "Nothing left? Pass. Two passes → count the treasure!",
      ),
    ],
  },
];

export function getLesson(id: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.id === id);
}


