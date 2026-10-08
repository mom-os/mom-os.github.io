// Fonts beyond the 4 defaults are cached at runtime the first time they're used.
// App-shell service worker: network-first for shell so Account/auth fixes land quickly;
// cache fallback keeps the iPhone home-screen app offline-capable.
const VERSION = 'momos-v0.4.9';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/views/account.js', './js/sync/engine.js', './js/sync/merge.js', './js/sync/client.js', './js/vendor/supabase.js', './js/vendor/uqr.js', './js/config.js', './js/store.js', './js/seed.js', './js/dates.js', './js/util.js', './js/ui.js',
  './js/templates.js',
  './js/style/engine.js', './js/style/looks.js', './js/style/presets.js', './js/style/fonts.js', './js/style/stickers.js', './js/style/sticker-picker.js',
  './js/views/month.js', './js/views/day.js', './js/views/myday.js', './js/views/studio.js', './js/views/export.js', './js/views/shared.js',
  './js/calendar/events.js', './js/calendar/ics.js', './js/calendar/providers.js',
  './fonts/Quicksand.woff', './fonts/JosefinSans.woff', './fonts/Sacramento-Regular.woff', './fonts/CormorantGaramond.woff',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  const isShellDoc = req.mode === 'navigate' || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('sw.js');
  if (isShellDoc) {
    // Network-first so auth/Account fixes appear after refresh
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
