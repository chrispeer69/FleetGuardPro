// ============================================================
// PANEL: DRIVERS
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.drivers = function (root) {
  const STATUS_OPTIONS = ['Active', 'On Leave', 'Flagged', 'Inactive'];
  const CDL_CLASSES = ['Class A', 'Class B', 'Class C', 'Non-CDL'];

  const driverFields = () => [
    { key: 'name', label: 'Full Name', required: true, full: true },
    { key: 'cdl_number', label: 'CDL Number', placeholder: 'OH-CDxxxxxx' },
    { key: 'cdl_class', label: 'CDL Class', type: 'select', options: CDL_CLASSES },
    { key: 'cdl_expiry', label: 'CDL Expiry', type: 'date' },
    { key: 'medical_card_expiry', label: 'Medical Card Expiry', type: 'date' },
    { key: 'hire_date', label: 'Hire Date', type: 'date' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'safety_score', label: 'Safety Score', type: 'number' },
    { key: 'phone', label: 'Phone', placeholder: '(614) 555-0100' },
    { key: 'email', label: 'Email', type: 'email', full: true },
    { key: 'address', label: 'Address', full: true },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Driver',
      fields: driverFields(),
      submitText: 'Add Driver',
      size: 'lg',
      onSubmit: (data) => {
        FG.state.create('drivers', data);
        FG.toast(`${data.name} added.`, 'success');
        render();
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
      onSubmit: (data) => {
        FG.state.update('drivers', driver.id, data);
        FG.toast(`${data.name} updated.`, 'success');
        render();
      },
    });
  };

  const openDetail = (driver) => {
    const trucks = FG.state.list('trucks').filter(t => t.assigned_driver === driver.id);
    const incidents = FG.state.list('safety_incidents').filter(s => s.driver_id === driver.id);
    const dot = FG.state.list('dot_files').filter(f => f.driver_id === driver.id);

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

        <div class="modal-section-title">Assigned Vehicles (${trucks.length})</div>
        ${trucks.length ? trucks.map(t => `<div class="file-item"><span class="file-icon">🚛</span><span class="file-name">${FG.utils.escapeHtml(t.unit_number)} — ${FG.utils.escapeHtml(t.year + ' ' + t.make + ' ' + t.model)}</span>${FG.utils.statusBadge(t.status)}</div>`).join('') : '<div class="empty-state">Not assigned to any units.</div>'}

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

  const render = () => {
    const data = FG.state.list('drivers');
    const avgScore = data.length ? Math.round(data.reduce((s, d) => s + (d.safety_score || 0), 0) / data.length) : 0;
    const expiringCdl = data.filter(d => { const days = FG.utils.daysFromNow(d.cdl_expiry); return days != null && days < 90 && days >= 0; }).length;

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Drivers</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Active</div><div class="kpi-value" style="color:var(--success)">${data.filter(d => d.status === 'Active').length}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Safety Score</div><div class="kpi-value" style="color:${FG.utils.scoreColor(avgScore)}">${avgScore}</div></div>
        <div class="kpi"><div class="kpi-label">CDL Expiring &lt; 90d</div><div class="kpi-value" style="color:${expiringCdl ? 'var(--warning)' : 'var(--text)'}">${expiringCdl}</div></div>
        <div class="kpi"><div class="kpi-label">Flagged</div><div class="kpi-value" style="color:${data.filter(d => d.status === 'Flagged').length ? 'var(--danger)' : 'var(--text)'}">${data.filter(d => d.status === 'Flagged').length}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Driver Roster',
      subtitle: 'Manage CDL records, qualifications, and assignments.',
      addLabel: 'Add Driver',
      onAdd: openAdd,
      data,
      kpisHtml,
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
        edit: (d) => openEdit(d),
        delete: (d) => {
          const rel = FG.state.relations('drivers', d.id);
          const lines = [];
          if (rel.trucks_assigned.length) lines.push(`${rel.trucks_assigned.length} truck${rel.trucks_assigned.length === 1 ? '' : 's'} assigned (will be unassigned)`);
          if (rel.open_repairs.length) lines.push(`${rel.open_repairs.length} open repair${rel.open_repairs.length === 1 ? '' : 's'} on assigned trucks`);
          if (rel.dot_files.length) lines.push(`${rel.dot_files.length} DOT file${rel.dot_files.length === 1 ? '' : 's'} on record`);
          const msg = lines.length
            ? `<strong>${FG.utils.escapeHtml(d.name)}</strong> has:<ul style="text-align:left;margin:8px 0 0 18px;padding:0">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
            : `Permanently delete <strong>${FG.utils.escapeHtml(d.name)}</strong>?`;
          FG.modal.confirm({
            title: 'Delete Driver?',
            message: msg,
            confirmText: lines.length ? 'Delete Anyway' : 'Delete',
            onConfirm: () => {
              rel.trucks_assigned.forEach(t => FG.state.update('trucks', t.id, { assigned_driver: null }));
              FG.state.remove('drivers', d.id);
              FG.toast(`${d.name} deleted.`, 'success');
              render();
            },
          });
        },
      },
    });
  };

  render();
};
