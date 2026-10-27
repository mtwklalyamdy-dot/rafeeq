const SHELL = 'rafeeq-shell-v1';
const FILES = 'rafeeq-offline-files-v1';
const SHELL_URLS = ['/offline', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_URLS))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/files/')) {
    event.respondWith(caches.open(FILES).then(async cache => {
      const cached = await cache.match(event.request);
      if (!self.navigator.onLine && cached) return cached;
      try { const fresh = await fetch(event.request); if (fresh.ok && event.request.headers.get('X-Rafeeq-Offline') === 'save') await cache.put(event.request, fresh.clone()); return fresh; }
      catch { return cached || new Response(JSON.stringify({error:'الملف غير محفوظ دون إنترنت'}), {status:503,headers:{'Content-Type':'application/json'}}); }
    }));
    return;
  }
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_FILE') event.waitUntil(caches.open(FILES).then(async cache => { const req = new Request(event.data.url, {headers:{'X-Rafeeq-Offline':'save'}}); const response = await fetch(req); if (!response.ok) throw new Error('download failed'); await cache.put(event.data.url, response); }));
  if (event.data?.type === 'REMOVE_FILE') event.waitUntil(caches.open(FILES).then(cache => cache.delete(event.data.url)));
});

// Native background push notification handlers
self.addEventListener('push', event => {
  let data = { title: 'تطبيق رفيقي الأكاديمي', body: 'تنبيه أكاديمي جديد متوفر!' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) {
      data = { title: 'تطبيق رفيقي', body: event.data.text() };
    }
  }
  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    dir: 'rtl',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/dashboard' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/dashboard';
      for (const client of clientList) {
        const clientUrl = new URL(client.url).pathname;
        if (clientUrl === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
