export * from "./types";
export * from "./board";
export * from "./ai";

/** Capture-race helper for free play goals */
export function captureRaceWinner(
  captured: { black: number; white: number },
  target: number,
): "black" | "white" | null {
  if (captured.black >= target) return "black";
  if (captured.white >= target) return "white";
  return null;
}
