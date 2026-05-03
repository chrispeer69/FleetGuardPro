// ============================================================
// PANEL: DOT / PUCO FILES
// ============================================================
// Wave 5 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. dot_files has two
// nullable FKs:
//   driver_id → drivers ON DELETE CASCADE
//   truck_id  → trucks  ON DELETE SET NULL
// Both are coerced from "" → null by FG.db._coerceEmpty.
//
// Mount fetches [dot_files, drivers, trucks] in parallel. drivers
// and trucks are needed for the related-entity dropdowns and for
// the "Related" column's label rendering (FG.utils.driverLabel /
// truckLabel factories, built once per render).
//
// Status is computed from expires_date on every read AND stamped
// on every write. The schema CHECK accepts ('Active','Expiring',
// 'Expired','Archived'); the UI never produces 'Archived' but
// reads tolerate it (statusBadge falls back to a neutral badge).
//
// Download row-action disabled until Phase 2D — no real file
// content stored yet. file_size is a manual byte-count input
// (sane 50 MB max) and storage_path stays unwritten.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.dot = function (root) {
  const myGen = FG._gen.dot = (FG._gen.dot || 0) + 1;

  const TYPES = ['Driver Qualification File', 'Annual Vehicle Inspection', 'Medical Certificate', 'Drug Test Result', 'IFTA Registration', 'PUCO Authority', 'IRP Registration', 'Operating Authority', 'Other'];
  const STATUS_OPTIONS = ['Active', 'Expiring', 'Expired'];
  const FILE_SIZE_MAX = 50 * 1024 * 1024; // 52428800 bytes (50 MB) — matches the documents drop-zone copy

  let files = [];
  let drivers = [];
  let trucks = [];

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const computeStatus = (expiry) => {
    const days = FG.utils.daysFromNow(expiry);
    if (days == null) return 'Active';
    if (days < 0) return 'Expired';
    if (days < 60) return 'Expiring';
    return 'Active';
  };

  const fields = () => [
    { key: 'type', label: 'File Type', type: 'select', required: true, options: TYPES },
    { key: 'name', label: 'Document Name', required: true, full: true },
    { key: 'driver_id', label: 'Related Driver (if any)', type: 'select', options: [{ value: '', label: '— None —' }, ...drivers.map(d => ({ value: d.id, label: d.name }))] },
    { key: 'truck_id', label: 'Related Truck (if any)', type: 'select', options: [{ value: '', label: '— None —' }, ...trucks.map(t => ({ value: t.id, label: t.unit_number }))] },
    { key: 'uploaded_date', label: 'Uploaded Date', type: 'date', value: FG.utils.today() },
    { key: 'expires_date', label: 'Expiration Date', type: 'date' },
    { key: 'file_size', label: 'File Size (bytes)', type: 'number', min: 0, max: FILE_SIZE_MAX },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Upload DOT File',
      fields: fields(),
      data: { uploaded_date: FG.utils.today() },
      submitText: 'Save File',
      onSubmit: async (data) => {
        const status = computeStatus(data.expires_date);
        try {
          const row = await FG.db.create('dot_files', { ...data, status });
          files.unshift(row);
          render();
          FG.toast('DOT file added.', 'success');
        } catch (err) {
          reportError(err, 'Add DOT file failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (f) => {
    FG.modal.form({
      title: 'Edit DOT File',
      fields: fields(),
      data: f,
      submitText: 'Save',
      onSubmit: async (data) => {
        const status = computeStatus(data.expires_date);
        try {
          const row = await FG.db.update('dot_files', f.id, { ...data, status });
          const idx = files.findIndex(x => x.id === f.id);
          if (idx !== -1) files[idx] = row;
          render();
          FG.toast('Updated.', 'success');
        } catch (err) {
          reportError(err, 'Update DOT file failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (f) => {
    FG.modal.confirm({
      message: `Delete <strong>${FG.utils.escapeHtml(f.name)}</strong>?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('dot_files', f.id);
          files = files.filter(x => x.id !== f.id);
          render();
          FG.toast('Deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete failed.');
        }
      },
    });
  };

  const render = () => {
    // UX status override on read; tolerates 'Archived' if stored.
    const data = files.map(f => ({ ...f, status: computeStatus(f.expires_date) }));
    const driverLabel = FG.utils.driverLabel(drivers);
    const truckLabel = FG.utils.truckLabel(trucks);

    const compliance = data.length ? Math.round((data.filter(f => f.status === 'Active').length / data.length) * 100) : 0;
    const expiring = data.filter(f => f.status === 'Expiring').length;
    const expired = data.filter(f => f.status === 'Expired').length;

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Files</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Compliance</div><div class="kpi-value" style="color:${compliance >= 90 ? 'var(--success)' : compliance >= 70 ? 'var(--warning)' : 'var(--danger)'}">${compliance}%</div></div>
        <div class="kpi"><div class="kpi-label">Expiring &lt; 60d</div><div class="kpi-value" style="color:${expiring ? 'var(--warning)' : 'var(--text)'}">${expiring}</div></div>
        <div class="kpi"><div class="kpi-label">Expired</div><div class="kpi-value" style="color:${expired ? 'var(--danger)' : 'var(--text)'}">${expired}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'DOT / PUCO Files',
      subtitle: 'Driver qualification files, vehicle inspection certs, and regulatory paperwork.',
      addLabel: 'Upload File',
      onAdd: openAdd,
      data,
      kpisHtml,
      searchFields: ['name', 'type'],
      filters: [
        { key: 'type', label: 'Type', options: TYPES.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'expires_date',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Document', render: (f) => `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">📄</span><strong>${FG.utils.escapeHtml(f.name)}</strong></div>` },
        { key: 'type', label: 'Type' },
        { key: 'driver_id', label: 'Related', sortable: false, render: (f) => f.driver_id ? FG.utils.escapeHtml(driverLabel(f.driver_id)) : f.truck_id ? FG.utils.escapeHtml(truckLabel(f.truck_id)) : '—' },
        { key: 'uploaded_date', label: 'Uploaded', render: (f) => FG.utils.fmtDateShort(f.uploaded_date) },
        { key: 'expires_date', label: 'Expires', render: (f) => {
          const days = FG.utils.daysFromNow(f.expires_date);
          const color = days != null && days < 0 ? 'var(--danger)' : days != null && days < 60 ? 'var(--warning)' : 'var(--text)';
          return `<span style="color:${color}">${FG.utils.fmtDateShort(f.expires_date)}</span>`;
        }},
        { key: 'status', label: 'Status', render: (f) => FG.utils.statusBadge(f.status) },
      ],
      // Download disabled until Phase 2D — no real file content stored yet.
      // Mirrors the documents drop-zone inertness pattern (no handler, dim
      // styling, aria-disabled). Browser-native click suppression on
      // [disabled] keeps the action from firing even if delegation tries.
      rowActions: () => `<button data-action="download" disabled aria-disabled="true" title="Download coming in Phase 2D" style="opacity:.5;cursor:not-allowed">⬇</button><button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading DOT files…</div>`;
    try {
      const [f, d, t] = await Promise.all([
        FG.db.list('dot_files', { orderBy: 'expires_date', ascending: true }),
        FG.db.list('drivers',   { orderBy: 'name',         ascending: true }),
        FG.db.list('trucks',    { orderBy: 'unit_number',  ascending: true }),
      ]);
      files = f;
      drivers = d;
      trucks = t;
    } catch (err) {
      console.error('dot.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.dot) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load DOT files. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.dot) return;
    render();
  };

  mount();
};
