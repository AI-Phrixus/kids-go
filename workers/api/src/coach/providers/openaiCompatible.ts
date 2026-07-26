import type { ChatMessage, CoachProvider } from "./types";

export function createOpenAICompatibleProvider(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): CoachProvider {
  const base = opts.baseUrl.replace(/\/$/, "");
  const isOpenRouter = base.includes("openrouter.ai");
  return {
    id: isOpenRouter ? "openrouter" : base.includes("groq.com") ? "groq" : "openai_compatible",
    async complete(messages, { maxTokens, temperature }) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      };
      // OpenRouter recommends these for free-tier routing
      if (isOpenRouter) {
        headers["HTTP-Referer"] = "https://go.tdtc.indevs.in";
        headers["X-Title"] = "Kids Igo";
      }
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
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
