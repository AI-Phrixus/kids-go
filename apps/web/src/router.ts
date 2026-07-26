import { state, type Route } from "./state";
import { onNavigate } from "./shell";

/**
 * v0.8.0 router: pushState + a real popstate handler that renders the route
 * from history state (v0.7 pushed states but Back always dumped you on the
 * map or desynced the URL).
 */

type Renderer = () => void | Promise<void>;

const routes = new Map<Route, Renderer>();

export function registerRoute(route: Route, render: Renderer): void {
  routes.set(route, render);
}

export function renderCurrent(): void {
  const r = routes.get(state.route) ?? routes.get("welcome")!;
  void r();
}

export function navigate(route: Route, opts: { push?: boolean } = {}): void {
  state.route = route;
  if (opts.push !== false) {
    try {
      history.pushState({ route, lessonId: state.lessonId }, "", route === "welcome" ? "/" : `#${route}`);
    } catch {
      /* ignore */
    }
  }
  renderCurrent();
}

export function initRouter(): void {
  onNavigate((r) => navigate(r as Route));
  window.addEventListener("popstate", (e) => {
    const st = (e.state ?? null) as { route?: Route; lessonId?: string } | null;
    let target: Route = st?.route ?? routeFromHash();
    // Guests can only see welcome/help/privacy.
    if (!state.nickname && target !== "help" && target !== "privacy") target = "welcome";
    // A lesson can only re-open if its data is still loaded.
    if (target === "lesson" && !state.lesson) target = "map";
    state.route = target;
    renderCurrent();
  });
}

function routeFromHash(): Route {
  const h = location.hash.replace(/^#/, "") as Route;
  const known: Route[] = ["welcome", "map", "lesson", "free", "settings", "parent", "privacy", "help"];
  return known.includes(h) ? h : state.nickname ? "map" : "welcome";
}
