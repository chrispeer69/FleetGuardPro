// ============================================================
// PANEL: PARTS INVENTORY
// ============================================================
// Phase 2C: reads/writes via FG.db (Supabase) instead of FG.state
// (localStorage). Tenant scoping is handled inside FG.db.
//
// TODO(Wave 6): re-wire low-stock alert generation. Pre-Phase-2C
// every parts write fired FG.state.generateAlerts() via the
// ALERT_TRIGGERS hook in state.js. With localStorage gone the
// alert refresh has to move server-side (trigger or scheduled
// function). Until then, low-stock alerts may lag by up to the
// next dashboard re-entry.
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.parts = function (root) {
  const CATEGORIES = ['Filters', 'Brakes', 'Hydraulics', 'Fluids', 'Electrical', 'Recovery Gear', 'Accessories', 'Engine', 'Tires', 'Other'];

  const fields = () => [
    { key: 'name', label: 'Part Name', required: true, full: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
    { key: 'vendor', label: 'Vendor' },
    { key: 'location', label: 'Bin Location', placeholder: 'Bin A-12' },
    { key: 'qty_on_hand', label: 'Qty on Hand', type: 'number', value: 0, min: 0 },
    { key: 'reorder_point', label: 'Reorder Point', type: 'number', value: 2, min: 0 },
    { key: 'unit_cost', label: 'Unit Cost', type: 'number', min: 0, step: '0.01' },
  ];

  let parts = [];
  let tableHandle = null;

  const stockStatus = (p) => {
    if (p.qty_on_hand === 0) return 'Out of Stock';
    if (p.qty_on_hand <= p.reorder_point) return 'Low Stock';
    return 'In Stock';
  };

  const buildKpis = (data) => {
    const totalValue = data.reduce((s, p) => s + (p.qty_on_hand || 0) * (p.unit_cost || 0), 0);
    const lowStock = data.filter(p => p.qty_on_hand > 0 && p.qty_on_hand <= p.reorder_point).length;
    const outOfStock = data.filter(p => p.qty_on_hand === 0).length;
    const reorderNeeded = data.filter(p => p.qty_on_hand <= p.reorder_point).length;
    return `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">SKUs</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Inventory Value</div><div class="kpi-value">${FG.utils.fmtMoney(totalValue, 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Low Stock</div><div class="kpi-value" style="color:${lowStock ? 'var(--warning)' : 'var(--text)'}">${lowStock}</div></div>
        <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value" style="color:${outOfStock ? 'var(--danger)' : 'var(--text)'}">${outOfStock}</div></div>
        <div class="kpi"><div class="kpi-label">Reorder Needed</div><div class="kpi-value" style="color:${reorderNeeded ? 'var(--accent)' : 'var(--text)'}">${reorderNeeded}</div></div>
      </div>
    `;
  };

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(parts);
  };

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Part',
      fields: fields(),
      submitText: 'Add Part',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('parts', data);
          parts.unshift(row);
          tableHandle.state.data = parts;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.name} added.`, 'success');
        } catch (err) {
          reportError(err, 'Add part failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (p) => {
    FG.modal.form({
      title: 'Edit Part',
      fields: fields(),
      data: p,
      submitText: 'Save',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('parts', p.id, data);
          const idx = parts.findIndex(x => x.id === p.id);
          if (idx !== -1) parts[idx] = row;
          tableHandle.state.data = parts;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Part updated.', 'success');
        } catch (err) {
          reportError(err, 'Update part failed.');
          return false;
        }
      },
    });
  };

  const adjustStock = (p) => {
    FG.modal.form({
      title: `Adjust Stock — ${p.name}`,
      fields: [
        { key: 'delta', label: 'Adjustment (+ to add, − to remove)', type: 'number', required: true, value: 0, full: true, hint: `Current on hand: ${p.qty_on_hand}` },
        { key: 'reason', label: 'Reason', type: 'select', options: ['Receipt / Restock', 'Used in Repair', 'Returned to Vendor', 'Cycle Count', 'Other'], full: true },
        { key: 'note', label: 'Note', type: 'textarea', rows: 2, full: true },
      ],
      submitText: 'Apply Adjustment',
      onSubmit: async (data) => {
        const delta = Number(data.delta || 0);
        if (delta === 0) { FG.toast('No change to apply.', 'info'); return false; }
        const newQty = (p.qty_on_hand || 0) + delta;
        if (newQty < 0) { FG.toast('Stock cannot go negative.', 'error'); return false; }
        try {
          const row = await FG.db.update('parts', p.id, { qty_on_hand: newQty });
          const idx = parts.findIndex(x => x.id === p.id);
          if (idx !== -1) parts[idx] = row;
          tableHandle.state.data = parts;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`Adjusted: ${delta > 0 ? '+' : ''}${delta} (${data.reason || 'manual'}).`, 'success');
        } catch (err) {
          reportError(err, 'Stock adjustment failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (p) => {
    const qty = p.qty_on_hand || 0;
    if (qty > 0) {
      FG.modal.alert({
        title: 'Cannot Delete Part',
        message: `<strong>${FG.utils.escapeHtml(p.name)}</strong> has <strong>${qty}</strong> on hand. Adjust stock to 0 first.`,
      });
      return;
    }
    FG.modal.confirm({
      title: 'Delete Part?',
      message: `Delete part <strong>${FG.utils.escapeHtml(p.name)}</strong>?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('parts', p.id);
          parts = parts.filter(x => x.id !== p.id);
          tableHandle.state.data = parts;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Part deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete part failed.');
        }
      },
    });
  };

  const renderPanel = () => {
    tableHandle = FG.table.panel({
      container: root,
      title: 'Parts Inventory',
      subtitle: 'Track on-hand stock, reorder points, and inventory value.',
      addLabel: 'Add Part',
      onAdd: openAdd,
      data: parts,
      kpisHtml: buildKpis(parts),
      emptyMessage: 'No parts in inventory yet. Add your first part to get started.',
      searchFields: ['name', 'sku', 'vendor', 'location'],
      filters: [
        { key: 'category', label: 'Category', options: CATEGORIES.map(v => ({ value: v, label: v })) },
        { key: 'stock_status', label: 'Stock', options: [
          { value: 'In Stock', label: 'In Stock' },
          { value: 'Low Stock', label: 'Low Stock' },
          { value: 'Out of Stock', label: 'Out of Stock' },
        ], match: (item, v) => stockStatus(item) === v },
      ],
      defaultSort: 'name',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Part', render: (p) => `<strong>${FG.utils.escapeHtml(p.name)}</strong><div style="font-size:11px;color:var(--muted-strong);font-family:var(--font-mono)">${FG.utils.escapeHtml(p.sku || '')}</div>` },
        { key: 'category', label: 'Category' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'location', label: 'Location', render: (p) => `<span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(p.location || '—')}</span>` },
        { key: 'qty_on_hand', label: 'On Hand', align: 'right', render: (p) => `<strong>${p.qty_on_hand}</strong>` },
        { key: 'reorder_point', label: 'Reorder At', align: 'right' },
        { key: 'stock_status', label: 'Status', sortable: false, render: (p) => FG.utils.statusBadge(stockStatus(p)) },
        { key: 'unit_cost', label: 'Unit $', align: 'right', render: (p) => FG.utils.fmtMoney(p.unit_cost, 2) },
        { key: 'value', label: 'Value', align: 'right', sortable: false, render: (p) => FG.utils.fmtMoney((p.qty_on_hand || 0) * (p.unit_cost || 0), 2) },
      ],
      rowActions: () => `<button data-action="adjust">Adjust</button><button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        adjust: adjustStock,
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading parts…</div>`;
    try {
      parts = await FG.db.list('parts', { orderBy: 'name', ascending: true });
    } catch (err) {
      console.error('parts.list failed', err && err.raw ? err.raw : err);
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load parts. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    renderPanel();
  };

  mount();
};
