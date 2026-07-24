import type { CoachRequest, CoachResponse } from "./contract";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { createGoogleProvider } from "./providers/google";
import { noneProvider } from "./providers/none";
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
  /** auto = workers_ai → byok → static | workers_ai | xai | google | openai_compatible | none */
  COACH_PROVIDER?: string;
  COACH_TIMEOUT_MS?: string;
  COACH_MAX_TOKENS?: string;
  COACH_TEMPERATURE?: string;
  /** Soft max Workers AI successful calls/day (default 40). Stay under free Neurons. */
  COACH_CF_SOFT_MAX_CALLS?: string;
  /** Workers AI model id */
  COACH_CF_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
}

function resolveByok(env: CoachEnv): CoachProvider | null {
  const id = (env.COACH_PROVIDER ?? "auto").toLowerCase();
  // Prefer explicit BYOK vars regardless of provider name when auto
  if (id === "xai" || (id === "auto" && (env.XAI_API_KEY || env.AI_API_KEY))) {
    if (id === "xai" || env.XAI_API_KEY) {
      const key = env.XAI_API_KEY || env.AI_API_KEY;
      if (key) return createXaiProvider(key, env.AI_MODEL || "grok-4.5");
    }
  }
  if (id === "google" || (id === "auto" && env.GOOGLE_API_KEY)) {
    const key = env.GOOGLE_API_KEY || (id === "google" ? env.AI_API_KEY : undefined);
    if (key) {
      return createGoogleProvider({
        apiKey: key,
        model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
      });
    }
  }
  if (
    id === "openai_compatible" ||
    (id === "auto" && env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL)
  ) {
    if (env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL) {
      return createOpenAICompatibleProvider({
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
      });
    }
  }
  if (id === "xai") {
    const key = env.XAI_API_KEY || env.AI_API_KEY;
    if (key) return createXaiProvider(key, env.AI_MODEL || "grok-4.5");
  }
  if (id === "google") {
    const key = env.GOOGLE_API_KEY || env.AI_API_KEY;
    if (key) {
      return createGoogleProvider({
        apiKey: key,
        model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
      });
    }
  }
  if (id === "openai_compatible") {
    if (env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL) {
      return createOpenAICompatibleProvider({
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
      });
    }
  }
  return null;
}

function parseJsonResponse(text: string, fallback: CoachResponse, source: CoachResponse["source"]): CoachResponse {
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

export async function getCoachStatus(env: CoachEnv, locale = "zh-Hant"): Promise<CoachStatus> {
  const day = utcDay();
  const maxCalls = softMaxCalls(env);
  const mode = (env.COACH_PROVIDER ?? "auto").toLowerCase();
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
  const byok = resolveByok(env);
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
      "Stay on Workers Free plan for Workers AI hard stop after free Neurons (no paid overage). Soft cap switches to BYOK first.",
  };
}

/**
 * Chain (default COACH_PROVIDER=auto):
 * 1) Cloudflare Workers AI free (if bound + under soft budget)
 * 2) Third-party BYOK (xAI / Google / openai_compatible)
 * 3) Static phrases
 *
 * Never charges CF AI if you remain on Free — Free hard-limits instead.
 */
export async function runCoach(req: CoachRequest, env: CoachEnv): Promise<CoachResponse & { reminder?: string }> {
  const fallback = staticCoach(req);
  const mode = (env.COACH_PROVIDER ?? "auto").toLowerCase();
  const timeoutMs = Number(env.COACH_TIMEOUT_MS ?? 2500);
  const maxTokens = Number(env.COACH_MAX_TOKENS ?? 120);
  const temperature = Number(env.COACH_TEMPERATURE ?? 0.5);
  const day = utcDay();
  const maxCalls = softMaxCalls(env);

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(req) },
    { role: "user" as const, content: buildUserPrompt(req) },
  ];

  if (mode === "none") {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return { ...fallback, reminder: "static only" };
  }

  let quota = env.DB ? await getQuota(env.DB, day).catch(() => null) : null;

  // --- 1) Workers AI free ---
  const tryCf =
    (mode === "auto" || mode === "workers_ai") &&
    !!env.AI &&
    (!quota || !shouldSkipWorkersAi(quota, maxCalls));

  if (tryCf && env.AI) {
    if (quota && shouldSkipWorkersAi(quota, maxCalls)) {
      if (env.DB) {
        await bumpQuota(env.DB, day, "cf_blocked_soft");
        const msg = quotaStatusMessage(quota, maxCalls, req.locale);
        await setAlert(env.DB, day, msg);
      }
    } else {
      const model =
        env.COACH_CF_MODEL || "@cf/meta/llama-3.1-8b-instruct";
      const provider = createWorkersAiProvider(env.AI, model);
      try {
        const text = await completeWithTimeout(
          provider,
          messages,
          maxTokens,
          temperature,
          timeoutMs,
        );
        if (env.DB) await bumpQuota(env.DB, day, "cf_success");
        const parsed = parseJsonResponse(text, fallback, "workers_ai");
        const rem =
          env.DB && quota
            ? quotaStatusMessage(
                { ...quota, cf_success: quota.cf_success + 1 },
                maxCalls,
                req.locale,
              )
            : undefined;
        if (rem && quota && quota.cf_success + 1 >= maxCalls - 5 && env.DB) {
          await setAlert(env.DB, day, rem);
        }
        return { ...parsed, reminder: rem };
      } catch (e) {
        if (isWorkersAiQuotaError(e) && env.DB) {
          await bumpQuota(env.DB, day, "cf_fail_quota");
          const msg = quotaStatusMessage(
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
          );
          await setAlert(env.DB, day, msg);
        }
        // fall through to BYOK
      }
    }
  }

  // force workers_ai only → static on fail
  if (mode === "workers_ai") {
    if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
    return {
      ...fallback,
      reminder: quota
        ? quotaStatusMessage(quota, maxCalls, req.locale)
        : "workers_ai unavailable → static",
    };
  }

  // --- 2) BYOK third party ---
  const byok =
    mode === "auto" || mode === "xai" || mode === "google" || mode === "openai_compatible"
      ? resolveByok(env)
      : mode === "xai" || mode === "google" || mode === "openai_compatible"
        ? resolveByok(env)
        : null;

  // also allow explicit single-provider modes
  let provider: CoachProvider | null = byok;
  if (!provider && mode !== "auto" && mode !== "workers_ai" && mode !== "none") {
    provider = resolveByok({ ...env, COACH_PROVIDER: mode });
  }

  if (provider && provider.id !== "none") {
    try {
      const text = await completeWithTimeout(
        provider,
        messages,
        maxTokens,
        temperature,
        timeoutMs,
      );
      if (env.DB) await bumpQuota(env.DB, day, "byok_success");
      const parsed = parseJsonResponse(text, fallback, "byok");
      const rem = env.DB
        ? (await getQuota(env.DB, day).then((q) => quotaStatusMessage(q, maxCalls, req.locale)).catch(() => undefined))
        : undefined;
      return { ...parsed, reminder: rem };
    } catch {
      // fall through
    }
  }

  if (env.DB) await bumpQuota(env.DB, day, "static_fallback");
  return {
    ...fallback,
    reminder: quota
      ? quotaStatusMessage(quota, maxCalls, req.locale)
      : "static fallback",
  };
}

// silence unused import if any
void noneProvider;
