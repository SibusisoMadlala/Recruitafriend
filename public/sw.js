const CACHE = 'rf-v6';
const SHELL = ['/', '/offline.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/functions/') || url.pathname.startsWith('/rest/')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Push notification handler ──────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch {}

  const title = data.title || 'RecruitFriend';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    tag: data.tag || 'rf-notification',
    renotify: true,
    data: { url: data.url || '/' },
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — open/focus the app ────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if ('clearAppBadge' in self.registration) self.registration.clearAppBadge?.().catch(() => {});
  const target = e.notification.data?.url || '/';

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((cs) => {
        const existing = cs.find((c) => c.url.endsWith(target) || c.url === self.location.origin + target);
        if (existing) return existing.focus();
        return clients.openWindow(target);
      })
  );
});
