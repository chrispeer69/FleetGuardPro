// ============================================================
// PANEL: GARAGE ACCESS (NEW)
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.garage = function (root) {
  const TIERS = ['Partner', 'Preferred', 'Standard'];

  const fields = () => [
    { key: 'name', label: 'Shop Name', required: true, full: true },
    { key: 'tier', label: 'Tier', type: 'select', options: TIERS },
    { key: 'rating', label: 'Rating (0-5)', type: 'number' },
    { key: 'specialties', label: 'Specialties', full: true, placeholder: 'Diesel, transmission, brakes' },
    { key: 'address', label: 'Address', full: true },
    { key: 'phone', label: 'Phone' },
    { key: 'contact', label: 'Contact Person' },
    { key: 'discount_pct', label: 'Member Discount %', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Garage',
      fields: fields(),
      data: { tier: 'Standard', rating: 4.0, discount_pct: 0 },
      submitText: 'Add Garage',
      onSubmit: (data) => {
        FG.state.create('garage_shops', data);
        FG.toast(`${data.name} added.`, 'success');
        render();
      },
    });
  };

  const openEdit = (g) => {
    FG.modal.form({
      title: 'Edit Garage',
      fields: fields(),
      data: g,
      submitText: 'Save',
      onSubmit: (data) => {
        FG.state.update('garage_shops', g.id, data);
        FG.toast('Garage updated.', 'success');
        render();
      },
    });
  };

  const requestService = (g) => {
    const trucks = FG.state.list('trucks');
    FG.modal.form({
      title: `Request Service @ ${g.name}`,
      fields: [
        { key: 'truck_id', label: 'Truck', type: 'select', required: true, options: trucks.map(t => ({ value: t.id, label: t.unit_number })) },
        { key: 'service_type', label: 'Service Type', required: true, full: true, placeholder: 'e.g. Brake job, Oil change, Diagnostics' },
        { key: 'preferred_date', label: 'Preferred Date', type: 'date' },
        { key: 'urgency', label: 'Urgency', type: 'select', options: ['Routine', 'Same Week', 'ASAP'] },
        { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
      ],
      submitText: 'Send Request',
      onSubmit: (data) => {
        FG.state.create('repairs', {
          truck_id: data.truck_id,
          issue: data.service_type,
          priority: data.urgency === 'ASAP' ? 'High' : data.urgency === 'Same Week' ? 'Medium' : 'Low',
          status: 'Open',
          shop: g.name,
          opened_date: FG.utils.today(),
          notes: data.notes || '',
          est_cost: null,
        });
        FG.toast(`Service request sent to ${g.name}. Tracked under Repairs.`, 'success');
      },
    });
  };

  const stars = (rating) => {
    if (!rating) return '—';
    const full = Math.floor(rating);
    const half = (rating - full) >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + ' '.repeat(0) + ' ' + rating.toFixed(1);
  };

  const render = () => {
    const data = FG.state.list('garage_shops');
    const partners = data.filter(g => g.tier === 'Partner').length;
    const avgRating = data.length ? (data.reduce((s, g) => s + (g.rating || 0), 0) / data.length).toFixed(1) : '—';
    const avgDiscount = data.length ? (data.reduce((s, g) => s + (g.discount_pct || 0), 0) / data.length).toFixed(1) : '—';

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Network Shops</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Partner Tier</div><div class="kpi-value" style="color:#a371f7">${partners}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Rating</div><div class="kpi-value">${avgRating}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Discount</div><div class="kpi-value" style="color:var(--accent)">${avgDiscount}%</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'Garage Access Network',
      subtitle: 'Curated network of partner repair shops with member discounts.',
      addLabel: 'Add Shop',
      onAdd: openAdd,
      data,
      kpisHtml,
      searchFields: ['name', 'specialties', 'address', 'contact'],
      filters: [
        { key: 'tier', label: 'Tier', options: TIERS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'tier',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Shop', render: (g) => `<strong>${FG.utils.escapeHtml(g.name)}</strong><div style="font-size:11px;color:var(--muted)">${FG.utils.escapeHtml(g.specialties || '')}</div>` },
        { key: 'tier', label: 'Tier', render: (g) => FG.utils.statusBadge(g.tier) },
        { key: 'rating', label: 'Rating', align: 'right', render: (g) => `<span style="color:var(--accent);font-weight:600">${stars(g.rating)}</span>` },
        { key: 'discount_pct', label: 'Discount', align: 'right', render: (g) => g.discount_pct ? `<span style="color:var(--accent);font-weight:600">${g.discount_pct}%</span>` : '—' },
        { key: 'phone', label: 'Phone', sortable: false, render: (g) => `<span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(g.phone || '—')}</span>` },
        { key: 'contact', label: 'Contact' },
        { key: 'address', label: 'Address', sortable: false, render: (g) => `<span style="color:var(--muted);font-size:12px">${FG.utils.escapeHtml(g.address || '—')}</span>` },
      ],
      rowActions: () => `<button data-action="request">Request</button><button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        request: requestService,
        edit: openEdit,
        delete: (g) => FG.modal.confirm({
          message: `Remove <strong>${FG.utils.escapeHtml(g.name)}</strong> from your network?`,
          confirmText: 'Remove', onConfirm: () => { FG.state.remove('garage_shops', g.id); FG.toast('Removed from network.', 'success'); render(); }
        }),
      },
    });
  };

  render();
};
