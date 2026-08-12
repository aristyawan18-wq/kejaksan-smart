// Paket 2 - Firebase Init & Sync Layer
// Menggunakan compat SDK agar kompatibel dengan data lama Anda

const firebaseConfig = {
  apiKey: "AIzaSyAWOoYiS4vuXXCc03aFrnTIsbLxipy-hCk",
  authDomain: "kejaksan-smart.firebaseapp.com",
  databaseURL: "https://kejaksan-smart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kejaksan-smart",
  storageBucket: "kejaksan-smart.firebasestorage.app",
  messagingSenderId: "295979776623",
  appId: "1:295979776623:web:150a939661dc435d2c2b9a",
  measurementId: "G-KS3488C25C"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// Enable persistence for offline-first (RTDB tidak punya cache persisten seperti Firestore, jadi kita pakai IndexedDB custom)
// Kita tetap pakai onDisconnect & keepSynced
try {
  db.ref().keepSynced(true);
} catch (e) { console.warn('keepSynced not supported in this context', e); }

// Role helper - nanti sesuaikan dengan data Anda yang sudah ada
// Struktur yang diharapkan di RTDB:
// /users/{uid}: { phone, name, role: 'warga'|'rw'|'lkk'|'admin', rw, rt, verifiedAt }
// /laporan/{id}: { uid, phone, kategori, deskripsi, lat, lng, fotoBase64, status: 'menunggu'|'diproses'|'selesai', createdAt, rw, rt }
// /umkm/{id}: existing
// /tokens/{uid}: FCM token for push

const FirebaseSync = {
  // Save laporan with offline fallback
  async saveLaporan(data) {
    const id = Date.now().toString() + '_' + (auth.currentUser?.uid || 'anon');
    const payload = {
      id,
      uid: auth.currentUser?.uid || null,
      phone: auth.currentUser?.phoneNumber || localStorage.getItem('ks_user_phone') || null,
      ...data,
      status: 'menunggu',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    // 1. Simpan ke IndexedDB dulu (optimistic)
    try {
      await AppDB.save('laporan', payload);
    } catch (e) { console.warn('IDB save fail', e); }

    // 2. Coba push ke RTDB jika online
    if (navigator.onLine && auth.currentUser) {
      try {
        await db.ref('laporan/' + id).set(payload);
        // Jika sukses, tandai synced
        payload._synced = true;
        await AppDB.save('laporan', payload);
        return { ok: true, synced: true, id };
      } catch (err) {
        console.error('RTDB save fail, queued', err);
        await FirebaseSync.queueOffline('laporan', payload);
        return { ok: true, synced: false, queued: true, id };
      }
    } else {
      await FirebaseSync.queueOffline('laporan', payload);
      return { ok: true, synced: false, queued: true, id };
    }
  },

  async queueOffline(type, data) {
    const dbLocal = await AppDB.open();
    const tx = dbLocal.transaction('offline-queue', 'readwrite');
    tx.objectStore('offline-queue').add({ type, data, createdAt: Date.now() });
    // Register background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-laporan');
      } catch (e) { console.warn('BG sync not supported', e); }
    }
  },

  async processOfflineQueue() {
    if (!navigator.onLine || !auth.currentUser) return;
    const dbLocal = await AppDB.open();
    const tx = dbLocal.transaction('offline-queue', 'readwrite');
    const store = tx.objectStore('offline-queue');
    const all = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    for (const item of all) {
      try {
        if (item.type === 'laporan') {
          await db.ref('laporan/' + item.data.id).set({
            ...item.data,
            _synced: true,
            syncedAt: firebase.database.ServerValue.TIMESTAMP
          });
        }
        // delete after success
        store.delete(item.id || item.key);
      } catch (e) {
        console.warn('Retry queue item failed', e);
      }
    }
  },

  // Listen realtime laporan untuk LKK & warga
  listenLaporan(cb) {
    const ref = db.ref('laporan').orderByChild('createdAt').limitToLast(100);
    ref.on('value', snap => {
      const val = snap.val() || {};
      const arr = Object.values(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(arr);
      // sync to IDB cache
      arr.forEach(item => AppDB.save('laporan', item).catch(()=>{}));
    });
    return () => ref.off();
  },

  // FCM token handling
  async saveFCMToken(token) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      await db.ref('tokens/' + uid).set({ token, phone: auth.currentUser.phoneNumber, updatedAt: Date.now() });
      // subscribe to RW topic via custom logic (via Cloud Function nanti)
    } catch (e) { console.warn('save token fail', e); }
  }
};

window.FirebaseSync = FirebaseSync;
window._fb = { db, auth };
