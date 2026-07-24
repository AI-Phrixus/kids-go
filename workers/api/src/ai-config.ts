/** Per-user BYOK coach settings stored on users.ai_config_json */

export type AiConfig = {
  /** auto | workers_ai | openai_compatible | xai | google | none */
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** If true, skip CF Workers AI and go straight to this BYOK */
  preferByok: boolean;
};

export const EMPTY_AI_CONFIG: AiConfig = {
  provider: "auto",
  baseUrl: "",
  apiKey: "",
  model: "",
  preferByok: false,
};

export function parseAiConfig(raw: string | null | undefined): AiConfig {
  if (!raw) return { ...EMPTY_AI_CONFIG };
  try {
    const o = JSON.parse(raw) as Partial<AiConfig>;
    return {
      provider: String(o.provider || "auto"),
      baseUrl: String(o.baseUrl || "").trim(),
      apiKey: String(o.apiKey || "").trim(),
      model: String(o.model || "").trim(),
      preferByok: Boolean(o.preferByok),
    };
  } catch {
    return { ...EMPTY_AI_CONFIG };
  }
}

/** Safe for client: never send full key */
export function publicAiConfig(cfg: AiConfig) {
  const key = cfg.apiKey;
  return {
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    preferByok: cfg.preferByok,
    hasApiKey: key.length > 0,
    apiKeyHint: key.length > 4 ? `••••${key.slice(-4)}` : key ? "••••" : "",
  };
}

export function mergeAiConfig(prev: AiConfig, patch: Partial<AiConfig> & { clearApiKey?: boolean }): AiConfig {
  const next: AiConfig = {
    provider: patch.provider !== undefined ? String(patch.provider) : prev.provider,
    baseUrl: patch.baseUrl !== undefined ? String(patch.baseUrl).trim() : prev.baseUrl,
    model: patch.model !== undefined ? String(patch.model).trim() : prev.model,
    preferByok: patch.preferByok !== undefined ? Boolean(patch.preferByok) : prev.preferByok,
    apiKey: prev.apiKey,
  };
  if (patch.clearApiKey) next.apiKey = "";
  else if (patch.apiKey !== undefined && String(patch.apiKey).trim() !== "") {
    next.apiKey = String(patch.apiKey).trim();
  }
  // normalize provider
  const p = next.provider.toLowerCase();
  if (!["auto", "workers_ai", "openai_compatible", "xai", "google", "none"].includes(p)) {
    next.provider = "auto";
  } else {
    next.provider = p;
  }
  // strip trailing slash on URL
  if (next.baseUrl.endsWith("/")) next.baseUrl = next.baseUrl.replace(/\/+$/, "");
  return next;
}
