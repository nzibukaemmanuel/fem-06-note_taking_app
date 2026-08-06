// service-worker.js
// Minimal offline support (bonus): caches the app shell on install, then
// serves from cache first and falls back to the network, so the notes app
// (and its data, which lives in localStorage — untouched by this file)
// still opens with no connection.

const CACHE_NAME = 'notes-app-shell-v1';
const APP_SHELL = [
  'index.html',
  'styles.css',
  'storage.js',
  'noteManager.js',
  'ui.js',
  'themes.js',
  'main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Never intercept cross-origin requests (Google Fonts, reverse-geocoding API).
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
