// JS_PATCH_V23.js - Placeholder for Vercel Web Deployment
// Original file missing - safe no-op patch for web version
console.log('[KS PATCH V23] Web mode - native bridge disabled');
window.KS_PATCH_V23_LOADED = true;
if(window.KS_Push){
  window.KS_Push.isWebView = function(){ return false; }
}
// Android bridges noop
window.AndroidInterface = window.AndroidInterface || { requestNotificationPermission: function(){ console.log('Android bridge noop on web'); } };
