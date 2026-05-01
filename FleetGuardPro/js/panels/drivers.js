// ============================================================
// PANEL: DRIVERS
// ============================================================
// Wave 2 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. Drivers is the FK-target
// side of the trucks.assigned_driver_id relationship; this panel
// reads trucks for the detail modal "Assigned Vehicles" section
// and the delete-warning count.
//
// Mount fetches [drivers, trucks] in parallel. Detail modal lazy-
// fetches safety_incidents + dot_files on open. Delete handler
// lazy-fetches repairs + dot_files for the warning copy, then
// relies on DB to:
//   trucks.assigned_driver_id  ON DELETE SET NULL  (unassigns)
//   dot_files.driver_id        ON DELETE CASCADE   (DQ files removed
//                                                   with driver — DQ
//                                                   files belong to
//                                                   the person, unlike
//                                                   truck DOT files)
//   safety_incidents.driver_id ON DELETE CASCADE
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.drivers = function (root) {
  // Mount-cycle generation. See parts.js for the rationale.
  const myGen = FG._gen.drivers = (FG._gen.drivers || 0) + 1;

  const STATUS_OPTIONS = ['Active', 'On Leave', 'Flagged', 'Inactive'];
  const CDL_CLASSES = ['Class A', 'Class B', 'Class C'];

  let drivers = [];
  let trucks = [];
  let tableHandle = null;

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const driverFields = () => [
    { key: 'name', label: 'Full Name', required: true, full: true },
    { key: 'cdl_number', label: 'CDL Number', placeholder: 'OH-CDxxxxxx' },
    { key: 'cdl_class', label: 'CDL Class', type: 'select', options: CDL_CLASSES, hint: 'Leave blank for non-CDL drivers' },
    { key: 'cdl_expiry', label: 'CDL Expiry', type: 'date' },
    { key: 'medical_card_expiry', label: 'Medical Card Expiry', type: 'date' },
    { key: 'hire_date', label: 'Hire Date', type: 'date' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'safety_score', label: 'Safety Score', type: 'number', min: 0, max: 100 },
    { key: 'phone', label: 'Phone', placeholder: '(614) 555-0100' },
    { key: 'email', label: 'Email', type: 'email', full: true },
    { key: 'address', label: 'Address', full: true },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const buildKpis = (data) => {
    const avgScore = data.length ? Math.round(data.reduce((s, d) => s + (d.safety_score || 0), 0) / data.length) : 0;
    const expiringCdl = data.filter(d => { const days = FG.utils.daysFromNow(d.cdl_expiry); return days != null && days < 90 && days >= 0; }).length;
    const flagged = data.filter(d => d.status === 'Flagged').length;
    return `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Drivers</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Active</div><div class="kpi-value" style="color:var(--success)">${data.filter(d => d.status === 'Active').length}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Safety Score</div><div class="kpi-value" style="color:${FG.utils.scoreColor(avgScore)}">${avgScore}</div></div>
        <div class="kpi"><div class="kpi-label">CDL Expiring &lt; 90d</div><div class="kpi-value" style="color:${expiringCdl ? 'var(--warning)' : 'var(--text)'}">${expiringCdl}</div></div>
        <div class="kpi"><div class="kpi-label">Flagged</div><div class="kpi-value" style="color:${flagged ? 'var(--danger)' : 'var(--text)'}">${flagged}</div></div>
      </div>
    `;
  };

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(drivers);
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Driver',
      fields: driverFields(),
      submitText: 'Add Driver',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('drivers', data);
          drivers.unshift(row);
          tableHandle.state.data = drivers;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.name} added.`, 'success');
        } catch (err) {
          reportError(err, 'Add driver failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (driver) => {
    FG.modal.form({
      title: `Edit ${driver.name}`,
      fields: driverFields(),
      data: driver,
      submitText: 'Save Changes',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('drivers', driver.id, data);
          const idx = drivers.findIndex(x => x.id === driver.id);
          if (idx !== -1) drivers[idx] = row;
          tableHandle.state.data = drivers;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.name} updated.`, 'success');
        } catch (err) {
          reportError(err, 'Update driver failed.');
          return false;
        }
      },
    });
  };

  const openDetail = async (driver) => {
    const assignedTrucks = trucks.filter(t => t.assigned_driver_id === driver.id);

    let incidents = [], dot = [];
    try {
      const [si, df] = await Promise.all([
        FG.db.list('safety_incidents'),
        FG.db.list('dot_files'),
      ]);
      incidents = si.filter(x => x.driver_id === driver.id);
      dot = df.filter(x => x.driver_id === driver.id);
    } catch (err) {
      reportError(err, 'Failed to load driver details.');
      return;
    }

    const cdlDays = FG.utils.daysFromNow(driver.cdl_expiry);
    const medDays = FG.utils.daysFromNow(driver.medical_card_expiry);

    FG.modal.open({
      title: driver.name,
      size: 'lg',
      body: `
        <div class="metrics-row" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          <div class="metric-card" style="padding:14px"><div class="metric-label">Safety Score</div><div class="metric-value" style="font-size:26px;color:${FG.utils.scoreColor(driver.safety_score)}">${driver.safety_score || '—'}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">Status</div><div style="margin-top:8px">${FG.utils.statusBadge(driver.status)}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">CDL Expires</div><div class="metric-value" style="font-size:18px;margin-top:8px;color:${cdlDays != null && cdlDays < 60 ? 'var(--warning)' : 'var(--text)'}">${FG.utils.fmtDateShort(driver.cdl_expiry)}</div></div>
          <div class="metric-card" style="padding:14px"><div class="metric-label">Med Card Expires</div><div class="metric-value" style="font-size:18px;margin-top:8px;color:${medDays != null && medDays < 60 ? 'var(--warning)' : 'var(--text)'}">${FG.utils.fmtDateShort(driver.medical_card_expiry)}</div></div>
        </div>

        <div class="modal-section-title">Driver Details</div>
        <div class="detail-grid">
          <div class="detail-row"><span class="lbl">CDL Number</span><span class="val mono">${FG.utils.escapeHtml(driver.cdl_number || '—')}</span></div>
          <div class="detail-row"><span class="lbl">CDL Class</span><span class="val">${FG.utils.escapeHtml(driver.cdl_class || '—')}</span></div>
          <div class="detail-row"><span class="lbl">Hire Date</span><span class="val">${FG.utils.fmtDate(driver.hire_date)}</span></div>
          <div class="detail-row"><span class="lbl">Date of Birth</span><span class="val">${FG.utils.fmtDate(driver.dob)}</span></div>
          <div class="detail-row"><span class="lbl">Phone</span><span class="val">${FG.utils.escapeHtml(driver.phone || '—')}</span></div>
          <div class="detail-row"><span class="lbl">Email</span><span class="val">${FG.utils.escapeHtml(driver.email || '—')}</span></div>
        </div>
        <div class="detail-row" style="grid-column:1/-1"><span class="lbl">Address</span><span class="val">${FG.utils.escapeHtml(driver.address || '—')}</span></div>

        ${driver.notes ? `<div class="modal-section-title">Notes</div><div style="font-size:13px;color:var(--muted)">${FG.utils.escapeHtml(driver.notes)}</div>` : ''}

        <div class="modal-section-title">Assigned Vehicles (${assignedTrucks.length})</div>
        ${assignedTrucks.length ? assignedTrucks.map(t => `<div class="file-item"><span class="file-icon">🚛</span><span class="file-name">${FG.utils.escapeHtml(t.unit_number)} — ${FG.utils.escapeHtml(t.year + ' ' + t.make + ' ' + t.model)}</span>${FG.utils.statusBadge(t.status)}</div>`).join('') : '<div class="empty-state">Not assigned to any units.</div>'}

        <div class="modal-section-title">Safety Incidents (${incidents.length})</div>
        ${incidents.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead><tbody>
          ${incidents.map(i => `<tr><td>${FG.utils.fmtDateShort(i.date)}</td><td>${FG.utils.escapeHtml(i.type)}</td><td>${FG.utils.statusBadge(i.severity)}</td><td>${FG.utils.statusBadge(i.status)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty-state">No safety incidents on record.</div>'}

        <div class="modal-section-title">DOT / DQ Files (${dot.length})</div>
        ${dot.length ? dot.map(d => `<div class="file-item"><span class="file-icon">📄</span><span class="file-name">${FG.utils.escapeHtml(d.name)}</span><span class="file-size">expires ${FG.utils.fmtDateShort(d.expires_date)}</span></div>`).join('') : '<div class="empty-state">No DQ files on record.</div>'}
      `,
      footer: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" id="btn-edit-driver">Edit Driver</button>`,
    });
    document.getElementById('btn-edit-driver').addEventListener('click', () => { FG.modal.closeAll(); openEdit(driver); });
  };

  const onDelete = async (d) => {
    const trucksAssigned = trucks.filter(t => t.assigned_driver_id === d.id);

    let openRepairsCount = 0, dotCount = 0;
    try {
      const [r, df] = await Promise.all([
        FG.db.list('repairs'),
        FG.db.list('dot_files'),
      ]);
      const truckIds = trucksAssigned.map(t => t.id);
      openRepairsCount = r.filter(x => truckIds.includes(x.truck_id) && x.status !== 'Closed').length;
      dotCount = df.filter(x => x.driver_id === d.id).length;
    } catch (err) {
      reportError(err, 'Failed to check related records.');
      return;
    }

    const lines = [];
    if (trucksAssigned.length) lines.push(`${trucksAssigned.length} truck${trucksAssigned.length === 1 ? '' : 's'} assigned (will be unassigned)`);
    if (openRepairsCount) lines.push(`${openRepairsCount} open repair${openRepairsCount === 1 ? '' : 's'} on assigned trucks`);
    if (dotCount) lines.push(`${dotCount} DQ file${dotCount === 1 ? '' : 's'} (will be removed with driver)`);
    const msg = lines.length
      ? `<strong>${FG.utils.escapeHtml(d.name)}</strong> has:<ul style="text-align:left;margin:8px 0 0 18px;padding:0">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
      : `Permanently delete <strong>${FG.utils.escapeHtml(d.name)}</strong>?`;

    FG.modal.confirm({
      title: 'Delete Driver?',
      message: msg,
      confirmText: lines.length ? 'Delete Anyway' : 'Delete',
      onConfirm: async () => {
        try {
          // DB SETs NULL on trucks.assigned_driver_id, cascades dot_files & safety_incidents.
          await FG.db.remove('drivers', d.id);
          drivers = drivers.filter(x => x.id !== d.id);
          // Reflect server-side SET NULL in our local trucks cache so the
          // detail modal / delete-warning won't lie until next mount.
          trucks = trucks.map(t => t.assigned_driver_id === d.id ? { ...t, assigned_driver_id: null } : t);
          tableHandle.state.data = drivers;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${d.name} deleted.`, 'success');
        } catch (err) {
          reportError(err, 'Delete driver failed.');
        }
      },
    });
  };

  const renderPanel = () => {
    tableHandle = FG.table.panel({
      container: root,
      title: 'Driver Roster',
      subtitle: 'Manage CDL records, qualifications, and assignments.',
      addLabel: 'Add Driver',
      onAdd: openAdd,
      data: drivers,
      kpisHtml: buildKpis(drivers),
      emptyMessage: 'No drivers yet. Add your first driver to get started.',
      searchFields: ['name', 'cdl_number', 'phone', 'email'],
      filters: [
        { key: 'cdl_class', label: 'CDL Class', options: CDL_CLASSES.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'name',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Driver', render: (d) => `<div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="width:28px;height:28px;font-size:11px">${FG.utils.initials(d.name)}</div><strong>${FG.utils.escapeHtml(d.name)}</strong></div>` },
        { key: 'cdl_class', label: 'CDL', render: (d) => `${FG.utils.escapeHtml(d.cdl_class || '—')}<div style="font-size:11px;color:var(--muted-strong);font-family:var(--font-mono)">${FG.utils.escapeHtml(d.cdl_number || '')}</div>` },
        { key: 'cdl_expiry', label: 'CDL Expiry', render: (d) => {
          const days = FG.utils.daysFromNow(d.cdl_expiry);
          const color = days != null && days < 60 ? 'var(--warning)' : days != null && days < 0 ? 'var(--danger)' : 'var(--text)';
          return `<span style="color:${color}">${FG.utils.fmtDateShort(d.cdl_expiry)}</span>`;
        }},
        { key: 'medical_card_expiry', label: 'Med Card', render: (d) => FG.utils.fmtDateShort(d.medical_card_expiry) },
        { key: 'safety_score', label: 'Score', align: 'right', render: (d) => `<span style="color:${FG.utils.scoreColor(d.safety_score)};font-weight:600">${d.safety_score || '—'}</span>` },
        { key: 'status', label: 'Status', render: (d) => FG.utils.statusBadge(d.status) },
        { key: 'phone', label: 'Phone', sortable: false, render: (d) => `<span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(d.phone || '—')}</span>` },
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
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading drivers…</div>`;
    try {
      const [d, t] = await Promise.all([
        FG.db.list('drivers', { orderBy: 'name',        ascending: true }),
        FG.db.list('trucks',  { orderBy: 'unit_number', ascending: true }),
      ]);
      drivers = d;
      trucks = t;
    } catch (err) {
      console.error('drivers.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.drivers) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load drivers. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.drivers) return;
    renderPanel();
  };

  mount();
};
