import type { AiConfig } from "../ai-config";
import { EMPTY_AI_CONFIG } from "../ai-config";
import type { CoachRequest, CoachResponse } from "./contract";
import {
  buildFreeFirstSlots,
  freePriorityLabel,
  type FreeSlot,
} from "./freeRotation";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import {
  createWorkersAiProvider,
  isWorkersAiQuotaError,
  type WorkersAiBinding,
} from "./providers/workersAi";
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
  /** Prefer free high-perf first (default). Set "cf_first" to restore CF→free order. */
  COACH_CHAIN_MODE?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

/**
 * Merge env + user BYOK credentials.
 * Default free-first: Groq → OpenRouter free → Gemini free → CF soft → user BYOK → static
 */
export function buildEffectiveEnv(env: CoachEnv, userCfg?: AiConfig | null): {
  env: CoachEnv;
  preferByok: boolean;
  forceNone: boolean;
  forceWorkersOnly: boolean;
  freeFirst: boolean;
} {
  const u = userCfg ?? EMPTY_AI_CONFIG;
  const hasUserByok = Boolean(u.apiKey || u.baseUrl);
  const preferByok = Boolean(u.preferByok && hasUserByok);
  const forceNone =
    u.provider === "none" || (env.COACH_PROVIDER || "").toLowerCase() === "none";
  const forceWorkersOnly =
    !preferByok &&
    (u.provider === "workers_ai" || (env.COACH_PROVIDER || "").toLowerCase() === "workers_ai");
  const freeFirst = (env.COACH_CHAIN_MODE || "free_first").toLowerCase() !== "cf_first";

  const merged: CoachEnv = {
    ...env,
    COACH_PROVIDER: forceNone ? "none" : forceWorkersOnly ? "workers_ai" : "auto",
    AI_BASE_URL: u.baseUrl || env.AI_BASE_URL,
    AI_API_KEY: u.apiKey || env.AI_API_KEY,
    AI_MODEL: u.model || env.AI_MODEL,
    XAI_API_KEY:
      u.provider === "xai" && u.apiKey
        ? u.apiKey
        : env.XAI_API_KEY || (u.baseUrl?.includes("x.ai") ? u.apiKey || undefined : undefined),
    GOOGLE_API_KEY:
      u.provider === "google" && u.apiKey ? u.apiKey : env.GOOGLE_API_KEY || undefined,
    GOOGLE_MODEL: (u.provider === "google" && u.model ? u.model : undefined) || env.GOOGLE_MODEL,
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_MODEL: env.GROQ_MODEL,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: env.OPENROUTER_MODEL,
  };

  return { env: merged, preferByok, forceNone, forceWorkersOnly, freeFirst };
}

function parseJsonResponse(
  text: string,
  fallback: CoachResponse,
  source: CoachResponse["source"],
): CoachResponse {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return { ...fallback, say: text.slice(0, 160), source };
    const obj = JSON.parse(text.slice(start, end + 1)) as Partial<CoachResponse>;
    return {
      say: String(obj.say ?? fallback.say).slice(0, 500),
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 8) : fallback.tags,
      praiseBehavior: obj.praiseBehavior ? String(obj.praiseBehavior).slice(0, 200) : undefined,
      parentNote: obj.parentNote ? String(obj.parentNote).slice(0, 300) : fallback.parentNote,
      tone: fallback.tone,
      speaker: (obj.speaker as CoachResponse["speaker"]) ?? fallback.speaker,
      source,
    };
  } catch {
    return { ...fallback, say: text.slice(0, 160), source };
  }
}

async function completeWithTimeout(
  provider: { complete: CoachProvider["complete"] },
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
  freePriority: string;
  cfSoftMaxCalls: number;
  cfSuccessToday: number;
  cfQuotaHitsToday: number;
  byokConfigured: boolean;
  freeTierConfigured: boolean;
  freeTierProviders: string[];
  workersAiBound: boolean;
  preferByok: boolean;
  freeFirst: boolean;
  alert: string | null;
  reminder: string;
  billingNote: string;
};

