// ============================================================
// PANEL: FLEET UNITS
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.fleet = function (root) {
  const STATUS_OPTIONS = ['Active', 'PM Overdue', 'Flagged', 'In Shop', 'Inactive'];
  const TYPE_OPTIONS = ['Tow Truck', 'Box Truck', 'Pickup', 'Other'];

  const truckFields = (data = {}) => {
    const drivers = FG.state.list('drivers');
    return [
      { key: 'unit_number', label: 'Unit Number', required: true, placeholder: 'T-108' },
      { key: 'type', label: 'Unit Type', type: 'select', required: true, options: TYPE_OPTIONS },
      { key: 'year', label: 'Year', type: 'number', placeholder: '2024' },
      { key: 'make', label: 'Make', placeholder: 'Kenworth' },
      { key: 'model', label: 'Model', placeholder: 'T270' },
      { key: 'gvwr', label: 'GVWR (lbs)', type: 'number', placeholder: '26000' },
      { key: 'vin', label: 'VIN', required: true, placeholder: '17-character VIN', full: true },
      { key: 'plate', label: 'License Plate', placeholder: 'OH-TRKxxxx' },
      { key: 'color', label: 'Color', placeholder: 'White' },
      { key: 'mileage', label: 'Current Mileage', type: 'number', placeholder: '0' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
      { key: 'safety_score', label: 'Safety Score', type: 'number', placeholder: '85' },
      { key: 'next_pm_miles', label: 'Next PM at Miles', type: 'number' },
      { key: 'next_pm_date', label: 'Next PM Date', type: 'date' },
      { key: 'assigned_driver_id', label: 'Assigned Driver', type: 'select', full: true,
        options: [{ value: '', label: '— Unassigned —' }, ...drivers.map(d => ({ value: d.id, label: d.name }))] },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
    ];
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Fleet Unit',
      fields: truckFields(),
      submitText: 'Add Unit',
      size: 'lg',
      onSubmit: (data) => {
        FG.state.create('trucks', data);
        FG.toast(`${data.unit_number} added.`, 'success');
        render();
      },
    });
  };

  const openEdit = (truck) => {
    FG.modal.form({
      title: `Edit ${truck.unit_number}`,
      fields: truckFields(truck),
      data: truck,
      submitText: 'Save Changes',
      size: 'lg',
      onSubmit: (data) => {
        FG.state.update('trucks', truck.id, data);
        FG.toast(`${data.unit_number} updated.`, 'success');
        render();
      },
    });
  };

  const openDetail = (truck) => {
    const driver = FG.state.driverById(truck.assigned_driver_id);
    const maintHistory = FG.state.list('maintenance').filter(m => m.truck_id === truck.id);
    const repairs = FG.state.list('repairs').filter(r => r.truck_id === truck.id);
    const dot = FG.state.list('dot_files').filter(f => f.truck_id === truck.id);

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

  const render = () => {
    const data = FG.state.list('trucks');
    const drivers = FG.state.list('drivers');

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Units</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Active</div><div class="kpi-value" style="color:var(--success)">${data.filter(t => t.status === 'Active').length}</div></div>
        <div class="kpi"><div class="kpi-label">In Shop</div><div class="kpi-value" style="color:var(--steel)">${data.filter(t => t.status === 'In Shop').length}</div></div>
        <div class="kpi"><div class="kpi-label">PM Overdue</div><div class="kpi-value" style="color:var(--danger)">${data.filter(t => t.status === 'PM Overdue').length}</div></div>
        <div class="kpi"><div class="kpi-label">Total Mileage</div><div class="kpi-value">${FG.utils.fmtNum(data.reduce((s, t) => s + (t.mileage || 0), 0))}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Fleet Units',
      subtitle: 'Manage your registered trucks. Click any row for full details.',
      addLabel: 'Add Unit',
      onAdd: openAdd,
      data,
      kpisHtml,
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
        { key: 'assigned_driver_id', label: 'Driver', render: (t) => FG.utils.escapeHtml(FG.state.driverLabel(t.assigned_driver_id)), sortable: false },
      ],
      rowClick: openDetail,
      rowActions: () => `<button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        edit: (t) => openEdit(t),
        delete: (t) => {
          const rel = FG.state.relations('trucks', t.id);
          if (rel.open_repairs.length) {
            FG.modal.alert({
              title: 'Cannot Delete Unit',
              message: `<strong>${FG.utils.escapeHtml(t.unit_number)}</strong> has <strong>${rel.open_repairs.length}</strong> open repair request${rel.open_repairs.length === 1 ? '' : 's'}. Close those first.`,
            });
            return;
          }
          const lines = [];
          if (rel.maintenance.length) lines.push(`${rel.maintenance.length} maintenance record${rel.maintenance.length === 1 ? '' : 's'} (will be cascade-deleted)`);
          if (rel.dot_files.length) lines.push(`${rel.dot_files.length} DOT file${rel.dot_files.length === 1 ? '' : 's'} (will be unlinked, kept for audit)`);
          const msg = lines.length
            ? `<strong>${FG.utils.escapeHtml(t.unit_number)}</strong> has:<ul style="text-align:left;margin:8px 0 0 18px;padding:0">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
            : `Permanently delete <strong>${FG.utils.escapeHtml(t.unit_number)}</strong>?`;
          FG.modal.confirm({
            title: 'Delete Unit?',
            message: msg,
            confirmText: 'Delete',
            onConfirm: () => {
              rel.maintenance.forEach(m => FG.state.remove('maintenance', m.id));
              rel.dot_files.forEach(f => FG.state.update('dot_files', f.id, { truck_id: null }));
              FG.state.remove('trucks', t.id);
              FG.toast(`${t.unit_number} deleted.`, 'success');
              render();
            },
          });
        },
      },
    });
  };

  render();
};

