import { api } from "../api";
import { friendlyError } from "../errors";
import { t } from "../i18n";
import { mascotSvg } from "../mascot";
import { navigate } from "../router";
import { setScreen } from "../shell";
import { state } from "../state";

function errMsg(e: unknown): string {
  const code = e instanceof Error ? e.message : String(e);
  return friendlyError(code, state.locale);
}

function showErr(msg: string): void {
  const el = document.querySelector("#err");
  if (el) el.textContent = msg;
}

function bindEnterSubmit(root: HTMLElement, btnId: string): void {
  root.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        (root.querySelector(`#${btnId}`) as HTMLButtonElement | null)?.click();
      }
    });
  });
}

export function renderWelcome(): void {
  const L = state.locale;
  const screen = setScreen(`
    <div class="card welcome-hero fade-in">
      <div class="welcome-glow" aria-hidden="true"></div>
      <div class="hero-row">${mascotSvg("idle")}
        <div>
          <h2>${t(L, "welcome")}</h2>
          <p class="muted">${t(L, "welcome_tag")}</p>
          <p class="welcome-magic muted">✦ ☁️ 🌿 ✨</p>
        </div>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="quick" class="${state.authTab === "quick" ? "on" : ""}" role="tab">${t(L, "quick_reg")}</button>
        <button data-tab="parent" class="${state.authTab === "parent" ? "on" : ""}" role="tab">${t(L, "parent_reg")}</button>
        <button data-tab="login" class="${state.authTab === "login" ? "on" : ""}" role="tab">${t(L, "login")}</button>
      </div>
      <div id="auth-form"></div>
      <p class="err" id="err" role="alert"></p>
      <p class="muted" style="margin-top:0.75rem">
        <a href="#" id="welcome-guide">${t(L, "guide")}</a>
      </p>
    </div>
  `);

  screen.querySelector("#welcome-guide")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate("help");
  });
  screen.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      state.authTab = (b as HTMLElement).dataset.tab as typeof state.authTab;
      renderWelcome();
    }),
  );

  const form = screen.querySelector("#auth-form")!;
  const enterMap = async () => {
    navigate("map");
  };

  if (state.authTab === "quick") {
    form.innerHTML = `
      <label>${t(L, "nickname")}<input id="nick" maxlength="12" autocomplete="username" /></label>
      <label>${t(L, "pin")}<input id="pin" inputmode="numeric" maxlength="6" autocomplete="current-password" /></label>
      <button class="primary" id="go">${t(L, "start")}</button>
    `;
    form.querySelector("#go")!.addEventListener("click", async () => {
      const btn = form.querySelector("#go") as HTMLButtonElement;
      btn.disabled = true;
      try {
        const nick = (form.querySelector("#nick") as HTMLInputElement).value.trim();
        const pin = (form.querySelector("#pin") as HTMLInputElement).value.trim();
        if (!nick || /[<>&`"\\/]/.test(nick) || !/^\d{4,6}$/.test(pin)) {
          showErr(friendlyError("invalid_input", L));
          btn.disabled = false;
          return;
        }
        await api.registerQuick({ nickname: nick, pin, locale: L });
        state.nickname = nick;
        void enterMap();
      } catch (e) {
        showErr(errMsg(e));
        btn.disabled = false;
      }
    });
    bindEnterSubmit(screen, "go");
  } else if (state.authTab === "parent") {
    form.innerHTML = `
      <label>${t(L, "email")}<input id="email" type="email" autocomplete="email" /></label>
      <label>${t(L, "password")}<input id="pass" type="password" autocomplete="new-password" /></label>
      <label>${t(L, "nickname")}<input id="nick" maxlength="12" /></label>
      <button class="primary" id="go">${t(L, "start")}</button>
    `;
    form.querySelector("#go")!.addEventListener("click", async () => {
      const btn = form.querySelector("#go") as HTMLButtonElement;
      btn.disabled = true;
      try {
        const email = (form.querySelector("#email") as HTMLInputElement).value.trim();
        const password = (form.querySelector("#pass") as HTMLInputElement).value;
        const nick = (form.querySelector("#nick") as HTMLInputElement).value.trim();
        await api.registerParent({ email, password, childNickname: nick, locale: L });
        state.nickname = nick;
        void enterMap();
      } catch (e) {
        showErr(errMsg(e));
        btn.disabled = false;
      }
    });
    bindEnterSubmit(screen, "go");
  } else {
    form.innerHTML = `
      <p class="muted">${t(L, "login_hint")}</p>
      <label>${t(L, "nickname")} / ${t(L, "email")}<input id="id" autocomplete="username" /></label>
      <label>${t(L, "pin")} / ${t(L, "password")}<input id="secret" type="password" autocomplete="current-password" /></label>
      <div class="row">
        <button id="lq">${t(L, "quick_reg")} ${t(L, "login")}</button>
        <button id="lp">${t(L, "parent_reg")} ${t(L, "login")}</button>
      </div>
    `;
    form.querySelector("#lq")!.addEventListener("click", async () => {
      try {
        const id = (form.querySelector("#id") as HTMLInputElement).value.trim();
        const secret = (form.querySelector("#secret") as HTMLInputElement).value;
        await api.loginQuick(id, secret);
        const me = await api.me();
        state.nickname = me.child?.nickname || id;
        void enterMap();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
    form.querySelector("#lp")!.addEventListener("click", async () => {
      try {
        const id = (form.querySelector("#id") as HTMLInputElement).value.trim();
        const secret = (form.querySelector("#secret") as HTMLInputElement).value;
        await api.loginParent(id, secret);
        const me = await api.me();
        state.nickname = me.child?.nickname || "";
        void enterMap();
      } catch (e) {
        showErr(errMsg(e));
      }
    });
    bindEnterSubmit(screen, "lq");
  }
}
