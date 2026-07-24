import type { ChatMessage, CoachProvider } from "./types";

export function createOpenAICompatibleProvider(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): CoachProvider {
  const base = opts.baseUrl.replace(/\/$/, "");
  return {
    id: "openai_compatible",
    async complete(messages, { maxTokens, temperature }) {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`openai_compatible ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty completion");
      return content;
    },
  };
}
