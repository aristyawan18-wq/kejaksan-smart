// Paket 2 - PWA Bridge & Android Native Feel (Web2App Ready)

const PWA = {
  deferredPrompt: null,

  init() {
    this.registerSW();
    this.handleBackButton();
    this.detectWeb2App();
    this.setupInstallPrompt();
    this.setupOfflineIndicator();
    this.setupMessageListener();
    console.log('[PWA] Paket 2 init');
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
        console.log('[PWA] SW registered', reg.scope);
        // Check update
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              if (window.showToast) showToast('Update tersedia, restart app untuk versi baru', 'info');
            }
          });
        });
      }).catch(err => console.warn('[PWA] SW fail', err));

      // Listen for controller change (new SW activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  },

  // Fix Android back button - close modals/drawers first, not exit app
  handleBackButton() {
    // Push dummy state so back button triggers popstate not exit
    const pushState = () => {
      try { history.pushState({ pwa: true }, '', location.href); } catch {}
    };
    // Push initial
    pushState();

    window.addEventListener('popstate', (e) => {
      // Check open modals/drawers
      const modals = document.querySelectorAll('.modal.open, .drawer.open, .sheet.open, #modal-umkm-detail.open');
      if (modals.length > 0) {
        modals.forEach(m => m.classList.remove('open'));
        if (typeof hideActionSheet === 'function') hideActionSheet();
        if (typeof hideAttachSheet === 'function') hideAttachSheet();
        if (typeof exitSelectMode === 'function') exitSelectMode();
        pushState(); // stay in app
        try { navigator.vibrate && navigator.vibrate(10); } catch {}
        return;
      }

      // Check if in sub-tab, go back to beranda
      const activePanel = document.querySelector('.tab-panel.active');
      if (activePanel && activePanel.id !== 'panel-beranda') {
        if (typeof switchTab === 'function') switchTab('beranda');
        pushState();
        return;
      }

      // If at beranda, allow exit but confirm
      if (document.getElementById('panel-beranda')?.classList.contains('active')) {
        // Let system handle exit, but show toast
        if (window.showToast) showToast('Tekan sekali lagi untuk keluar', 'info');
        // push again to require double back to exit
        setTimeout(pushState, 500);
      } else {
        pushState();
      }
    });

    // Web2App specific backbutton event (some wrappers fire this)
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      history.back();
    });
  },

  detectWeb2App() {
    const isWeb2App = !!window.Android || !!window.AndroidInterface || navigator.userAgent.includes('Web2App');
    if (isWeb2App) {
      document.body.classList.add('web2app');
      console.log('[PWA] Running inside Web2App wrapper');
      // Enable Web2App features if interface exists
      try {
        if (window.AndroidInterface && window.AndroidInterface.setStatusBarColor) {
          window.AndroidInterface.setStatusBarColor('#6750A4');
        }
      } catch {}
    }

    // Fix 100vh issues in WebView
    const setVH = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
  },

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      // Show custom install button if needed
      const btn = document.getElementById('btn-install-pwa');
      if (btn) btn.style.display = 'block';
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] Installed');
      this.deferredPrompt = null;
    });
  },

  async promptInstall() {
    if (!this.deferredPrompt) {
      if (window.showToast) showToast('Untuk install, buka di browser Chrome -> Tambahkan ke layar utama', 'info');
      return;
    }
    this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    console.log('[PWA] Install choice', choice.outcome);
    this.deferredPrompt = null;
  },

  setupOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.innerHTML = '<i class="fa-solid fa-wifi"></i> Offline - Laporan akan terkirim saat online';
    indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#B3261E;color:white;text-align:center;padding:8px;font-size:12px;z-index:9999;display:none;';
    document.body.appendChild(indicator);

    const update = () => {
      if (!navigator.onLine) {
        indicator.style.display = 'block';
        document.body.classList.add('offline');
      } else {
        indicator.style.display = 'none';
        document.body.classList.remove('offline');
        // Process queue when back online
        if (window.FirebaseSync) FirebaseSync.processOfflineQueue();
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  },

  setupMessageListener() {
    navigator.serviceWorker?.addEventListener('message', event => {
      if (event.data?.type === 'SYNC_REQUIRED' || event.data?.type === 'PROCESS_OFFLINE_QUEUE') {
        if (window.FirebaseSync) FirebaseSync.processOfflineQueue();
      }
      if (event.data?.type === 'NOTIF_CLICK') {
        const url = event.data.url;
        if (url.includes('lapor')) {
          if (typeof switchTab === 'function') switchTab('data-lkk');
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => PWA.init());
window.PWA = PWA;
window.promptPWAInstall = () => PWA.promptInstall();
