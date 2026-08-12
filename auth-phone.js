// Paket 2 - Firebase Phone Auth untuk LKK & Warga
// Alur: Input No HP -> reCAPTCHA invisible -> Kirim OTP -> Verifikasi -> Simpan role

let recaptchaVerifier = null;
let confirmationResult = null;

const AuthPhone = {
  init() {
    // Render reCAPTCHA invisible di login screen
    if (document.getElementById('recaptcha-container') && !recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: () => console.log('[Auth] reCAPTCHA ok'),
        'expired-callback': () => console.warn('[Auth] reCAPTCHA expired')
      });
      recaptchaVerifier.render().catch(e => console.warn('recaptcha render fail', e));
    }

    // Listener auth state
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        console.log('[Auth] Logged in', user.phoneNumber);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('ks_uid', user.uid);
        localStorage.setItem('ks_user_phone', user.phoneNumber);
        localStorage.setItem('ks_user', JSON.stringify({ uid: user.uid, phone: user.phoneNumber }));

        // Cek apakah user sudah ada di /users
        try {
          const snap = await firebase.database().ref('users/' + user.uid).once('value');
          if (!snap.exists()) {
            // Buat profil awal warga
            await firebase.database().ref('users/' + user.uid).set({
              uid: user.uid,
              phone: user.phoneNumber,
              role: 'warga', // default, LKK bisa ubah jadi 'lkk' / 'rw' di console Firebase
              rw: localStorage.getItem('ks_rw') || '',
              rt: localStorage.getItem('ks_rt') || '',
              createdAt: firebase.database.ServerValue.TIMESTAMP,
              lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
          } else {
            await firebase.database().ref('users/' + user.uid + '/lastLogin').set(firebase.database.ServerValue.TIMESTAMP);
          }
        } catch (e) { console.warn('user init fail', e); }

        // Request notification permission & save FCM token (jika ada messaging)
        if ('Notification' in window && Notification.permission !== 'granted') {
          try { await Notification.requestPermission(); } catch {}
        }

        // Tampilkan app
        if (typeof showAppAfterLogin === 'function') showAppAfterLogin();
        else {
          document.getElementById('login-screen')?.classList.remove('open');
          document.getElementById('login-screen') && (document.getElementById('login-screen').style.display = 'none');
          document.getElementById('app') && (document.getElementById('app').style.display = 'block');
        }

        // Process offline queue
        FirebaseSync.processOfflineQueue();
      } else {
        console.log('[Auth] Logged out');
        localStorage.setItem('isLoggedIn', 'false');
        if (typeof showLoginScreen === 'function') showLoginScreen();
      }
    });
  },

  formatPhoneNumber(input) {
    let p = input.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (p.startsWith('0')) p = '+62' + p.slice(1);
    if (!p.startsWith('+')) p = '+62' + p;
    return p;
  },

  async sendOTP() {
    const phoneInput = document.getElementById('phone-input');
    const status = document.getElementById('auth-status');
    const btn = document.getElementById('btn-send-otp');
    if (!phoneInput) return;

    const raw = phoneInput.value.trim();
    if (raw.length < 9) {
      if (status) status.textContent = 'Nomor HP tidak valid. Contoh: 0812xxxx';
      return;
    }
    const phone = this.formatPhoneNumber(raw);
    if (status) status.textContent = 'Mengirim OTP ke ' + phone + '...';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...'; }

    try {
      if (!recaptchaVerifier) this.init();
      confirmationResult = await firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier);
      if (status) status.textContent = 'OTP terkirim! Cek SMS Anda.';
      document.getElementById('otp-section')?.classList.add('show');
      document.getElementById('otp-input')?.focus();
      if (btn) btn.innerHTML = 'OTP Terkirim <i class="fa-solid fa-check"></i>';
      console.log('[Auth] OTP sent to', phone);
    } catch (err) {
      console.error('[Auth] OTP fail', err);
      if (status) status.textContent = 'Gagal kirim OTP: ' + (err.message || err.code);
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim OTP'; }
      // Reset recaptcha on fail
      try { recaptchaVerifier.render().then(id => grecaptcha.reset(id)); } catch {}
    }
  },

  async verifyOTP() {
    const otpInput = document.getElementById('otp-input');
    const status = document.getElementById('auth-status');
    const btnVerify = document.getElementById('btn-verify-otp');
    if (!otpInput || !confirmationResult) {
      if (status) status.textContent = 'Silakan kirim OTP dulu.';
      return;
    }
    const code = otpInput.value.trim();
    if (code.length !== 6) {
      if (status) status.textContent = 'Kode OTP harus 6 digit.';
      return;
    }
    if (btnVerify) { btnVerify.disabled = true; btnVerify.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifikasi...'; }

    try {
      const result = await confirmationResult.confirm(code);
      if (status) status.textContent = 'Berhasil login! Memuat data...';
      console.log('[Auth] Verified', result.user.uid);
      // onAuthStateChanged will handle UI
    } catch (err) {
      console.error('[Auth] verify fail', err);
      if (status) status.textContent = 'OTP salah / expired: ' + (err.message || '');
      if (btnVerify) { btnVerify.disabled = false; btnVerify.textContent = 'Verifikasi OTP'; }
    }
  },

  async logout() {
    try {
      await firebase.auth().signOut();
      localStorage.clear();
      localStorage.setItem('isFirstTime', '0'); // jangan tampilkan onboarding lagi
      location.reload();
    } catch (e) { console.error('logout fail', e); }
  }
};

window.AuthPhone = AuthPhone;

// Auto init after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay sedikit agar firebase lib load
  setTimeout(() => AuthPhone.init(), 800);
});
