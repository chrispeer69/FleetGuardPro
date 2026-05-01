// ============================================================
// PANEL: FLEET UNITS
// ============================================================
// Wave 2 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. Trucks own the
// assigned_driver_id FK to drivers; this panel is the FK-owner side.
//
// Mount fetches [trucks, drivers] in parallel — drivers is needed
// for the Assigned Driver dropdown (form + filter) and the table
// column. Detail modal and delete handler lazy-fetch related
// tables (maintenance / repairs / dot_files) on demand.
//
// Truck delete relies on DB cascade behavior set up in Wave 2 prep:
//   maintenance.truck_id    ON DELETE CASCADE  (records removed)
//   dot_files.truck_id      ON DELETE SET NULL (preserved for audit)
//   safety_incidents.       ON DELETE SET NULL (preserved for audit)
//   repairs.truck_id        ON DELETE CASCADE  (but panel blocks
//                                               delete if any open)
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.fleet = function (root) {
  // Mount-cycle generation. See parts.js for the rationale.
  const myGen = FG._gen.fleet = (FG._gen.fleet || 0) + 1;

  const STATUS_OPTIONS = ['Active', 'PM Overdue', 'Flagged', 'In Shop', 'Out of Service', 'Sold'];
  const TYPE_OPTIONS = ['Tow Truck', 'Box Truck', 'Pickup', 'Other'];

  let trucks = [];
  let drivers = [];
  let tableHandle = null;

  // ── Local helper: driver label by id ────────────────────────
  // Lift candidate (paired with makeTruckLabel in overview.js): once
  // a third panel needs this, promote both to FG.utils.
  const makeDriverLabel = (drivers) => {
    const byId = new Map(drivers.map(d => [d.id, d]));
    return (id) => {
      if (!id) return '— Unassigned —';
      const d = byId.get(id);
      return d ? d.name : '— Unassigned —';
    };
  };

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const truckFields = () => [
    { key: 'unit_number', label: 'Unit Number', required: true, placeholder: 'T-108' },
    { key: 'type', label: 'Unit Type', type: 'select', required: true, options: TYPE_OPTIONS },
    { key: 'year', label: 'Year', type: 'number', placeholder: '2024', min: 1980, max: 2100 },
    { key: 'make', label: 'Make', placeholder: 'Kenworth' },
    { key: 'model', label: 'Model', placeholder: 'T270' },
    { key: 'gvwr', label: 'GVWR (lbs)', type: 'number', placeholder: '26000', min: 0 },
    { key: 'vin', label: 'VIN', required: true, placeholder: '17-character VIN', full: true },
    { key: 'plate', label: 'License Plate', placeholder: 'OH-TRKxxxx' },
    { key: 'color', label: 'Color', placeholder: 'White' },
    { key: 'mileage', label: 'Current Mileage', type: 'number', placeholder: '0', min: 0 },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'safety_score', label: 'Safety Score', type: 'number', placeholder: '85', min: 0, max: 100 },
    { key: 'next_pm_miles', label: 'Next PM at Miles', type: 'number', min: 0 },
    { key: 'next_pm_date', label: 'Next PM Date', type: 'date' },
    { key: 'assigned_driver_id', label: 'Assigned Driver', type: 'select', full: true,
      options: [{ value: '', label: '— Unassigned —' }, ...drivers.map(d => ({ value: d.id, label: d.name }))] },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const buildKpis = (data) => `
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Units</div><div class="kpi-value">${data.length}</div></div>
      <div class="kpi"><div class="kpi-label">Active</div><div class="kpi-value" style="color:var(--success)">${data.filter(t => t.status === 'Active').length}</div></div>
      <div class="kpi"><div class="kpi-label">In Shop</div><div class="kpi-value" style="color:var(--steel)">${data.filter(t => t.status === 'In Shop').length}</div></div>
      <div class="kpi"><div class="kpi-label">PM Overdue</div><div class="kpi-value" style="color:var(--danger)">${data.filter(t => t.status === 'PM Overdue').length}</div></div>
      <div class="kpi"><div class="kpi-label">Total Mileage</div><div class="kpi-value">${FG.utils.fmtNum(data.reduce((s, t) => s + (t.mileage || 0), 0))}</div></div>
    </div>
  `;

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(trucks);
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Fleet Unit',
      fields: truckFields(),
      submitText: 'Add Unit',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('trucks', data);
          trucks.unshift(row);
          tableHandle.state.data = trucks;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.unit_number} added.`, 'success');
        } catch (err) {
          reportError(err, 'Add unit failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (truck) => {
    FG.modal.form({
      title: `Edit ${truck.unit_number}`,
      fields: truckFields(),
      data: truck,
      submitText: 'Save Changes',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('trucks', truck.id, data);
          const idx = trucks.findIndex(x => x.id === truck.id);
          if (idx !== -1) trucks[idx] = row;
          tableHandle.state.data = trucks;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.unit_number} updated.`, 'success');
        } catch (err) {
          reportError(err, 'Update unit failed.');
          return false;
        }
      },
    });
  };

  const openDetail = async (truck) => {
    const driver = drivers.find(d => d.id === truck.assigned_driver_id);

    let maintHistory = [], repairs = [], dot = [];
    try {
      const [m, r, d] = await Promise.all([
        FG.db.list('maintenance'),
        FG.db.list('repairs'),
        FG.db.list('dot_files'),
      ]);
      maintHistory = m.filter(x => x.truck_id === truck.id);
      repairs = r.filter(x => x.truck_id === truck.id);
      dot = d.filter(x => x.truck_id === truck.id);
    } catch (err) {
      reportError(err, 'Failed to load unit details.');
      return;
    }

    FG.modal.open({
      title: `Unit ${truck.unit_number} — ${truck.year} ${truck.make} ${truck.model}`,
      size: 'lg',
      body: `
        <div class="metrics-row" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          <div class="metric-card" style="padding:14px"><div class="metric-label">Safety Score</div><div class="metric-value" style="font-size:26px;color:${FG.utils.scoreColor(truck.safety_score)}">${truck.safety_score || '—'}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">Odometer</div><div class="metric-value" style="font-size:26px">${FG.utils.fmtNum(truck.mileage)}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">Status</div><div style="margin-top:8px">${FG.utils.statusBadge(truck.status)}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">Next PM</div><div class="metric-value" style="font-size:18px;margin-top:8px">${FG.utils.fmtDateShort(truck.next_pm_date)}</div></div>
        </div>

        <div class="modal-section-title">Vehicle Details</div>
        <div class="detail-grid">
          <div class="detail-row"><span class="lbl">VIN</span><span class="val mono">${FG.utils.escapeHtml(truck.vin || '—')}</span></div>
          <div class="detail-row"><span class="lbl">License Plate</span><span class="val mono">${FG.utils.escapeHtml(truck.plate || '—')}</span></div>
          <div class="detail-row"><span class="lbl">Type</span><span class="val">${FG.utils.escapeHtml(truck.type || '—')}</span></div>
          <div class="detail-row"><span class="lbl">GVWR</span><span class="val">${truck.gvwr ? FG.utils.fmtNum(truck.gvwr) + ' lbs' : '—'}</span></div>
          <div class="detail-row"><span class="lbl">Color</span><span class="val">${FG.utils.escapeHtml(truck.color || '—')}</span></div>
          <div class="detail-row"><span class="lbl">Assigned Driver</span><span class="val">${driver ? FG.utils.escapeHtml(driver.name) : '— Unassigned —'}</span></div>
        </div>

        ${truck.notes ? `<div class="modal-section-title">Notes</div><div style="font-size:13px;color:var(--muted)">${FG.utils.escapeHtml(truck.notes)}</div>` : ''}

        <div class="modal-section-title">Maintenance History (${maintHistory.length})</div>
        ${maintHistory.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Type</th><th>Status</th><th>Due</th><th style="text-align:right">Cost</th></tr></thead><tbody>
          ${maintHistory.slice(0, 8).map(m => `<tr><td>${FG.utils.escapeHtml(m.type)}</td><td>${FG.utils.statusBadge(m.status)}</td><td>${FG.utils.fmtDateShort(m.due_date)}</td><td style="text-align:right">${m.cost ? FG.utils.fmtMoney(m.cost, 2) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty-state">No maintenance records.</div>'}

        <div class="modal-section-title">Repair Requests (${repairs.length})</div>
        ${repairs.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Issue</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead><tbody>
          ${repairs.map(r => `<tr><td>${FG.utils.escapeHtml(r.issue)}</td><td>${FG.utils.statusBadge(r.priority)}</td><td>${FG.utils.statusBadge(r.status)}</td><td>${FG.utils.fmtDateShort(r.opened_date)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty-state">No repair requests.</div>'}

        <div class="modal-section-title">DOT Documents (${dot.length})</div>
        ${dot.length ? dot.map(d => `<div class="file-item"><span class="file-icon">📄</span><span class="file-name">${FG.utils.escapeHtml(d.name)}</span><span class="file-size">${FG.utils.fmtDateShort(d.expires_date)}</span></div>`).join('') : '<div class="empty-state">No DOT files for this unit.</div>'}
      `,
      footer: `
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn btn-secondary" id="btn-edit-truck">Edit Unit</button>
        <button class="btn btn-primary" id="btn-add-repair">+ Repair Request</button>
      `,
    });
    document.getElementById('btn-edit-truck').addEventListener('click', () => { FG.modal.closeAll(); openEdit(truck); });
    document.getElementById('btn-add-repair').addEventListener('click', () => {
      FG.modal.closeAll();
      FG.app.navigate('repairs');
      FG.toast(`Now add a repair for ${truck.unit_number}.`, 'info');
    });
  };

  const onDelete = async (t) => {
    let openRepairsCount = 0, maintCount = 0, dotCount = 0;
    try {
      const [r, m, d] = await Promise.all([
        FG.db.list('repairs'),
        FG.db.list('maintenance'),
        FG.db.list('dot_files'),
      ]);
      openRepairsCount = r.filter(x => x.truck_id === t.id && x.status !== 'Closed').length;
      maintCount = m.filter(x => x.truck_id === t.id).length;
      dotCount = d.filter(x => x.truck_id === t.id).length;
    } catch (err) {
      reportError(err, 'Failed to check related records.');
      return;
    }

    if (openRepairsCount) {
      FG.modal.alert({
        title: 'Cannot Delete Unit',
        message: `<strong>${FG.utils.escapeHtml(t.unit_number)}</strong> has <strong>${openRepairsCount}</strong> open repair request${openRepairsCount === 1 ? '' : 's'}. Close those first.`,
      });
      return;
    }

    const lines = [];
    if (maintCount) lines.push(`${maintCount} maintenance record${maintCount === 1 ? '' : 's'} (will be cascade-deleted)`);
    if (dotCount) lines.push(`${dotCount} DOT file${dotCount === 1 ? '' : 's'} (will be unlinked, kept for audit)`);
    const msg = lines.length
      ? `<strong>${FG.utils.escapeHtml(t.unit_number)}</strong> has:<ul style="text-align:left;margin:8px 0 0 18px;padding:0">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
      : `Permanently delete <strong>${FG.utils.escapeHtml(t.unit_number)}</strong>?`;

    FG.modal.confirm({
      title: 'Delete Unit?',
      message: msg,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          // DB cascades maintenance; SETs NULL on dot_files / safety_incidents (Wave 2 prep migration).
          await FG.db.remove('trucks', t.id);
          trucks = trucks.filter(x => x.id !== t.id);
          tableHandle.state.data = trucks;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${t.unit_number} deleted.`, 'success');
        } catch (err) {
          reportError(err, 'Delete unit failed.');
        }
      },
    });
  };

  const renderPanel = () => {
    const driverLabel = makeDriverLabel(drivers);

    tableHandle = FG.table.panel({
      container: root,
      title: 'Fleet Units',
      subtitle: 'Manage your registered trucks. Click any row for full details.',
      addLabel: 'Add Unit',
      onAdd: openAdd,
      data: trucks,
      kpisHtml: buildKpis(trucks),
      emptyMessage: 'No fleet units yet. Add your first unit to get started.',
      searchFields: ['unit_number', 'make', 'model', 'vin', 'plate'],
      filters: [
        { key: 'type', label: 'Type', options: TYPE_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'assigned_driver_id', label: 'Driver', options: [{ value: 'unassigned', label: 'Unassigned' }, ...drivers.map(d => ({ value: d.id, label: d.name }))],
          match: (item, v) => v === 'unassigned' ? !item.assigned_driver_id : item.assigned_driver_id === v },
      ],
      defaultSort: 'unit_number',
      defaultDir: 'asc',
      columns: [
        { key: 'unit_number', label: 'Unit', render: (t) => `<strong>${FG.utils.escapeHtml(t.unit_number)}</strong>` },
        { key: 'make', label: 'Make / Model', render: (t) => `${t.year || ''} ${FG.utils.escapeHtml(t.make || '')} ${FG.utils.escapeHtml(t.model || '')}`.trim() || '—' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', render: (t) => FG.utils.statusBadge(t.status) },
        { key: 'mileage', label: 'Mileage', align: 'right', render: (t) => FG.utils.fmtNum(t.mileage) },
        { key: 'next_pm_date', label: 'Next PM', render: (t) => FG.utils.fmtDateShort(t.next_pm_date) },
        { key: 'safety_score', label: 'Score', align: 'right', render: (t) => `<span style="color:${FG.utils.scoreColor(t.safety_score)};font-weight:600">${t.safety_score || '—'}</span>` },
        { key: 'assigned_driver_id', label: 'Driver', render: (t) => FG.utils.escapeHtml(driverLabel(t.assigned_driver_id)), sortable: false },
      ],
      rowClick: openDetail,
      rowActions: () => `<button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading fleet…</div>`;
    try {
      const [t, d] = await Promise.all([
        FG.db.list('trucks',  { orderBy: 'unit_number', ascending: true }),
        FG.db.list('drivers', { orderBy: 'name',        ascending: true }),
      ]);
      trucks = t;
      drivers = d;
    } catch (err) {
      console.error('fleet.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.fleet) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load fleet. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.fleet) return;
    renderPanel();
  };

  mount();
};
