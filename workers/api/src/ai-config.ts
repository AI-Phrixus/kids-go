/** Per-user BYOK coach settings stored on users.ai_config_json */

export type AiConfig = {
  /**
   * byokKind: how to call third-party when CF free is exhausted / skipped
   * - auto | openai_compatible | xai | google
   * Chain mode is CF-first by default unless preferByok or forceNone.
   */
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** If true, skip CF Workers AI and go straight to third-party */
  preferByok: boolean;
};

export const EMPTY_AI_CONFIG: AiConfig = {
  provider: "auto",
  baseUrl: "",
  apiKey: "",
  model: "",
  preferByok: false,
};

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Reject local/private destinations before the Worker makes a user-configured request. */
export function isSafeAiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    const isIpv6 = hostname.includes(":");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      (isIpv6 &&
        (hostname === "::1" ||
          hostname.startsWith("fc") ||
          hostname.startsWith("fd") ||
          hostname.startsWith("fe8") ||
          hostname.startsWith("fe9") ||
          hostname.startsWith("fea") ||
          hostname.startsWith("feb"))) ||
      isPrivateIpv4(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
    /** UI copy: privacy-first chain unless the parent explicitly prefers BYOK. */
    chain: cfg.preferByok
      ? "byok → static"
      : "cloudflare_free → configured_free/byok → static",
  };
}

export function mergeAiConfig(
  prev: AiConfig,
  patch: Partial<AiConfig> & { clearApiKey?: boolean },
): AiConfig {
  const nextProvider =
    patch.provider !== undefined ? String(patch.provider).toLowerCase() : prev.provider;
  const nextBaseUrl =
    patch.baseUrl !== undefined ? String(patch.baseUrl).trim().replace(/\/+$/, "") : prev.baseUrl;
  const destinationChanged = nextProvider !== prev.provider || nextBaseUrl !== prev.baseUrl;
  const next: AiConfig = {
    provider: nextProvider,
    baseUrl: nextBaseUrl,
    model: patch.model !== undefined ? String(patch.model).trim() : prev.model,
    preferByok: patch.preferByok !== undefined ? Boolean(patch.preferByok) : prev.preferByok,
    apiKey: destinationChanged ? "" : prev.apiKey,
  };
  if (patch.clearApiKey) next.apiKey = "";
  else if (patch.apiKey !== undefined && String(patch.apiKey).trim() !== "") {
    next.apiKey = String(patch.apiKey).trim();
  }
  const p = next.provider.toLowerCase();
  if (!["auto", "workers_ai", "openai_compatible", "xai", "google", "none"].includes(p)) {
    next.provider = "auto";
  } else {
    next.provider = p;
  }
  return next;
}
