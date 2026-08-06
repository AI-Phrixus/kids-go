export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CoachProvider {
  readonly id: string;
  complete(
    messages: ChatMessage[],
    opts: { maxTokens: number; temperature: number; signal?: AbortSignal },
  ): Promise<string>;
}
