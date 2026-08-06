import { isSafeAiBaseUrl, mergeAiConfig } from "./ai-config";
import { staticCoachStatusMessage } from "./coach/quota";
import { buildEffectiveEnv } from "./coach/service";
import { sanitizeNickname } from "./sanitize";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const url of [
  "https://api.openai.com/v1",
  "https://openrouter.ai/api/v1",
  "https://api.example.com:8443/v1",
]) {
  assert(isSafeAiBaseUrl(url), `expected safe AI URL: ${url}`);
}

for (const url of [
  "http://api.example.com/v1",
  "https://localhost/v1",
  "https://localhost./v1",
  "https://127.0.0.1/v1",
  "https://2130706433/v1",
  "https://10.0.0.1/v1",
  "https://169.254.169.254/latest/meta-data",
  "https://192.168.1.1/v1",
  "https://[::1]/v1",
  "https://[fd00::1]/v1",
  "https://user:pass@example.com/v1",
  "https://api.example.com/v1?redirect=https://127.0.0.1",
]) {
  assert(!isSafeAiBaseUrl(url), `expected blocked AI URL: ${url}`);
}

assert(sanitizeNickname("悟空 7") === "悟空 7", "valid nickname rejected");
assert(sanitizeNickname("<script>") === null, "markup nickname accepted");
assert(staticCoachStatusMessage("ja").includes("外部AI"), "Japanese static status missing");
assert(staticCoachStatusMessage("zh-Hant").includes("本機"), "Chinese static status missing");
assert(!buildEffectiveEnv({}).freeFirst, "coach chain must default to Cloudflare first");
assert(
  buildEffectiveEnv({ COACH_CHAIN_MODE: "free_first" }).freeFirst,
  "explicit free_first mode ignored",
);
const changedDestination = mergeAiConfig(
  {
    provider: "openai_compatible",
    baseUrl: "https://api.example.com/v1",
    apiKey: "secret",
    model: "old",
    preferByok: true,
  },
  { baseUrl: "https://api.other.example/v1" },
);
assert(changedDestination.apiKey === "", "API key survived a destination change");

console.log("security.test.ts: all passed");
