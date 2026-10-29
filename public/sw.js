/* Offline support. Plain service worker, no build step.
 *  - App shell + hashed /assets/*: cache-first (filenames change when content changes)
 *  - index.html (navigations): stale-while-revalidate for instant startup with background update
 *  - Quran text/tafsir API (api.alquran.cloud): network-first, cached copy when offline
 *  - Audio is NOT cached (range requests, large) */
const VERSION = 'v3';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const API = `api-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/quran-icon.svg', '/manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const networkFetch = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);

  return hit || networkFetch;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(staleWhileRevalidate(new Request('/'), SHELL));
    } else if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, RUNTIME));
    }
    return;
  }

  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(networkFirst(request, API));
  }
});
