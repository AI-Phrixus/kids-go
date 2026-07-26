/**
 * SSRF guard for BYOK base URLs (v0.8.0): https only, no credentials in the
 * URL, no IP-literal hosts, no localhost/internal-suffix hosts. (DNS-level
 * rebinding is out of scope on Workers Free — this blocks the practical
 * "point my coach at an internal service" cases.)
 * Extracted from routes/settings.ts so it can be unit-tested without importing
 * hono.
 */
export function baseUrlProblem(raw: string): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "base_url_invalid";
  }
  if (u.protocol !== "https:") return "base_url_must_https";
  if (u.username || u.password) return "base_url_credentials";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "base_url_private";
  if (/\.(local|internal|lan|home|corp)$/.test(host)) return "base_url_private";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "base_url_ip"; // IPv4 literal
  if (host.includes(":") || host.startsWith("[")) return "base_url_ip"; // IPv6 literal
  return null;
}
