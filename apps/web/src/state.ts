import type { BoardState, Point } from "../../../packages/go-engine/src/index";
import type { LessonDetail } from "./api";
import type { Locale } from "./i18n";
import type { BattleRuntime } from "./battle/runtime";

export type Route =
  | "welcome"
  | "map"
  | "lesson"
  | "free"
  | "settings"
  | "parent"
  | "privacy"
  | "help";
export type FreeMode = "casual" | "race5" | "race10";
export type AiLevel = 0 | 1 | 2;

/**
 * v0.8.0: the 43 module-level globals of the old main.ts collected into one
 * typed state object. Persistence stays in localStorage via load/save helpers.
 */
export const state = {
  locale: (localStorage.getItem("kids-go-locale") as Locale) || ("zh-Hant" as Locale),
  route: "welcome" as Route,
  nickname: "",

  // lesson flow
  lessonId: "L01",
  lesson: null as LessonDetail | null,
  stepIndex: 0,
  phase: "steps" as "steps" | "battle" | "done",
  battle: null as BattleRuntime | null,
  completing: false,
  earnedStars: 0,
  continueLessonId: null as string | null,
  nextLessonId: null as string | null,
  allLessonIds: [] as string[],
  lessonTotal: 20,

  // board
  board: null as BoardState | null,
  lastMove: null as Point | null,
  boardBusy: false,
  focusCell: null as Point | null,
  showLibs: localStorage.getItem("kids-go-libs") === "1",

  // free play
  freeMode: readFreeMode(),
  freeAiLevel: readAiLevel(),
  freeHistory: [] as BoardState[],
  freeKomi: Number(localStorage.getItem("kids-go-komi") || "0") || 0,

  // misc UI
  statusMsg: "",
  coachBanner: "",
  coachBusyUntil: 0,
  authTab: "quick" as "quick" | "parent" | "login",
  tipDismissed: localStorage.getItem("kids-go-tip") === "1",

  // friends / chat
  friendsOpen: false,
  friendsTab: "list" as "list" | "add" | "chat" | "share",
  chatFriendshipId: null as string | null,
  chatNick: "",
  chatMsgs: [] as { id: string; fromMe: boolean; body: string; at: number }[],
  chatSince: 0,
  chatPollTimer: null as number | null,
  friendsStatus: "",
  typePractice: localStorage.getItem("kids-go-type") === "1",
  typeTarget: "",
  typeWins: Number(localStorage.getItem("kids-go-type-wins") || "0") || 0,
  postureTip: "",
};

function readFreeMode(): FreeMode {
  const v = localStorage.getItem("kids-go-free-mode");
  return v === "race5" || v === "race10" ? v : "casual";
}

function readAiLevel(): AiLevel {
  const v = Number(localStorage.getItem("kids-go-ai") || "1");
  return v === 0 || v === 2 ? v : 1;
}

export function persist(key: "locale" | "libs" | "free-mode" | "ai" | "tip" | "type" | "type-wins" | "komi"): void {
  switch (key) {
    case "locale":
      localStorage.setItem("kids-go-locale", state.locale);
      break;
    case "libs":
      localStorage.setItem("kids-go-libs", state.showLibs ? "1" : "0");
      break;
    case "free-mode":
      localStorage.setItem("kids-go-free-mode", state.freeMode);
      break;
    case "ai":
      localStorage.setItem("kids-go-ai", String(state.freeAiLevel));
      break;
    case "tip":
      localStorage.setItem("kids-go-tip", state.tipDismissed ? "1" : "0");
      break;
    case "type":
      localStorage.setItem("kids-go-type", state.typePractice ? "1" : "0");
      break;
    case "type-wins":
      localStorage.setItem("kids-go-type-wins", String(state.typeWins));
      break;
    case "komi":
      localStorage.setItem("kids-go-komi", String(state.freeKomi));
      break;
  }
}
