import type { ChatMessage, CoachProvider } from "./types";

/** Cloudflare Workers AI binding shape (env.AI). */
export type WorkersAiBinding = {
  run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Free-tier friendly Workers AI chat.
 * Stay on Workers Free → daily 10k Neurons hard stop (no surprise bill).
 * Soft budget is enforced in coach service before calling this.
 */
export function createWorkersAiProvider(
  ai: WorkersAiBinding,
  model: string,
): CoachProvider {
  return {
    id: "workers_ai",
    async complete(messages: ChatMessage[], { maxTokens, temperature }) {
      const out = await ai.run(model, {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      });
      const text = extractText(out);
      if (!text) throw new Error("workers_ai empty response");
      return text;
    },
  };
}

function extractText(out: unknown): string {
  if (!out) return "";
  if (typeof out === "string") return out;
  const o = out as {
    response?: string | { response?: string };
    result?: string;
    output_text?: string;
    description?: string;
    choices?: { message?: { content?: string } }[];
  };
  if (typeof o.response === "string") return o.response;
  if (o.response && typeof o.response === "object" && typeof o.response.response === "string") {
    return o.response.response;
  }
  if (typeof o.result === "string") return o.result;
  if (typeof o.output_text === "string") return o.output_text;
  if (typeof o.description === "string") return o.description;
  const choice = o.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  try {
    return JSON.stringify(out);
  } catch {
    return "";
  }
}

/** Heuristic: detect free-tier / neuron limit errors. */
export function isWorkersAiQuotaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes("4006") ||
    msg.includes("neuron") ||
    msg.includes("free allocation") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("capacity")
  );
}
