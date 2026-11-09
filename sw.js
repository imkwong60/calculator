/* multi-calc Service Worker — 完整預快取，可靠離線 */
const CACHE = 'multi-calc-v9';
const CACHE_PREFIX = 'multi-calc-';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './tailwind-built.css',
  './lucide.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function isNavigation(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    let response;
    try {
      response = await fetch(request);
    } catch (_) {
      if (isNavigation(request)) {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
        return new Response(
          '<!DOCTYPE html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>離線</title><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>目前離線</h1><p>請先在有網路時開啟此計數機，完成離線資源快取。</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    if (response.status === 200 && response.type === 'basic') {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('Unable to cache response for offline use:', request.url, error);
      }
    }
    return response;
  })());
});
