// My Work Planner — Service Worker (App Shell & Web Push Notifications)
// Handles static shell metadata caching and background Web Push notifications.
// Never caches private Supabase data or auth sessions.

const CACHE_NAME = 'mwp-shell-v2';
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icon.svg'];

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API calls, Supabase endpoints, or cross-origin private data
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first strategy for navigation & static assets so users get fresh builds
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
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
