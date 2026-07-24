import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CoachRequest } from "./coach/contract";
import { getCoachStatus, runCoach } from "./coach/service";
import auth from "./routes/auth";
import progress from "./routes/progress";
import type { Env } from "./types";

const VERSION = "0.1.1";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  }),
);

app.get("/api/health", async (c) => {
  const status = await getCoachStatus(c.env, "en");
  return c.json({
    ok: true,
    version: VERSION,
    coachProvider: c.env.COACH_PROVIDER ?? "auto",
    coach: {
      cfSuccessToday: status.cfSuccessToday,
      cfSoftMaxCalls: status.cfSoftMaxCalls,
      byokConfigured: status.byokConfigured,
      workersAiBound: status.workersAiBound,
      reminder: status.reminder,
    },
  });
});

app.get("/api/coach/status", async (c) => {
  const locale = c.req.query("locale") || "zh-Hant";
  const status = await getCoachStatus(c.env, locale);
  return c.json(status);
});

app.route("/api/auth", auth);
app.route("/api", progress);

app.post("/api/coach", async (c) => {
  let body: Partial<CoachRequest>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const locale =
    body.locale === "ja" || body.locale === "zh-Hant" || body.locale === "en"
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

app.get("/api", (c) =>
  c.json({
    name: "kids-go-api",
    version: VERSION,
    docs: "https://github.com/AI-Phrixus/kids-go",
  }),
);

export default app;
