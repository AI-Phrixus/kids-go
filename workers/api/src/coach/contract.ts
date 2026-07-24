export type CoachTone = "hint" | "celebrate" | "comfort" | "parent_summary";
export type Speaker = "wukong" | "tangseng" | "bajie" | "shaseng" | "narrator";
export type Locale = "ja" | "zh-Hant" | "en";

export interface CoachRequest {
  tone: CoachTone;
  speaker?: Speaker;
  locale: Locale;
  childName: string;
  lessonId?: string;
  boardSummary?: string;
  recentMoves?: unknown[];
  storyBeat?: string;
}

export interface CoachResponse {
  say: string;
  tags: string[];
  praiseBehavior?: string;
  parentNote?: string;
  tone: CoachTone;
  speaker: Speaker;
  source: "llm" | "static";
}
