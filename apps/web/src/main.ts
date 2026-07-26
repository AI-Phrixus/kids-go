import { api } from "./api";
import { initRouter, navigate, registerRoute, renderCurrent } from "./router";
import { initShell } from "./shell";
import { state } from "./state";
import { renderWelcome } from "./screens/welcome";
import { renderMap } from "./screens/map";
import { renderLesson } from "./screens/lesson";
import { renderFree } from "./screens/free";
import { renderSettings } from "./screens/settings";
import { renderHelp, renderParent, renderPrivacy } from "./screens/misc";

/**
 * v0.8.0: main.ts is boot-only. The 2,341-line v0.7 monolith now lives in:
 *   state.ts (app state) · shell.ts (persistent chrome + eye care)
 *   router.ts (history/popstate) · screens/* (one module per screen)
 *   board/view.ts (SVG board) · battle/runtime.ts (battle rules & stars)
 *   friends.ts (friends modal + chat) · coach.ts (hint helper)
 */

registerRoute("welcome", renderWelcome);
registerRoute("map", renderMap);
registerRoute("lesson", renderLesson);
registerRoute("free", renderFree);
registerRoute("settings", renderSettings);
registerRoute("parent", renderParent);
registerRoute("privacy", renderPrivacy);
registerRoute("help", renderHelp);

async function boot(): Promise<void> {
  document.documentElement.lang = state.locale === "zh-Hant" ? "zh-Hant" : state.locale;
  initShell();
  initRouter();
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
  try {
    const me = await api.me();
    state.nickname = me.child?.nickname || "";
    if (me.child?.preferred_locale) {
      state.locale = me.child.preferred_locale as typeof state.locale;
      document.documentElement.lang = state.locale === "zh-Hant" ? "zh-Hant" : state.locale;
    }
    state.route = "map";
    void api.track("session_start");
  } catch {
    state.route = "welcome";
  }
  renderCurrent();
}

void boot();
void navigate; // re-exported entry for debugging in dev tools
