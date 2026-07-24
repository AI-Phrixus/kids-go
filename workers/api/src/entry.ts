import app from "./index";
import type { Env } from "./types";

export interface WorkerEnv extends Env {
  ASSETS?: Fetcher;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request, env, ctx);
    }
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
      // SPA fallback
      return env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    }
    return app.fetch(request, env, ctx);
  },
};
