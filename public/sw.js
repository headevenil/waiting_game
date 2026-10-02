// Precache + offline. Cache-first for everything; a new version waits until someone taps 업데이트.
const VERSION = 'wg-2026-10-03a';            // bump on every deploy
const FILES = [
  '/', '/index.html', '/manifest.webmanifest',
  '/css/tokens.css', '/css/base.css', '/css/components.css', '/css/games.css',
  '/content/words.ko.json', '/content/spectrums.ko.json', '/content/scales.ko.json',
  '/fonts/dohyeon-sub.woff2',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon-180.png',
  '/js/app.js', '/js/store.js', '/js/rng.js', '/js/content.js',
  '/js/i18n/ko.js', '/js/i18n/josa.js', '/js/i18n/norm.js',
  '/js/ui/h.js', '/js/ui/gate.js', '/js/ui/hold.js', '/js/ui/caption.js', '/js/ui/timer.js', '/js/ui/vote.js',
  '/js/ui/sorter.js', '/js/ui/dial.js', '/js/ui/koinput.js', '/js/ui/scoreboard.js',
  '/js/ui/sheet.js', '/js/ui/haptics.js', '/js/ui/wakelock.js',
  '/js/screens/home.js', '/js/screens/roster.js', '/js/screens/rules.js', '/js/screens/session.js', '/js/screens/settings.js',
  '/js/games/registry.js', '/js/games/common.js',
  '/js/games/liar.js', '/js/games/dial.js', '/js/games/scale10.js',
  '/js/games/fading.js', '/js/games/twenty.js', '/js/games/kkwang.js',
];

self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(VERSION)                                       // no skipWaiting here
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))));  // bypass the HTTP cache

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then((hit) => hit || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('/') : Response.error())));
});

// 업데이트 tap → SKIP_WAITING. STATUS → reply whether every file is cached (오프라인 준비 완료 badge).
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'STATUS') {
    e.waitUntil(caches.open(VERSION)
      .then((c) => Promise.all(FILES.map((f) => c.match(f))))
      .then((hits) => e.source?.postMessage({ type: 'STATUS', version: VERSION, ready: hits.every(Boolean) })));
  }
});
