// ============================================================
// PANEL: INSURANCE
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.insurance = function (root) {
  const TYPES = ['Commercial Auto Liability', 'Physical Damage', 'General Liability', 'Workers Compensation', 'Cargo', 'Garage Keepers', 'Umbrella', 'Other'];
  const CARRIERS = ['Progressive Commercial', 'Travelers', 'The Hartford', 'Liberty Mutual', 'Nationwide', 'Sentry', 'Zurich', 'Other'];
  const STATUS_OPTIONS = ['Active', 'Pending Renewal', 'Expired', 'Cancelled'];

  const fields = () => [
    { key: 'carrier', label: 'Carrier', type: 'select', required: true, options: CARRIERS },
    { key: 'type', label: 'Coverage Type', type: 'select', required: true, options: TYPES },
    { key: 'policy_number', label: 'Policy Number', required: true },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'premium', label: 'Annual Premium', type: 'number' },
    { key: 'deductible', label: 'Deductible', type: 'number' },
    { key: 'coverage_limit', label: 'Coverage Limit', type: 'number' },
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
      onSubmit: (data) => {
        FG.state.create('insurance_policies', data);
        FG.toast('Policy added.', 'success');
        render();
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
      onSubmit: (data) => {
        FG.state.update('insurance_policies', p.id, data);
        FG.toast('Policy updated.', 'success');
        render();
      },
    });
  };

  const initiateRenewal = (p) => {
    FG.modal.confirm({
      title: 'Initiate Renewal Process',
      message: `Begin multi-broker quote process for <strong>${FG.utils.escapeHtml(p.carrier)} — ${FG.utils.escapeHtml(p.type)}</strong>? Your FleetGuard specialist will be notified.`,
      confirmText: 'Start Renewal',
      confirmClass: 'btn-primary',
      onConfirm: () => {
        FG.state.update('insurance_policies', p.id, { status: 'Pending Renewal' });
        FG.toast('Renewal process started. Quotes typically arrive within 5 business days.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('insurance_policies');
    const totalPremium = data.filter(p => p.status === 'Active' || p.status === 'Pending Renewal').reduce((s, p) => s + (p.premium || 0), 0);
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
              const policies = data.filter(p => p.type === t && p.status === 'Active');
              if (!policies.length) return '';
              return `<div class="detail-row" style="border-bottom:1px solid var(--border)">
                <span class="lbl">${t}</span>
                <span class="val">${FG.utils.fmtMoney(policies.reduce((s, p) => s + (p.coverage_limit || 0), 0))} <span style="font-size:11px;color:var(--muted)">· ${FG.utils.fmtMoney(policies.reduce((s, p) => s + (p.premium || 0), 0))}/yr</span></span>
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
        delete: (p) => FG.modal.confirm({
          message: `Delete policy <strong>${FG.utils.escapeHtml(p.policy_number)}</strong>?`,
          confirmText: 'Delete', onConfirm: () => { FG.state.remove('insurance_policies', p.id); FG.toast('Policy deleted.', 'success'); render(); }
        }),
      },
    });

    // Hide redundant panel header from table.panel since we already have one
    const hdr = wrapper.querySelector('#policies-host .panel-header');
    if (hdr) hdr.style.display = 'none';
  };

  render();
};
