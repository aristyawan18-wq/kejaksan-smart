
const CACHE_NAME = 'kejaksan-v3';
const ASSETS = ['/', '/Warga.html', '/Admin.html', '/manifest.json'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

// For background presence cleanup - not rely heavily
self.addEventListener('message', e=>{
  if(e.data?.type==='PING') console.log('SW ping', Date.now());
});
