import app from "./index";
import type { Env } from "./types";

export interface WorkerEnv extends Env {
  ASSETS?: Fetcher;
}

const SECURITY: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-XSS-Protection": "0",
};

function withSecurity(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  // SPA HTML: allow same-origin only
  if ((headers.get("content-type") || "").includes("text/html")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'",
    );
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return withSecurity(await app.fetch(request, env, ctx));
    }
    if (env.ASSETS) {
      let res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        res = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
      }
      return withSecurity(res);
    }
    return withSecurity(await app.fetch(request, env, ctx));
  },
};
