import type { AiConfig } from "../ai-config";
import { EMPTY_AI_CONFIG } from "../ai-config";
import type { CoachRequest, CoachResponse } from "./contract";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { createGoogleProvider } from "./providers/google";
import { createOpenAICompatibleProvider } from "./providers/openaiCompatible";
import type { CoachProvider } from "./providers/types";
import {
  createWorkersAiProvider,
  isWorkersAiQuotaError,
  type WorkersAiBinding,
} from "./providers/workersAi";
import { createXaiProvider } from "./providers/xai";
import {
  bumpQuota,
  getQuota,
  quotaStatusMessage,
  setAlert,
  shouldSkipWorkersAi,
  softMaxCalls,
  utcDay,
} from "./quota";
import { staticCoach } from "./staticPhrases";

export interface CoachEnv {
  DB?: D1Database;
  AI?: WorkersAiBinding;
  COACH_PROVIDER?: string;
  COACH_TIMEOUT_MS?: string;
  COACH_MAX_TOKENS?: string;
  COACH_TEMPERATURE?: string;
  COACH_CF_SOFT_MAX_CALLS?: string;
  COACH_CF_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
}

/**
 * Merge env + user settings for BYOK credentials.
 * Chain policy (product requirement):
 *   1) Cloudflare Workers AI free  FIRST
 *   2) Third-party BYOK
 *   3) Static phrases
 * Only preferByok=true or provider=none|workers_ai changes this.
 */
export function buildEffectiveEnv(env: CoachEnv, userCfg?: AiConfig | null): {
  env: CoachEnv;
  preferByok: boolean;
  forceNone: boolean;
  forceWorkersOnly: boolean;
} {
  const u = userCfg ?? EMPTY_AI_CONFIG;
  const preferByok = Boolean(u.preferByok && (u.apiKey || u.baseUrl || env.AI_API_KEY || env.XAI_API_KEY || env.GOOGLE_API_KEY));
  const forceNone = u.provider === "none" || (env.COACH_PROVIDER || "").toLowerCase() === "none";
  const forceWorkersOnly =
    !preferByok && (u.provider === "workers_ai" || (env.COACH_PROVIDER || "").toLowerCase() === "workers_ai");

  const merged: CoachEnv = {
    ...env,
    // Keep chain mode as auto unless forced
    COACH_PROVIDER: forceNone ? "none" : forceWorkersOnly ? "workers_ai" : "auto",
    AI_BASE_URL: u.baseUrl || env.AI_BASE_URL,
    AI_API_KEY: u.apiKey || env.AI_API_KEY,
    AI_MODEL: u.model || env.AI_MODEL,
    XAI_API_KEY:
      u.provider === "xai" && u.apiKey
        ? u.apiKey
        : env.XAI_API_KEY || (u.baseUrl?.includes("x.ai") ? u.apiKey || undefined : undefined),
    GOOGLE_API_KEY: u.provider === "google" && u.apiKey ? u.apiKey : env.GOOGLE_API_KEY,
    GOOGLE_MODEL: u.provider === "google" && u.model ? u.model : env.GOOGLE_MODEL,
  };

  // Remember user's BYOK kind on the side via model/url (resolveByok inspects urls/keys)
  return { env: merged, preferByok, forceNone, forceWorkersOnly };
}

/** Build third-party provider from credentials (used AFTER CF free, or if preferByok). */
function resolveByok(env: CoachEnv, userCfg?: AiConfig | null): CoachProvider | null {
  const u = userCfg ?? EMPTY_AI_CONFIG;
  const kind = (u.provider || "auto").toLowerCase();

  // Google
  if (kind === "google" || env.GOOGLE_API_KEY) {
    const key = kind === "google" ? env.GOOGLE_API_KEY || env.AI_API_KEY : env.GOOGLE_API_KEY;
    if (key && (kind === "google" || !env.AI_BASE_URL)) {
      if (kind === "google" || (!env.AI_BASE_URL && env.GOOGLE_API_KEY)) {
        return createGoogleProvider({
          apiKey: key,
          model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
        });
      }
    }
  }

  // xAI shortcut
  if (
    kind === "xai" ||
    env.XAI_API_KEY ||
    (env.AI_BASE_URL && env.AI_BASE_URL.includes("x.ai") && env.AI_API_KEY)
  ) {
    const key = env.XAI_API_KEY || env.AI_API_KEY;
    if (key) return createXaiProvider(key, env.AI_MODEL || "grok-4.5");
  }

  // OpenAI-compatible (includes most presets)
  if (env.AI_BASE_URL && env.AI_API_KEY) {
    return createOpenAICompatibleProvider({
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL || "gpt-4o-mini",
    });
  }

  if (kind === "google" && env.GOOGLE_API_KEY) {
    return createGoogleProvider({
      apiKey: env.GOOGLE_API_KEY,
      model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
    });
  }

  return null;
}

