// ============================================================
// PANEL: ADMIN CONSOLE (Phase B)
// ============================================================
// Pending / Approved / Declined tabs over public.access_requests.
//
// Pending → Approve calls admin-approve-request Edge Function
// (creates auth.users invite, patches companies grant, marks the
// request approved). Reads + Decline updates use the caller's JWT,
// gated by RLS policies access_requests_admin_select /
// access_requests_admin_update which require users.is_admin=true.
//
// Sidebar visibility is controlled in app.js via
// FG.app.isAdmin(); this file assumes the panel only mounts for
// admins, but RLS would refuse the read anyway if it didn't.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen   = FG._gen   || {};

FG.panels.admin = function (root) {
  const myGen = FG._gen.admin = (FG._gen.admin || 0) + 1;

  // Service catalog used by the approve modal. Codes match
  // SERVICES_TO_PANELS in app.js and the admin-approve-request Edge
  // Function. Order here drives the order of checkboxes shown.
  const SERVICE_CATALOG = [
    { code: 'safety',      label: 'Driver Safety Management' },
    { code: 'compliance',  label: 'DOT / PUCO Compliance' },
    { code: 'maintenance', label: 'Fleet Maintenance' },
    { code: 'insurance',   label: 'Insurance Management' },
  ];
  const TRIAL_DAY_OPTIONS = [30, 60, 90, 120, 150, 180];

  let activeTab = 'pending';
  let rows = { pending: [], approved: [], declined: [] };

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error', 6000);
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fmtFleetSize = (s) => s || '—';
  const fmtDate = (s) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch (_) { return s; }
  };

  const sourceBadge = (s) => {
    const label = s === 'contact-form' ? 'Contact' : 'Request';
    const bg = s === 'contact-form' ? 'rgba(46,160,67,.12)' : 'rgba(245,166,35,.12)';
    const color = s === 'contact-form' ? '#56d364' : 'var(--accent)';
    return `<span style="font-family:var(--font-mono);font-size:11px;padding:2px 8px;border-radius:4px;background:${bg};color:${color}">${label}</span>`;
  };

  // ── Approve modal ─────────────────────────────────────────────
  // Custom modal (not FG.modal.form) because we need conditional
  // field visibility (trial_days only when access_type=free_trial)
  // and a multi-select of services with an "All" master toggle.
  const openApproveModal = (request) => {
    const fieldId = (k) => `approve-${request.id}-${k}`;

    const servicesHtml = `
      <label class="service-check" style="grid-column:1/-1">
        <input type="checkbox" id="${fieldId('all')}" data-services-master>
        <div><div class="service-check-label">All-Access (all 4 services)</div><div class="service-check-price">Selecting this overrides individual checkboxes.</div></div>
      </label>
      ${SERVICE_CATALOG.map(s => `
        <label class="service-check">
          <input type="checkbox" data-service="${FG.utils.escapeAttr(s.code)}">
          <div><div class="service-check-label">${FG.utils.escapeHtml(s.label)}</div></div>
        </label>
      `).join('')}
    `;

    const body = `
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
        Approving <strong style="color:var(--text)">${FG.utils.escapeHtml(request.company_name)}</strong>
        — invite will be sent to <span style="font-family:var(--font-mono)">${FG.utils.escapeHtml(request.email)}</span>.
      </div>

      <div class="field-group">
        <label for="${fieldId('access_type')}">Access Type *</label>
        <select class="form-control" id="${fieldId('access_type')}" data-access-type>
          <option value="free_trial">Free Trial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div class="field-group" data-trial-days-row>
        <label for="${fieldId('trial_days')}">Trial Length</label>
        <select class="form-control" id="${fieldId('trial_days')}" data-trial-days>
          ${TRIAL_DAY_OPTIONS.map(d => `<option value="${d}">${d} days</option>`).join('')}
        </select>
      </div>

      <div class="field-group">
        <label>Services *</label>
        <div class="service-checkboxes" data-services-grid>${servicesHtml}</div>
        <div class="field-hint">Pick at least one. All four (or "All-Access") grants every service-gated panel.</div>
      </div>

      <div id="${fieldId('error')}" class="alert alert-danger" style="display:none;margin-bottom:8px"></div>
    `;

    const m = FG.modal.open({
      title: `Approve: ${request.company_name}`,
      body,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-approve-submit>Approve & Invite</button>`,
      size: 'md',
    });

    const overlay = m.overlay;
    const accessTypeEl   = overlay.querySelector('[data-access-type]');
    const trialDaysRow   = overlay.querySelector('[data-trial-days-row]');
    const trialDaysEl    = overlay.querySelector('[data-trial-days]');
    const masterEl       = overlay.querySelector('[data-services-master]');
    const serviceEls     = overlay.querySelectorAll('[data-service]');
    const errorEl        = overlay.querySelector(`#${fieldId('error')}`);
    const submitBtn      = overlay.querySelector('[data-approve-submit]');

    const showError = (msg) => { errorEl.textContent = msg; errorEl.style.display = ''; };
    const clearError = () => { errorEl.textContent = ''; errorEl.style.display = 'none'; };

    const syncTrialVisibility = () => {
      const showTrial = accessTypeEl.value === 'free_trial';
      trialDaysRow.style.display = showTrial ? '' : 'none';
    };
    accessTypeEl.addEventListener('change', syncTrialVisibility);
    syncTrialVisibility();

    // Master "All" checkbox: ticking it forces all 4 service boxes on
    // and disables them so the admin sees the override is total.
    // Unticking it re-enables them (preserving any previously checked
    // state would be more complex than it's worth).
    const syncMaster = () => {
      const allOn = masterEl.checked;
      serviceEls.forEach(el => {
        el.checked = allOn ? true : el.checked;
        el.disabled = allOn;
      });
    };
    masterEl.addEventListener('change', syncMaster);

    submitBtn.addEventListener('click', async () => {
      clearError();
      const access_type = accessTypeEl.value;
      const trial_days  = access_type === 'free_trial' ? Number(trialDaysEl.value) : undefined;

      let services;
      if (masterEl.checked) {
        services = 'all';
      } else {
        services = Array.from(serviceEls).filter(el => el.checked).map(el => el.dataset.service);
        if (!services.length) {
          showError('Pick at least one service, or check "All-Access".');
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Inviting…';
      try {
        await callAdminApprove({ request_id: request.id, access_type, trial_days, services });
        FG.toast(`${request.company_name} approved. Invite sent to ${request.email}.`, 'success', 6000);
        m.close();
        await reload();
      } catch (e) {
        showError(e.message || 'Approval failed.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Approve & Invite';
      }
    });
  };

  // ── Decline confirm ──────────────────────────────────────────
  // Direct UPDATE via RLS (admin policy). Reason is captured in
  // approval_metadata.reason for future reference / audit. Email
  // notifying the prospect of the decline is intentionally omitted
  // from this PR — flagged as Phase B.1 follow-up; the row alone
  // is enough for the admin to reach back out manually.
  const openDeclineModal = (request) => {
    FG.modal.form({
      title: `Decline: ${request.company_name}`,
      fields: [
        { key: 'reason', label: 'Decline Reason (internal)', type: 'textarea', rows: 3, full: true,
          hint: 'Stored on the access_request record for future reference. Not currently emailed to the prospect.' },
      ],
      submitText: 'Decline Request',
      onSubmit: async (data) => {
        try {
          const { error } = await FG.supabase
            .from('access_requests')
            .update({
              status: 'declined',
              reviewed_by: (FG.app.user() || {}).id || null,
              reviewed_at: new Date().toISOString(),
              approval_metadata: { reason: (data.reason || '').trim() || null },
            })
            .eq('id', request.id);
          if (error) throw error;
          FG.toast(`${request.company_name} declined.`, 'success');
          await reload();
        } catch (e) {
          reportError(e, 'Decline failed.');
          return false;
        }
      },
    });
  };

  // ── Edge function call ────────────────────────────────────────
  const callAdminApprove = async (payload) => {
    const cfg = FG.supabaseConfig || {};
    const { data: { session } } = await FG.supabase.auth.getSession();
    if (!session) throw new Error('Your session expired. Sign in again.');

    const url = `${cfg.SUPABASE_URL}/functions/v1/admin-approve-request`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        cfg.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await resp.json(); } catch (_) { /* non-JSON body */ }
    if (!resp.ok) {
      const err = new Error((data && data.error) || `Approve failed (${resp.status}).`);
      err.field = data && data.field;
      throw err;
    }
    return data || {};
  };

  // ── Rendering ─────────────────────────────────────────────────
  const tabsHtml = () => `
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px">
      ${[
        { key: 'pending',  label: 'Pending Requests', count: rows.pending.length },
        { key: 'approved', label: 'Approved',         count: rows.approved.length },
        { key: 'declined', label: 'Declined',         count: rows.declined.length },
      ].map(t => `
        <button data-tab="${t.key}" style="background:none;border:none;border-bottom:2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'};color:${activeTab === t.key ? 'var(--text)' : 'var(--muted)'};font-family:var(--font-display);font-size:14px;letter-spacing:1px;text-transform:uppercase;padding:14px 20px;cursor:pointer;transition:color .2s,border-color .2s">
          ${t.label} <span style="opacity:.7;font-family:var(--font-mono);font-size:12px">(${t.count})</span>
        </button>
      `).join('')}
    </div>
  `;

  const pendingTableHtml = () => {
    if (!rows.pending.length) {
      return `<div class="empty-state"><span class="icon">📭</span>No pending requests right now.</div>`;
    }
    return `
      <div class="table-wrap"><table class="data-table"><thead><tr>
        <th>Company</th>
        <th>Contact</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Fleet Size</th>
        <th>Source</th>
        <th>Submitted</th>
        <th style="text-align:right">Actions</th>
      </tr></thead><tbody>
        ${rows.pending.map(r => `
          <tr data-row="${r.id}">
            <td><strong>${FG.utils.escapeHtml(r.company_name)}</strong>${r.referral_source ? `<div style="font-size:11px;color:var(--muted-strong)">via ${FG.utils.escapeHtml(r.referral_source)}</div>` : ''}</td>
            <td>${FG.utils.escapeHtml(r.contact_name)}</td>
            <td><span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(r.email)}</span></td>
            <td><span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(r.phone)}</span></td>
            <td>${FG.utils.escapeHtml(fmtFleetSize(r.fleet_size))}</td>
            <td>${sourceBadge(r.source)}</td>
            <td><span style="font-size:12px;color:var(--muted)">${FG.utils.escapeHtml(fmtDate(r.created_at))}</span></td>
            <td style="text-align:right">
              <button class="btn btn-primary btn-sm" data-action="approve" data-id="${r.id}">Approve</button>
              <button class="btn btn-ghost btn-sm" data-action="decline" data-id="${r.id}" style="margin-left:6px">Decline</button>
              ${r.notes ? `<button class="btn btn-ghost btn-sm" data-action="view" data-id="${r.id}" style="margin-left:6px">Notes</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody></table></div>
    `;
  };

  const reviewedTableHtml = (status) => {
    const list = rows[status];
    if (!list.length) {
      return `<div class="empty-state"><span class="icon">${status === 'approved' ? '✅' : '🚫'}</span>No ${status} requests.</div>`;
    }
    return `
      <div class="table-wrap"><table class="data-table"><thead><tr>
        <th>Company</th>
        <th>Contact</th>
        <th>Email</th>
        <th>Source</th>
        <th>Reviewed</th>
        <th>${status === 'approved' ? 'Plan / Services' : 'Reason'}</th>
      </tr></thead><tbody>
        ${list.map(r => {
          const meta = r.approval_metadata || {};
          const detail = status === 'approved'
            ? (meta.plan ? `<strong>${FG.utils.escapeHtml(meta.plan)}</strong>${meta.services && meta.services.length ? `<div style="font-size:11px;color:var(--muted-strong)">${meta.services.map(FG.utils.escapeHtml).join(', ')}${meta.access_type === 'free_trial' && meta.trial_days ? ` · ${meta.trial_days}-day trial` : ''}</div>` : ''}` : '—')
            : (meta.reason ? FG.utils.escapeHtml(meta.reason) : '—');
          return `<tr>
            <td><strong>${FG.utils.escapeHtml(r.company_name)}</strong></td>
            <td>${FG.utils.escapeHtml(r.contact_name)}</td>
            <td><span style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(r.email)}</span></td>
            <td>${sourceBadge(r.source)}</td>
            <td><span style="font-size:12px;color:var(--muted)">${FG.utils.escapeHtml(fmtDate(r.reviewed_at || r.updated_at))}</span></td>
            <td><span style="font-size:13px">${detail}</span></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
    `;
  };

  const render = () => {
    const tabBody = (activeTab === 'pending')
      ? pendingTableHtml()
      : reviewedTableHtml(activeTab);

    root.innerHTML = `
      <div style="margin-bottom:18px">
        <h2 style="font-family:var(--font-display);font-size:24px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Admin Console</h2>
        <p style="color:var(--muted);font-size:13px">Review and approve access_requests from prospects who submitted the public form.</p>
      </div>
      ${tabsHtml()}
      <div data-tab-body>${tabBody}</div>
    `;

    root.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        render();
      });
    });

    if (activeTab === 'pending') {
      root.querySelectorAll('[data-action]').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          const row = rows.pending.find(r => r.id === id);
          if (!row) return;
          if (b.dataset.action === 'approve') openApproveModal(row);
          else if (b.dataset.action === 'decline') openDeclineModal(row);
          else if (b.dataset.action === 'view') {
            FG.modal.open({
              title: row.company_name,
              body: `<div style="font-size:13px;color:var(--muted);white-space:pre-wrap">${FG.utils.escapeHtml(row.notes || '')}</div>`,
              size: 'md',
            });
          }
        });
      });
    }
  };

  // ── Data load ─────────────────────────────────────────────────
  const reload = async () => {
    try {
      const { data, error } = await FG.supabase
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const all = data || [];
      rows.pending  = all.filter(r => r.status === 'pending');
      rows.approved = all.filter(r => r.status === 'approved');
      rows.declined = all.filter(r => r.status === 'declined');
    } catch (e) {
      reportError(e, 'Failed to load access requests.');
      rows = { pending: [], approved: [], declined: [] };
    }
    if (myGen !== FG._gen.admin) return;
    render();
  };

  const mount = async () => {
    if (!FG.app.isAdmin()) {
      root.innerHTML = `<div class="empty-state"><span class="icon">🔒</span>This panel is only visible to FleetGuard admins.</div>`;
      return;
    }
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading access requests…</div>`;
    await reload();
  };

  mount();
};
