// ============================================================
// STORAGE — localStorage wrapper with namespaced keys
// ============================================================
window.FG = window.FG || {};

FG.storage = (function () {
  const PREFIX = 'fgp_';
  const VERSION_KEY = PREFIX + 'version';
  const VERSION = '1';

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
      console.warn('storage.set failed for', key, e);
      return false;
    }
  };

  const remove = (key) => {
    localStorage.removeItem(PREFIX + key);
  };

  const clearAll = () => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    });
  };

  const ensureVersion = () => {
    const v = localStorage.getItem(VERSION_KEY);
    if (v !== VERSION) {
      // future migrations would go here
      localStorage.setItem(VERSION_KEY, VERSION);
    }
  };

  return { get, set, remove, clearAll, ensureVersion };
})();
