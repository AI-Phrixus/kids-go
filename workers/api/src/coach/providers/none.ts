import type { ChatMessage, CoachProvider } from "./types";

/** Offline provider — service layer should use static phrases instead. */
export const noneProvider: CoachProvider = {
  id: "none",
  async complete(_messages: ChatMessage[]): Promise<string> {
    throw new Error("none provider: use static fallback");
  },
};
