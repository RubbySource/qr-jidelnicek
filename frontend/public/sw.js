// Service worker for QR Jidelnicek public menu — offline-first for menu pages.
// Strategy:
//   - GET /api/menu/:slug → stale-while-revalidate (instant load, fresh in background)
//   - SPA shell (HTML, JS, CSS) → cache-first with network fallback
//   - Other requests → network-first, no caching
// Bumping CACHE_VERSION wipes old caches.

const CACHE_VERSION = 'v1';
const CACHE_NAME = `qrj-${CACHE_VERSION}`;
const MENU_API_RE = /\/api\/menu\/[^/?]+/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Don't cache admin/auth/billing/QR — these need fresh data.
  if (
    url.pathname.startsWith('/api/admin') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/billing') ||
    url.pathname.startsWith('/api/stripe') ||
    url.pathname.startsWith('/api/qr') ||
    url.pathname === '/api/health'
  ) {
    return;
  }

  // Public menu API: stale-while-revalidate.
  if (MENU_API_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Static assets (everything else under same origin) — cache-first.
  event.respondWith(cacheFirst(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || (await networkPromise) || new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    // Last-resort offline fallback for HTML navigations.
    if (request.mode === 'navigate') {
      const indexHtml = await cache.match('/');
      if (indexHtml) return indexHtml;
    }
    return new Response('Offline', { status: 503 });
  }
}
