/* multi-calc Service Worker v5 — 本機 UI，可靠離線 */
const CACHE = 'multi-calc-v5';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './tailwind-built.css',
  './lucide.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

async function cacheOne(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && res.ok) {
      await cache.put(url, res);
      return true;
    }
  } catch (_) {}
  return false;
}

function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(CORE.map((u) => cacheOne(cache, u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        networkPromise.catch(() => {});
        return cached;
      }
      const net = await networkPromise;
      if (net) return net;

      if (isNavigation(req)) {
        return (
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          new Response(
            '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>離線</h1><p>請先在有網路時開啟一次完成快取。</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        );
      }
      return new Response('Offline', { status: 503 });
    })()
  );
});
