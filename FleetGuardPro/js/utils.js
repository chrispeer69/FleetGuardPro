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
