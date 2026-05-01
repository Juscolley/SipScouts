const CACHE_NAME = 'morning-kiss-v1';
const ASSETS = [
  '/',
  '/static/manifest.json',
  '/static/images/card_icon.png',
  '/static/images/vibrant_sunrise.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
