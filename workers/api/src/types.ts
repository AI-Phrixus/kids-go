export type Locale = "ja" | "zh-Hant" | "en";

export type Env = {
  DB: D1Database;
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
  SESSION_SECRET?: string;
  /** auto | workers_ai | xai | google | openai_compatible | none */
  COACH_PROVIDER?: string;
  COACH_TIMEOUT_MS?: string;
  COACH_MAX_TOKENS?: string;
  COACH_TEMPERATURE?: string;
  COACH_CF_SOFT_MAX_CALLS?: string;
  COACH_CF_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  XAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;
};

export type AuthUser = {
  id: string;
  kind: "parent" | "quick";
  email: string | null;
  display_name: string | null;
  preferred_locale: Locale;
};

export type Child = {
  id: string;
  user_id: string;
  nickname: string;
  avatar_id: string | null;
  preferred_locale: Locale;
  eyecare_json: string;
};
