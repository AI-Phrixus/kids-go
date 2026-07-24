import { Hono } from "hono";
import { mergeAiConfig, parseAiConfig, publicAiConfig } from "../ai-config";
import { loadSession } from "../session";
import type { Env } from "../types";

const settings = new Hono<{ Bindings: Env }>();

settings.get("/ai", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
  return c.json({
    config: publicAiConfig(cfg),
    presets: [
      {
        id: "xai",
        label: "xAI Grok（備援；仍先 CF 免費）",
        baseUrl: "https://api.x.ai/v1",
        model: "grok-4.5",
        provider: "openai_compatible",
      },
      {
        id: "groq",
        label: "Groq（備援；仍先 CF 免費）",
        baseUrl: "https://api.groq.com/openai/v1",
        model: "llama-3.1-8b-instant",
        provider: "openai_compatible",
      },
      {
        id: "openai",
        label: "OpenAI（備援；仍先 CF 免費）",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        provider: "openai_compatible",
      },
      {
        id: "google",
        label: "Google Gemini（備援；仍先 CF 免費）",
        baseUrl: "",
        model: "gemini-2.0-flash",
        provider: "google",
      },
      {
        id: "custom",
        label: "自訂 OpenAI 相容 URL（備援）",
        baseUrl: "",
        model: "",
        provider: "openai_compatible",
      },
    ],
    hints: {
      zhHant:
        "【優先順序固定】① Cloudflare 免費 AI → ② 下方第三方 URL/Key → ③ 本地句庫。填寫第三方不會跳過 CF，除非勾選「略過 CF」。軟上限防止超額。",
      en: "Order is fixed: 1) CF free AI 2) third-party URL/key 3) static. Filling BYOK does NOT skip CF unless you check prefer BYOK. Soft cap prevents overage.",
      ja: "順序固定：①CF無料 → ②第三者 → ③定型文。第三者を記入しても CF を飛ばしません（優先BYOKにチェックした場合を除く）。",
    },
  });
});

settings.put("/ai", async (c) => {
  const sess = await loadSession(c.env, c.req.header("Cookie"));
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    preferByok?: boolean;
    clearApiKey?: boolean;
  }>();

  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const prev = parseAiConfig(row?.ai_config_json);
  const next = mergeAiConfig(prev, body);

  // validation
  if (next.provider === "openai_compatible" || (next.provider === "auto" && next.baseUrl)) {
    if (next.baseUrl && !/^https:\/\//i.test(next.baseUrl)) {
      return c.json({ error: "base_url_must_https" }, 400);
    }
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
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
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
    let text = "";
    if (cfg.provider === "google") {
      if (!cfg.apiKey) return c.json({ ok: false, error: "missing_api_key" }, 400);
      text = await createGoogleProvider({
        apiKey: cfg.apiKey,
        model: cfg.model || "gemini-2.0-flash",
      }).complete(msgs, { maxTokens: 16, temperature: 0 });
    } else if (cfg.provider === "xai" || cfg.baseUrl.includes("x.ai")) {
      if (!cfg.apiKey) return c.json({ ok: false, error: "missing_api_key" }, 400);
      text = await createXaiProvider(cfg.apiKey, cfg.model || "grok-4.5").complete(msgs, {
        maxTokens: 16,
        temperature: 0,
      });
    } else if (cfg.baseUrl && cfg.apiKey) {
      text = await createOpenAICompatibleProvider({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model || "gpt-4o-mini",
      }).complete(msgs, { maxTokens: 16, temperature: 0 });
    } else {
      return c.json({ ok: false, error: "incomplete_config" }, 400);
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
