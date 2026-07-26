#!/usr/bin/env node
/**
 * Single-source the version string from package.json into:
 *  - apps/web/src/version.ts        (footer display)
 *  - workers/api/src/version.ts     (API responses)
 *  - apps/web/public/sw.js          (service-worker cache key)
 * Runs automatically before build/deploy (see package.json scripts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

function replaceIn(file, re, replacement) {
  const p = join(root, file);
  const before = readFileSync(p, "utf8");
  const after = before.replace(re, replacement);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`sync-version: ${file} → ${version}`);
  }
}

replaceIn(
  "apps/web/src/version.ts",
  /APP_VERSION = "[^"]+"/,
  `APP_VERSION = "${version}"`,
);
replaceIn(
  "workers/api/src/version.ts",
  /APP_VERSION = "[^"]+"/,
  `APP_VERSION = "${version}"`,
);
replaceIn(
  "apps/web/public/sw.js",
  /const CACHE = "kids-go-v[^"]+"/,
  `const CACHE = "kids-go-v${version}"`,
);
