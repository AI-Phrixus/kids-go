import { api } from "../api";
import { friendlyError } from "../errors";
import { t } from "../i18n";
import { navigate } from "../router";
import { escapeHtml, setScreen } from "../shell";
import { state } from "../state";

function errMsg(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e), state.locale);
}

export async function renderSettings(): Promise<void> {
  const L = state.locale;
  setScreen(`<div class="card"><p class="muted">${t(L, "loading")}</p></div>`);
  let body: string;
  try {
    const data = await api.getAiSettings();
    const c = data.config;
    const hint = L === "zh-Hant" ? data.hints.zhHant : L === "ja" ? data.hints.ja : data.hints.en;
    const presets = data.presets
      .map(
        (p) =>
          `<option value="${p.id}" data-url="${escapeHtml(p.baseUrl)}" data-model="${escapeHtml(p.model)}" data-provider="${escapeHtml(p.provider)}">${escapeHtml(p.label)}</option>`,
      )
      .join("");
    body = `
      <p class="muted">${escapeHtml(hint || "")}</p>
      <label>${t(L, "preset")}
        <select id="preset"><option value="">—</option>${presets}</select>
      </label>
      <label>${t(L, "provider")}
        <select id="provider">
          <option value="auto" ${c.provider === "auto" ? "selected" : ""}>auto</option>
          <option value="openai_compatible" ${c.provider === "openai_compatible" ? "selected" : ""}>openai_compatible</option>
          <option value="xai" ${c.provider === "xai" ? "selected" : ""}>xai</option>
          <option value="google" ${c.provider === "google" ? "selected" : ""}>google</option>
          <option value="workers_ai" ${c.provider === "workers_ai" ? "selected" : ""}>workers_ai only</option>
          <option value="none" ${c.provider === "none" ? "selected" : ""}>none</option>
        </select>
      </label>
      <label>${t(L, "base_url")}
        <input id="baseUrl" type="url" placeholder="https://api.groq.com/openai/v1" value="${escapeHtml(c.baseUrl)}" />
      </label>
      <label>${t(L, "api_key")}
        <input id="apiKey" type="password" autocomplete="off" placeholder="${escapeHtml(c.apiKeyHint || "sk-…")}" />
      </label>
      <label>${t(L, "model")}
        <input id="model" value="${escapeHtml(c.model)}" />
      </label>
      <label class="check">
        <input type="checkbox" id="preferByok" ${c.preferByok ? "checked" : ""} />
        ${t(L, "prefer_byok")}
      </label>
      <label>${t(L, "cred_label")}
        <input id="credential" type="password" autocomplete="current-password" />
      </label>
      <p class="muted">${t(L, "cred_required")}</p>
      <div class="row">
        <button class="primary" id="saveAi">${t(L, "save")}</button>
        <button id="testAi">${t(L, "test_ai")}</button>
        <button id="clearKey">${t(L, "clear_key")}</button>
        <button id="home">${t(L, "home")}</button>
      </div>
      <p class="err" id="setMsg" role="status"></p>
    `;
  } catch (e) {
    body = `<p class="err">${escapeHtml(errMsg(e))}</p>
      <button id="home">${t(L, "home")}</button>`;
  }

  if (state.route !== "settings") return;
  const screen = setScreen(`
    <div class="card">
      <h2>${t(L, "settings_title")}</h2>
      ${body}
    </div>
  `);

  const $ = <T extends HTMLElement>(sel: string) => screen.querySelector<T>(sel);
  $("#home")?.addEventListener("click", () => navigate("map"));
  $("#preset")?.addEventListener("change", (e) => {
    const opt = (e.target as HTMLSelectElement).selectedOptions[0];
    if (!opt || !opt.value) return;
    ($("#baseUrl") as HTMLInputElement | null)!.value = opt.dataset.url || "";
    ($("#model") as HTMLInputElement | null)!.value = opt.dataset.model || "";
    ($("#provider") as HTMLSelectElement | null)!.value = opt.dataset.provider || "openai_compatible";
  });
  const credential = () => ($("#credential") as HTMLInputElement | null)?.value || "";
  const setMsg = (msg: string) => {
    const el = $("#setMsg");
    if (el) el.textContent = msg;
  };
  $("#saveAi")?.addEventListener("click", async () => {
    try {
      await api.saveAiSettings({
        provider: ($("#provider") as HTMLSelectElement).value,
        baseUrl: ($("#baseUrl") as HTMLInputElement).value.trim(),
        apiKey: ($("#apiKey") as HTMLInputElement).value,
        model: ($("#model") as HTMLInputElement).value.trim(),
        preferByok: ($("#preferByok") as HTMLInputElement).checked,
        credential: credential(),
      });
      setMsg(t(L, "saved"));
      const k = $("#apiKey") as HTMLInputElement | null;
      if (k) k.value = "";
    } catch (err) {
      setMsg(errMsg(err));
    }
  });
  $("#clearKey")?.addEventListener("click", async () => {
    try {
      await api.saveAiSettings({ clearApiKey: true, credential: credential() });
      setMsg(t(L, "saved"));
    } catch (err) {
      setMsg(errMsg(err));
    }
  });
  $("#testAi")?.addEventListener("click", async () => {
    setMsg(t(L, "testing"));
    try {
      const key = ($("#apiKey") as HTMLInputElement | null)?.value;
      if (key) {
        await api.saveAiSettings({
          provider: ($("#provider") as HTMLSelectElement).value,
          baseUrl: ($("#baseUrl") as HTMLInputElement).value.trim(),
          apiKey: key,
          model: ($("#model") as HTMLInputElement).value.trim(),
          preferByok: ($("#preferByok") as HTMLInputElement).checked,
          credential: credential(),
        });
      }
      const r = await api.testAiSettings(credential());
      setMsg(r.ok ? `OK: ${r.sample || "ok"}` : r.error || "fail");
    } catch (err) {
      setMsg(errMsg(err));
    }
  });
}
