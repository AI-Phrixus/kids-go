export * from "./types";
export * from "./board";
export * from "./ai";

/** Capture-race helper for free play goals. If both ≥ target, higher score wins; tie → null. */
export function captureRaceWinner(
  captured: { black: number; white: number },
  target: number,
): "black" | "white" | null {
  const b = captured.black >= target;
  const w = captured.white >= target;
  if (b && w) {
    if (captured.black > captured.white) return "black";
    if (captured.white > captured.black) return "white";
    return null; // simultaneous equal
  }
  if (b) return "black";
  if (w) return "white";
  return null;
}
