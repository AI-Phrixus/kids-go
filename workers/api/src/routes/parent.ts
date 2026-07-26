import { Hono } from "hono";
import { LESSONS } from "../lessons-data";
import { loadSession } from "../session";
import type { Env } from "../types";

const parent = new Hono<{ Bindings: Env }>();

/** Skills each lesson emphasizes (for parent-facing summary) */
const LESSON_SKILLS: Record<string, { ja: string; "zh-Hant": string; en: string }> = {
  L01: { ja: "盤・順番・交点", "zh-Hant": "棋盤・輪流・交叉點", en: "Board, turns, intersections" },
  L02: { ja: "気（呼吸）", "zh-Hant": "氣（呼吸）", en: "Liberties" },
  L03: { ja: "取り／吃子", "zh-Hant": "提子／吃子", en: "Capture" },
  L04: { ja: "アタリ・逃げ", "zh-Hant": "叫吃・逃・長", en: "Atari & escape" },
  L05: { ja: "アタリを見つける", "zh-Hant": "預見叫吃", en: "Spotting atari" },
  L06: { ja: "連結", "zh-Hant": "連接", en: "Connection" },
  L07: { ja: "両アタリ", "zh-Hant": "雙叫吃", en: "Double atari" },
  L08: { ja: "切断", "zh-Hant": "切斷", en: "Cut" },
  L09: { ja: "真眼・仮眼", "zh-Hant": "真眼・假眼", en: "True & false eyes" },
  L10: { ja: "金角銀辺草中腹", "zh-Hant": "金角銀邊草肚皮", en: "Corner / side / center" },
  L11: { ja: "辺の感覚", "zh-Hant": "銀邊練習", en: "Side sense" },
  L12: { ja: "取り総合", "zh-Hant": "吃子綜合練習", en: "Capture review" },
  L13: { ja: "門食べ", "zh-Hant": "門吃", en: "Net / gate capture" },
  L14: { ja: "抱え取り", "zh-Hant": "抱吃", en: "Clamp capture" },
  L15: { ja: "シチョウ入門", "zh-Hant": "征子入門", en: "Ladder intro" },
  L16: { ja: "コウ入門", "zh-Hant": "打劫入門", en: "Ko intro" },
  L17: { ja: "シチョウ多手", "zh-Hant": "征子多步", en: "Ladder multi-step" },
  L18: { ja: "ウッテガエシ", "zh-Hant": "倒撲", en: "Snapback" },
  L19: { ja: "セメアイ", "zh-Hant": "對殺入門", en: "Liberty race" },
  L20: { ja: "入門卒業", "zh-Hant": "啟蒙畢業", en: "Graduation" },
  L21: { ja: "引きシチョウ", "zh-Hant": "引征與改招", en: "Ladder-breakers" },
  L22: { ja: "コウ争い", "zh-Hant": "劫材與劫爭", en: "Ko fight" },
  L23: { ja: "眼作り", "zh-Hant": "做眼求活", en: "Making two eyes" },
  L24: { ja: "眼つぶし", "zh-Hant": "點眼殺棋", en: "Killing eyes" },
  L25: { ja: "セメアイの数え方", "zh-Hant": "對殺數氣進階", en: "Semeai counting" },
  L26: { ja: "ヨセと地の計算", "zh-Hant": "官子與數地", en: "Endgame & counting" },
};

const BADGE_NAMES: Record<string, { ja: string; "zh-Hant": string; en: string }> = {
  first_steps: { ja: "第一歩", "zh-Hant": "西行第一步", en: "First steps" },
  breath: { ja: "呼吸", "zh-Hant": "會呼吸的棋", en: "Breath" },
  first_capture: { ja: "初捕獲", "zh-Hant": "初降小妖", en: "First capture" },
  escape: { ja: "脱困", "zh-Hant": "脫困", en: "Escape" },
  atari_eye: { ja: "火眼", "zh-Hant": "火眼預見", en: "Fiery eyes" },
  connect: { ja: "連結", "zh-Hant": "師徒同心", en: "Connect" },
  double: { ja: "両アタリ", "zh-Hant": "雙叫吃", en: "Double atari" },
  cut: { ja: "切断", "zh-Hant": "切斷", en: "Cut" },
  eyes: { ja: "眼", "zh-Hant": "辨真假", en: "Eyes" },
  corner: { ja: "金角", "zh-Hant": "金角銀邊", en: "Golden corner" },
  side_camp: { ja: "銀辺", "zh-Hant": "銀邊官道", en: "Silver side" },
  gate: { ja: "山門", "zh-Hant": "小山門", en: "Gate trial" },
  net_capture: { ja: "門食べ", "zh-Hant": "門吃", en: "Net" },
  clamp: { ja: "抱え", "zh-Hant": "抱吃", en: "Clamp" },
  ladder: { ja: "シチョウ", "zh-Hant": "征子", en: "Ladder" },
  ko_intro: { ja: "コウ", "zh-Hant": "打劫", en: "Ko" },
  ladder2: { ja: "シチョウⅡ", "zh-Hant": "征子Ⅱ", en: "Ladder II" },
  snapback: { ja: "反転", "zh-Hant": "倒撲", en: "Snapback" },
  liberty_race: { ja: "気比べ", "zh-Hant": "氣的對殺", en: "Race" },
  graduation: { ja: "卒業", "zh-Hant": "西天門畢業", en: "Graduate" },
  ladder_reader: { ja: "引きシチョウ", "zh-Hant": "引征識破", en: "Ladder reader" },
  ko_fighter: { ja: "コウ戦士", "zh-Hant": "劫爭高手", en: "Ko fighter" },
  two_eyes: { ja: "二眼", "zh-Hant": "兩眼做活", en: "Two eyes" },
  eye_breaker: { ja: "眼つぶし", "zh-Hant": "點眼殺棋", en: "Eye breaker" },
  liberty_counter: { ja: "気数え名人", "zh-Hant": "數氣名家", en: "Liberty counter" },
  graduate_master: { ja: "凱旋卒業", "zh-Hant": "長安凱旋", en: "Graduate master" },
};

