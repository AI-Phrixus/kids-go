const base = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText || "request_failed");
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean; version: string }>("/api/health"),
  me: () =>
    req<{
      user: { id: string; kind: string; preferred_locale: string };
      child: { id: string; nickname: string; preferred_locale: string } | null;
      children: { id: string; nickname: string }[];
    }>("/api/auth/me"),
  registerParent: (body: {
    email: string;
    password: string;
    childNickname: string;
    locale: string;
  }) =>
    req("/api/auth/register/parent", { method: "POST", body: JSON.stringify(body) }),
  registerQuick: (body: { nickname: string; pin: string; locale: string }) =>
    req("/api/auth/register/quick", { method: "POST", body: JSON.stringify(body) }),
  loginParent: (email: string, password: string) =>
    req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ mode: "parent", email, password }),
    }),
  loginQuick: (nickname: string, pin: string) =>
    req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ mode: "quick", nickname, pin }),
    }),
  logout: () => req("/api/auth/logout", { method: "POST", body: "{}" }),
  lessons: () =>
    req<{
      lessons: {
        id: string;
        order: number;
        titles: Record<string, string>;
        status: string;
        stars: number;
        playable: boolean;
      }[];
      child: { id: string; nickname: string };
    }>("/api/lessons"),
  lesson: (id: string) => req<{ lesson: LessonDetail }>(`/api/lessons/${id}`),
  complete: (lessonId: string, stars = 2, extra?: { hintsUsed?: number; movesUsed?: number }) =>
    req(`/api/progress/${lessonId}`, {
      method: "POST",
      body: JSON.stringify({ status: "completed", stars, ...extra }),
    }),
  saveGame: (body: unknown) =>
    req("/api/games", { method: "POST", body: JSON.stringify(body) }),
  coach: (body: unknown) =>
    req<{ say: string; source: string; reminder?: string }>("/api/coach", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  coachStatus: (locale: string) =>
    req<{
      reminder: string;
      cfSuccessToday: number;
      cfSoftMaxCalls: number;
      byokConfigured: boolean;
      workersAiBound: boolean;
    }>(`/api/coach/status?locale=${encodeURIComponent(locale)}`),
  getAiSettings: () =>
    req<{
      config: {
        provider: string;
        baseUrl: string;
        model: string;
        preferByok: boolean;
        hasApiKey: boolean;
        apiKeyHint: string;
      };
      presets: {
        id: string;
        label: string;
        baseUrl: string;
        model: string;
        provider: string;
      }[];
      hints: Record<string, string>;
    }>("/api/settings/ai"),
  saveAiSettings: (body: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    preferByok?: boolean;
    clearApiKey?: boolean;
    /** v0.8.0: parent password / PIN re-auth required for changes */
    credential?: string;
  }) => req("/api/settings/ai", { method: "PUT", body: JSON.stringify(body) }),
  testAiSettings: (credential: string) =>
    req<{ ok: boolean; sample?: string; error?: string }>("/api/settings/ai/test", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  parentSummary: (locale: string) =>
    req<{
      headline: string;
      stats: {
        completedCount: number;
        totalLessons: number;
        totalStars: number;
        badgeCount: number;
        percent: number;
      };
      skills: { lessonId: string; skill: string; stars: number }[];
      badges: { id: string; name: string }[];
      nextLesson: { id: string; title: string } | null;
      parentTips: string[];
      note: string;
    }>(`/api/parent/summary?locale=${encodeURIComponent(locale)}`),
  badges: () =>
    req<{ badges: { badge_id: string; earned_at: number }[] }>("/api/badges"),
  saveLocale: (locale: string) =>
    req("/api/auth/locale", {
      method: "PATCH",
      body: JSON.stringify({ locale }),
    }),
  track: (event: string, payload?: unknown) =>
    req("/api/events", {
      method: "POST",
      body: JSON.stringify({ event, payload: payload ?? {} }),
    }).catch(() => ({ ok: false })),
  usageStats: () =>
    req<{
      summary: {
        sessions: number;
        lessonsCompleted: number;
        eyeBreaks: number;
        freePlays: number;
        coachHints: number;
        breakPerLesson: number;
      };
      counts: Record<string, number>;
    }>("/api/stats"),
  friends: () =>
    req<{
      me: { id: string; nickname: string };
      friends: { id: string; nickname: string; childId: string; status: string }[];
      pendingIn: { id: string; nickname: string; childId: string; status: string }[];
      pendingOut: { id: string; nickname: string; childId: string; status: string }[];
      limits: { maxFriends: number; maxMsgLen: number };
    }>("/api/friends"),
  friendAdd: (nickname: string) =>
    req<{ ok: boolean; status: string; friendshipId?: string; mutual?: boolean; already?: boolean }>(
      "/api/friends/add",
      { method: "POST", body: JSON.stringify({ nickname }) },
    ),
  friendAccept: (friendshipId: string) =>
    req<{ ok: boolean; status: string }>("/api/friends/accept", {
      method: "POST",
      body: JSON.stringify({ friendshipId }),
    }),
  friendRemove: (friendshipId: string) =>
    req<{ ok: boolean }>("/api/friends/remove", {
      method: "POST",
      body: JSON.stringify({ friendshipId }),
    }),
  friendMessages: (friendshipId: string, since = 0) =>
    req<{ messages: { id: string; fromMe: boolean; body: string; at: number }[] }>(
      `/api/friends/messages?friendshipId=${encodeURIComponent(friendshipId)}&since=${since}`,
    ),
  friendSend: (friendshipId: string, body: string) =>
    req<{ ok: boolean; message: { id: string; fromMe: boolean; body: string; at: number } }>(
      "/api/friends/messages",
      { method: "POST", body: JSON.stringify({ friendshipId, body }) },
    ),
};

