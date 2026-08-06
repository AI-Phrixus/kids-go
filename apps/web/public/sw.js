/* Kids Igo — lightweight offline shell (static assets only) */
const CACHE = "kids-go-v0.7.7";
const PRECACHE = ["/", "/favicon.svg", "/manifest.webmanifest"];

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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // Never cache API
  if (url.pathname.startsWith("/api")) return;

  // Navigations are network-first so a returning family sees a newly deployed
  // lesson or fix immediately. The cached shell remains the offline fallback.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put("/", clone));
          }
          return res;
        })
        .catch(async () =>
          (await caches.match("/")) ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok && (url.origin === self.location.origin)) {
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
