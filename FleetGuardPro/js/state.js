// ============================================================
// STATE — generic CRUD repository over localStorage
// ============================================================
window.FG = window.FG || {};

FG.state = (function () {

  const COLLECTIONS = [
    'trucks', 'drivers', 'maintenance', 'repairs', 'parts',
    'dot_files', 'safety_incidents', 'insurance_policies',
    'documents', 'alerts', 'billing', 'garage_shops', 'reports'
  ];

  // Writes to these collections trigger auto-alert regeneration.
  const ALERT_TRIGGERS = ['drivers', 'insurance_policies', 'maintenance', 'parts', 'dot_files'];

  let _inGenerator = false;

  const list = (collection) => FG.storage.get(collection, []);
  const get = (collection, id) => list(collection).find(x => x.id === id) || null;
  const save = (collection, items) => {
    FG.storage.set(collection, items);
    if (!_inGenerator && ALERT_TRIGGERS.includes(collection)) generateAlerts();
  };

  const create = (collection, data) => {
    const items = list(collection);
    const item = { id: FG.utils.uid(collection.slice(0, 1)), ...data };
    items.unshift(item);
    save(collection, items);
    return item;
  };

  const update = (collection, id, patch) => {
    const items = list(collection);
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...patch };
    save(collection, items);
    return items[idx];
  };

  const remove = (collection, id) => {
    const items = list(collection).filter(x => x.id !== id);
    save(collection, items);
  };

  const company = () => FG.storage.get('company', {});
  const setCompany = (patch) => {
    const c = { ...company(), ...patch };
    FG.storage.set('company', c);
    return c;
  };

  // helpers / lookups
  const truckById = (id) => get('trucks', id);
  const driverById = (id) => get('drivers', id);

  const truckLabel = (id) => {
    const t = truckById(id);
    return t ? `${t.unit_number} — ${t.year} ${t.make}` : '—';
  };
  const driverLabel = (id) => {
    const d = driverById(id);
    return d ? d.name : '—';
  };

  const unreadAlertCount = () => list('alerts').filter(a => !a.read).length;

  // ── Cross-entity relation helpers (used by orphan-safety on delete) ──
  const relations = (collection, id) => {
    const r = { open_repairs: [], maintenance: [], dot_files: [], trucks_assigned: [], pending_at_shop: [] };
    if (collection === 'drivers') {
      r.trucks_assigned = list('trucks').filter(t => t.assigned_driver_id === id);
      const truckIds = r.trucks_assigned.map(t => t.id);
      r.open_repairs = list('repairs').filter(x => truckIds.includes(x.truck_id) && x.status !== 'Closed');
      r.dot_files = list('dot_files').filter(f => f.driver_id === id);
    } else if (collection === 'trucks') {
      r.open_repairs = list('repairs').filter(x => x.truck_id === id && x.status !== 'Closed');
      r.maintenance = list('maintenance').filter(m => m.truck_id === id);
      r.dot_files = list('dot_files').filter(f => f.truck_id === id);
    } else if (collection === 'garage_shops') {
      // shops are matched by name (legacy seed shape) on repair.shop
      const shop = get('garage_shops', id);
      if (shop) r.pending_at_shop = list('repairs').filter(x => x.shop === shop.name && x.status !== 'Closed');
    } else if (collection === 'parts') {
      const part = get('parts', id);
      if (part) r.qty_on_hand = part.qty_on_hand || 0;
    }
    return r;
  };

  // ── Auto-generated alerts ──
  // Idempotent: rebuilds the auto-alerts subset on each call, preserving
  // manual alerts and the read state of any prior auto alert with the same key.
  const generateAlerts = () => {
    if (_inGenerator) return;
    _inGenerator = true;
    try {
      const today = FG.utils.today();
      const fmtDate = FG.utils.fmtDate;
      const daysFromNow = FG.utils.daysFromNow;

      const desired = new Map(); // auto_key -> alert template

      // CDL & medical card expirations (≤30 days)
      list('drivers').forEach(d => {
        const cdl = daysFromNow(d.cdl_expiry);
        if (cdl != null && cdl >= 0 && cdl <= 30) {
          const key = `cdl_${d.id}`;
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'compliance', severity: cdl <= 7 ? 'high' : 'medium',
            title: `CDL Expiring: ${d.name}`,
            message: `CDL expires ${fmtDate(d.cdl_expiry)} (${cdl} day${cdl === 1 ? '' : 's'}). Begin renewal.`,
            date: today, related_type: 'driver', related_id: d.id, read: false,
          });
        }
        const med = daysFromNow(d.medical_card_expiry);
        if (med != null && med >= 0 && med <= 30) {
          const key = `med_${d.id}`;
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'compliance', severity: med <= 7 ? 'high' : 'medium',
            title: `Medical Card Expiring: ${d.name}`,
            message: `Med card expires ${fmtDate(d.medical_card_expiry)} (${med} day${med === 1 ? '' : 's'}). Schedule DOT physical.`,
            date: today, related_type: 'driver', related_id: d.id, read: false,
          });
        }
      });

      // Insurance policies expiring (≤60 days, not cancelled/expired)
      list('insurance_policies').forEach(p => {
        if (p.status === 'Cancelled' || p.status === 'Expired') return;
        const days = daysFromNow(p.expiry_date);
        if (days != null && days >= 0 && days <= 60) {
          const key = `ins_${p.id}`;
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'insurance', severity: days <= 14 ? 'high' : days <= 30 ? 'medium' : 'low',
            title: `Insurance Renewing: ${p.carrier}`,
            message: `${p.type} expires ${fmtDate(p.expiry_date)} (${days} day${days === 1 ? '' : 's'}). Begin multi-broker quote.`,
            date: today, related_type: 'insurance', related_id: p.id, read: false,
          });
        }
      });

      // Maintenance overdue (date passed, not yet completed)
      list('maintenance').forEach(m => {
        if (m.status === 'Completed') return;
        const days = daysFromNow(m.due_date);
        if (days != null && days < 0) {
          const key = `maint_${m.id}`;
          const truck = truckById(m.truck_id);
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'maintenance', severity: days <= -14 ? 'high' : 'medium',
            title: `Overdue: ${m.type}${truck ? ` (${truck.unit_number})` : ''}`,
            message: `${m.type} was due ${fmtDate(m.due_date)} — ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue.`,
            date: today, related_type: 'maintenance', related_id: m.id, read: false,
          });
        }
      });

      // Parts at or below reorder point
      list('parts').forEach(p => {
        const qty = p.qty_on_hand || 0;
        const rp = p.reorder_point || 0;
        if (qty <= rp) {
          const key = `parts_${p.id}`;
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'parts', severity: qty === 0 ? 'high' : 'low',
            title: qty === 0 ? `Out of Stock: ${p.name}` : `Low Stock: ${p.name}`,
            message: `${p.name} (${p.sku || '—'}) has ${qty} on hand · reorder at ${rp}.`,
            date: today, related_type: 'part', related_id: p.id, read: false,
          });
        }
      });

      // DOT files expiring (≤30 days) or expired
      list('dot_files').forEach(f => {
        const days = daysFromNow(f.expires_date);
        if (days == null) return;
        if (days <= 30) {
          const key = `dot_${f.id}`;
          desired.set(key, {
            auto: true, auto_key: key,
            type: 'compliance', severity: days < 0 ? 'high' : days <= 7 ? 'high' : 'medium',
            title: days < 0 ? `Expired: ${f.name}` : `DOT File Expiring: ${f.name}`,
            message: days < 0
              ? `${f.type} expired ${fmtDate(f.expires_date)} (${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago).`
              : `${f.type} expires ${fmtDate(f.expires_date)} (${days} day${days === 1 ? '' : 's'}).`,
            date: today, related_type: 'dot_file', related_id: f.id, read: false,
          });
        }
      });

      // Reconcile: keep all manual alerts; replace auto alerts with desired set,
      // preserving id and read-state from any prior auto alert with the same key.
      const existing = list('alerts');
      const manual = existing.filter(a => !a.auto);
      const priorAuto = existing.filter(a => a.auto);
      const priorByKey = new Map(priorAuto.map(a => [a.auto_key, a]));

      const next = [...manual];
      desired.forEach((tpl, key) => {
        const prior = priorByKey.get(key);
        if (prior) {
          // preserve id, read state, but refresh content
          next.push({ ...tpl, id: prior.id, read: prior.read });
        } else {
          next.push({ ...tpl, id: FG.utils.uid('a') });
        }
      });

      FG.storage.set('alerts', next);
    } finally {
      _inGenerator = false;
    }
  };

  return {
    COLLECTIONS, list, get, save, create, update, remove,
    company, setCompany, truckById, driverById, truckLabel, driverLabel,
    unreadAlertCount, relations, generateAlerts,
  };
})();
