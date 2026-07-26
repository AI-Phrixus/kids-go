import { api } from "./api";
import { t } from "./i18n";
import { displayName } from "./shell";
import { state } from "./state";

/** Shared "ask Wukong" helper — returns the line to show in the bubble. */
export async function askCoach(boardSummary?: string, skillTag?: string): Promise<string> {
  const now = Date.now();
  if (now < state.coachBusyUntil) return t(state.locale, "coach_wait");
  state.coachBusyUntil = now + 2500;
  try {
    void api.track("coach_hint", { lessonId: state.lessonId });
    const c = await api.coach({
      tone: "hint",
      speaker: "wukong",
      locale: state.locale,
      childName: displayName(),
      lessonId: state.lessonId,
      skillTag,
      boardSummary,
    });
    return c.reminder ? `${c.say}\n—— ${c.reminder}` : c.say;
  } catch {
    return t(state.locale, "try_again_quiz");
  }
}

export function skillTagOf(lesson: { skillTag?: Record<string, string> | string } | null): string | undefined {
  if (!lesson?.skillTag) return undefined;
  if (typeof lesson.skillTag === "string") return lesson.skillTag;
  return lesson.skillTag.en || Object.values(lesson.skillTag)[0];
}
