// Service worker for Candy Sort — enables offline play.
// Caches the app shell (HTML, manifest, icons) so the game loads and
// runs without a network connection. Firebase calls (leaderboard,
// reactions) will simply fail gracefully offline; the game itself
// (spawning, sorting, scoring, lives) keeps working from cache.

const CACHE_NAME = "candy-sort-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for Firebase/API calls (so scores/reactions stay live when
// online), cache-first for everything else (app shell, fonts, icons).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isFirebase = url.hostname.includes("googleapis.com") ||
                      url.hostname.includes("firebaseio.com") ||
                      url.hostname.includes("gstatic.com") && url.pathname.includes("firebasejs");

  if (isFirebase) {
    // Let these go straight to the network; don't try to cache live data.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Only cache plain, complete, successful GET responses.
          // Partial responses (status 206, e.g. range requests for fonts/
          // media) and opaque/redirected responses can't be stored via
          // cache.put and would throw if we tried.
          const cacheable = event.request.method === "GET" &&
                             response.status === 200 &&
                             response.type === "basic" &&
                             url.origin === self.location.origin;
          if (cacheable) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});