// ============================================================
// PANEL: COMPANY PROFILE
// ============================================================
// Wave 6 (Phase 2C): reads via FG.db (Supabase) on mount, writes
// via FG.db.update with a write-through shim to FG.state. Tenant
// scoping handled by RLS. companies has no FK out (it's the
// parent of every other table); profile operates on the single
// row identified by FG.db.companyId().
//
// Both write paths (editProfile, changePlan) converge on the
// shared saveCompany(patch) async helper. After a successful
// FG.db.update returns the updated row, saveCompany() calls
// FG.state.setCompany(row) — ratified Wave 9 deferral shim that
// keeps the FG.state.company() cache in sync with Supabase truth.
// Existing FG.state.company() readers (documents.js, overview.js,
// billing.js, app.js sidebar) get fresh data without migrating.
// Wave 9 rips out the shim once those readers move to FG.db.
//
// Plan-name drift fix: the À La Carte option now emits
// 'a-la-carte' (with hyphens) to match the schema CHECK set
// ('a-la-carte','all-access'). Pre-Wave-6 it shipped 'alacarte'
// which would 23514 against the live DB. The bug was silent under
// FG.state because localStorage tolerates anything and read paths
// only check === 'all-access' (else falls through).
//
// No delete UI — companies row is created by the signup trigger
// and persists for the lifetime of the tenant.
//
// Sidebar DOM patching after save (.sidebar-company-name,
// .sidebar-company-plan) preserved as-is — refactoring to a
// proper FG.app.renderSidebar() export is out of scope for Wave 6.
//
// FG.storage.estimate() localStorage usage indicator removed —
// meaningless in Supabase mode.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.profile = function (root) {
  const myGen = FG._gen.profile = (FG._gen.profile || 0) + 1;

  let company = null;

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  // Shared write path for editProfile + changePlan.
  // 1. await FG.db.update -> row from Supabase (the truth)
  // 2. FG.state.setCompany(row) -- ratified Wave 9 write-through shim;
  //    keeps the FG.state.company() cache aligned for in-session readers.
  // 3. update local mount cache + re-render.
  const saveCompany = async (patch) => {
    try {
      const row = await FG.db.update('companies', company.id, patch);
      FG.state.setCompany(row);
      company = row;
      render();
      return row;
    } catch (err) {
      reportError(err, 'Save failed.');
      return null;
    }
  };

  const editProfile = () => {
    const m = FG.modal.form({
      title: 'Edit Company Profile',
      size: 'lg',
      fields: [
        { key: 'name', label: 'Company Name', required: true, full: true },
        { key: 'dot_number', label: 'USDOT Number' },
        { key: 'mc_number', label: 'MC Number' },
        { key: 'puco_number', label: 'PUCO Number' },
        { key: 'fleet_type', label: 'Fleet Type', type: 'select', options: ['Tow Trucks', 'Box Trucks', 'Mixed (Tow + Box)', 'Other'] },
        { key: 'address', label: 'Business Address', full: true },
        { key: 'phone', label: 'Main Phone', placeholder: '614-633-7935' },
        { key: 'email', label: 'Main Email', type: 'email' },
        { key: 'website', label: 'Website', full: true },
        { key: 'contact_name', label: 'Primary Contact', placeholder: 'First Last' },
        { key: 'contact_title', label: 'Title' },
        { key: 'contact_email', label: 'Contact Email', type: 'email' },
        { key: 'contact_phone', label: 'Contact Phone', placeholder: '614-633-7935' },
      ],
      data: company,
      submitText: 'Save Changes',
      // Profile fields (other than Company Name) are optional, so
      // each *Error helper runs with required:false — empty stays
      // empty, but anything supplied must be well-formed. Phones are
      // also normalized to XXX-XXX-XXXX / 1-XXX-XXX-XXXX before save
      // so the stored shape matches the contact + access-request rows.
      onSubmit: async (data) => {
        const contact_name = (data.contact_name || '').trim();
        const phone        = FG.validate.formatPhone((data.phone || '').trim());
        const contact_phone = FG.validate.formatPhone((data.contact_phone || '').trim());
        const checks = [
          phone        ? FG.validate.phoneError(phone, { required: false })       : null,
          contact_phone? FG.validate.phoneError(contact_phone, { required: false }): null,
          (data.email || '').trim()        ? FG.validate.emailError(data.email, { required: false })        : null,
          (data.contact_email || '').trim()? FG.validate.emailError(data.contact_email, { required: false }): null,
          // Primary Contact, if filled in, must be a full name
          // (matches Request Access / Contact rules). Empty is
          // permitted because the field isn't required.
          contact_name ? FG.validate.fullNameError(contact_name, 'Primary contact') : null,
        ].filter(Boolean);
        if (checks.length) {
          FG.toast(checks[0], 'error', 5500);
          return false;
        }
        // Re-pack normalized phones into the patch so saveCompany
        // writes the canonical shape, not the raw user input.
        const patch = { ...data, phone, contact_phone, contact_name };
        const row = await saveCompany(patch);
        if (!row) return false;
        FG.toast('Profile updated.', 'success');
        // refresh sidebar in case name changed
        const sb = document.getElementById('sidebar');
        if (sb) {
          const nameEl = sb.querySelector('.sidebar-company-name');
          if (nameEl) nameEl.textContent = row.name || '—';
        }
      },
    });
    // Auto-format both phone fields on blur, same as the contact /
    // access-request forms.
    if (m && m.overlay) {
      FG.validate.attachPhoneFormatter(m.overlay.querySelector('input[name="phone"]'));
      FG.validate.attachPhoneFormatter(m.overlay.querySelector('input[name="contact_phone"]'));
    }
  };

  const changePlan = () => {
    FG.modal.form({
      title: 'Change Plan',
      fields: [
        { key: 'plan', label: 'Plan', type: 'select', required: true, full: true,
          options: [
            { value: 'all-access', label: 'All-Access — $399/mo (all 4 services)' },
            // Drift fix: schema CHECK requires 'a-la-carte' (with hyphens).
            // Pre-Wave-6 this emitted 'alacarte' — silent under FG.state,
            // would 23514 against the live DB.
            { value: 'a-la-carte', label: 'À La Carte — $149/mo per service' },
          ]
        },
      ],
      data: company,
      submitText: 'Change Plan',
      onSubmit: async (data) => {
        const row = await saveCompany(data);
        if (!row) return false;
        FG.toast(`Plan changed to ${row.plan === 'all-access' ? 'All-Access' : 'À La Carte'}.`, 'success');
        const sb = document.getElementById('sidebar');
        if (sb) {
          const planEl = sb.querySelector('.sidebar-company-plan');
          if (planEl) planEl.textContent = row.plan === 'all-access' ? 'All-Access Member' : 'À La Carte Member';
        }
      },
    });
  };

  const render = () => {
    const c = company;

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

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading profile…</div>`;
    const cid = FG.db.companyId();
    if (!cid) {
      // Defensive: app.js initDashboard awaits FG.db.init() before any panel
      // mounts, so companyId() should be resolved by the time we get here.
      // If it isn't, surface clearly rather than letting the FG.db.get fail
      // with a less obvious error.
      console.error('profile mount: FG.db.companyId() unresolved');
      if (myGen !== FG._gen.profile) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Profile unavailable — company not yet resolved. Reload the dashboard.</div>
        </div>`;
      return;
    }
    try {
      company = await FG.db.get('companies', cid);
      if (!company) throw new Error(`Company ${cid} not found.`);
    } catch (err) {
      console.error('profile.get failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.profile) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load profile. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.profile) return;
    render();
  };

  mount();
};
