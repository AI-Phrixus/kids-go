import { Hono } from "hono";
import type { CoachRequest } from "./coach/contract";
import { runCoach, type CoachEnv } from "./coach/service";

type Bindings = CoachEnv & {
  DB?: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

const VERSION = "0.0.1";

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    version: VERSION,
    coachProvider: c.env.COACH_PROVIDER ?? "none",
  }),
);

app.post("/api/coach", async (c) => {
  let body: Partial<CoachRequest>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const locale = body.locale === "ja" || body.locale === "zh-Hant" || body.locale === "en"
    ? body.locale
    : "en";
  const req: CoachRequest = {
    tone: body.tone ?? "hint",
    speaker: body.speaker ?? "wukong",
    locale,
    childName: (body.childName ?? "").toString().slice(0, 12) || "friend",
    lessonId: body.lessonId,
    boardSummary: body.boardSummary,
    recentMoves: body.recentMoves,
    storyBeat: body.storyBeat,
  };
  const result = await runCoach(req, c.env);
  return c.json(result);
});

app.get("/", (c) =>
  c.json({
    name: "kids-go-api",
    version: VERSION,
    docs: "https://github.com/AI-Phrixus/kids-go",
  }),
);

export default app;