function parseJsonResponse(
  text: string,
  fallback: CoachResponse,
  source: CoachResponse["source"],
): CoachResponse {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return { ...fallback, say: text.slice(0, 120), source };
    const obj = JSON.parse(text.slice(start, end + 1)) as Partial<CoachResponse>;
    return {
      say: String(obj.say ?? fallback.say),
      tags: Array.isArray(obj.tags) ? obj.tags.map(String) : fallback.tags,
      praiseBehavior: obj.praiseBehavior ? String(obj.praiseBehavior) : undefined,
      parentNote: obj.parentNote ? String(obj.parentNote) : fallback.parentNote,
      tone: fallback.tone,
      speaker: (obj.speaker as CoachResponse["speaker"]) ?? fallback.speaker,
      source,
    };
  } catch {
    return { ...fallback, say: text.slice(0, 120), source };
  }
}

async function completeWithTimeout(
  provider: CoachProvider,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  return Promise.race([
    provider.complete(messages, { maxTokens, temperature }),
    new Promise<string>((_, rej) =>
      setTimeout(() => rej(new Error("coach timeout")), timeoutMs),
    ),
  ]);
}

export type CoachStatus = {
  dayUtc: string;
  mode: string;
  chain: string;
  cfSoftMaxCalls: number;
  cfSuccessToday: number;
  cfQuotaHitsToday: number;
  byokConfigured: boolean;
  workersAiBound: boolean;
  preferByok: boolean;
  alert: string | null;
  reminder: string;
  billingNote: string;
};

export async function getCoachStatus(
  env: CoachEnv,
  locale = "zh-Hant",
  userCfg?: AiConfig | null,
): Promise<CoachStatus> {
  const { env: effective, preferByok, forceNone, forceWorkersOnly } = buildEffectiveEnv(
    env,
    userCfg,
  );
  const day = utcDay();
  const maxCalls = softMaxCalls(effective);
  let q = {
    day,
    cf_success: 0,
    cf_fail_quota: 0,
    byok_success: 0,
    static_fallback: 0,
    cf_blocked_soft: 0,
    last_alert: null as string | null,
  };
  if (env.DB) {
    try {
      q = await getQuota(env.DB, day);
    } catch {
      /* ignore */
    }
  }
  const byok = resolveByok(effective, userCfg);
  const chain = forceNone
    ? "static"
    : preferByok
      ? "byok → static"
      : forceWorkersOnly
        ? "cloudflare_free → static"
        : "cloudflare_free → byok → static";

  return {
    dayUtc: day,
    mode: effective.COACH_PROVIDER || "auto",
    chain,
    cfSoftMaxCalls: maxCalls,
    cfSuccessToday: q.cf_success,
    cfQuotaHitsToday: q.cf_fail_quota,
    byokConfigured: !!byok,
    workersAiBound: !!env.AI,
    preferByok,
    alert: q.last_alert,
    reminder: quotaStatusMessage(q, maxCalls, locale),
    billingNote:
      "CF-first free AI. Soft cap switches to BYOK before free Neurons hard wall. Stay on Workers Free to avoid paid overage.",
  };
}

/**
 * Product chain (mandatory default):
 * 1) Cloudflare Workers AI free
 * 2) Third-party BYOK (user settings URL/key)
 * 3) Static i18n phrases
 *
 * Anti-overage: soft max calls/day + treat CF quota errors as hard block for the UTC day.
 * Account must stay on Workers Free for platform hard-stop (no CF AI overage bill).
 */
