// ============================================================
// PANEL: REPAIR REQUESTS
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.repairs = function (root) {
  const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
  const STATUS_OPTIONS = ['Open', 'In Progress', 'Closed'];

  const fields = (presetTruckId) => {
    const trucks = FG.state.list('trucks');
    const shops = FG.state.list('garage_shops');
    return [
      { key: 'truck_id', label: 'Truck', type: 'select', required: true, options: trucks.map(t => ({ value: t.id, label: t.unit_number + ' — ' + t.year + ' ' + t.make })), value: presetTruckId },
      { key: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITY_OPTIONS, value: 'Medium' },
      { key: 'issue', label: 'Issue', required: true, full: true, placeholder: 'Brief description of the problem' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, value: 'Open' },
      { key: 'shop', label: 'Repair Shop', type: 'select', options: [{ value: '', label: '— Not Assigned —' }, ...shops.map(s => ({ value: s.name, label: s.name }))] },
      { key: 'est_cost', label: 'Estimated Cost', type: 'number' },
      { key: 'opened_date', label: 'Opened Date', type: 'date', value: FG.utils.today() },
      { key: 'closed_date', label: 'Closed Date', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
    ];
  };

  const openAdd = (presetTruckId) => {
    FG.modal.form({
      title: 'New Repair Request',
      fields: fields(presetTruckId),
      submitText: 'Submit',
      onSubmit: (data) => {
        FG.state.create('repairs', data);
        FG.toast('Repair request created.', 'success');
        render();
      },
    });
  };

  const openEdit = (r) => {
    FG.modal.form({
      title: 'Edit Repair Request',
      fields: fields(),
      data: r,
      submitText: 'Save',
      onSubmit: (data) => {
        FG.state.update('repairs', r.id, data);
        FG.toast('Repair updated.', 'success');
        render();
      },
    });
  };

  const closeRepair = (r) => {
    FG.modal.form({
      title: 'Close Repair',
      fields: [
        { key: 'closed_date', label: 'Closed Date', type: 'date', required: true, value: FG.utils.today() },
        { key: 'final_cost', label: 'Final Cost', type: 'number' },
        { key: 'notes', label: 'Resolution Notes', type: 'textarea', rows: 3, full: true },
      ],
      data: { closed_date: FG.utils.today(), notes: r.notes },
      submitText: 'Close Repair',
      onSubmit: (data) => {
        FG.state.update('repairs', r.id, { ...data, status: 'Closed', est_cost: data.final_cost || r.est_cost });
        FG.toast('Repair closed.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('repairs');
    const trucks = FG.state.list('trucks');
    const open = data.filter(r => r.status === 'Open').length;
    const inProgress = data.filter(r => r.status === 'In Progress').length;
    const closed = data.filter(r => r.status === 'Closed').length;
    const totalEst = data.filter(r => r.status !== 'Closed').reduce((s, r) => s + (r.est_cost || 0), 0);

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:var(--accent)">${open}</div></div>
        <div class="kpi"><div class="kpi-label">In Progress</div><div class="kpi-value" style="color:var(--steel)">${inProgress}</div></div>
        <div class="kpi"><div class="kpi-label">Closed</div><div class="kpi-value" style="color:var(--success)">${closed}</div></div>
        <div class="kpi"><div class="kpi-label">Open Est. Cost</div><div class="kpi-value">${FG.utils.fmtMoney(totalEst)}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Repair Requests',
      subtitle: 'Track open issues, assign shops, and close repairs.',
      addLabel: 'New Request',
      onAdd: () => openAdd(),
      data,
      kpisHtml,
      searchFields: ['issue', 'shop', 'notes'],
      filters: [
        { key: 'truck_id', label: 'Truck', options: trucks.map(t => ({ value: t.id, label: t.unit_number })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'opened_date',
      defaultDir: 'desc',
      columns: [
        { key: 'truck_id', label: 'Unit', render: (r) => FG.utils.escapeHtml(FG.state.truckLabel(r.truck_id)) },
        { key: 'issue', label: 'Issue', render: (r) => FG.utils.escapeHtml(r.issue) },
        { key: 'priority', label: 'Priority', render: (r) => FG.utils.statusBadge(r.priority) },
        { key: 'status', label: 'Status', render: (r) => FG.utils.statusBadge(r.status) },
        { key: 'shop', label: 'Shop', render: (r) => FG.utils.escapeHtml(r.shop || '—') },
        { key: 'est_cost', label: 'Est. Cost', align: 'right', render: (r) => r.est_cost ? FG.utils.fmtMoney(r.est_cost) : '—' },
        { key: 'opened_date', label: 'Opened', render: (r) => FG.utils.fmtDateShort(r.opened_date) },
      ],
      rowActions: (r) => `
        ${r.status !== 'Closed' ? '<button data-action="close">Close</button>' : ''}
        <button data-action="edit">Edit</button>
        <button data-action="delete" class="danger">✕</button>
      `,
      actionHandlers: {
        close: closeRepair,
        edit: openEdit,
        delete: (r) => FG.modal.confirm({
          message: `Delete this repair request?`,
          confirmText: 'Delete', onConfirm: () => { FG.state.remove('repairs', r.id); FG.toast('Deleted.', 'success'); render(); }
        }),
      },
    });
  };

  render();
};

