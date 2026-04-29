// ============================================================
// STORAGE — localStorage wrapper with namespaced keys
// ============================================================
window.FG = window.FG || {};

FG.storage = (function () {
  const PREFIX = 'fgp_';
  const SESSION_PREFIX = 'fgp_session_'; // preserved by clearAll (future-proof)
  const VERSION_KEY = PREFIX + 'version';
  const VERSION = '1';

  let quotaToastShown = false;

  const isQuotaError = (e) => {
    if (!e) return false;
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    if (e.code === 22 || e.code === 1014) return true;
    return /quota|exceeded/i.test(e.message || '');
  };

  const get = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('storage.get failed for', key, e);
      return fallback;
    }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (isQuotaError(e)) {
        console.warn('storage.set quota exceeded for', key);
        // throttle toast: show at most once per session until user resets
        if (!quotaToastShown && window.FG && FG.toast) {
          FG.toast('Storage limit reached. Reset Demo or remove documents to continue.', 'error', 7000);
          quotaToastShown = true;
        }
      } else {
        console.warn('storage.set failed for', key, e);
      }
      return false;
    }
  };

  const remove = (key) => {
    localStorage.removeItem(PREFIX + key);
  };

  // Clears all fgp_* keys EXCEPT session-prefixed ones, so a "Reset Demo"
  // tear-down can happen without logging the user out (once we have auth).
  const clearAll = () => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(PREFIX) && !k.startsWith(SESSION_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
    quotaToastShown = false;
  };

  // Returns approximate bytes/KB used by all fgp_* keys (including session)
  const estimate = () => {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const v = localStorage.getItem(k) || '';
      // localStorage stores UTF-16; double the char count for a rough byte estimate
      bytes += (k.length + v.length) * 2;
    }
    return { bytes, kb: Math.round(bytes / 1024 * 10) / 10 };
  };

  const ensureVersion = () => {
    const v = localStorage.getItem(VERSION_KEY);
    if (v !== VERSION) {
      localStorage.setItem(VERSION_KEY, VERSION);
    }
  };

  return { get, set, remove, clearAll, ensureVersion, estimate, PREFIX, SESSION_PREFIX };
})();
