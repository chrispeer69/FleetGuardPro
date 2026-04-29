// ============================================================
// PANEL: PARTS INVENTORY (NEW)
// ============================================================
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
    { key: 'qty_on_hand', label: 'Qty on Hand', type: 'number', value: 0 },
    { key: 'reorder_point', label: 'Reorder Point', type: 'number', value: 2 },
    { key: 'unit_cost', label: 'Unit Cost', type: 'number' },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Part',
      fields: fields(),
      submitText: 'Add Part',
      onSubmit: (data) => {
        FG.state.create('parts', data);
        FG.toast(`${data.name} added.`, 'success');
        render();
      },
    });
  };

  const openEdit = (p) => {
    FG.modal.form({
      title: 'Edit Part',
      fields: fields(),
      data: p,
      submitText: 'Save',
      onSubmit: (data) => {
        FG.state.update('parts', p.id, data);
        FG.toast('Part updated.', 'success');
        render();
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
      onSubmit: (data) => {
        const newQty = (p.qty_on_hand || 0) + Number(data.delta || 0);
        if (newQty < 0) { FG.toast('Stock cannot go negative.', 'error'); return false; }
        FG.state.update('parts', p.id, { qty_on_hand: newQty });
        FG.toast(`Adjusted: ${data.delta > 0 ? '+' : ''}${data.delta} (${data.reason || 'manual'}).`, 'success');
        render();
      },
    });
  };

  const stockStatus = (p) => {
    if (p.qty_on_hand === 0) return 'Out of Stock';
    if (p.qty_on_hand <= p.reorder_point) return 'Low Stock';
    return 'In Stock';
  };

  const render = () => {
    const data = FG.state.list('parts');
    const totalValue = data.reduce((s, p) => s + (p.qty_on_hand || 0) * (p.unit_cost || 0), 0);
    const lowStock = data.filter(p => p.qty_on_hand > 0 && p.qty_on_hand <= p.reorder_point).length;
    const outOfStock = data.filter(p => p.qty_on_hand === 0).length;
    const reorderNeeded = data.filter(p => p.qty_on_hand <= p.reorder_point).length;

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">SKUs</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Inventory Value</div><div class="kpi-value">${FG.utils.fmtMoney(totalValue, 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Low Stock</div><div class="kpi-value" style="color:${lowStock ? 'var(--warning)' : 'var(--text)'}">${lowStock}</div></div>
        <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value" style="color:${outOfStock ? 'var(--danger)' : 'var(--text)'}">${outOfStock}</div></div>
        <div class="kpi"><div class="kpi-label">Reorder Needed</div><div class="kpi-value" style="color:${reorderNeeded ? 'var(--accent)' : 'var(--text)'}">${reorderNeeded}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Parts Inventory',
      subtitle: 'Track on-hand stock, reorder points, and inventory value.',
      addLabel: 'Add Part',
      onAdd: openAdd,
      data,
      kpisHtml,
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
        delete: (p) => {
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
            onConfirm: () => { FG.state.remove('parts', p.id); FG.toast('Part deleted.', 'success'); render(); },
          });
        },
      },
    });
  };

  render();
};
