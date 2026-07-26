import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseAiConfig } from "./ai-config";
import type { CoachRequest } from "./coach/contract";
import { getCoachStatus, runCoach } from "./coach/service";
import { readJson } from "./middleware/body";
import { rateOk } from "./middleware/rateLimit";
import analytics from "./routes/analytics";
import auth from "./routes/auth";
import friends from "./routes/friends";
import parent from "./routes/parent";
import progress from "./routes/progress";
import settings from "./routes/settings";
import { loadSession } from "./session";
import type { Env } from "./types";
import { APP_VERSION } from "./version";

const app = new Hono<{ Bindings: Env }>();

/**
 * CORS: explicit allowlist (v0.8.0). The previous config reflected ANY origin
 * with credentials enabled — one cookie-attribute regression away from
 * cross-site account access. Same-origin requests send no Origin header and
 * are unaffected.
 */
const ALLOWED_ORIGINS = new Set([
  "https://go.tdtc.indevs.in",
  "https://go.tdtc.dpdns.org",
  "https://igo.142857.eu.cc",
  "https://kids-go.phrixusjhon.workers.dev",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  "/api/*",
  cors({
    origin: (origin) => (origin && ALLOWED_ORIGINS.has(origin) ? origin : ""),
    credentials: true,
  }),
);

/** Kid-safe error boundary: no stack traces or internals in responses. */
app.onError((err, c) => {
  console.error("api_error", c.req.method, c.req.path, err instanceof Error ? err.stack : err);
  return c.json({ error: "server_error" }, 500);
});

async function loadUserAiConfig(env: Env, cookie: string | undefined) {
  const sess = await loadSession(env, cookie);
  if (!sess) return { sess: null, cfg: null };
  const row = await env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  return { sess, cfg: parseAiConfig(row?.ai_config_json) };
}

/**
 * Static health check (v0.8.0): zero D1 work — the old handler ran DDL +
 * reads per anonymous request, an easy free-tier write-budget drain.
 * Quota details moved behind login on /api/coach/status.
 */
app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    version: APP_VERSION,
    coachProvider: c.env.COACH_PROVIDER ?? "auto",
    coach: {
      freeTierConfigured: Boolean(
        c.env.GROQ_API_KEY || c.env.OPENROUTER_API_KEY || c.env.GOOGLE_API_KEY,
      ),
      workersAiBound: Boolean(c.env.AI),
    },
  });
});

/** Coach status incl. quota counters — requires login (v0.8.0). */
app.get("/api/coach/status", async (c) => {
  const locale = c.req.query("locale") || "zh-Hant";
  const { sess, cfg } = await loadUserAiConfig(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const status = await getCoachStatus(c.env, locale, cfg);
  return c.json(status);
});

app.route("/api/auth", auth);
app.route("/api", progress);
app.route("/api", parent);
app.route("/api/settings", settings);
app.route("/api", analytics);
app.route("/api", friends);

app.post("/api/coach", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  if (!rateOk(`coach:${ip}`, 20)) {
    return c.json({ error: "rate_limited" }, 429);
  }
  // Require login — prevents free-tier AI quota theft
  const { sess, cfg } = await loadUserAiConfig(c.env, c.req.header("Cookie"));
  if (!sess?.child) {
    return c.json({ error: "unauthorized" }, 401);
  }
  if (!rateOk(`coach-user:${sess.user.id}`, 40, 60_000)) {
    return c.json({ error: "rate_limited" }, 429);
  }
  const parsed = await readJson<Partial<CoachRequest>>(c.req, 8_192);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;
  const locale =
    body.locale === "ja" || body.locale === "zh-Hant" || body.locale === "en"
      ? body.locale
      : (sess.child.preferred_locale as "ja" | "zh-Hant" | "en") || "en";
  // Prefer session nickname over client-supplied name (anti-spoof / prompt abuse)
  const childName = (sess.child.nickname || body.childName || "friend").toString().slice(0, 12);
  const req: CoachRequest = {
    tone: body.tone ?? "hint",
    speaker: body.speaker ?? "wukong",
    locale,
    childName,
    lessonId: typeof body.lessonId === "string" ? body.lessonId.slice(0, 8) : undefined,
    skillTag: typeof body.skillTag === "string" ? body.skillTag.slice(0, 24) : undefined,
    boardSummary:
      typeof body.boardSummary === "string" ? body.boardSummary.slice(0, 400) : undefined,
    recentMoves: sanitizeRecentMoves(body.recentMoves),
    storyBeat: typeof body.storyBeat === "string" ? body.storyBeat.slice(0, 200) : undefined,
  };
  const result = await runCoach(req, c.env, cfg);
  return c.json(result);
});

/**
 * recentMoves reaches the LLM prompt: bound both element count AND element
 * size (a single multi-MB string used to pass the old length-only check).
 */
function sanitizeRecentMoves(raw: unknown): CoachRequest["recentMoves"] {
  if (!Array.isArray(raw)) return undefined;
  const out: unknown[] = [];
  for (const item of raw.slice(0, 20)) {
    if (typeof item === "string") out.push(item.slice(0, 24));
    else if (typeof item === "number" || typeof item === "boolean") out.push(item);
    else if (item && typeof item === "object") {
      out.push(JSON.stringify(item).slice(0, 48));
    }
  }
  return out as CoachRequest["recentMoves"];
}

app.get("/api", (c) =>
  c.json({
    name: "kids-go-api",
    version: APP_VERSION,
    docs: "https://github.com/AI-Phrixus/kids-go",
  }),
);

export default app;
