// ============================================================
// PANEL: GARAGE ACCESS
// ============================================================
// Wave 4 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. garage_shops has no FKs
// out — it's the FK target of repairs.shop_id ON DELETE SET NULL.
//
// Mount fetches [garage_shops, trucks] in parallel. Trucks is needed
// for the Request Service form's truck dropdown only — never rendered
// in the garage table itself.
//
// Two Wave-4 fixes bundled in:
//   1. requestService wrote `shop: g.name` against the repairs table,
//      but the schema column is `shop_id uuid` (since Wave 3). Against
//      localStorage that was silent; PostgREST rejects unknown columns
//      with 42703. Fixed: shop_id: g.id.
//   2. Rating + discount_pct inputs gain min/max bounds matching the
//      schema CHECK constraints (rating 0–5, discount_pct 0–100) so
//      browser-level validation fires before the request leaves.
//
// Delete orphan-safety lazy-fetches repairs (matches drivers.js Wave 2
// pattern). DB will SET NULL on shop_id either way; the check is purely
// UX to prevent accidentally orphaning open work from a known shop.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.garage = function (root) {
  const myGen = FG._gen.garage = (FG._gen.garage || 0) + 1;

  const TIERS = ['Partner', 'Preferred', 'Standard'];

  let shops = [];
  let trucks = [];
  let tableHandle = null;

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fields = () => [
    { key: 'name', label: 'Shop Name', required: true, full: true },
    { key: 'tier', label: 'Tier', type: 'select', options: TIERS },
    { key: 'rating', label: 'Rating (0-5)', type: 'number', min: 0, max: 5, step: '0.1' },
    { key: 'specialties', label: 'Specialties', full: true, placeholder: 'Diesel, transmission, brakes' },
    { key: 'address', label: 'Address', full: true },
    { key: 'phone', label: 'Phone' },
    { key: 'contact', label: 'Contact Person' },
    { key: 'discount_pct', label: 'Member Discount %', type: 'number', min: 0, max: 100, step: '0.01' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const buildKpis = (data) => {
    const partners = data.filter(g => g.tier === 'Partner').length;
    const avgRating = data.length ? (data.reduce((s, g) => s + (g.rating || 0), 0) / data.length).toFixed(1) : '—';
    const avgDiscount = data.length ? (data.reduce((s, g) => s + (g.discount_pct || 0), 0) / data.length).toFixed(1) : '—';
    return `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Network Shops</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Partner Tier</div><div class="kpi-value" style="color:#a371f7">${partners}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Rating</div><div class="kpi-value">${avgRating}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Discount</div><div class="kpi-value" style="color:var(--accent)">${avgDiscount}%</div></div>
      </div>
    `;
  };

  const refreshKpis = () => {
    const el = root.querySelector('.kpi-row');
    if (el) el.outerHTML = buildKpis(shops);
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Garage',
      fields: fields(),
      data: { tier: 'Standard', rating: 4.0, discount_pct: 0 },
      submitText: 'Add Garage',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('garage_shops', data);
          shops.unshift(row);
          tableHandle.state.data = shops;
          refreshKpis();
          tableHandle.rerender();
          FG.toast(`${row.name} added.`, 'success');
        } catch (err) {
          reportError(err, 'Add garage failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (g) => {
    FG.modal.form({
      title: 'Edit Garage',
      fields: fields(),
      data: g,
      submitText: 'Save',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('garage_shops', g.id, data);
          const idx = shops.findIndex(x => x.id === g.id);
          if (idx !== -1) shops[idx] = row;
          tableHandle.state.data = shops;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Garage updated.', 'success');
        } catch (err) {
          reportError(err, 'Update garage failed.');
          return false;
        }
      },
    });
  };

  const requestService = (g) => {
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
      onSubmit: async (data) => {
        // shop_id: g.id (was: shop: g.name). Pre-Wave-4 the form sent
        // a `shop` text column that doesn't exist in repairs — schema
        // only has shop_id uuid. localStorage tolerated unknown keys;
        // PostgREST 42703s. Same wedge fixed in Wave 3 repairs.js.
        // preferred_date is a form-only field (not a repairs column);
        // pre-existing behavior is to drop it from the payload.
        try {
          await FG.db.create('repairs', {
            truck_id: data.truck_id,
            issue: data.service_type,
            priority: data.urgency === 'ASAP' ? 'High' : data.urgency === 'Same Week' ? 'Medium' : 'Low',
            status: 'Open',
            shop_id: g.id,
            opened_date: FG.utils.today(),
            notes: data.notes || '',
          });
          FG.toast(`Service request sent to ${g.name}. Tracked under Repairs.`, 'success');
        } catch (err) {
          reportError(err, 'Service request failed.');
          return false;
        }
      },
    });
  };

  const onDelete = async (g) => {
    // Lazy-fetch repairs only when delete is invoked (matches
    // drivers.js Wave 2 pattern). DB will SET NULL on shop_id
    // either way; this check is UX to avoid accidentally orphaning
    // open work from a known shop.
    let pendingCount = 0;
    try {
      const repairs = await FG.db.list('repairs');
      pendingCount = repairs.filter(r => r.shop_id === g.id && r.status !== 'Closed' && r.status !== 'Cancelled').length;
    } catch (err) {
      reportError(err, 'Failed to check related repairs.');
      return;
    }

    if (pendingCount) {
      FG.modal.alert({
        title: 'Cannot Remove Shop',
        message: `<strong>${FG.utils.escapeHtml(g.name)}</strong> has <strong>${pendingCount}</strong> pending service request${pendingCount === 1 ? '' : 's'}. Close or reassign those first.`,
      });
      return;
    }

    FG.modal.confirm({
      title: 'Remove Shop?',
      message: `Remove <strong>${FG.utils.escapeHtml(g.name)}</strong> from your network?`,
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await FG.db.remove('garage_shops', g.id);
          shops = shops.filter(x => x.id !== g.id);
          tableHandle.state.data = shops;
          refreshKpis();
          tableHandle.rerender();
          FG.toast('Removed from network.', 'success');
        } catch (err) {
          reportError(err, 'Remove garage failed.');
        }
      },
    });
  };

  const stars = (rating) => {
    if (!rating) return '—';
    const full = Math.floor(rating);
    const half = (rating - full) >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + ' ' + rating.toFixed(1);
  };

  const renderPanel = () => {
    tableHandle = FG.table.panel({
      container: root,
      title: 'Garage Access Network',
      subtitle: 'Curated network of partner repair shops with member discounts.',
      addLabel: 'Add Shop',
      onAdd: openAdd,
      data: shops,
      kpisHtml: buildKpis(shops),
      emptyMessage: 'No shops in your network yet. Add one to get started.',
      searchFields: ['name', 'specialties', 'address', 'contact'],
      filters: [
        { key: 'tier', label: 'Tier', options: TIERS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'tier',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Shop', render: (g) => `<strong>${FG.utils.escapeHtml(g.name)}</strong><div style="font-size:11px;color:var(--muted-strong)">${FG.utils.escapeHtml(g.specialties || '')}</div>` },
        { key: 'tier', label: 'Tier', render: (g) => FG.utils.statusBadge(g.tier) },
        { key: 'rating', label: 'Rating', align: 'right', render: (g) => `<span style="color:var(--accent);font-weight:600">${stars(g.rating)}</span>` },
        { key: 'discount_pct', label: 'Discount', align: 'right', render: (g) => g.discount_pct ? `<span style="color:var(--accent);font-weight:600">${g.discount_pct}%</span>` : '—' },
        { key: 'phone', label: 'Phone', sortable: false, render: (g) => `<span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(g.phone || '—')}</span>` },
        { key: 'contact', label: 'Contact' },
        { key: 'address', label: 'Address', sortable: false, render: (g) => `<span style="color:var(--muted-strong);font-size:12px">${FG.utils.escapeHtml(g.address || '—')}</span>` },
      ],
      rowActions: () => `<button data-action="request">Request</button><button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        request: requestService,
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading garages…</div>`;
    try {
      const [s, t] = await Promise.all([
        FG.db.list('garage_shops', { orderBy: 'name',        ascending: true }),
        FG.db.list('trucks',       { orderBy: 'unit_number', ascending: true }),
      ]);
      shops = s;
      trucks = t;
    } catch (err) {
      console.error('garage.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.garage) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load garages. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.garage) return;
    renderPanel();
  };

  mount();
};
