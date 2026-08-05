const CACHE_NAME = 'cryptocall-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js'
];

// Install the service worker and cache the app
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Serve cached files when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});