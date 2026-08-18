const CACHE_NAME = "churchadmin-shell-v2";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/api/pwa/icon?size=192", "/api/pwa/icon?size=512"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/pwa/icon")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response; })));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/check-in/")) {
    if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image/")) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
