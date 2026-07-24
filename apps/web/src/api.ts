const base = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText);
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
  complete: (lessonId: string, stars = 2) =>
    req(`/api/progress/${lessonId}`, {
      method: "POST",
      body: JSON.stringify({ status: "completed", stars }),
    }),
  saveGame: (body: unknown) =>
    req("/api/games", { method: "POST", body: JSON.stringify(body) }),
  coach: (body: unknown) =>
    req<{ say: string; source: string }>("/api/coach", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export type LessonDetail = {
  id: string;
  boardSize: number;
  badgeId: string;
  titles: Record<string, string>;
  story: Record<string, string>;
  goal: Record<string, string>;
  battle: {
    mode: string;
    n?: number;
    aiLevel?: number;
    points?: [number, number][];
    setup?: { x: number; y: number; color: "black" | "white" }[];
  };
  steps: Array<
    | { type: "story" }
    | { type: "info"; text: Record<string, string> }
    | { type: "tap"; prompt: Record<string, string>; correct: [number, number][] }
  >;
};
