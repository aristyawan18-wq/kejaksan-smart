# KEJAKSAN SMART - Paket 2 (Firebase Phone Auth + Offline Sync)

## Apa yang sudah di-fix dari file Anda (5MB -> modular)
- Manifest dulu base64 data URI -> sekarang file fisik `/manifest.json` + 10 icon PNG (72-512 + maskable) agar terdeteksi Web2App & PWA
- Service Worker dulu Blob URL -> sekarang `/sw.js` real dengan cache-first + network-first untuk Firebase & OSM, background sync untuk laporan offline, push notification FCM
- Login dulu localStorage isLoggedIn -> sekarang Firebase Auth No HP (OTP SMS). Otomatis buat profil di `/users/{uid}` role default `warga`, bisa ubah jadi `lkk`/`rw` di Firebase Console
- Data dulu IndexedDB lokal saja -> sekarang Offline-First + Realtime Sync: simpan dulu di IndexedDB, jika online push ke `https://kejaksan-smart-default-rtdb.asia-southeast1.firebasedatabase.app/laporan`. Semua HP lihat data sama
- Back button Android dulu langsung keluar -> sekarang `popstate` handler: tutup modal dulu, baru keluar (double-back to exit)
- Foto laporan: compress ke 1024px JPEG 70% sebelum upload (hemat quota RTDB), ambil GPS highAccuracy
- Lazy load Leaflet hanya saat tab Peta dibuka (hemat RAM HP)

## Struktur File untuk Vercel
```
/index.html (baru, 23KB, bukan 5MB)
/manifest.json
/sw.js
/vercel.json
/offline.html
/css/style.css (89874 - CSS original Anda)
/js/firebase.js (sync layer)
/js/auth-phone.js (Phone OTP)
/js/app.js (IDB + Laporan)
/js/pwa.js (Web2App bridge, back button, offline indicator)
/icons/*.png (10 icon)
```

## Cara Deploy via HP (tanpa laptop)
1. Buat repo baru di github.com via HP: New Repository -> `kejaksan-smart`
2. Upload semua file di folder ini via `Add file -> Upload files` (drag folder icons juga)
3. Buka vercel.com -> Login dengan GitHub -> New Project -> Import `kejaksan-smart` -> Deploy (otomatis HTTPS)
4. Setelah deploy, copy URL: `https://kejaksan-smart.vercel.app` (atau `...-yourname.vercel.app`)
5. Cek PWA: buka URL di Chrome HP, harus muncul icon install

## Setting Web2App by Monica Gupta (APK)
- Start URL: `https://kejaksan-smart.vercel.app/?source=apk`
- App Name: Kejaksan Smart
- Icon: pilih `/icons/icon-512x512.png`
- WAJIB Enable:
  - JavaScript: ON
  - DOM Storage: ON
  - Allow File Access: ON
  - Allow File Upload: ON
  - Geolocation: ON
  - Camera Access: ON
  - Keep Screen On: ON (untuk live tracking petugas)
  - Fullscreen: ON
  - Zoom: OFF
  - Status Bar Color: #6750A4
  - Orientation: Portrait
  - Splash Screen: pakai icon Anda + background #FEF7FF
  - User Agent: Default (jangan desktop)
- Optional: Enable Push Notification (FCM) -> paste Server Key Firebase jika diminta
- Build APK -> Install -> Test login No HP

## Firebase Rules yang disarankan (RTDB)
Buka Firebase Console -> Realtime Database -> Rules, ganti dengan:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'lkk'",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "laporan": {
      ".read": "auth != null",
      ".indexOn": ["createdAt", "status", "rw"],
      "$id": {
        ".write": "auth != null && (data.child('uid').val() == auth.uid || !data.exists() || root.child('users').child(auth.uid).child('role').val() == 'lkk' || root.child('users').child(auth.uid).child('role').val() == 'admin')"
      }
    },
    "tokens": {
      "$uid": { ".read": "auth != null && auth.uid == $uid", ".write": "auth != null && auth.uid == $uid" }
    },
    "chat": { ".read": "auth != null", ".write": "auth != null" },
    "umkm": { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

## Data existing Anda
Data RTDB Anda yang sudah ada (umkm, pembangunan, dll) tetap bisa dipakai. Kode baru di `firebase.js` akan `keepSynced(true)` dan tidak menghapus node lama. Untuk laporan baru, pakai node `/laporan` terpisah.

## Next Step setelah Paket 2 jalan
- Aktifkan FCM via Firebase Cloud Messaging untuk broadcast bencana per RW
- Buat Cloud Function untuk auto-notif saat status laporan jadi `selesai`
- Tambah role: di Firebase Console -> RTDB -> users/{uid}/role = `lkk` untuk akses ubah status laporan

Butuh saya deploy-kan langsung ke Vercel? Saya bisa siapkan ZIP siap upload.
