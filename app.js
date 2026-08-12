// Paket 2 - AppDB IndexedDB wrapper + Laporan logic

const AppDB = {
  _db: null,
  DB_NAME: 'KejaksanSmartDB',
  DB_VERSION: 5, // bump from v4 to v5 for new stores

  async open() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const stores = [
          ['pembangunan', { keyPath: 'id' }, [['status'], ['rw'], ['rt'], ['timestamp']]],
          ['pemberdayaan', { keyPath: 'id' }, [['kategori'], ['rw'], ['timestamp']]],
          ['csr', { keyPath: 'id' }, [['perusahaan'], ['rw'], ['timestamp']]],
          ['bencana', { keyPath: 'id' }, [['jenis'], ['status'], ['rw'], ['timestamp']]],
          ['pokir', { keyPath: 'id' }, [['status'], ['rw']]],
          ['lkk', { keyPath: 'id' }],
          ['posbankum', { keyPath: 'id' }],
          ['peraturan', { keyPath: 'id' }],
          ['umkm', { keyPath: 'id' }, [['kategori'], ['rw']]],
          ['laporan', { keyPath: 'id' }, [['status'], ['kategori'], ['uid']]],
          ['chat', { keyPath: 'id' }],
          ['offline-queue', { keyPath: 'id', autoIncrement: true }]
        ];
        stores.forEach(([name, opts, indexes]) => {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, opts);
          } else {
            store = e.target.transaction.objectStore(name);
          }
          if (indexes) {
            indexes.forEach(([idxName]) => {
              if (!store.indexNames.contains(idxName)) store.createIndex(idxName, idxName, { unique: false });
            });
          }
        });
      };
      req.onsuccess = () => { AppDB._db = req.result; res(req.result); };
      req.onerror = () => rej(req.error);
    });
  },

  async save(storeName, data) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(data);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  },

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
};

window.AppDB = AppDB;

// Laporan Warga Logic - Paket 2 enhancement
const LaporanWarga = {
  compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 1024; // max dimension
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            if (w > h) { h = (h / w) * max; w = max; }
            else { w = (w / h) * max; h = max; }
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // compress
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async getLocation() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej('Geolocation tidak didukung');
      navigator.geolocation.getCurrentPosition(pos => {
        res({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      }, err => rej(err.message), { enableHighAccuracy: true, timeout: 15000 });
    });
  },

  async submit(formData) {
    const statusEl = document.getElementById('laporan-status');
    if (statusEl) statusEl.textContent = 'Mengompres foto & mengambil lokasi...';

    let fotoBase64 = null;
    if (formData.fotoFile) {
      fotoBase64 = await this.compressImage(formData.fotoFile);
    }

    let loc = { lat: null, lng: null };
    try {
      loc = await this.getLocation();
    } catch (e) {
      console.warn('Lokasi gagal', e);
    }

    const payload = {
      kategori: formData.kategori, // pembangunan, bencana, umkm, kebersihan, dll
      deskripsi: formData.deskripsi,
      rw: formData.rw,
      rt: formData.rt,
      alamatDetail: formData.alamatDetail,
      foto: fotoBase64,
      lat: loc.lat,
      lng: loc.lng,
      acc: loc.acc,
      _synced: false
    };

    if (statusEl) statusEl.textContent = 'Menyimpan... (offline-first)';
    const result = await FirebaseSync.saveLaporan(payload);

    if (result.synced) {
      if (statusEl) statusEl.textContent = '✅ Laporan terkirim & sinkron ke LKK!';
    } else if (result.queued) {
      if (statusEl) statusEl.textContent = '📵 Offline - Laporan disimpan, akan terkirim otomatis saat online.';
    }

    // Haptic feedback for Web2App
    try { navigator.vibrate && navigator.vibrate([30, 50, 30]); } catch {}

    return result;
  }
};

window.LaporanWarga = LaporanWarga;
