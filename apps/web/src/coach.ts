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

/**
 * The static phrase bank groups hints by a short tag (capture/atari/ladder/…).
 * The badgeId is the closest machine-friendly signal, so map it to a bank key.
 */
export function skillTagOf(lesson: { badgeId?: string } | null): string | undefined {
  if (!lesson?.badgeId) return undefined;
  const b = lesson.badgeId;
  const map: Record<string, string> = {
    first_capture: "capture",
    first_steps: "corner",
    breath: "atari",
    escape: "atari",
    atari_eye: "atari",
    connect: "connect",
    double: "capture",
    cut: "connect",
    eyes: "life",
    two_eyes: "life",
    corner: "corner",
    side_camp: "corner",
    gate: "capture",
    net_capture: "ladder",
    clamp: "capture",
    ladder: "ladder",
    ladder2: "ladder",
    ladder_reader: "ladder",
    ko_intro: "ko",
    ko_fighter: "ko",
    eye_breaker: "kill",
    liberty_race: "semeai",
    liberty_counter: "semeai",
    graduation: "territory",
    graduate_master: "territory",
  };
  return map[b] ?? undefined;
}
