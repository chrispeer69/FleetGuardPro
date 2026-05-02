// ============================================================
// PANEL: MAINTENANCE
// ============================================================
// Wave 3 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping via RLS. truck_id is NOT NULL on this
// table, so the Truck dropdown is required and never sends null.
//
// Mount fetches [maintenance, trucks] in parallel — trucks is needed
// for the Truck dropdown (form + filter) and the table column label.
//
// Status check constraint allows ('Scheduled','In Progress',
// 'Completed','Overdue','Cancelled'). UI was missing 'Cancelled' —
// now added so operators can cancel a scheduled task.
//
// On truck delete, maintenance rows cascade-delete (FK ON DELETE
// CASCADE in db/schema.sql, unchanged from baseline). The fleet.js
// delete handler already accounts for this.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.maintenance = function (root) {
  const myGen = FG._gen.maintenance = (FG._gen.maintenance || 0) + 1;

  const TYPES = ['Oil & Filter Change', 'Brake Inspection', 'Tire Rotation', 'DOT Annual Inspection', 'Annual Inspection', 'Transmission Service', 'Coolant Flush', 'Air Filter', 'DPF Service', 'Other'];
  const STATUS_OPTIONS = ['Scheduled', 'Overdue', 'In Progress', 'Completed', 'Cancelled'];

  let maintenance = [];
  let trucks = [];
  let tableHandle = null;

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fields = () => [
    { key: 'truck_id', label: 'Truck', type: 'select', required: true,
      options: trucks.map(t => ({ value: t.id, label: `${t.unit_number} — ${t.year} ${t.make}` })) },
    { key: 'type', label: 'Service Type', type: 'select', required: true, options: TYPES },
    { key: 'due_date', label: 'Due Date', type: 'date', required: true },
    { key: 'due_miles', label: 'Due Mileage', type: 'number', min: 0 },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'cost', label: 'Cost (if completed)', type: 'number', min: 0, step: '0.01' },
    { key: 'completed_date', label: 'Completed Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const buildKpis = (data) => {
    const overdue = data.filter(m => m.status === 'Overdue').length;
    const upcoming = data.filter(m => m.status === 'Scheduled' && FG.utils.daysFromNow(m.due_date) >= 0 && FG.utils.daysFromNow(m.due_date) < 30).length;
    const completed = data.filter(m => m.status === 'Completed').length;
    const totalSpend = data.filter(m => m.status === 'Completed').reduce((s, m) => s + (m.cost || 0), 0);
    return `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:${overdue ? 'var(--danger)' : 'var(--text)'}">${overdue}</div></div>
        <div class="kpi"><div class="kpi-label">Due in 30 days</div><div class="kpi-value" style="color:${upcoming ? 'var(--warning)' : 'var(--text)'}">${upcoming}</div></div>
        <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:var(--success)">${completed}</div></div>
        <div class="kpi"><div class="kpi-label">Lifetime Spend</div><div class="kpi-value">${FG.utils.fmtMoney(totalSpend)}</div></div>
      </div>
    `;
  };

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(maintenance);
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Schedule Maintenance',
      fields: fields(),
      data: { status: 'Scheduled', due_date: FG.utils.today() },
      submitText: 'Schedule',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('maintenance', data);
          maintenance.unshift(row);
          tableHandle.state.data = maintenance;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Maintenance task scheduled.', 'success');
        } catch (err) {
          reportError(err, 'Schedule maintenance failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (m) => {
    FG.modal.form({
      title: 'Edit Maintenance',
      fields: fields(),
      data: m,
      submitText: 'Save',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('maintenance', m.id, data);
          const idx = maintenance.findIndex(x => x.id === m.id);
          if (idx !== -1) maintenance[idx] = row;
          tableHandle.state.data = maintenance;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Maintenance updated.', 'success');
        } catch (err) {
          reportError(err, 'Update maintenance failed.');
          return false;
        }
      },
    });
  };

  const markComplete = (m) => {
    FG.modal.form({
      title: 'Mark Complete',
      fields: [
        { key: 'completed_date', label: 'Completed Date', type: 'date', required: true, value: FG.utils.today() },
        { key: 'cost', label: 'Cost', type: 'number', required: true, min: 0, step: '0.01' },
        { key: 'notes', label: 'Completion Notes', type: 'textarea', rows: 3, full: true },
      ],
      data: { completed_date: FG.utils.today(), notes: m.notes },
      submitText: 'Complete',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('maintenance', m.id, { ...data, status: 'Completed' });
          const idx = maintenance.findIndex(x => x.id === m.id);
          if (idx !== -1) maintenance[idx] = row;
          tableHandle.state.data = maintenance;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Marked complete.', 'success');
        } catch (err) {
          reportError(err, 'Mark complete failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (m) => {
    FG.modal.confirm({
      message: `Delete this <strong>${FG.utils.escapeHtml(m.type)}</strong> task?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('maintenance', m.id);
          maintenance = maintenance.filter(x => x.id !== m.id);
          tableHandle.state.data = maintenance;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Task deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete task failed.');
        }
      },
    });
  };

  const renderPanel = () => {
    const truckLabel = FG.utils.truckLabel(trucks);

    tableHandle = FG.table.panel({
      container: root,
      title: 'Maintenance Schedule',
      subtitle: 'Preventive maintenance, annual inspections, and completed work.',
      addLabel: 'Schedule Service',
      onAdd: openAdd,
      data: maintenance,
      kpisHtml: buildKpis(maintenance),
      emptyMessage: 'No maintenance tasks yet. Schedule your first service to get started.',
      searchFields: ['type', 'notes'],
      filters: [
        { key: 'truck_id', label: 'Truck', options: trucks.map(t => ({ value: t.id, label: t.unit_number })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'type', label: 'Type', options: TYPES.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'due_date',
      defaultDir: 'asc',
      columns: [
        { key: 'truck_id', label: 'Unit', render: (m) => FG.utils.escapeHtml(truckLabel(m.truck_id)) },
        { key: 'type', label: 'Service', render: (m) => FG.utils.escapeHtml(m.type) },
        { key: 'due_date', label: 'Due', render: (m) => {
          const days = FG.utils.daysFromNow(m.due_date);
          const color = m.status === 'Completed' ? 'var(--muted)' : (days < 0 ? 'var(--danger)' : days < 14 ? 'var(--warning)' : 'var(--text)');
          return `<span style="color:${color}">${FG.utils.fmtDateShort(m.due_date)}${days != null && m.status !== 'Completed' ? ` <span style="font-size:11px;color:var(--muted-strong)">(${days >= 0 ? 'in ' + days + 'd' : Math.abs(days) + 'd ago'})</span>` : ''}</span>`;
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
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading maintenance…</div>`;
    try {
      const [m, t] = await Promise.all([
        FG.db.list('maintenance', { orderBy: 'due_date',    ascending: true }),
        FG.db.list('trucks',      { orderBy: 'unit_number', ascending: true }),
      ]);
      maintenance = m;
      trucks = t;
    } catch (err) {
      console.error('maintenance.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.maintenance) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load maintenance. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.maintenance) return;
    renderPanel();
  };

  mount();
};
