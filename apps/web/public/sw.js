/* Kids Igo — lightweight offline shell (static assets only).
 * v0.8.0: CACHE version is synced from package.json by scripts/sync-version.mjs
 * (it was stuck at v0.6.0, pinning returning users to an old shell), and HTML/
 * navigation requests are network-first so releases actually reach players. */
const CACHE = "kids-go-v0.8.0";
const PRECACHE = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isNavigation(request, url) {
  return (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // Never cache API
  if (url.pathname.startsWith("/api")) return;
  if (url.origin !== self.location.origin) return;

  if (isNavigation(event.request, url)) {
    // Network-first for the app shell: always try to get the newest release.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Hashed static assets: cache-first with background revalidate.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match("/"));
      return cached || network;
    }),
  );
});
