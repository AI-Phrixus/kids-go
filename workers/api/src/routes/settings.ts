import { Hono } from "hono";
import { mergeAiConfig, parseAiConfig, publicAiConfig } from "../ai-config";
import { verifyPassword, verifyPin } from "../crypto";
import { readJson } from "../middleware/body";
import { requireSession } from "../middleware/guards";
import { rateOk } from "../middleware/rateLimit";
import type { Env } from "../types";

const settings = new Hono<{ Bindings: Env }>();

/**
 * SSRF guard for BYOK base URLs (v0.8.0): https only, no credentials in the
 * URL, no IP-literal hosts, no localhost/internal-suffix hosts. (DNS-level
 * rebinding is out of scope on Workers Free — this blocks the practical
 * "point my coach at an internal service" cases.)
 */
export function baseUrlProblem(raw: string): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "base_url_invalid";
  }
  if (u.protocol !== "https:") return "base_url_must_https";
  if (u.username || u.password) return "base_url_credentials";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "base_url_private";
  if (/\.(local|internal|lan|home|corp)$/.test(host)) return "base_url_private";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "base_url_ip"; // IPv4 literal
  if (host.includes(":") || host.startsWith("[")) return "base_url_ip"; // IPv6 literal
  return null;
}

/**
 * "Sudo" re-authentication (v0.8.0): changing or testing AI credentials
 * requires re-entering the account password (parent) or PIN (quick), so a
 * child holding a logged-in device cannot rewrite the account's BYOK config.
 */
async function verifyCredential(env: Env, userId: string, credential: string): Promise<boolean> {
  if (!credential) return false;
  const row = await env.DB.prepare(
    `SELECT kind, password_hash, pin_hash FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{ kind: "parent" | "quick"; password_hash: string | null; pin_hash: string | null }>();
  if (!row) return false;
  if (row.kind === "parent" && row.password_hash) {
    return verifyPassword(credential, row.password_hash);
  }
  if (row.kind === "quick" && row.pin_hash) {
    return verifyPin(credential, row.pin_hash);
  }
  return false;
}

settings.get("/ai", async (c) => {
  const sess = await requireSession(c);
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
  return c.json({
    config: publicAiConfig(cfg),
    credentialRequired: true,
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
        "【優先】① 免費額 Key（Groq/OpenRouter/Gemini，見 docs/FREE-AI.md）→ ② Cloudflare 免費 Workers AI → ③ 你填的第三方 → ④ 本地句庫。修改設定需重新輸入家長密碼／PIN。",
      en: "Order: 1) site free-tier keys (Groq/OpenRouter/Gemini) 2) CF free Workers AI 3) your BYOK 4) static. Changing settings requires re-entering your password/PIN.",
      ja: "順序：①サイト無料キー（Groq等）→ ②CF無料 → ③あなたのBYOK → ④定型文。変更にはパスワード／PINの再入力が必要。",
    },
  });
});

settings.put("/ai", async (c) => {
  const sess = await requireSession(c);
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`aiset:${sess.user.id}`, 10)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    preferByok?: boolean;
    clearApiKey?: boolean;
    credential?: string;
  }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.body;

  if (!(await verifyCredential(c.env, sess.user.id, body.credential ?? ""))) {
    return c.json({ error: "credential_required" }, 403);
  }

  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const prev = parseAiConfig(row?.ai_config_json);
  const next = mergeAiConfig(prev, body);

  if (next.baseUrl) {
    const problem = baseUrlProblem(next.baseUrl);
    if (problem) return c.json({ error: problem }, 400);
  }
  if (next.apiKey && next.apiKey.length > 512) {
    return c.json({ error: "api_key_too_long" }, 400);
  }

  await c.env.DB.prepare(`UPDATE users SET ai_config_json = ? WHERE id = ?`)
    .bind(JSON.stringify(next), sess.user.id)
    .run();

  return c.json({ ok: true, config: publicAiConfig(next) });
});

/** Optional test call — only hits the user's own configured BYOK endpoint. */
settings.post("/ai/test", async (c) => {
  const sess = await requireSession(c);
  if (!sess) return c.json({ error: "unauthorized" }, 401);
  if (!rateOk(`aitest:${sess.user.id}`, 5)) return c.json({ error: "rate_limited" }, 429);
  const parsed = await readJson<{ credential?: string }>(c.req);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  if (!(await verifyCredential(c.env, sess.user.id, parsed.body.credential ?? ""))) {
    return c.json({ error: "credential_required" }, 403);
  }
  const row = await c.env.DB.prepare(`SELECT ai_config_json FROM users WHERE id = ?`)
    .bind(sess.user.id)
    .first<{ ai_config_json: string | null }>();
  const cfg = parseAiConfig(row?.ai_config_json);
  if (!cfg.apiKey && !cfg.baseUrl) {
    return c.json({ ok: false, error: "not_configured" }, 400);
  }
  if (cfg.baseUrl) {
    const problem = baseUrlProblem(cfg.baseUrl);
    if (problem) return c.json({ ok: false, error: problem }, 400);
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
  } catch {
    // v0.8.0: do not echo upstream response bodies/errors (info-leak channel)
    return c.json({ ok: false, error: "provider_error" }, 502);
  }
});

export default settings;
