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

  const list = (collection) => FG.storage.get(collection, []);

  const get = (collection, id) => list(collection).find(x => x.id === id) || null;

  const save = (collection, items) => FG.storage.set(collection, items);

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

  // alert helpers
  const unreadAlertCount = () => list('alerts').filter(a => !a.read).length;

  return {
    COLLECTIONS, list, get, save, create, update, remove,
    company, setCompany, truckById, driverById, truckLabel, driverLabel,
    unreadAlertCount,
  };
})();
