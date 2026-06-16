const CACHE = "offo-v2";
const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
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
        // Only cache same-origin static assets (/_next/static/) — never cache pages/HTML
        // so users always get the latest app on the next visit.
        if (res.ok && url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      // For static assets: serve cache immediately, update in background
      // For everything else (pages, API): always go to network
      if (cached && url.pathname.startsWith("/_next/static/")) {
        return cached;
      }
      return networkFetch;
    })
  );
});
