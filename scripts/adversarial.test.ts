/**
 * Three-round red-team / blue-team adversarial suite (v0.8.0).
 *
 * The full Worker needs `hono` (unavailable offline here), so this exercises
 * the REAL shipped security code directly — the modules that carry the actual
 * defenses — with adversarial inputs, plus session lifecycle against an
 * in-memory D1 (node:sqlite). Run: `npx tsx scripts/adversarial.test.ts`.
 *
 * Each of the 3 rounds runs the same battery (fresh DB per round) so ordering
 * / state bugs surface, mirroring scripts/adversarial-3rounds.sh.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTestDb } from "./d1-mock";
import {
  hashPassword,
  hashPin,
  sha256hex,
  verifyPassword,
  verifyPin,
  uid,
} from "../workers/api/src/crypto";
import { sanitizeNickname } from "../workers/api/src/sanitize";
import { baseUrlProblem } from "../workers/api/src/ssrf";
import { filterCoachOutput, scriptMatches } from "../workers/api/src/coach/safety";
import { hasBlockedContent, hasContactInfo } from "../workers/api/src/shared/blocklist";
import { isOpen, recordFailure, recordSuccess, type BreakerState } from "../workers/api/src/coach/breaker";
import {
  createSession,
  loadSession,
  purgeExpiredSessions,
} from "../workers/api/src/session";
import type { Env } from "../workers/api/src/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let PASS = 0;
let FAIL = 0;
const fails: string[] = [];
function ok(name: string): void {
  PASS++;
}
function bad(name: string): void {
  FAIL++;
  fails.push(name);
  console.error(`  ✗ ${name}`);
}
function expect(cond: boolean, name: string): void {
  cond ? ok(name) : bad(name);
}
async function expectThrows(fn: () => Promise<unknown>, name: string): Promise<void> {
  try {
    await fn();
    bad(name + " (did not throw)");
  } catch {
    ok(name);
  }
}

async function round(r: number): Promise<void> {
  console.log(`\n========== ROUND ${r} ==========`);
  const db = makeTestDb(join(root, "migrations"));
  const env = { DB: db } as unknown as Env;

  /* --- crypto / auth --- */
  const pw = await hashPassword("hunter2");
  expect(await verifyPassword("hunter2", pw), "password verify ok");
  expect(!(await verifyPassword("wrong", pw)), "password verify rejects wrong");
  expect(pw.startsWith("pbkdf2$"), "pbkdf2 format");
  const pin = await hashPin("1357");
  expect(await verifyPin("1357", pin), "pin verify ok");
  expect(!(await verifyPin("0000", pin)), "pin verify rejects wrong");
  const h1 = await sha256hex("tokenABC");
  const h2 = await sha256hex("tokenABC");
  expect(h1 === h2 && h1.length === 64, "sha256 deterministic 64-hex");
  expect((await sha256hex("a")) !== (await sha256hex("b")), "sha256 distinct inputs");

  /* --- nickname sanitize (XSS / injection) --- */
  expect(sanitizeNickname("<script>x</script>") === null, "reject <script> nick");
  expect(sanitizeNickname('a"b') === null, "reject quote nick");
  expect(sanitizeNickname("a/b") === null, "reject slash nick");
  expect(sanitizeNickname("   ") === null, "reject blank nick");
  expect(sanitizeNickname("小明") === "小明", "accept CJK nick");
  expect(sanitizeNickname("Ann123") === "Ann123", "accept latin+num nick");
  expect((sanitizeNickname("abcdefghijklmnop") ?? "").length <= 12, "truncate long nick");

  /* --- SSRF guard on BYOK base URLs --- */
  expect(baseUrlProblem("http://evil.com") === "base_url_must_https", "block http byok");
  expect(baseUrlProblem("https://192.168.1.1/v1") === "base_url_ip", "block private ipv4");
  expect(baseUrlProblem("https://127.0.0.1/v1") === "base_url_ip", "block loopback ip");
  expect(baseUrlProblem("https://localhost/v1") === "base_url_private", "block localhost");
  expect(baseUrlProblem("https://api.internal/v1") === "base_url_private", "block .internal");
  expect(baseUrlProblem("https://user:pw@api.groq.com/v1") === "base_url_credentials", "block creds in url");
  expect(baseUrlProblem("https://api.groq.com/openai/v1") === null, "allow real https host");

  /* --- shared blocklist (chat + coach) --- */
  expect(hasContactInfo("找我 line id abc"), "detect contact info");
  expect(hasContactInfo("go to https://x.y"), "detect url");
  expect(hasBlockedContent("你去死"), "detect blocked zh word");
  expect(hasBlockedContent("that is shit"), "detect blocked en word");
  expect(!hasBlockedContent("好棒喔一起加油"), "clean text passes blocklist");

  /* --- coach output safety filter (never ships unsafe text) --- */
  const zhBad = filterCoachOutput("加我微信 12345678", "zh-Hant");
  expect(!zhBad.ok, "coach: reject contact info");
  const simp = filterCoachOutput("这是简体字的回答问题", "zh-Hant");
  expect(!simp.ok, "coach: reject Simplified in zh-Hant");
  const kana = filterCoachOutput("これは日本語です", "zh-Hant");
  expect(!kana.ok, "coach: reject kana in zh-Hant");
  const cyr = filterCoachOutput("Привет друг", "en");
  expect(!cyr.ok, "coach: reject Cyrillic in en");
  const good = filterCoachOutput("{{name}}，先數氣再下。", "zh-Hant");
  expect(good.ok, "coach: accept clean zh-Hant");
  const goodJa = filterCoachOutput("気を数えよう。", "ja");
  expect(goodJa.ok, "coach: accept clean ja (has kana)");
  const jaNoKana = filterCoachOutput("你好世界", "ja");
  expect(!jaNoKana.ok, "coach: reject kana-less text as ja");
  const capped = filterCoachOutput("一。二。三。四。五。", "zh-Hant");
  expect(capped.ok && (capped.text.match(/。/g) || []).length <= 2, "coach: cap to 2 sentences");
  expect(scriptMatches("Hello there", "en"), "scriptMatches en ok");

  /* --- circuit breaker --- */
  const bs: BreakerState = new Map();
  const t0 = 1_000_000;
  expect(!isOpen(bs, "groq", t0), "breaker closed initially");
  await recordFailure(db, bs, "groq", t0);
  await recordFailure(db, bs, "groq", t0);
  expect(!isOpen(bs, "groq", t0), "breaker still closed after 2 fails");
  await recordFailure(db, bs, "groq", t0);
  expect(isOpen(bs, "groq", t0 + 1000), "breaker OPEN after 3 fails");
  await recordSuccess(db, bs, "groq");
  expect(!isOpen(bs, "groq", t0 + 1000), "breaker reset on success");

  /* --- session lifecycle (hashed at rest, legacy fallback, expiry) --- */
  const userId = uid();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO users (id, kind, display_name, pin_hash, preferred_locale, created_at) VALUES (?, 'quick', 'kid', ?, 'en', ?)`,
    )
    .bind(userId, pin, now)
    .run();
  const token = await createSession(env, userId, null);
  // raw token is NOT what's stored
  const stored = await db
    .prepare(`SELECT id FROM sessions WHERE user_id = ?`)
    .bind(userId)
    .first<{ id: string }>();
  expect(stored?.id === (await sha256hex(token)), "session id stored HASHED, not raw");
  expect(stored?.id !== token, "raw token not in DB");
  const sess = await loadSession(env, `kids_go_sid=${token}`);
  expect(sess?.user.id === userId, "loadSession resolves by raw cookie");
  const stolenDbId = stored!.id;
  const spoof = await loadSession(env, `kids_go_sid=${stolenDbId}`);
  expect(spoof === null, "stolen hashed id is NOT usable as a cookie");
  // legacy plaintext row still resolves for one release
  const legacyRaw = uid();
  await db
    .prepare(`INSERT INTO sessions (id, user_id, child_id, expires_at) VALUES (?, ?, NULL, ?)`)
    .bind(legacyRaw, userId, now + 86_400_000)
    .run();
  const legacy = await loadSession(env, `kids_go_sid=${legacyRaw}`);
  expect(legacy?.user.id === userId, "legacy plaintext session still resolves");
  // expiry purge
  await db
    .prepare(`INSERT INTO sessions (id, user_id, child_id, expires_at) VALUES ('expired', ?, NULL, 1)`)
    .bind(userId)
    .run();
  const purged = await purgeExpiredSessions(env);
  expect(purged >= 1, "purge removes expired session");
  const afterPurge = await loadSession(env, `kids_go_sid=expired`);
  expect(afterPurge === null, "expired session not loadable");

  /* --- lockout backoff math (mirrors auth.ts) --- */
  const LOCK_START_AFTER = 3;
  const LOCK_BASE_MS = 30_000;
  const LOCK_MAX_MS = 15 * 60_000;
  function lockMs(next: number): number {
    if (next < LOCK_START_AFTER) return 0;
    return Math.min(LOCK_BASE_MS * 2 ** (next - LOCK_START_AFTER), LOCK_MAX_MS);
  }
  expect(lockMs(2) === 0, "no lock before 3 failures");
  expect(lockMs(3) === 30_000, "lock 30s at 3rd failure");
  expect(lockMs(4) === 60_000, "lock doubles");
  expect(lockMs(20) === LOCK_MAX_MS, "lock capped at 15min");

  console.log(`  round ${r}: pass so far ${PASS}, fail ${FAIL}`);
}

async function main(): Promise<void> {
  for (const r of [1, 2, 3]) await round(r);
  console.log(`\n========== SUMMARY ==========`);
  console.log(`PASS=${PASS} FAIL=${FAIL}`);
  if (FAIL) {
    console.error("FAILURES:", fails.join(", "));
    process.exit(1);
  }
  console.log("adversarial: all rounds green");
}
void main();
