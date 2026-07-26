import type { CoachProvider, CompleteOpts } from "./types";

export function createOpenAICompatibleProvider(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): CoachProvider {
  const base = opts.baseUrl.replace(/\/$/, "");
  const isOpenRouter = base.includes("openrouter.ai");
  return {
    id: isOpenRouter ? "openrouter" : base.includes("groq.com") ? "groq" : "openai_compatible",
    async complete(messages, { maxTokens, temperature, signal, json }: CompleteOpts) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      };
      // OpenRouter recommends these for free-tier routing
      if (isOpenRouter) {
        headers["HTTP-Referer"] = "https://go.tdtc.indevs.in";
        headers["X-Title"] = "Kids Igo";
      }
      const payload: Record<string, unknown> = {
        model: opts.model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      if (json) payload.response_format = { type: "json_object" };

      let res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });
      // Some BYOK endpoints reject response_format — retry once without it.
      if (!res.ok && res.status === 400 && json) {
        const errText = await res.text();
        if (/response_format/i.test(errText)) {
          delete payload.response_format;
          res = await fetch(`${base}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal,
          });
        } else {
          throw new Error(`openai_compatible 400: ${errText.slice(0, 200)}`);
        }
      }
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
