// ============================================================
// PANEL: REPAIR REQUESTS
// ============================================================
// Wave 3 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping via RLS. truck_id is NOT NULL on this
// table; shop_id is nullable (ON DELETE SET NULL from garage_shops).
//
// Mount fetches [repairs, trucks, garage_shops] in parallel.
// garage_shops is needed for the Repair Shop dropdown and to render
// the shop name in the table column (the row carries shop_id, not
// the name).
//
// Three Wave-3 fixes bundled into this migration:
//   1. shop → shop_id. Pre-Wave-3 the form sent data.shop = "<name>"
//      to a column that doesn't exist (schema only has shop_id uuid).
//      With localStorage that was harmless; on FG.db it's a 42703
//      column-not-found.
//   2. closeRepair's onSubmit no longer spreads the form-only
//      final_cost field into the DB payload. final_cost is mapped to
//      est_cost; it never reaches PostgREST.
//   3. UI/schema drift fixed: STATUS_OPTIONS adds 'Cancelled',
//      PRIORITY_OPTIONS adds 'Critical' (both already in the schema
//      CHECK constraints; UI was the subset).
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.repairs = function (root) {
  const myGen = FG._gen.repairs = (FG._gen.repairs || 0) + 1;

  const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
  const STATUS_OPTIONS = ['Open', 'In Progress', 'Closed', 'Cancelled'];

  let repairs = [];
  let trucks = [];
  let shops = [];
  let tableHandle = null;

  // Local helper: shop label by id. Lift candidate once a second
  // panel needs garage_shops by id (likely Wave 4 garage panel).
  const makeShopLabel = (shops) => {
    const byId = new Map(shops.map(s => [s.id, s]));
    return (id) => {
      if (!id) return '— Not Assigned —';
      const s = byId.get(id);
      return s ? s.name : '— Not Assigned —';
    };
  };

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fields = (presetTruckId) => [
    { key: 'truck_id', label: 'Truck', type: 'select', required: true,
      options: trucks.map(t => ({ value: t.id, label: t.unit_number + ' — ' + t.year + ' ' + t.make })),
      value: presetTruckId },
    { key: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITY_OPTIONS, value: 'Medium' },
    { key: 'issue', label: 'Issue', required: true, full: true, placeholder: 'Brief description of the problem' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, value: 'Open' },
    { key: 'shop_id', label: 'Repair Shop', type: 'select',
      options: [{ value: '', label: '— Not Assigned —' }, ...shops.map(s => ({ value: s.id, label: s.name }))] },
    { key: 'est_cost', label: 'Estimated Cost', type: 'number', min: 0, step: '0.01' },
    { key: 'opened_date', label: 'Opened Date', type: 'date', value: FG.utils.today() },
    { key: 'closed_date', label: 'Closed Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const buildKpis = (data) => {
    const open = data.filter(r => r.status === 'Open').length;
    const inProgress = data.filter(r => r.status === 'In Progress').length;
    const closed = data.filter(r => r.status === 'Closed').length;
    const totalEst = data.filter(r => r.status !== 'Closed' && r.status !== 'Cancelled').reduce((s, r) => s + (r.est_cost || 0), 0);
    return `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:var(--accent)">${open}</div></div>
        <div class="kpi"><div class="kpi-label">In Progress</div><div class="kpi-value" style="color:var(--steel)">${inProgress}</div></div>
        <div class="kpi"><div class="kpi-label">Closed</div><div class="kpi-value" style="color:var(--success)">${closed}</div></div>
        <div class="kpi"><div class="kpi-label">Open Est. Cost</div><div class="kpi-value">${FG.utils.fmtMoney(totalEst)}</div></div>
      </div>
    `;
  };

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(repairs);
  };

  const openAdd = (presetTruckId) => {
    FG.modal.form({
      title: 'New Repair Request',
      fields: fields(presetTruckId),
      submitText: 'Submit',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('repairs', data);
          repairs.unshift(row);
          tableHandle.state.data = repairs;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Repair request created.', 'success');
        } catch (err) {
          reportError(err, 'Create repair failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (r) => {
    FG.modal.form({
      title: 'Edit Repair Request',
      fields: fields(),
      data: r,
      submitText: 'Save',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('repairs', r.id, data);
          const idx = repairs.findIndex(x => x.id === r.id);
          if (idx !== -1) repairs[idx] = row;
          tableHandle.state.data = repairs;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Repair updated.', 'success');
        } catch (err) {
          reportError(err, 'Update repair failed.');
          return false;
        }
      },
    });
  };

  const closeRepair = (r) => {
    FG.modal.form({
      title: 'Close Repair',
      fields: [
        { key: 'closed_date', label: 'Closed Date', type: 'date', required: true, value: FG.utils.today() },
        { key: 'final_cost', label: 'Final Cost', type: 'number', min: 0, step: '0.01' },
        { key: 'notes', label: 'Resolution Notes', type: 'textarea', rows: 3, full: true },
      ],
      data: { closed_date: FG.utils.today(), notes: r.notes },
      submitText: 'Close Repair',
      onSubmit: async (data) => {
        // Extract final_cost (form-only field, NOT a schema column) and
        // map it to est_cost. Spreading data directly would send
        // final_cost to PostgREST, which rejects unknown columns with
        // 42703. Pre-Wave-3 this worked because FG.state.localStorage
        // didn't validate column names.
        const { final_cost, ...rest } = data;
        const patch = {
          ...rest,
          status: 'Closed',
          est_cost: final_cost != null ? final_cost : r.est_cost,
        };
        try {
          const row = await FG.db.update('repairs', r.id, patch);
          const idx = repairs.findIndex(x => x.id === r.id);
          if (idx !== -1) repairs[idx] = row;
          tableHandle.state.data = repairs;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Repair closed.', 'success');
        } catch (err) {
          reportError(err, 'Close repair failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (r) => {
    FG.modal.confirm({
      message: 'Delete this repair request?',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('repairs', r.id);
          repairs = repairs.filter(x => x.id !== r.id);
          tableHandle.state.data = repairs;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete repair failed.');
        }
      },
    });
  };

  const renderPanel = () => {
    const truckLabel = FG.utils.truckLabel(trucks);
    const shopLabel = makeShopLabel(shops);

    tableHandle = FG.table.panel({
      container: root,
      title: 'Repair Requests',
      subtitle: 'Track open issues, assign shops, and close repairs.',
      addLabel: 'New Request',
      onAdd: () => openAdd(),
      data: repairs,
      kpisHtml: buildKpis(repairs),
      emptyMessage: 'No repair requests yet. Open one when a unit needs work.',
      // shop name is no longer on the row directly (only shop_id);
      // dropped 'shop' from searchFields. Use the Shop filter or
      // search by issue / notes text instead.
      searchFields: ['issue', 'notes'],
      filters: [
        { key: 'truck_id', label: 'Truck', options: trucks.map(t => ({ value: t.id, label: t.unit_number })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
        { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'opened_date',
      defaultDir: 'desc',
      columns: [
        { key: 'truck_id', label: 'Unit', render: (r) => FG.utils.escapeHtml(truckLabel(r.truck_id)) },
        { key: 'issue', label: 'Issue', render: (r) => FG.utils.escapeHtml(r.issue) },
        { key: 'priority', label: 'Priority', render: (r) => FG.utils.statusBadge(r.priority) },
        { key: 'status', label: 'Status', render: (r) => FG.utils.statusBadge(r.status) },
        { key: 'shop_id', label: 'Shop', sortable: false, render: (r) => FG.utils.escapeHtml(shopLabel(r.shop_id)) },
        { key: 'est_cost', label: 'Est. Cost', align: 'right', render: (r) => r.est_cost ? FG.utils.fmtMoney(r.est_cost) : '—' },
        { key: 'opened_date', label: 'Opened', render: (r) => FG.utils.fmtDateShort(r.opened_date) },
      ],
      rowActions: (r) => `
        ${r.status !== 'Closed' && r.status !== 'Cancelled' ? '<button data-action="close">Close</button>' : ''}
        <button data-action="edit">Edit</button>
        <button data-action="delete" class="danger">✕</button>
      `,
      actionHandlers: {
        close: closeRepair,
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading repairs…</div>`;
    try {
      const [r, t, s] = await Promise.all([
        FG.db.list('repairs',      { orderBy: 'opened_date', ascending: false }),
        FG.db.list('trucks',       { orderBy: 'unit_number', ascending: true }),
        FG.db.list('garage_shops', { orderBy: 'name',        ascending: true }),
      ]);
      repairs = r;
      trucks = t;
      shops = s;
    } catch (err) {
      console.error('repairs.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.repairs) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load repairs. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.repairs) return;
    renderPanel();
  };

  mount();
};
