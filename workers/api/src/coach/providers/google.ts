import type { ChatMessage, CoachProvider } from "./types";

/** Google Gemini generateContent (API key in query). Model id is configurable for free tiers. */
export function createGoogleProvider(opts: {
  apiKey: string;
  model: string;
}): CoachProvider {
  return {
    id: "google",
    async complete(messages: ChatMessage[], { maxTokens, temperature }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const system = messages.find((m) => m.role === "system")?.content;
      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      };
      if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`google ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      // Skip thought-only parts; only join real text
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => (typeof p.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("") ?? "";
      if (!text.trim()) throw new Error("empty gemini response");
      return text.trim();
    },
  };
}
