/**
 * i18n parity check (v0.8.0) — runs in CI (`npm run check:locales`).
 * 1. The three locale dictionaries expose identical key sets.
 * 2. Every t(..., "key") reference in the frontend source resolves.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { dict } from "../apps/web/src/i18n";

let failures = 0;
const locales = Object.keys(dict) as (keyof typeof dict)[];
const keySets = locales.map((l) => new Set(Object.keys(dict[l])));

for (let i = 0; i < locales.length; i++) {
  for (let j = 0; j < locales.length; j++) {
    if (i === j) continue;
    for (const k of keySets[i]!) {
      if (!keySets[j]!.has(k)) {
        failures++;
        console.error(`✗ key "${k}" exists in ${locales[i]} but not in ${locales[j]}`);
      }
    }
  }
}

// scan source for t(locale, "key") / t(L, "key") references
const srcDir = join(import.meta.dirname ?? __dirname, "..", "apps", "web", "src");
const refs = new Set<string>();
function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/\bt\(\s*[A-Za-z.]+\s*,\s*"([a-z0-9_]+)"/g)) {
        refs.add(m[1]!);
      }
    }
  }
}
walk(srcDir);

const en = keySets[locales.indexOf("en" as never)] ?? keySets[0]!;
for (const key of refs) {
  if (!en.has(key)) {
    failures++;
    console.error(`✗ t() references missing key "${key}"`);
  }
}

if (failures) {
  console.error(`check-locales: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `check-locales: ${keySets[0]!.size} keys × ${locales.length} locales in sync; ${refs.size} references resolve`,
);
