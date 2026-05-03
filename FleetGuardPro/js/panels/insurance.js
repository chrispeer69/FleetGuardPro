// ============================================================
// PANEL: INSURANCE
// ============================================================
// Wave 4 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. insurance_policies has
// no FK relationships — fully standalone, scoped only by company_id.
//
// Mount fetches insurance_policies (orderBy expiry_date asc) once.
// Mutations update the local cache and re-render in place; full
// re-render preserves existing UX (Renewal Timeline + Coverage
// Summary cards rebuild alongside the table).
//
// Status drift fix: pre-Wave-4 the UI shipped 'Pending Renewal' as a
// status, but the schema CHECK is ('Active','Expiring','Expired',
// 'Cancelled','Pending'). 'Pending Renewal' would 23514 against the
// live DB. UI now uses 'Pending', and 'Expiring' is in the dropdown
// so server-side / future auto-transitions round-trip cleanly.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.insurance = function (root) {
  const myGen = FG._gen.insurance = (FG._gen.insurance || 0) + 1;

  const TYPES = ['Commercial Auto Liability', 'Physical Damage', 'General Liability', 'Workers Compensation', 'Cargo', 'Garage Keepers', 'Umbrella', 'Other'];
  const CARRIERS = ['Progressive Commercial', 'Travelers', 'The Hartford', 'Liberty Mutual', 'Nationwide', 'Sentry', 'Zurich', 'Other'];
  const STATUS_OPTIONS = ['Active', 'Pending', 'Expiring', 'Expired', 'Cancelled'];

  let policies = [];

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fields = () => [
    { key: 'carrier', label: 'Carrier', type: 'select', required: true, options: CARRIERS },
    { key: 'type', label: 'Coverage Type', type: 'select', required: true, options: TYPES },
    { key: 'policy_number', label: 'Policy Number', required: true },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'premium', label: 'Annual Premium', type: 'number', min: 0, step: '0.01' },
    { key: 'deductible', label: 'Deductible', type: 'number', min: 0, step: '0.01' },
    { key: 'coverage_limit', label: 'Coverage Limit', type: 'number', min: 0, step: '0.01' },
    { key: 'effective_date', label: 'Effective Date', type: 'date' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, full: true },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Add Policy',
      fields: fields(),
      data: { status: 'Active' },
      submitText: 'Add Policy',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('insurance_policies', data);
          policies.unshift(row);
          render();
          FG.toast('Policy added.', 'success');
        } catch (err) {
          reportError(err, 'Add policy failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (p) => {
    FG.modal.form({
      title: 'Edit Policy',
      fields: fields(),
      data: p,
      submitText: 'Save',
      size: 'lg',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('insurance_policies', p.id, data);
          const idx = policies.findIndex(x => x.id === p.id);
          if (idx !== -1) policies[idx] = row;
          render();
          FG.toast('Policy updated.', 'success');
        } catch (err) {
          reportError(err, 'Update policy failed.');
          return false;
        }
      },
    });
  };

  const initiateRenewal = (p) => {
    FG.modal.confirm({
      title: 'Initiate Renewal Process',
      message: `Begin multi-broker quote process for <strong>${FG.utils.escapeHtml(p.carrier)} — ${FG.utils.escapeHtml(p.type)}</strong>? Your FleetGuard specialist will be notified.`,
      confirmText: 'Start Renewal',
      confirmClass: 'btn-primary',
      onConfirm: async () => {
        try {
          // Status drift fix: schema CHECK has 'Pending', not 'Pending Renewal'.
          const row = await FG.db.update('insurance_policies', p.id, { status: 'Pending' });
          const idx = policies.findIndex(x => x.id === p.id);
          if (idx !== -1) policies[idx] = row;
          render();
          FG.toast('Renewal process started. Quotes typically arrive within 5 business days.', 'success');
        } catch (err) {
          reportError(err, 'Failed to start renewal.');
        }
      },
    });
  };

  const onDelete = (p) => {
    FG.modal.confirm({
      message: `Delete policy <strong>${FG.utils.escapeHtml(p.policy_number)}</strong>?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('insurance_policies', p.id);
          policies = policies.filter(x => x.id !== p.id);
          render();
          FG.toast('Policy deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete policy failed.');
        }
      },
    });
  };

  const render = () => {
    const data = policies;
    // Status drift fix: 'Pending Renewal' → 'Pending' (matches schema CHECK).
    const totalPremium = data.filter(p => p.status === 'Active' || p.status === 'Pending').reduce((s, p) => s + (p.premium || 0), 0);
    const renewing = data.filter(p => {
      const days = FG.utils.daysFromNow(p.expiry_date);
      return days != null && days < 90 && days >= 0 && p.status !== 'Expired' && p.status !== 'Cancelled';
    }).length;
    const totalCoverage = data.filter(p => p.status === 'Active').reduce((s, p) => s + (p.coverage_limit || 0), 0);

    const wrapper = document.createElement('div');
    root.innerHTML = '';
    root.appendChild(wrapper);

    wrapper.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Insurance Management</h2>
          <p>Active policies, renewals, and claims documentation.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="btn-loss-run">📥 Request Loss Run</button>
          <button class="btn btn-primary" id="btn-add-policy">+ Add Policy</button>
        </div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Active Policies</div><div class="kpi-value">${data.filter(p => p.status === 'Active').length}</div></div>
        <div class="kpi"><div class="kpi-label">Annual Premium</div><div class="kpi-value">${FG.utils.fmtMoney(totalPremium)}</div></div>
        <div class="kpi"><div class="kpi-label">Total Coverage</div><div class="kpi-value">${FG.utils.fmtMoney(totalCoverage)}</div></div>
        <div class="kpi"><div class="kpi-label">Renewing &lt; 90d</div><div class="kpi-value" style="color:${renewing ? 'var(--warning)' : 'var(--text)'}">${renewing}</div></div>
      </div>

      <div class="card gap-24">
        <div class="card-header"><span class="card-title">Policy Schedule</span><span class="toolbar-info">${data.length} policies</span></div>
        <div class="card-body" style="padding:0" id="policies-host"></div>
      </div>

      <div class="grid-2 gap-24">
        <div class="card">
          <div class="card-header"><span class="card-title">Renewal Timeline</span></div>
          <div class="card-body">
            ${data.slice().sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)).map(p => {
              const days = FG.utils.daysFromNow(p.expiry_date);
              const color = days < 0 ? 'var(--danger)' : days < 60 ? 'var(--warning)' : 'var(--success)';
              const pct = Math.max(0, Math.min(100, 100 - (days / 365) * 100));
              return `
                <div style="margin-bottom:14px">
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                    <strong>${FG.utils.escapeHtml(p.carrier)} — ${FG.utils.escapeHtml(p.type)}</strong>
                    <span style="color:${color};font-family:var(--font-mono);font-size:12px">${days >= 0 ? days + 'd' : Math.abs(days) + 'd ago'}</span>
                  </div>
                  <div class="progress-wrap"><div class="progress-bar ${days < 0 ? 'red' : days < 60 ? 'yellow' : 'green'}" style="width:${pct}%"></div></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Coverage Summary</span></div>
          <div class="card-body">
            ${TYPES.map(t => {
              const forType = data.filter(p => p.type === t && p.status === 'Active');
              if (!forType.length) return '';
              return `<div class="detail-row" style="border-bottom:1px solid var(--border)">
                <span class="lbl">${t}</span>
                <span class="val">${FG.utils.fmtMoney(forType.reduce((s, p) => s + (p.coverage_limit || 0), 0))} <span style="font-size:11px;color:var(--muted-strong)">· ${FG.utils.fmtMoney(forType.reduce((s, p) => s + (p.premium || 0), 0))}/yr</span></span>
              </div>`;
            }).join('') || '<div class="empty-state">No active coverage.</div>'}
          </div>
        </div>
      </div>
    `;

    wrapper.querySelector('#btn-add-policy').addEventListener('click', openAdd);
    wrapper.querySelector('#btn-loss-run').addEventListener('click', () => {
      FG.toast('Loss run request sent to your FleetGuard specialist.', 'success');
    });

    FG.table.panel({
      container: wrapper.querySelector('#policies-host'),
      title: '',
      data,
      searchFields: ['carrier', 'policy_number', 'type'],
      filters: [
        { key: 'carrier', label: 'Carrier', options: CARRIERS.map(v => ({ value: v, label: v })) },
        { key: 'type', label: 'Type', options: TYPES.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'expiry_date',
      defaultDir: 'asc',
      columns: [
        { key: 'carrier', label: 'Carrier' },
        { key: 'type', label: 'Coverage' },
        { key: 'policy_number', label: 'Policy #', render: (p) => `<span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(p.policy_number)}</span>` },
        { key: 'premium', label: 'Premium', align: 'right', render: (p) => FG.utils.fmtMoney(p.premium) },
        { key: 'deductible', label: 'Deductible', align: 'right', render: (p) => FG.utils.fmtMoney(p.deductible) },
        { key: 'coverage_limit', label: 'Limit', align: 'right', render: (p) => FG.utils.fmtMoney(p.coverage_limit) },
        { key: 'expiry_date', label: 'Expires', render: (p) => FG.utils.fmtDateShort(p.expiry_date) },
        { key: 'status', label: 'Status', render: (p) => FG.utils.statusBadge(p.status) },
      ],
      rowActions: (p) => `
        ${p.status === 'Active' && FG.utils.daysFromNow(p.expiry_date) < 120 ? '<button data-action="renew">Renew</button>' : ''}
        <button data-action="edit">Edit</button>
        <button data-action="delete" class="danger">✕</button>
      `,
      actionHandlers: {
        renew: initiateRenewal,
        edit: openEdit,
        delete: onDelete,
      },
    });

    // Hide redundant panel header from table.panel since we already have one
    const hdr = wrapper.querySelector('#policies-host .panel-header');
    if (hdr) hdr.style.display = 'none';
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading insurance…</div>`;
    try {
      policies = await FG.db.list('insurance_policies', { orderBy: 'expiry_date', ascending: true });
    } catch (err) {
      console.error('insurance.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.insurance) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load insurance. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.insurance) return;
    render();
  };

  mount();
};
