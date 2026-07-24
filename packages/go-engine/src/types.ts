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
}
