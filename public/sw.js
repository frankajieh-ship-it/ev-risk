// Cache key is replaced at deploy time by scripts/inject-sw-version.mjs
// with the git commit hash (e.g. "offo-abc1234"). This ensures every deploy
// invalidates the old cache across all user browsers automatically.
const CACHE = "offo-__DEPLOY_ID__";
const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Delete ALL caches that don't match current CACHE key —
  // this cleans up every prior deploy's cache on every browser automatically.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Never intercept API calls, auth flows, or non-GET requests
  const url = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request).then((res) => {
        // Only cache immutable static chunks — never page HTML.
        // /_next/static/ files have content hashes in their filenames,
        // so cached copies are always valid for their lifetime.
        if (res.ok && url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      // Serve cached static chunks immediately; everything else goes to network.
      if (cached && url.pathname.startsWith("/_next/static/")) {
        return cached;
      }
      return networkFetch;
    })
  );
});
