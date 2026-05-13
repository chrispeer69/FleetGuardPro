// ============================================================
// UTILS — formatters, helpers, sorters, escapers
// ============================================================
window.FG = window.FG || {};

FG.utils = (function () {
  const uid = (prefix = 'id') => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  const fmtMoney = (n, decimals = 0) => {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtNum = (n) => {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US');
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtDateShort = (d) => {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const fmtDateTime = (d) => {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const daysFromNow = (d) => {
    if (!d) return null;
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(date); target.setHours(0,0,0,0);
    return Math.round((target - today) / 86400000);
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, days) => {
    const date = (d instanceof Date) ? new Date(d) : new Date(d || Date.now());
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const escapeAttr = escapeHtml;

  const debounce = (fn, ms = 200) => {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  const sortBy = (arr, key, dir = 'asc') => {
    const sorted = [...arr].sort((a, b) => {
      let av = a[key], bv = b[key];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv);
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return dir === 'desc' ? sorted.reverse() : sorted;
  };

  const filterBy = (arr, query, fields) => {
    if (!query) return arr;
    const q = query.toLowerCase();
    return arr.filter(item => fields.some(f => {
      const v = item[f];
      return v != null && String(v).toLowerCase().includes(q);
    }));
  };

  const fileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const initials = (name) => {
    if (!name) return '?';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const statusBadge = (status) => {
    const map = {
      'active': 'badge-green',
      'in shop': 'badge-blue',
      'in_shop': 'badge-blue',
      'inactive': 'badge-gray',
      'flagged': 'badge-orange',
      'overdue': 'badge-red',
      'pm overdue': 'badge-red',
      'on leave': 'badge-yellow',
      'on_leave': 'badge-yellow',
      'open': 'badge-orange',
      'in progress': 'badge-blue',
      'in_progress': 'badge-blue',
      'closed': 'badge-gray',
      'completed': 'badge-green',
      'pending': 'badge-yellow',
      'scheduled': 'badge-blue',
      'expired': 'badge-red',
      'expiring': 'badge-yellow',
      'paid': 'badge-green',
      'unpaid': 'badge-red',
      'low stock': 'badge-orange',
      'in stock': 'badge-green',
      'out of stock': 'badge-red',
      'partner': 'badge-purple',
      'preferred': 'badge-purple',
      'standard': 'badge-gray',
    };
    const cls = map[status?.toLowerCase()] || 'badge-gray';
    return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
  };

  const scoreColor = (score) => {
    if (score >= 90) return 'var(--success)';
    if (score >= 75) return 'var(--accent)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  // ── FK label factories ─────────────────────────────────────
  // Each takes the cached related-table list and returns an
  // (id) => label function. Pre-builds a Map for O(1) lookup —
  // panels typically render the same label many times per mount.
  // Lifted from in-panel makeTruckLabel / makeDriverLabel
  // (overview.js Wave 1.5, fleet.js Wave 2) once Wave 3 brought
  // the third user.

  // Returns "T-101 — 2019 Kenworth" for known ids, "—" for null
  // or missing. truck_id is NOT NULL on maintenance/repairs (schema
  // enforces) but nullable on safety_incidents and dot_files.
  const truckLabel = (trucks) => {
    const byId = new Map((trucks || []).map(t => [t.id, t]));
    return (id) => {
      const t = byId.get(id);
      return t ? `${t.unit_number} — ${t.year} ${t.make}` : '—';
    };
  };

  // Returns the driver's name, "— Unassigned —" for null or missing.
  // The "Unassigned" framing reflects the most common nullable case
  // (trucks.assigned_driver_id can be null by design).
  const driverLabel = (drivers) => {
    const byId = new Map((drivers || []).map(d => [d.id, d]));
    return (id) => {
      const d = byId.get(id);
      return d ? d.name : '— Unassigned —';
    };
  };

  return {
    uid, fmtMoney, fmtNum, fmtDate, fmtDateShort, fmtDateTime, daysFromNow,
    today, addDays, escapeHtml, escapeAttr, debounce, sortBy, filterBy,
    fileSize, initials, statusBadge, scoreColor,
    truckLabel, driverLabel,
  };
})();

// ============================================================
// VALIDATE — shared, consistent rules for every user-facing form
// ============================================================
// Every form validator (login, request-access, contact modal,
// profile edit, password reset, complete-signup) routes through
// here so rules stay aligned. Each *Error helper returns null
// on success or a user-facing string; formatPhone normalizes
// on blur (attachPhoneFormatter wires that listener).
FG.validate = (function () {
  // Tighter than the pre-Wave shape ([^\s@]{2,} TLD): now requires
  // an alphabetic TLD of 2+ chars so things like `a@b.1` or
  // `a@b.@x` can't slip through. The typo blocklist below also
  // rejects common misspellings of well-known TLDs (`.con`, etc).
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  // Suffixes that are virtually always typos of a real TLD.
  // Conservative — only stuff that's obviously wrong, not anything
  // plausibly valid (`.co` is real, so it's NOT in the list).
  const TLD_TYPOS = new Set([
    'con', 'cmo', 'comm', 'cim', 'vom', 'xom',
    'ney', 'nett', 'nrt',
    'orgg', 'ogr', 'og',
  ]);

  const phoneDigits = (s) => (s == null ? '' : String(s)).replace(/\D/g, '');

  // Normalize to XXX-XXX-XXXX (10 digits) or 1-XXX-XXX-XXXX
  // (11 digits with US country code). Anything else passes through
  // untouched so partials / international numbers aren't mangled.
  const formatPhone = (s) => {
    const raw = s == null ? '' : String(s);
    const d = phoneDigits(raw);
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === '1') return `1-${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
    return raw;
  };

  const phoneError = (s, { required = true } = {}) => {
    const raw = s == null ? '' : String(s).trim();
    if (!raw) return required ? 'Phone number is required.' : null;
    const d = phoneDigits(raw);
    if (d.length < 10) return 'Phone must be at least 10 digits, e.g. 614-633-7935.';
    if (d.length > 15) return 'Phone number is too long.';
    return null;
  };

  const emailError = (s, { required = true } = {}) => {
    const v = s == null ? '' : String(s).trim();
    if (!v) return required ? 'Email is required.' : null;
    if (!EMAIL_RE.test(v)) return 'Please enter a valid email address.';
    const tld = (v.split('.').pop() || '').toLowerCase();
    if (TLD_TYPOS.has(tld)) return 'Please enter a valid email address.';
    return null;
  };

  // Trim + reject empty. Pulled out so callers can apply the rule
  // to company-name fields without inlining the same two checks.
  const requiredTextError = (s, label) => {
    const v = s == null ? '' : String(s).trim();
    if (!v) return `${label} is required.`;
    return null;
  };

  // Require both first and last name: trimmed input must split into
  // at least two non-empty whitespace-separated parts. Hyphenated
  // and apostrophe-containing names still pass — only the "no
  // space" case (single token) is rejected.
  const fullNameError = (s, label = 'Name') => {
    const v = s == null ? '' : String(s).trim();
    if (!v) return `${label} is required.`;
    const parts = v.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return 'Please enter both your first and last name.';
    return null;
  };

  // 8+ chars + matching confirm. Deliberately NOT layered with
  // letter/digit/symbol class requirements — Supabase Auth's own
  // policy is the source of truth for strength, and stacking
  // client-side rules on top creates lockouts where the password
  // passes Supabase but fails our regex (or vice versa).
  const passwordError = (pw, confirm) => {
    if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
    if (confirm !== undefined && pw !== confirm) return 'Passwords do not match.';
    return null;
  };

  // Wire onBlur auto-format on a phone <input>. Idempotent per
  // element via a sentinel flag so accidentally calling twice
  // (e.g. modal re-open) doesn't stack listeners.
  const attachPhoneFormatter = (el) => {
    if (!el || el._fgPhoneFmt) return;
    el._fgPhoneFmt = true;
    el.addEventListener('blur', () => {
      const formatted = formatPhone(el.value);
      if (formatted && formatted !== el.value) el.value = formatted;
    });
  };

  return {
    EMAIL_RE,
    phoneDigits, formatPhone, phoneError,
    emailError, requiredTextError, fullNameError, passwordError,
    attachPhoneFormatter,
  };
})();
