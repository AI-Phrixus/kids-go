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

/** Merge env secrets + per-user BYOK from settings UI */
export function buildEffectiveEnv(env: CoachEnv, userCfg?: AiConfig | null): CoachEnv {
  const u = userCfg ?? EMPTY_AI_CONFIG;
  const provider =
    u.provider && u.provider !== "auto"
      ? u.provider
      : env.COACH_PROVIDER || "auto";

  return {
    ...env,
    COACH_PROVIDER: u.preferByok && (u.apiKey || u.baseUrl) ? (u.provider === "auto" ? "openai_compatible" : u.provider) : provider,
    AI_BASE_URL: u.baseUrl || env.AI_BASE_URL,
    AI_API_KEY: u.apiKey || env.AI_API_KEY,
    AI_MODEL: u.model || env.AI_MODEL,
    // if user set xai/google keys via generic fields
    XAI_API_KEY:
      u.provider === "xai" && u.apiKey ? u.apiKey : env.XAI_API_KEY || (u.baseUrl?.includes("x.ai") ? u.apiKey : undefined),
    GOOGLE_API_KEY: u.provider === "google" && u.apiKey ? u.apiKey : env.GOOGLE_API_KEY,
    GOOGLE_MODEL: u.provider === "google" && u.model ? u.model : env.GOOGLE_MODEL,
  };
}

function resolveByok(env: CoachEnv): CoachProvider | null {
  const id = (env.COACH_PROVIDER ?? "auto").toLowerCase();

  // Explicit or auto with full openai-compatible triple
  if (env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL) {
    if (
      id === "auto" ||
      id === "openai_compatible" ||
      id === "xai" ||
      (id !== "google" && id !== "workers_ai" && id !== "none")
    ) {
      // Prefer specialized xai host
      if (env.AI_BASE_URL.includes("x.ai") || id === "xai") {
        return createXaiProvider(env.AI_API_KEY || env.XAI_API_KEY || "", env.AI_MODEL || "grok-4.5");
      }
      return createOpenAICompatibleProvider({
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
      });
    }
  }

  if (id === "xai" || (id === "auto" && env.XAI_API_KEY)) {
    const key = env.XAI_API_KEY || env.AI_API_KEY;
    if (key) return createXaiProvider(key, env.AI_MODEL || "grok-4.5");
  }

  if (id === "google" || (id === "auto" && env.GOOGLE_API_KEY)) {
    const key = env.GOOGLE_API_KEY || env.AI_API_KEY;
    if (key) {
      return createGoogleProvider({
        apiKey: key,
        model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
      });
    }
  }

  // openai_compatible with key+url even if model missing — default model
  if (env.AI_BASE_URL && env.AI_API_KEY) {
    return createOpenAICompatibleProvider({
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL || "gpt-4o-mini",
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
  cfSoftMaxCalls: number;
  cfSuccessToday: number;
  cfQuotaHitsToday: number;
  byokConfigured: boolean;
  workersAiBound: boolean;
  alert: string | null;
  reminder: string;
  billingNote: string;
};

export async function getCoachStatus(
  env: CoachEnv,
  locale = "zh-Hant",
  userCfg?: AiConfig | null,
): Promise<CoachStatus> {
  const effective = buildEffectiveEnv(env, userCfg);
  const day = utcDay();
  const maxCalls = softMaxCalls(effective);
  const mode = (effective.COACH_PROVIDER ?? "auto").toLowerCase();
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
  const byok = resolveByok(effective);
  return {
    dayUtc: day,
    mode,
    cfSoftMaxCalls: maxCalls,
    cfSuccessToday: q.cf_success,
    cfQuotaHitsToday: q.cf_fail_quota,
    byokConfigured: !!byok,
    workersAiBound: !!env.AI,
    alert: q.last_alert,
    reminder: quotaStatusMessage(q, maxCalls, locale),
    billingNote:
      "Stay on Workers Free for hard stop. Soft cap then BYOK (settings URL/key) then static.",
  };
}

/**
 * Chain:
 * 1) CF Workers AI (unless preferByok / mode skips)
 * 2) User settings BYOK + env secrets
 * 3) Static
 */
export async function runCoach(
  req: CoachRequest,
  env: CoachEnv,
  userCfg?: AiConfig | null,
): Promise<CoachResponse & { reminder?: string }> {
  const effective = buildEffectiveEnv(env, userCfg);
  const fallback = staticCoach(req);
  const mode = (effective.COACH_PROVIDER ?? "auto").toLowerCase();
  const preferByok = Boolean(userCfg?.preferByok && (userCfg.apiKey || userCfg.baseUrl));
  const timeoutMs = Number(effective.COACH_TIMEOUT_MS ?? 2500);
  const maxTokens = Number(effective.COACH_MAX_TOKENS ?? 120);
  const temperature = Number(effective.COACH_TEMPERATURE ?? 0.5);
  const day = utcDay();
  const maxCalls = softMaxCalls(effective);

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(req) },
    { role: "user" as const, content: buildUserPrompt(req) },
  ];

  if (mode === "none") {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return { ...fallback, reminder: "static only" };
  }

  let quota = env.DB ? await getQuota(env.DB, day).catch(() => null) : null;

  const tryCf =
    !preferByok &&
    (mode === "auto" || mode === "workers_ai") &&
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
      return { ...parsed, reminder: rem };
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
    }
  } else if (quota && shouldSkipWorkersAi(quota, maxCalls) && env.DB) {
    await bumpQuota(env.DB, day, "cf_blocked_soft");
  }

  if (mode === "workers_ai" && !preferByok) {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return {
      ...fallback,
      reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "workers_ai → static",
    };
  }

  const byok = resolveByok(effective);
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
      return { ...parsed, reminder: rem };
    } catch {
      /* static */
    }
  }

  if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
  return {
    ...fallback,
    reminder: quota ? quotaStatusMessage(quota, maxCalls, req.locale) : "static fallback",
  };
}
