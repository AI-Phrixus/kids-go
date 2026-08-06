import { Hono } from "hono";
import { isSafeAiBaseUrl, mergeAiConfig, parseAiConfig, publicAiConfig } from "../ai-config";
import { consumeDailyQuota } from "../daily-quota";
import { verifyParentAccess } from "../parent-auth";
import { loadSession } from "../session";
import type { Env } from "../types";

const settings = new Hono<{ Bindings: Env }>();

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

settings.get("/ai", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  if (sess.user.kind !== "parent") return c.json({ error: "parent_required" }, 403);
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
  return c.json({
    config: publicAiConfig(cfg),
    presets: [
      {
        id: "groq",
        label: "Groq Llama 3.3 70B（推薦免費 · 高速開源）",
        baseUrl: "https://api.groq.com/openai/v1",
        model: "llama-3.3-70b-versatile",
        provider: "openai_compatible",
      },
      {
        id: "openrouter",
        label: "OpenRouter 免費模型（多模型開源）",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "openrouter/free",
        provider: "openai_compatible",
      },
      {
        id: "google",
        label: "Google Gemini 免費額（Flash）",
        baseUrl: "",
        model: "gemini-2.0-flash",
        provider: "google",
      },
      {
        id: "xai",
        label: "xAI Grok",
        baseUrl: "https://api.x.ai/v1",
        model: "grok-4.5",
        provider: "openai_compatible",
      },
      {
        id: "openai",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        provider: "openai_compatible",
      },
      {
        id: "custom",
        label: "自訂 OpenAI 相容 URL",
        baseUrl: "",
        model: "",
        provider: "openai_compatible",
      },
    ],
    hints: {
      zhHant:
        "【優先】① Cloudflare 免費 Workers AI → ② 站點設定的免費額 Key（Groq/OpenRouter/Gemini，見 docs/FREE-AI.md）→ ③ 你填的第三方 → ④ 本地句庫。勾選「略過 CF」才會先打第三方。兒童教練短句即可；70B 級免費額明顯比 CF 小模型更聰明。",
      en: "Order: 1) CF free Workers AI 2) site free-tier keys (Groq/OpenRouter/Gemini) 3) your BYOK 4) static. Check prefer BYOK to skip CF first.",
      ja: "順序：①CF無料 → ②サイト無料キー（Groq等）→ ③あなたのBYOK → ④定型文。",
    },
  });
});

settings.put("/ai", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  if (sess.user.kind !== "parent") return c.json({ error: "parent_required" }, 403);
  let body: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    preferByok?: boolean;
    clearApiKey?: boolean;
    parentPassword?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!isRecord(body)) return c.json({ error: "invalid_json" }, 400);
  if (!(await verifyParentAccess(c.env, sess, body.parentPassword))) {
    return c.json({ error: "parent_verification_required" }, 403);
  }

  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const prev = parseAiConfig(row?.ai_config_json);
  const next = mergeAiConfig(prev, body);

  if (next.provider === "workers_ai" || next.provider === "none") {
    next.baseUrl = "";
    next.apiKey = "";
    next.model = "";
    next.preferByok = false;
  } else if (next.provider === "google") {
    next.baseUrl = "";
  } else if (next.provider === "xai") {
    next.baseUrl = "https://api.x.ai/v1";
  }

  // validation
  if (next.baseUrl) {
    if (!/^https:\/\//i.test(next.baseUrl)) {
      return c.json({ error: "base_url_must_https" }, 400);
    }
    if (!isSafeAiBaseUrl(next.baseUrl)) {
      return c.json({ error: "unsafe_base_url" }, 400);
    }
  }
  if (next.baseUrl.length > 300 || next.model.length > 120) {
    return c.json({ error: "invalid_input" }, 400);
  }
  if (next.apiKey && next.apiKey.length > 512) {
    return c.json({ error: "api_key_too_long" }, 400);
  }

  await c.env.DB.prepare(`UPDATE users SET ai_config_json = ? WHERE id = ?`)
    .bind(JSON.stringify(next), sess.user.id)
    .run();

  return c.json({ ok: true, config: publicAiConfig(next) });
});

/** Optional test call — does not charge CF AI; only hits BYOK if configured */
settings.post("/ai/test", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  if (sess.user.kind !== "parent") return c.json({ error: "parent_required" }, 403);
  let body: { parentPassword?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!isRecord(body)) return c.json({ error: "invalid_json" }, 400);
  if (!(await verifyParentAccess(c.env, sess, body.parentPassword))) {
    return c.json({ error: "parent_verification_required" }, 403);
  }
  if (!(await consumeDailyQuota(c.env.DB, `ai-test:${sess.user.id}`, 20))) {
    return c.json({ error: "daily_limit" }, 429);
  }
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
  if (cfg.baseUrl && !isSafeAiBaseUrl(cfg.baseUrl)) {
    return c.json({ ok: false, error: "unsafe_base_url" }, 400);
  }
  if (!cfg.apiKey && !cfg.baseUrl) {
    return c.json({ ok: false, error: "not_configured" }, 400);
  }
  try {
    const { createOpenAICompatibleProvider } = await import("../coach/providers/openaiCompatible");
    const { createGoogleProvider } = await import("../coach/providers/google");
    const { createXaiProvider } = await import("../coach/providers/xai");
    const msgs = [
      { role: "system" as const, content: "Reply with one word: ok" },
      { role: "user" as const, content: "ping" },
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    let text = "";
    try {
      if (cfg.provider === "google") {
        if (!cfg.apiKey) return c.json({ ok: false, error: "missing_api_key" }, 400);
        text = await createGoogleProvider({
          apiKey: cfg.apiKey,
          model: cfg.model || "gemini-2.0-flash",
        }).complete(msgs, { maxTokens: 16, temperature: 0, signal: controller.signal });
      } else if (cfg.provider === "xai" || cfg.baseUrl.includes("x.ai")) {
        if (!cfg.apiKey) return c.json({ ok: false, error: "missing_api_key" }, 400);
        text = await createXaiProvider(cfg.apiKey, cfg.model || "grok-4.5").complete(msgs, {
          maxTokens: 16,
          temperature: 0,
          signal: controller.signal,
        });
      } else if (cfg.baseUrl && cfg.apiKey) {
        text = await createOpenAICompatibleProvider({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          model: cfg.model || "gpt-4o-mini",
        }).complete(msgs, { maxTokens: 16, temperature: 0, signal: controller.signal });
      } else {
        return c.json({ ok: false, error: "incomplete_config" }, 400);
      }
    } finally {
      clearTimeout(timer);
    }
    return c.json({ ok: true, sample: String(text).slice(0, 80) });
  } catch (e) {
    return c.json(
      { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) },
      502,
    );
  }
});

export default settings;
