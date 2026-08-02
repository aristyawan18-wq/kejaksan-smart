
// Kejaksan Smart Service Worker - Push Notification
const CACHE_NAME='kejaksan-v2';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAWOoYiS4vuXXCc03aFrnTIsbLxipy-hCK",
  authDomain: "kejaksan-smart.firebaseapp.com",
  databaseURL: "https://kejaksan-smart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kejaksan-smart",
  storageBucket: "kejaksan-smart.firebasestorage.app",
  messagingSenderId: "295979776623",
  appId: "1:295979776623:web:150a939661dc435d2c2b9a"
};

self.addEventListener('install', (e)=>{
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(clients.claim());
});

self.addEventListener('push', (event)=>{
  let data={};
  try{ data=event.data.json(); }catch(e){ data={title:'Kejaksan Smart', body: event.data ? event.data.text() : 'Aktivitas warga baru'}; }
  const title = data.title || 'KEJAKSAN SMART';
  const options = {
    body: data.body || data.message || 'Ada aktivitas warga baru',
    icon: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    vibrate: [200,100,200],
    data: data,
    requireInteraction: true,
    actions: [
      {action:'open', title:'Buka Dashboard'},
      {action:'close', title:'Tutup'}
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event)=>{
  event.notification.close();
  if(event.action==='close') return;
  event.waitUntil(
    clients.matchAll({type:'window'}).then(clientList=>{
      for(const client of clientList){
        if(client.url.includes('Kejaksan') && 'focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow('./Kejaksan_Smart_PUSH.html');
    })
  );
});

// Background sync for Firebase RTDB auth_events (polling fallback)
self.addEventListener('periodicsync', (event)=>{
  if(event.tag==='kejaksan-auth-check'){
    event.waitUntil(checkAuthEvents());
  }
});

async function checkAuthEvents(){
  try{
    const res = await fetch(FIREBASE_CONFIG.databaseURL+'/auth_events.json?orderBy="ts"&limitToLast=1');
    const data = await res.json();
    if(!data) return;
    const ev = Object.values(data)[0];
    if(ev){
      const lastTs = await self.registration ? 0 : 0;
      // simple show
      self.registration.showNotification(ev.type==='login'?'🟢 Warga Login':'🔴 Warga Logout', {
        body: `${ev.name} ${ev.type==='login'?'masuk':'keluar'} - ${ev.device}`,
        icon: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png'
      });
    }
  }catch(e){}
}
