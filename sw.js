/**
 * KEJAKSAN SMART - Service Worker Paket 2
 * Fixed for Vercel + Web2App APK
 * Features: Cache-first, offline fallback, background sync, FCM, prayer notif
 */

const CACHE_NAME = 'kejaksan-smart-v3-paket2';
const OFFLINE_URL = '/offline.html';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/firebase.js',
  '/js/auth-phone.js',
  '/js/pwa.js',
  '/js/app.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// IndexedDB helper for prayer & offline queue
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('KejaksanSmartSW', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline-queue')) db.createObjectStore('offline-queue', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('prayer')) db.createObjectStore('prayer');
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

self.addEventListener('install', event => {
  console.log('[SW] Install Paket 2');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS.map(u => new Request(u, { cache: 'reload' }))).catch(err => {
        console.warn('[SW] Core cache partial fail', err);
        return cache.addAll(['/','/index.html','/manifest.json']);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    console.log('[SW] Activated Paket 2');
  })());
});

// Network-first for API, Cache-first for assets
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and chrome extensions
  if (req.method !== 'GET') return;
  if (url.protocol.startsWith('chrome')) return;

  // Firebase, Open-Meteo, Aladhan, Nominatim -> Network first with cache fallback
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('open-meteo') || 
      url.hostname.includes('aladhan') ||
      url.hostname.includes('openstreetmap') ||
      url.hostname.includes('tile.openstreetmap')) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // All other -> Cache first, then network, then offline page for navigation
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Cache successful basic responses
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('/index.html') || caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Background Sync for laporan offline
self.addEventListener('sync', event => {
  if (event.tag === 'sync-laporan') {
    console.log('[SW] Sync laporan queued');
    event.waitUntil(syncOfflineQueue());
  }
  if (event.tag === 'sync-data') {
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'SYNC_REQUIRED' }));
    }));
  }
});

async function syncOfflineQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('offline-queue', 'readwrite');
    const store = tx.objectStore('offline-queue');
    const all = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    // Notify clients to push to RTDB
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'PROCESS_OFFLINE_QUEUE', queue: all }));
    console.log('[SW] Notified clients to process', all.length, 'items');
  } catch (e) {
    console.error('[SW] sync error', e);
  }
}

// Push Notification - FCM + Custom
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Kejaksan Smart', body: event.data ? event.data.text() : 'Ada informasi baru' };
  }
  const title = data.notification?.title || data.title || 'Kejaksan Smart';
  const options = {
    body: data.notification?.body || data.body || 'Ada pembaruan untuk Anda',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/?notif=1' },
    tag: data.tag || 'kejaksan-general',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', url });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Message handling from app
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'SET_PRAYER_TIMINGS') {
    // store prayer timings in IDB for offline adzan reminder
    openDB().then(db => {
      const tx = db.transaction('prayer', 'readwrite');
      tx.objectStore('prayer').put(event.data.timings, 'timings');
    });
  }
});
