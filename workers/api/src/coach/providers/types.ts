export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOpts {
  maxTokens: number;
  temperature: number;
  /** Abort the underlying fetch on timeout (v0.8.0). */
  signal?: AbortSignal;
  /** Ask the provider for structured JSON output where supported (v0.8.0). */
  json?: boolean;
}

export interface CoachProvider {
  readonly id: string;
  complete(messages: ChatMessage[], opts: CompleteOpts): Promise<string>;
}
