
// Firebase Messaging Service Worker for FCM Push
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAWOoYiS4vuXXCc03aFrnTIsbLxipy-hCK",
  authDomain: "kejaksan-smart.firebaseapp.com",
  databaseURL: "https://kejaksan-smart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kejaksan-smart",
  storageBucket: "kejaksan-smart.firebasestorage.app",
  messagingSenderId: "295979776623",
  appId: "1:295979776623:web:150a939661dc435d2c2b9a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload)=>{
  console.log('[FCM SW] Background message', payload);
  const title = payload.notification?.title || payload.data?.title || 'KEJAKSAN SMART';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'Aktivitas warga baru',
    icon: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    data: payload.data,
    requireInteraction: true
  };
  self.registration.showNotification(title, options);
});