parent.get("/parent/summary", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess?.child) return c.json({ error: "unauthorized" }, 401);
  const locale = (c.req.query("locale") || sess.child.preferred_locale || "zh-Hant") as
    | "ja"
    | "zh-Hant"
    | "en";
  const loc = locale === "ja" || locale === "en" ? locale : "zh-Hant";

  const progress = await c.env.DB.prepare(
    "SELECT lesson_id, status, stars FROM lesson_progress WHERE child_id = ?",
  )
    .bind(sess.child.id)
    .all<{ lesson_id: string; status: string; stars: number }>();

  const badges = await c.env.DB.prepare(
    "SELECT badge_id, earned_at FROM badges WHERE child_id = ? ORDER BY earned_at",
  )
    .bind(sess.child.id)
    .all<{ badge_id: string; earned_at: number }>();

  const rows = progress.results ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  const totalStars = completed.reduce((s, r) => s + (r.stars || 0), 0);
  const skills = completed.map((r) => {
    const sk = LESSON_SKILLS[r.lesson_id];
    return {
      lessonId: r.lesson_id,
      skill: sk ? sk[loc] : r.lesson_id,
      stars: r.stars,
    };
  });

  const badgeList = (badges.results ?? []).map((b) => {
    const n = BADGE_NAMES[b.badge_id];
    return {
      id: b.badge_id,
      name: n ? n[loc] : b.badge_id,
      earnedAt: b.earned_at,
    };
  });

  const nextLesson = LESSONS.find((l) => {
    const row = rows.find((r) => r.lesson_id === l.id);
    return !row || row.status !== "completed";
  });

  const tips = {
    ja: [
      "具体的な行動をほめましょう（「気を数えてから置いたね」）。",
      "負けても責めず、「もう一回どうする？」と聞く。",
      "20分ごとに遠くを見る習慣を一緒に。",
    ],
    "zh-Hant": [
      "讚美具體行為（例如：「你先數氣再下，真棒」）。",
      "失敗時不羞辱，改問：「再試一次，換個想法？」",
      "每 20 分鐘陪孩子遠眺一下，保護眼睛。",
    ],
    en: [
      "Praise specific actions (“You counted liberties first!”).",
      "On mistakes, ask “What could we try next?” — no shame.",
      "Every 20 minutes, look far away together for eye care.",
    ],
  };

  const headline = {
    ja: `${sess.child.nickname} の旅のまとめ`,
    "zh-Hant": `${sess.child.nickname} 的西行摘要（給家長）`,
    en: `${sess.child.nickname}'s journey (for parents)`,
  };

  return c.json({
    child: { id: sess.child.id, nickname: sess.child.nickname },
    headline: headline[loc],
    stats: {
      completedCount: completed.length,
      totalLessons: LESSONS.length,
      totalStars,
      badgeCount: badgeList.length,
      percent: Math.round((completed.length / LESSONS.length) * 100),
    },
    skills,
    badges: badgeList,
    nextLesson: nextLesson
      ? { id: nextLesson.id, title: nextLesson.titles[loc] }
      : null,
    parentTips: tips[loc],
    note: {
      ja: "これは成績表ではありません。成長の記録です。",
      "zh-Hant": "這不是成績單，是成長與快樂學習的記錄。",
      en: "This is not a report card — it's a growth journal.",
    }[loc],
  });
});

export default parent;