/* ---------------- lesson content types (v0.8.0 battle system v2) ---------------- */

export type Pt = { x: number; y: number };

export type GoalPredicate =
  | { type: "connected"; points: Pt[] }
  | { type: "occupy"; points: Pt[]; anyOf?: number }
  | { type: "two_eyes"; group: Pt }
  | { type: "group_captured"; points: Pt[] }
  | { type: "capture_at_least"; n: number }
  | { type: "territory_lead"; margin?: number; komi?: number }
  | { type: "all"; of: GoalPredicate[] };

export type SequenceStep = {
  /** accepted player moves at this index */
  expect: Pt[] | "any-capture" | "any-atari" | "pass";
  /** scripted AI answer; "ai" = engine move at spec.aiLevel */
  reply?: Pt | "pass" | "ai";
  /** i18n text shown after 2 wrong tries (locale map) */
  hint?: Record<string, string>;
  hintKey?: string;
  sayKey?: string;
};

export type BattleSpec = {
  mode: "place_n" | "find_atari" | "capture_n" | "sequence";
  n?: number;
  aiLevel?: number;
  points?: [number, number][];
  setup?: { x: number; y: number; color: "black" | "white" }[];
  playerColor?: "black" | "white";
  /** optional completion gate (v0.8.0) */
  goal?: GoalPredicate;
  /** move budget for the 3-star rating */
  par?: number;
  /** sequence mode script */
  script?: SequenceStep[];
  afterScript?: "won" | "free-to-goal";
};

export type LessonDetail = {
  id: string;
  boardSize: number;
  badgeId: string;
  skillTag?: Record<string, string> | string;
  titles: Record<string, string>;
  story: Record<string, string>;
  goal: Record<string, string>;
  battle: BattleSpec;
  steps: Array<
    | { type: "story" }
    | { type: "info"; text: Record<string, string> }
    | { type: "tap"; prompt: Record<string, string>; correct: [number, number][] }
  >;
};
