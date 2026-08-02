importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey: "AIzaSyAWOoYiS4vuXXCc03aFrnTIsbLxipy-hCK", authDomain: "kejaksan-smart.firebaseapp.com", projectId: "kejaksan-smart", storageBucket: "kejaksan-smart.firebasestorage.app", messagingSenderId: "295979776623", appId: "1:295979776623:web:150a939661dc435d2c2b9a"});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload)=>{ self.registration.showNotification(payload.notification.title, {body: payload.notification.body}); });