export async function runCoach(
  req: CoachRequest,
  env: CoachEnv,
  userCfg?: AiConfig | null,
): Promise<CoachResponse & { reminder?: string; chain?: string }> {
  const { env: effective, preferByok, forceNone, forceWorkersOnly } = buildEffectiveEnv(
    env,
    userCfg,
  );
  const fallback = staticCoach(req);
  const timeoutMs = Number(effective.COACH_TIMEOUT_MS ?? 2500);
  const maxTokens = Number(effective.COACH_MAX_TOKENS ?? 120);
  const temperature = Number(effective.COACH_TEMPERATURE ?? 0.5);
  const day = utcDay();
  const maxCalls = softMaxCalls(effective);

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(req) },
    { role: "user" as const, content: buildUserPrompt(req) },
  ];

  const chainLabel = forceNone
    ? "static"
    : preferByok
      ? "byok→static"
      : forceWorkersOnly
        ? "cf→static"
        : "cf→byok→static";

  if (forceNone) {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return { ...fallback, reminder: "static only", chain: chainLabel };
  }

  let quota = env.DB ? await getQuota(env.DB, day).catch(() => null) : null;

  // --- 1) Cloudflare free AI FIRST (unless preferByok) ---
  const tryCf =
    !preferByok &&
    !!env.AI &&
    (!quota || !shouldSkipWorkersAi(quota, maxCalls));

  if (tryCf && env.AI) {
    const model = effective.COACH_CF_MODEL || "@cf/meta/llama-3.1-8b-instruct";
    const provider = createWorkersAiProvider(env.AI, model);
    try {
      const text = await completeWithTimeout(provider, messages, maxTokens, temperature, timeoutMs);
      if (env.DB) await bumpQuota(env.DB, day, "cf_success");
      const parsed = parseJsonResponse(text, fallback, "workers_ai");
      const rem =
        env.DB && quota
          ? quotaStatusMessage({ ...quota, cf_success: quota.cf_success + 1 }, maxCalls, req.locale)
          : undefined;
      if (rem && quota && quota.cf_success + 1 >= maxCalls - 5 && env.DB) {
        await setAlert(env.DB, day, rem);
      }
      return { ...parsed, reminder: rem, chain: chainLabel };
    } catch (e) {
      if (isWorkersAiQuotaError(e) && env.DB) {
        await bumpQuota(env.DB, day, "cf_fail_quota");
        await setAlert(
          env.DB,
          day,
          quotaStatusMessage(
            {
              day,
              cf_success: quota?.cf_success ?? 0,
              cf_fail_quota: 1,
              byok_success: 0,
              static_fallback: 0,
              cf_blocked_soft: 0,
              last_alert: null,
            },
            maxCalls,
            req.locale,
          ),
        );
      }
      // fall through to BYOK
    }
  } else if (!preferByok && quota && shouldSkipWorkersAi(quota, maxCalls) && env.DB) {
    await bumpQuota(env.DB, day, "cf_blocked_soft");
  }

  if (forceWorkersOnly) {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return {
      ...fallback,
      reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "cf only → static",
      chain: chainLabel,
    };
  }

  // --- 2) Third-party BYOK ---
  const byok = resolveByok(effective, userCfg);
  if (byok) {
    try {
      const text = await completeWithTimeout(byok, messages, maxTokens, temperature, timeoutMs);
      if (env.DB) await bumpQuota(env.DB, day, "byok_success");
      const parsed = parseJsonResponse(text, fallback, "byok");
      const rem = env.DB
        ? await getQuota(env.DB, day)
            .then((q) => quotaStatusMessage(q, maxCalls, req.locale))
            .catch(() => undefined)
        : undefined;
      return { ...parsed, reminder: rem, chain: chainLabel };
    } catch {
      /* static */
    }
  }

  // --- 3) Static ---
  if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
  return {
    ...fallback,
    reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "static fallback",
    chain: chainLabel,
  };
}
