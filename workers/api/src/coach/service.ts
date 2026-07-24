import type { CoachRequest, CoachResponse } from "./contract";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { createGoogleProvider } from "./providers/google";
import { noneProvider } from "./providers/none";
import { createOpenAICompatibleProvider } from "./providers/openaiCompatible";
import type { CoachProvider } from "./providers/types";
import { createXaiProvider } from "./providers/xai";
import { staticCoach } from "./staticPhrases";

export interface CoachEnv {
  COACH_PROVIDER?: string;
  COACH_TIMEOUT_MS?: string;
  COACH_MAX_TOKENS?: string;
  COACH_TEMPERATURE?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
}

function resolveProvider(env: CoachEnv): CoachProvider | null {
  const id = (env.COACH_PROVIDER ?? "none").toLowerCase();
  if (id === "none" || id === "") return null;
  if (id === "xai") {
    const key = env.XAI_API_KEY || env.AI_API_KEY;
    if (!key) return null;
    return createXaiProvider(key, env.AI_MODEL || "grok-4.5");
  }
  if (id === "google") {
    const key = env.GOOGLE_API_KEY || env.AI_API_KEY;
    if (!key) return null;
    return createGoogleProvider({
      apiKey: key,
      model: env.GOOGLE_MODEL || env.AI_MODEL || "gemini-2.0-flash",
    });
  }
  if (id === "openai_compatible") {
    const key = env.AI_API_KEY;
    const base = env.AI_BASE_URL;
    const model = env.AI_MODEL;
    if (!key || !base || !model) return null;
    return createOpenAICompatibleProvider({ baseUrl: base, apiKey: key, model });
  }
  return noneProvider;
}

function parseJsonResponse(text: string, fallback: CoachResponse): CoachResponse {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return { ...fallback, say: text.slice(0, 120), source: "llm" };
    const obj = JSON.parse(text.slice(start, end + 1)) as Partial<CoachResponse>;
    return {
      say: String(obj.say ?? fallback.say),
      tags: Array.isArray(obj.tags) ? obj.tags.map(String) : fallback.tags,
      praiseBehavior: obj.praiseBehavior ? String(obj.praiseBehavior) : undefined,
      parentNote: obj.parentNote ? String(obj.parentNote) : fallback.parentNote,
      tone: fallback.tone,
      speaker: (obj.speaker as CoachResponse["speaker"]) ?? fallback.speaker,
      source: "llm",
    };
  } catch {
    return { ...fallback, say: text.slice(0, 120), source: "llm" };
  }
}

export async function runCoach(req: CoachRequest, env: CoachEnv): Promise<CoachResponse> {
  const fallback = staticCoach(req);
  const provider = resolveProvider(env);
  if (!provider || provider.id === "none") return fallback;

  const timeoutMs = Number(env.COACH_TIMEOUT_MS ?? 2500);
  const maxTokens = Number(env.COACH_MAX_TOKENS ?? 120);
  const temperature = Number(env.COACH_TEMPERATURE ?? 0.5);

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(req) },
    { role: "user" as const, content: buildUserPrompt(req) },
  ];

  try {
    const text = await Promise.race([
      provider.complete(messages, { maxTokens, temperature }),
      new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error("coach timeout")), timeoutMs),
      ),
    ]);
    return parseJsonResponse(text, fallback);
  } catch {
    return fallback;
  }
}
