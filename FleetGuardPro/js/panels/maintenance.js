// ============================================================
// PANEL: MAINTENANCE
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.maintenance = function (root) {
  const TYPES = ['Oil & Filter Change', 'Brake Inspection', 'Tire Rotation', 'DOT Annual Inspection', 'Annual Inspection', 'Transmission Service', 'Coolant Flush', 'Air Filter', 'DPF Service', 'Other'];
  const STATUS_OPTIONS = ['Scheduled', 'Overdue', 'In Progress', 'Completed'];

  const fields = () => {
    const trucks = FG.state.list('trucks');
    return [
      { key: 'truck_id', label: 'Truck', type: 'select', required: true, options: trucks.map(t => ({ value: t.id, label: `${t.unit_number} — ${t.year} ${t.make}` })) },
      { key: 'type', label: 'Service Type', type: 'select', required: true, options: TYPES },
      { key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { key: 'due_miles', label: 'Due Mileage', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
      { key: 'cost', label: 'Cost (if completed)', type: 'number' },
      { key: 'completed_date', label: 'Completed Date', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
    ];
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Schedule Maintenance',
      fields: fields(),
      data: { status: 'Scheduled', due_date: FG.utils.today() },
      submitText: 'Schedule',
      onSubmit: (data) => {
        FG.state.create('maintenance', data);
        FG.toast('Maintenance task scheduled.', 'success');
        render();
      },
    });
  };

  const openEdit = (m) => {
    FG.modal.form({
      title: 'Edit Maintenance',
      fields: fields(),
      data: m,
      submitText: 'Save',
      onSubmit: (data) => {
        FG.state.update('maintenance', m.id, data);
        FG.toast('Maintenance updated.', 'success');
        render();
      },
    });
  };

  const markComplete = (m) => {
    FG.modal.form({
      title: 'Mark Complete',
      fields: [
        { key: 'completed_date', label: 'Completed Date', type: 'date', required: true, value: FG.utils.today() },
        { key: 'cost', label: 'Cost', type: 'number', required: true },
        { key: 'notes', label: 'Completion Notes', type: 'textarea', rows: 3, full: true },
      ],
      data: { completed_date: FG.utils.today(), notes: m.notes },
      submitText: 'Complete',
      onSubmit: (data) => {
        FG.state.update('maintenance', m.id, { ...data, status: 'Completed' });
        FG.toast('Marked complete.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('maintenance');
    const trucks = FG.state.list('trucks');
    const overdue = data.filter(m => m.status === 'Overdue').length;
    const upcoming = data.filter(m => m.status === 'Scheduled' && FG.utils.daysFromNow(m.due_date) >= 0 && FG.utils.daysFromNow(m.due_date) < 30).length;
    const completed = data.filter(m => m.status === 'Completed').length;
    const totalSpend = data.filter(m => m.status === 'Completed').reduce((s, m) => s + (m.cost || 0), 0);

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:${overdue ? 'var(--danger)' : 'var(--text)'}">${overdue}</div></div>
        <div class="kpi"><div class="kpi-label">Due in 30 days</div><div class="kpi-value" style="color:${upcoming ? 'var(--warning)' : 'var(--text)'}">${upcoming}</div></div>
        <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:var(--success)">${completed}</div></div>
        <div class="kpi"><div class="kpi-label">Lifetime Spend</div><div class="kpi-value">${FG.utils.fmtMoney(totalSpend)}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Maintenance Schedule',
      subtitle: 'Preventive maintenance, annual inspections, and completed work.',
      addLabel: 'Schedule Service',
      onAdd: openAdd,
      data,
      kpisHtml,
      searchFields: ['type', 'notes'],
      filters: [
        { key: 'truck_id', label: 'Truck', options: trucks.map(t => ({ value: t.id, label: t.unit_number })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'type', label: 'Type', options: TYPES.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'due_date',
      defaultDir: 'asc',
      columns: [
        { key: 'truck_id', label: 'Unit', render: (m) => FG.utils.escapeHtml(FG.state.truckLabel(m.truck_id)) },
        { key: 'type', label: 'Service', render: (m) => FG.utils.escapeHtml(m.type) },
        { key: 'due_date', label: 'Due', render: (m) => {
          const days = FG.utils.daysFromNow(m.due_date);
          const color = m.status === 'Completed' ? 'var(--muted)' : (days < 0 ? 'var(--danger)' : days < 14 ? 'var(--warning)' : 'var(--text)');
          return `<span style="color:${color}">${FG.utils.fmtDateShort(m.due_date)}${days != null && m.status !== 'Completed' ? ` <span style="font-size:11px;color:var(--muted)">(${days >= 0 ? 'in ' + days + 'd' : Math.abs(days) + 'd ago'})</span>` : ''}</span>`;
        }},
        { key: 'due_miles', label: 'At Miles', render: (m) => FG.utils.fmtNum(m.due_miles) },
        { key: 'status', label: 'Status', render: (m) => FG.utils.statusBadge(m.status) },
        { key: 'cost', label: 'Cost', align: 'right', render: (m) => m.cost ? FG.utils.fmtMoney(m.cost, 2) : '—' },
      ],
      rowActions: (m) => `
        ${m.status !== 'Completed' ? '<button data-action="complete">Complete</button>' : ''}
        <button data-action="edit">Edit</button>
        <button data-action="delete" class="danger">✕</button>
      `,
      actionHandlers: {
        complete: markComplete,
        edit: openEdit,
        delete: (m) => FG.modal.confirm({
          message: `Delete this <strong>${FG.utils.escapeHtml(m.type)}</strong> task?`,
          confirmText: 'Delete', onConfirm: () => { FG.state.remove('maintenance', m.id); FG.toast('Task deleted.', 'success'); render(); }
        }),
      },
    });
  };

  render();
};
