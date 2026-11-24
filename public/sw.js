// My Work Planner — Service Worker (App Shell & Web Push Notifications)
// Handles static shell metadata caching, resilient offline support, and background Web Push notifications.
// Never caches private Supabase data or auth sessions.

const CACHE_NAME = 'mwp-shell-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API calls, Supabase endpoints, or cross-origin private data
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // 1. Navigation requests (HTML documents): Network-first with cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // 2. Static bundled assets (/assets/*): Cache-first with network fallback and caching
  // CRITICAL: Never fall back to index.html for JS/CSS assets, as that causes syntax errors.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          });
      })
    );
    return;
  }

  // 3. Other static shell resources (manifest, icons): Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ==============================================================================
// Push Notifications
// ==============================================================================

self.addEventListener('push', (event) => {
  let data = {
    title: 'My Work Planner',
    body: 'You have a scheduled task coming up.',
    tag: 'mwp-task-reminder',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || data.body,
        tag: parsed.tag || data.tag,
        data: parsed.data || data.data,
      };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: data.tag,
    data: data.data,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, notificationOptions));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const fullTargetUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing app window and navigate if open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) {
              client.navigate(fullTargetUrl);
            }
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullTargetUrl);
        }
      })
  );
});

self.addEventListener('notificationclose', () => {
  // Gracefully handle notification dismissals
});
