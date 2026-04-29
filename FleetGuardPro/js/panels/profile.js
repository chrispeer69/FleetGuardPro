// ============================================================
// PANEL: COMPANY PROFILE
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.profile = function (root) {

  const editProfile = () => {
    const c = FG.state.company();
    FG.modal.form({
      title: 'Edit Company Profile',
      size: 'lg',
      fields: [
        { key: 'name', label: 'Company Name', required: true, full: true },
        { key: 'dot_number', label: 'USDOT Number' },
        { key: 'mc_number', label: 'MC Number' },
        { key: 'puco_number', label: 'PUCO Number' },
        { key: 'fleet_type', label: 'Fleet Type', type: 'select', options: ['Tow Trucks', 'Box Trucks', 'Mixed (Tow + Box)', 'Other'] },
        { key: 'address', label: 'Business Address', full: true },
        { key: 'phone', label: 'Main Phone' },
        { key: 'email', label: 'Main Email', type: 'email' },
        { key: 'website', label: 'Website', full: true },
        { key: 'contact_name', label: 'Primary Contact' },
        { key: 'contact_title', label: 'Title' },
        { key: 'contact_email', label: 'Contact Email', type: 'email' },
        { key: 'contact_phone', label: 'Contact Phone' },
      ],
      data: c,
      submitText: 'Save Changes',
      onSubmit: (data) => {
        FG.state.setCompany(data);
        FG.toast('Profile updated.', 'success');
        render();
        // refresh sidebar in case name/plan changed
        const sb = document.getElementById('sidebar');
        if (sb) {
          const nameEl = sb.querySelector('.sidebar-company-name');
          if (nameEl) nameEl.textContent = data.name || '—';
        }
      },
    });
  };

  const changePlan = () => {
    const c = FG.state.company();
    FG.modal.form({
      title: 'Change Plan',
      fields: [
        { key: 'plan', label: 'Plan', type: 'select', required: true, full: true,
          options: [
            { value: 'all-access', label: 'All-Access — $399/mo (all 4 services)' },
            { value: 'alacarte', label: 'À La Carte — $149/mo per service' },
          ]
        },
      ],
      data: c,
      submitText: 'Change Plan',
      onSubmit: (data) => {
        FG.state.setCompany(data);
        FG.toast(`Plan changed to ${data.plan === 'all-access' ? 'All-Access' : 'À La Carte'}.`, 'success');
        render();
        const sb = document.getElementById('sidebar');
        if (sb) {
          const planEl = sb.querySelector('.sidebar-company-plan');
          if (planEl) planEl.textContent = data.plan === 'all-access' ? 'All-Access Member' : 'À La Carte Member';
        }
      },
    });
  };

  const render = () => {
    const c = FG.state.company();

    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Company Profile</h2>
          <p>Your business identity, regulatory IDs, and primary contact.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="btn-change-plan">Change Plan</button>
          <button class="btn btn-primary" id="btn-edit-profile">Edit Profile</button>
        </div>
      </div>

      <div class="grid-2 gap-24">
        <div class="card">
          <div class="card-header"><span class="card-title">Company Information</span></div>
          <div class="card-body">
            <div class="detail-grid">
              <div class="detail-row" style="grid-column:1/-1"><span class="lbl">Company Name</span><span class="val" style="font-size:18px;font-family:var(--font-display);letter-spacing:1px">${FG.utils.escapeHtml(c.name || '—')}</span></div>
              <div class="detail-row"><span class="lbl">USDOT</span><span class="val mono">${FG.utils.escapeHtml(c.dot_number || '—')}</span></div>
              <div class="detail-row"><span class="lbl">MC Number</span><span class="val mono">${FG.utils.escapeHtml(c.mc_number || '—')}</span></div>
              <div class="detail-row"><span class="lbl">PUCO</span><span class="val mono">${FG.utils.escapeHtml(c.puco_number || '—')}</span></div>
              <div class="detail-row"><span class="lbl">Fleet Type</span><span class="val">${FG.utils.escapeHtml(c.fleet_type || '—')}</span></div>
              <div class="detail-row" style="grid-column:1/-1"><span class="lbl">Address</span><span class="val">${FG.utils.escapeHtml(c.address || '—')}</span></div>
              <div class="detail-row"><span class="lbl">Phone</span><span class="val">${FG.utils.escapeHtml(c.phone || '—')}</span></div>
              <div class="detail-row"><span class="lbl">Email</span><span class="val">${FG.utils.escapeHtml(c.email || '—')}</span></div>
              <div class="detail-row" style="grid-column:1/-1"><span class="lbl">Website</span><span class="val">${FG.utils.escapeHtml(c.website || '—')}</span></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Membership</span></div>
          <div class="card-body">
            <div style="text-align:center;padding:20px 0">
              <div style="font-family:var(--font-display);font-size:32px;letter-spacing:2px;color:var(--accent);text-transform:uppercase">${c.plan === 'all-access' ? 'All-Access' : 'À La Carte'}</div>
              <div style="font-family:var(--font-mono);font-size:13px;color:var(--muted);margin-top:4px">
                ${c.plan === 'all-access' ? '$399 / month flat' : '$149 / service / month'}
              </div>
              <div style="margin-top:16px;font-size:12px;color:var(--muted-strong)">Member since ${FG.utils.fmtDate(c.member_since)}</div>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted-strong);margin-bottom:8px">Active Services</div>
              ${(c.services || []).length ? (c.services).map(s => {
                const map = { safety: '🛡️ Driver Safety', compliance: '📋 DOT/PUCO', maintenance: '🔧 Maintenance', insurance: '📄 Insurance' };
                return `<div style="padding:6px 0;font-size:13px">${map[s] || s}</div>`;
              }).join('') : '<div class="empty-state">No services selected.</div>'}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Primary Contact</span></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
            <div class="avatar" style="width:64px;height:64px;font-size:24px">${FG.utils.initials(c.contact_name || 'JS')}</div>
            <div style="flex:1;min-width:200px">
              <div style="font-family:var(--font-display);font-size:22px;letter-spacing:1px">${FG.utils.escapeHtml(c.contact_name || '—')}</div>
              <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${FG.utils.escapeHtml(c.contact_title || '')}</div>
              <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px">
                <span>📧 ${FG.utils.escapeHtml(c.contact_email || '—')}</span>
                <span>📞 ${FG.utils.escapeHtml(c.contact_phone || '—')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-edit-profile').addEventListener('click', editProfile);
    root.querySelector('#btn-change-plan').addEventListener('click', changePlan);
  };

  render();
};
