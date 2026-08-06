import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { APP_VERSION } from "../../../packages/app-version";
import { parseAiConfig } from "./ai-config";
import { consumeDailyQuota } from "./daily-quota";
import type { CoachRequest } from "./coach/contract";
import { getCoachStatus, runCoach } from "./coach/service";
import analytics from "./routes/analytics";
import auth from "./routes/auth";
import friends from "./routes/friends";
import parent from "./routes/parent";
import progress from "./routes/progress";
import settings from "./routes/settings";
import { loadSession } from "./session";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();
const MAX_API_BODY_BYTES = 32_000;

/** Best-effort per-isolate rate limit (Free Workers). */
const coachHits = new Map<string, { n: number; t: number }>();
function coachRateOk(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = coachHits.get(key);
  if (!row || now - row.t > windowMs) {
    coachHits.set(key, { n: 1, t: now });
    return true;
  }
  if (row.n >= max) return false;
  row.n += 1;
  return true;
}

app.use(
  "/api/*",
  bodyLimit({
    maxSize: MAX_API_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  }),
);

app.use("/api/*", async (c, next) => {
  const contentLength = Number(c.req.header("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return c.json({ error: "payload_too_large" }, 413);
  }

  // The web app and API share an origin. Reject cross-origin mutations so a
  // compromised sibling site cannot act through a child's session cookie.
  if (!["GET", "HEAD"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ error: "forbidden_origin" }, 403);
    }
  }

  await next();
});

async function loadUserAiConfig(env: Env, cookie: string | undefined) {
  const sess = await loadSession(env, cookie);
  if (!sess) return { sess: null, cfg: null };
  if (sess.user.kind !== "parent") return { sess, cfg: null };
  const row = await env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  return { sess, cfg: parseAiConfig(row?.ai_config_json) };
}

app.get("/api/health", async (c) => {
  try {
    const status = await getCoachStatus(c.env, "en");
    return c.json({
      ok: true,
      version: APP_VERSION,
      coachProvider: c.env.COACH_PROVIDER ?? "auto",
      coach: {
        cfSuccessToday: status.cfSuccessToday,
        cfSoftMaxCalls: status.cfSoftMaxCalls,
        byokConfigured: status.byokConfigured,
        freeTierConfigured: status.freeTierConfigured,
        freeTierProviders: status.freeTierProviders,
        freePriority: status.freePriority,
        freeFirst: status.freeFirst,
        workersAiBound: status.workersAiBound,
        reminder: status.reminder,
        chain: status.chain,
      },
    });
  } catch (e) {
    return c.json({
      ok: true,
      version: APP_VERSION,
      coachProvider: c.env.COACH_PROVIDER ?? "auto",
      coachError: String(e instanceof Error ? e.message : e).slice(0, 200),
    });
  }
});

app.get("/api/coach/status", async (c) => {
  const locale = c.req.query("locale") || "zh-Hant";
  const { cfg } = await loadUserAiConfig(c.env, c.req.header("Cookie"));
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
  if (!coachRateOk(`coach:${ip}`, 20)) {
    return c.json({ error: "rate_limited" }, 429);
  }
  // Require login — prevents free-tier AI quota theft
  const { sess, cfg } = await loadUserAiConfig(c.env, c.req.header("Cookie"));
  if (!sess?.child) {
    return c.json({ error: "unauthorized" }, 401);
  }
  if (!coachRateOk(`coach-user:${sess.user.id}`, 40, 60_000)) {
    return c.json({ error: "rate_limited" }, 429);
  }
  let body: Partial<CoachRequest>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!(await consumeDailyQuota(c.env.DB, `coach:${sess.user.id}`, 100))) {
    return c.json({ error: "daily_limit" }, 429);
  }
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
    boardSummary:
      typeof body.boardSummary === "string" ? body.boardSummary.slice(0, 400) : undefined,
    recentMoves: Array.isArray(body.recentMoves) ? body.recentMoves.slice(0, 20) : undefined,
    storyBeat: typeof body.storyBeat === "string" ? body.storyBeat.slice(0, 200) : undefined,
  };
  const result = await runCoach(req, c.env, cfg);
  return c.json(result);
});

app.get("/api", (c) =>
  c.json({
    name: "kids-go-api",
    version: APP_VERSION,
    docs: "https://github.com/AI-Phrixus/kids-go",
  }),
);

export default app;
