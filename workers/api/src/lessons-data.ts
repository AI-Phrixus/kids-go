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

export type BattleSpec =
  | { mode: "place_n"; n: number; aiLevel: 0 | 1 | 2; setup?: SetupStone[] }
  | { mode: "find_atari"; points: [number, number][]; aiLevel: 0; setup?: SetupStone[] }
  | { mode: "capture_n"; n: number; aiLevel: 0 | 1 | 2; setup?: SetupStone[] };

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
      n: 6,
      aiLevel: 0,
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
      n: 8,
      aiLevel: 0,
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
    goal: T.story("吃掉 1 子，感受「效率」", "1子取って効率を感じる", "Capture 1 stone efficiently"),
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
      n: 8,
      aiLevel: 0,
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
    goal: T.story("認識眼的概念後，下滿 8 手感受空間", "眼を知って8手", "Learn eyes, then play 8 moves"),
    battle: { mode: "place_n", n: 8, aiLevel: 0 },
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
      info(
        "兒童階段先建立「別把自己堵死、留氣口」的感覺即可。",
        "まず窒息しない形を。",
        "For kids: don’t smother your own stones; leave breathing room.",
      ),
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
    goal: T.story("學會角＞邊＞中，並在對局中優先佔角", "角優先で10手", "Prefer corners for 10 moves"),
    battle: { mode: "place_n", n: 10, aiLevel: 0 },
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
    goal: T.story("優先在邊與角附近下棋 10 手", "辺・角を意識して10手", "Play 10 moves favoring side/corner"),
    battle: {
      mode: "place_n",
      n: 10,
      aiLevel: 0,
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
];

export function getLesson(id: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.id === id);
}
