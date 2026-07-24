import { createOpenAICompatibleProvider } from "./openaiCompatible";
import type { CoachProvider } from "./types";

export function createXaiProvider(apiKey: string, model = "grok-4.5"): CoachProvider {
  const p = createOpenAICompatibleProvider({
    baseUrl: "https://api.x.ai/v1",
    apiKey,
    model,
  });
  return { ...p, id: "xai" };
}
