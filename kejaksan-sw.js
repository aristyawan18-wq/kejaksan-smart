self.addEventListener('push', function(event){
  const data = event.data ? event.data.json() : {title:'Kejaksan SMART', body:'Notifikasi baru'};
  event.waitUntil(self.registration.showNotification(data.title, {body: data.body, icon: '/icon-192.png', badge: '/badge.png'}));
});
self.addEventListener('notificationclick', function(event){ event.notification.close(); event.waitUntil(clients.openWindow('/Kejaksan_Smart_PUSH.html')); });
