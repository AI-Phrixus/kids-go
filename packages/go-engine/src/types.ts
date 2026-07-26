/** Shared Go types for browser + worker (no Node-only APIs). */

export type Color = "black" | "white";

export type Point = { x: number; y: number };

export type BoardSize = 9 | 13 | 19;

export type Move =
  | { type: "play"; color: Color; x: number; y: number }
  | { type: "pass"; color: Color };

export type AiLevel = 0 | 1 | 2;

export interface BoardState {
  size: BoardSize;
  /** row-major; null = empty */
  grid: (Color | null)[];
  toPlay: Color;
  captured: { black: number; white: number };
  /** simple ko: forbidden point key "x,y" or null */
  ko: string | null;
  /** consecutive passes; 2 = game over (v2) */
  consecutivePasses: number;
  /** total plays+passes so far (v2) */
  moveNumber: number;
  /** position keys after each play, for positional-superko detection (v2) */
  history: string[];
}

/** Rich play result (v2). `tryPlay` keeps the legacy `BoardState | null` shape. */
export type PlayResult =
  | { ok: true; state: BoardState; captured: Point[] }
  | {
      ok: false;
      reason: "off-board" | "occupied" | "suicide" | "ko" | "superko" | "game-over";
    };

export interface Score {
  /** area totals: stones + territory (+ komi for white) */
  black: number;
  white: number;
  territory: { black: number; white: number };
  stones: { black: number; white: number };
  /** dame: empty points bordering both colors */
  neutral: number;
  komi: number;
}

export interface GameResult {
  winner: Color | "draw";
  margin: number;
  score: Score;
}
