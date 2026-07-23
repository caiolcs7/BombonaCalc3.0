const CACHE = 'bombonacalc-v4.0.1';
const APP_SHELL = [
  '/', '/index.html', '/style.css', '/manifest.json', '/assets/logo-bombonacalc.png',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png',
  '/js/app.js', '/js/api.js', '/js/calculator.js', '/js/dom.js', '/js/formatters.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/index.html')))
  );
});