export async function getCoachStatus(
  env: CoachEnv,
  locale = "zh-Hant",
  userCfg?: AiConfig | null,
): Promise<CoachStatus> {
  const { env: effective, preferByok, forceNone, forceWorkersOnly, freeFirst } = buildEffectiveEnv(
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
  const slots = buildFreeFirstSlots(effective, userCfg, preferByok);
  const freeTier: string[] = [];
  if (env.GROQ_API_KEY) freeTier.push("groq");
  if (env.OPENROUTER_API_KEY) freeTier.push("openrouter");
  if (env.GOOGLE_API_KEY) freeTier.push("google");

  const chain = forceNone
    ? "static"
    : forceWorkersOnly
      ? "cloudflare_free → static"
      : freeFirst
        ? "free_high: groq → openrouter_free → gemini_free → cf_soft → byok → static"
        : "cf_soft → free_high → byok → static";

  return {
    dayUtc: day,
    mode: effective.COACH_PROVIDER || "auto",
    chain,
    freePriority: freePriorityLabel(slots) || freeTiers.join(" → ") || "none",
    cfSoftMaxCalls: maxCalls,
    cfSuccessToday: q.cf_success,
    cfQuotaHitsToday: q.cf_fail_quota,
    byokConfigured: slots.some((s) => s.tier === "byok"),
    freeTierConfigured: freeTiers.length > 0,
    freeTierProviders: freeTiers,
    workersAiBound: !!env.AI,
    preferByok,
    freeFirst,
    alert: q.last_alert,
    reminder: quotaStatusMessage(q, maxCalls, locale),
    billingNote:
      "Default free-first: Groq 70B → OpenRouter free → Gemini free → CF soft-capped → user BYOK → static. Never auto-picks paid OpenRouter models on site secrets.",
  };
}

async function trySlot(
  slot: FreeSlot,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  fallback: CoachResponse,
): Promise<(CoachResponse & { via: string }) | null> {
  const provider = slot.build();
  if (!provider) return null;
  try {
    const text = await completeWithTimeout(provider, messages, maxTokens, temperature, timeoutMs);
    const source = slot.tier === "free" || slot.tier === "byok" ? "byok" : "workers_ai";
    const parsed = parseJsonResponse(text, fallback, source as CoachResponse["source"]);
    return { ...parsed, via: slot.id };
  } catch {
    return null;
  }
}

async function tryCloudflare(
  env: CoachEnv,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  fallback: CoachResponse,
  day: string,
  maxCalls: number,
  quota: Awaited<ReturnType<typeof getQuota>> | null,
): Promise<(CoachResponse & { via: string }) | null> {
  if (!env.AI) return null;
  if (quota && shouldSkipWorkersAi(quota, maxCalls)) {
    if (env.DB) await bumpQuota(env.DB, day, "cf_blocked_soft").catch(() => undefined);
    return null;
  }
  const models = [
    env.COACH_CF_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast",
    "@cf/meta/llama-3.2-3b-instruct",
  ];
  for (const model of models) {
    try {
      const provider = createWorkersAiProvider(env.AI, model);
      const text = await completeWithTimeout(provider, messages, maxTokens, temperature, timeoutMs);
      if (env.DB) await bumpQuota(env.DB, day, "cf_success").catch(() => undefined);
      const parsed = parseJsonResponse(text, fallback, "workers_ai");
      return { ...parsed, via: `cf:${model}` };
    } catch (e) {
      if (isWorkersAiQuotaError(e) && env.DB) {
        await bumpQuota(env.DB, day, "cf_fail_quota").catch(() => undefined);
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
            "zh-Hant",
          ),
        ).catch(() => undefined);
        return null;
      }
    }
  }
  return null;
}

export async function runCoach(
  req: CoachRequest,
  env: CoachEnv,
  userCfg?: AiConfig | null,
): Promise<CoachResponse & { reminder?: string; chain?: string; via?: string }> {
  const { env: effective, preferByok, forceNone, forceWorkersOnly, freeFirst } = buildEffectiveEnv(
    env,
    userCfg,
  );
  const fallback = staticCoach(req);
  const timeoutMs = Number(effective.COACH_TIMEOUT_MS ?? 5000);
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
    : forceWorkersOnly
      ? "cf→static"
      : freeFirst
        ? "free→cf→byok→static"
        : "cf→free→byok→static";

  if (forceNone) {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback").catch(() => undefined);
    return { ...fallback, reminder: "static only", chain: chainLabel, via: "static" };
  }

  const quota = env.DB ? await getQuota(env.DB, day).catch(() => null) : null;
  const slots = buildFreeFirstSlots(effective, userCfg, preferByok);

  const tryFreeSlots = async (onlyTier?: "free" | "byok") => {
    const list = onlyTier ? slots.filter((s) => s.tier === onlyTier) : slots;
    for (const slot of list) {
      const hit = await trySlot(slot, messages, maxTokens, temperature, timeoutMs, fallback);
      if (hit) {
        if (env.DB && slot.tier !== "cf") {
          await bumpQuota(env.DB, day, "byok_success").catch(() => undefined);
        }
        const rem = env.DB
          ? await getQuota(env.DB, day)
              .then((q) => quotaStatusMessage(q, maxCalls, req.locale))
              .catch(() => undefined)
          : undefined;
        return { ...hit, reminder: rem, chain: chainLabel };
      }
    }
    return null;
  };

  // workers_ai only
  if (forceWorkersOnly) {
    const cf = await tryCloudflare(
      effective,
      messages,
      maxTokens,
      temperature,
      timeoutMs,
      fallback,
      day,
      maxCalls,
      quota,
    );
    if (cf) return { ...cf, chain: chainLabel };
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback").catch(() => undefined);
    return {
      ...fallback,
      reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "cf only → static",
      chain: chainLabel,
      via: "static",
    };
  }

  // —— free_first (default): high-perf free → CF soft → paid BYOK → static ——
  if (freeFirst) {
    // 1) free high-perf (Groq, OpenRouter free, Gemini free)
    const freeHit = await tryFreeSlots("free");
    if (freeHit) return freeHit;

    // 2) CF soft-capped
    const cf = await tryCloudflare(
      effective,
      messages,
      maxTokens,
      temperature,
      timeoutMs,
      fallback,
      day,
      maxCalls,
      quota,
    );
    if (cf) {
      const rem =
        env.DB && quota
          ? quotaStatusMessage({ ...quota, cf_success: quota.cf_success + 1 }, maxCalls, req.locale)
          : undefined;
      return { ...cf, reminder: rem, chain: chainLabel };
    }

    // 3) user / env BYOK (may cost)
    const byokHit = await tryFreeSlots("byok");
    if (byokHit) return byokHit;
  } else {
    // legacy cf_first
    const cf = await tryCloudflare(
      effective,
      messages,
      maxTokens,
      temperature,
      timeoutMs,
      fallback,
      day,
      maxCalls,
      quota,
    );
    if (cf) {
      const rem =
        env.DB && quota
          ? quotaStatusMessage({ ...quota, cf_success: quota.cf_success + 1 }, maxCalls, req.locale)
          : undefined;
      return { ...cf, reminder: rem, chain: chainLabel };
    }
    const any = await tryFreeSlots();
    if (any) return any;
  }

  if (env.DB) await bumpQuota(env.DB, day, "static_fallback").catch(() => undefined);
  return {
    ...fallback,
    reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "static fallback",
    chain: chainLabel,
    via: "static",
  };
}
