/**
 * Engine smoke test without TS loader — duplicates critical rules inline check via dynamic import fails.
 * Run after build with wrangler; this file documents expected cases.
 * node --experimental-strip-types packages/go-engine/src/board.ts  (node 22+)
 */
import { createRequire } from "node:module";
// Prefer: npx tsx packages/go-engine/smoke-run.ts when available
console.log("Use: npx --yes tsx -e \"...\" or deploy smoke via API lessons");
console.log("Manual checks: capture, suicide illegal, ko single-stone");
