/**
 * Free high-performance coach provider rotation.
 *
 * Priority (keep FREE, maximize quality/speed):
 *  1. Groq — Llama 3.3 70B (fastest high-quality free OSS)
 *  2. OpenRouter free models — rotate among known free slugs
 *  3. Google Gemini free (if key; privacy trade-off)
 *  4. Cloudflare Workers AI — free neurons, soft-capped (smaller models)
 *  5. User BYOK (may be paid — only after free fail, or first if preferByok)
 *  6. Static phrases
 *
 * v0.8.0: hourly rotation removed — order is fixed by quality and the
 * circuit breaker (coach/breaker.ts) skips unhealthy slots instead. Rotating
 * by the clock meant a child got a 70B model some hours and a 9B model
 * others, for no benefit.
 */

import type { AiConfig } from "../ai-config";
import { EMPTY_AI_CONFIG } from "../ai-config";
import { createGoogleProvider } from "./providers/google";
import { createOpenAICompatibleProvider } from "./providers/openaiCompatible";
import type { CoachProvider } from "./providers/types";

/** Minimal env shape for free rotation (avoid circular import with service.ts). */
export type FreeRotationEnv = {
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
};

export type FreeSlot = {
  /** Stable id for health / logging */
  id: string;
  /** Quality rank 1 = best free */
  rank: number;
  /** free | byok | cf */
  tier: "free" | "byok" | "cf";
  build: () => CoachProvider | null;
};

/** OpenRouter free model candidates (order = quality preference; dead slugs skipped on fail). */
export const OPENROUTER_FREE_MODELS = [
  "openrouter/free", // auto free router
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "poolside/laguna-m.1:free",
] as const;

/** Groq free model candidates if primary fails */
export const GROQ_FREE_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
] as const;

/**
 * Build ordered free-first provider slots.
 * @param preferByok — user wants their BYOK first (may leave free path)
 */
export function buildFreeFirstSlots(
  env: FreeRotationEnv,
  userCfg?: AiConfig | null,
  preferByok = false,
): FreeSlot[] {
  const u = userCfg ?? EMPTY_AI_CONFIG;
  const free: FreeSlot[] = [];
  const byok: FreeSlot[] = [];

  // —— Free tier 1: Groq (best free for kids coach) ——
  if (env.GROQ_API_KEY) {
    const models = [
      env.GROQ_MODEL || GROQ_FREE_MODELS[0],
      ...GROQ_FREE_MODELS.filter((m) => m !== (env.GROQ_MODEL || GROQ_FREE_MODELS[0])),
    ];
    models.forEach((model, i) => {
      free.push({
        id: `groq:${model}`,
        rank: 10 + i,
        tier: "free",
        build: () =>
          createOpenAICompatibleProvider({
            baseUrl: "https://api.groq.com/openai/v1",
            apiKey: env.GROQ_API_KEY!,
            model,
          }),
      });
    });
  }

  // —— Free tier 2: OpenRouter free models ——
  if (env.OPENROUTER_API_KEY) {
    const preferred = env.OPENROUTER_MODEL;
    const list = preferred
      ? [preferred, ...OPENROUTER_FREE_MODELS.filter((m) => m !== preferred)]
      : [...OPENROUTER_FREE_MODELS];
    // Only keep free-looking models when auto (avoid gpt-4o on site secret path)
    const freeOnly = list.filter(
      (m) =>
        m === "openrouter/free" ||
        m.endsWith(":free") ||
        m.includes("/free") ||
        // allow explicit secret override even if not :free
        m === preferred,
    );
    const models = freeOnly;
    models.forEach((model, i) => {
      free.push({
        id: `openrouter:${model}`,
        rank: 20 + i,
        tier: "free",
        build: () =>
          createOpenAICompatibleProvider({
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: env.OPENROUTER_API_KEY!,
            model,
          }),
      });
    });
  }

  // —— Free tier 3: Google Gemini free (if site key) ——
  if (env.GOOGLE_API_KEY) {
    const gModel = env.GOOGLE_MODEL || "gemini-flash-lite-latest";
    free.push({
      id: `google:${gModel}`,
      rank: 30,
      tier: "free",
      build: () =>
        createGoogleProvider({
          apiKey: env.GOOGLE_API_KEY!,
          model: gModel,
        }),
    });
  }

  // —— User BYOK (may cost money) ——
  const kind = (u.provider || "auto").toLowerCase();
  if (u.apiKey && (u.baseUrl || kind === "google" || kind === "xai")) {
    byok.push({
      id: `user:${kind || "byok"}`,
      rank: 90,
      tier: "byok",
      build: () => {
        if (kind === "google") {
          return createGoogleProvider({
            apiKey: u.apiKey!,
            model: u.model || env.GOOGLE_MODEL || "gemini-2.0-flash",
          });
        }
        if (kind === "xai" || u.baseUrl?.includes("x.ai")) {
          // lazy import avoided — use openai-compatible x.ai endpoint
          return createOpenAICompatibleProvider({
            baseUrl: "https://api.x.ai/v1",
            apiKey: u.apiKey!,
            model: u.model || "grok-4.5",
          });
        }
        if (u.baseUrl) {
          return createOpenAICompatibleProvider({
            baseUrl: u.baseUrl,
            apiKey: u.apiKey!,
            model: u.model || "gpt-4o-mini",
          });
        }
        return null;
      },
    });
  }

  // Env generic AI_* / XAI (treat as paid-ish BYOK unless empty)
  if (env.AI_BASE_URL && env.AI_API_KEY && !env.AI_BASE_URL.includes("groq.com") && !env.AI_BASE_URL.includes("openrouter.ai")) {
    byok.push({
      id: `env:${env.AI_MODEL || "custom"}`,
      rank: 91,
      tier: "byok",
      build: () =>
        createOpenAICompatibleProvider({
          baseUrl: env.AI_BASE_URL!,
          apiKey: env.AI_API_KEY!,
          model: env.AI_MODEL || "gpt-4o-mini",
        }),
    });
  }
  if (env.XAI_API_KEY) {
    byok.push({
      id: "env:xai",
      rank: 92,
      tier: "byok",
      build: () =>
        createOpenAICompatibleProvider({
          baseUrl: "https://api.x.ai/v1",
          apiKey: env.XAI_API_KEY!,
          model: env.AI_MODEL || "grok-4.5",
        }),
    });
  }

  // Sort free by rank, then rotate whole free list by hour for load balance
  free.sort((a, b) => a.rank - b.rank);
  // Keep Groq block first always (rank 10–19), only rotate within same tens?
  // User asked for priority order: Groq > OpenRouter > Google. Don't scramble rank groups.
  // Only rotate models *within* each provider group (already done).
  // Hourly: if Groq rate-limited often, still try Groq first then fall through — good.

  if (preferByok && byok.length) {
    return [...byok, ...free];
  }
  return [...free, ...byok];
}

export function freePriorityLabel(slots: FreeSlot[]): string {
  const ids = slots.filter((s) => s.tier === "free").map((s) => s.id.split(":")[0]);
  const uniq = [...new Set(ids)];
  return uniq.length ? uniq.join(" → ") : "none";
}
