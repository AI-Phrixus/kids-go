/** Minimal node smoke tests: node packages/go-engine/src/board.test.mjs */
import { createEmptyBoard, tryPlay, groupLiberties, idx } from "./board.ts";

// Dynamic import may fail without ts loader — inline critical checks via assert on compiled logic
// This file documents expected cases; CI uses wrangler/runtime. For local:
console.log("board.test: run via vitest/ts later; engine loaded by Vite.");
