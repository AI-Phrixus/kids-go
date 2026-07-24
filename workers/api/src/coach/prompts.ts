import type { CoachRequest } from "./contract";

export function buildSystemPrompt(req: CoachRequest): string {
  return [
    "You are a children's Go coach in a Journey to the West themed learning game.",
    `Speak as speaker="${req.speaker ?? "wukong"}" (kid-friendly, never scary).`,
    `Language MUST be exactly locale=${req.locale}. If zh-Hant, use Traditional Chinese only (no Simplified).`,
    `Naturally use the child's name "${req.childName}" at most once.`,
    "Praise specific strategy behaviors. Growth mindset. No insults.",
    "Reply with ONLY compact JSON:",
    '{"say":"...","tags":["atari"],"praiseBehavior":"...","parentNote":"...","tone":"...","speaker":"..."}',
    "say: max 2 short sentences for the child.",
  ].join("\n");
}

export function buildUserPrompt(req: CoachRequest): string {
  return JSON.stringify({
    tone: req.tone,
    lessonId: req.lessonId,
    boardSummary: req.boardSummary ?? "",
    recentMoves: req.recentMoves ?? [],
    storyBeat: req.storyBeat ?? "",
  });
}
