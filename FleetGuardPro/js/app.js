// ============================================================
// APP — page routing, dashboard nav, init
// ============================================================
window.FG = window.FG || {};

FG.app = (function () {

  const PANELS = [
    { id: 'overview',    label: 'Dashboard',         icon: '🏠', section: 'Overview' },
    { id: 'alerts',      label: 'Alerts & Notices',  icon: '🔔', section: 'Overview', badge: () => FG.state.unreadAlertCount() },
    { id: 'fleet',       label: 'Fleet Units',       icon: '🚛', section: 'Fleet Management' },
    { id: 'drivers',     label: 'Drivers',           icon: '👤', section: 'Fleet Management' },
    { id: 'maintenance', label: 'Maintenance',       icon: '🔧', section: 'Fleet Management' },
    { id: 'repairs',     label: 'Repair Requests',   icon: '🛠️', section: 'Fleet Management' },
    { id: 'parts',       label: 'Parts Inventory',   icon: '📦', section: 'Fleet Management' },
    { id: 'dot',         label: 'DOT / PUCO Files',  icon: '📋', section: 'Compliance' },
    { id: 'safety',      label: 'Driver Safety',     icon: '🛡️', section: 'Compliance' },
    { id: 'insurance',   label: 'Insurance',         icon: '📄', section: 'Insurance' },
    { id: 'garage',      label: 'Garage Access',     icon: '🏚️', section: 'Network' },
    { id: 'reports',     label: 'Reports',           icon: '📊', section: 'Network' },
    { id: 'profile',     label: 'Company Profile',   icon: '🏢', section: 'Account' },
    { id: 'documents',   label: 'Documents',         icon: '📁', section: 'Account' },
    { id: 'billing',     label: 'Billing',           icon: '💳', section: 'Account' },
    { id: 'admin',       label: 'Admin Console',     icon: '🛠️', section: 'Admin' },
  ];

  const TITLES = {
    overview: 'Dashboard Overview', alerts: 'Alerts & Notices',
    fleet: 'Fleet Units', drivers: 'Driver Roster', maintenance: 'Maintenance Schedule',
    repairs: 'Repair & Parts Requests', parts: 'Parts Inventory',
    dot: 'DOT & PUCO Compliance', safety: 'Driver Safety',
    insurance: 'Insurance Management', garage: 'Garage Network', reports: 'Reports Engine',
    profile: 'Company Profile', documents: 'Document Storage', billing: 'Billing & Subscription',
    admin: 'Admin Console',
  };

  // Phase B service-gating. Service codes mirror seed.sql / seed.js
  // (['safety','compliance','maintenance','insurance']) and the
  // admin-approve-request Edge Function. Panels not in either map
  // are always visible (overview/alerts/fleet/drivers/garage/reports/
  // profile/documents/billing — these are core dashboard infrastructure,
  // not à-la-carte products).
  const SERVICES_TO_PANELS = {
    safety:      ['safety'],
    compliance:  ['dot'],
    maintenance: ['maintenance', 'repairs', 'parts'],
    insurance:   ['insurance'],
  };
  const ALWAYS_VISIBLE_PANELS = new Set([
    'overview', 'alerts', 'fleet', 'drivers',
    'garage', 'reports', 'profile', 'documents', 'billing',
  ]);

  let currentPanel = 'overview';
  // Cached after first dashboard mount; refreshed each time initDashboard
  // runs so a re-entry after an admin grant change picks up new services.
  let _user = null;
  let _company = null;

  // ── PAGE ROUTING ──
  const showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = (id === 'dashboard') ? 'none' : '';
    if (id === 'dashboard') initDashboard();
  };

  const scrollToSection = (id) => {
    showPage('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // ── ACCESS CONTROL ────────────────────────────────────────
  // visiblePanelIds collapses (company.plan, company.services, user.is_admin)
  // into the set of panel ids the sidebar should render. Returning a Set
  // also makes the navigate() guard cheap.
  const visiblePanelIds = () => {
    const visible = new Set(ALWAYS_VISIBLE_PANELS);
    if (_user && _user.is_admin) visible.add('admin');
    if (!_company) return visible;
    const codes = (_company.plan === 'all-access')
      ? Object.keys(SERVICES_TO_PANELS)
      : (Array.isArray(_company.services) ? _company.services : []);
    codes.forEach(code => {
      (SERVICES_TO_PANELS[code] || []).forEach(p => visible.add(p));
    });
    return visible;
  };

  const isTrialExpired = () => {
    if (_user && _user.is_admin) return false;  // admins never gated by trial
    if (!_company) return false;
    if (_company.access_type !== 'free_trial') return false;
    if (!_company.trial_ends_at) return false;
    return new Date(_company.trial_ends_at).getTime() <= Date.now();
  };

  const renderTrialExpired = () => {
    const sb = document.getElementById('sidebar');
    if (sb) sb.innerHTML = '';
    const tb = document.getElementById('topbar-title');
    if (tb) tb.textContent = 'Trial Expired';
    const content = document.getElementById('dash-content');
    if (!content) return;
    content.innerHTML = `
      <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;text-align:center">
        <div style="max-width:560px">
          <div style="font-size:64px;margin-bottom:16px">⏳</div>
          <h1 style="font-family:var(--font-display);font-size:clamp(36px,5vw,52px);letter-spacing:2px;text-transform:uppercase;line-height:1;margin-bottom:20px">Trial <em style="font-style:normal;color:var(--accent)">Expired</em></h1>
          <p style="color:var(--muted);font-size:15px;line-height:1.7;margin-bottom:8px">Your FleetGuard Pro free trial has ended.</p>
          <p style="color:var(--muted);font-size:15px;line-height:1.7;margin-bottom:28px">To re-activate your dashboard, get in touch and we'll set up your paid plan.</p>
          <p style="color:var(--text);font-size:20px;font-weight:600;margin-bottom:32px">Call <a href="tel:+16146337935" style="color:var(--accent);text-decoration:none">(614) 633-7935</a></p>
          <button class="btn btn-ghost" onclick="FG.app.logout()">Sign out</button>
        </div>
      </div>
    `;
  };

  // ── SIDEBAR ──
  const renderSidebar = () => {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const visible = visiblePanelIds();
    const sections = {};
    PANELS.forEach(p => {
      if (!visible.has(p.id)) return;
      sections[p.section] = sections[p.section] || [];
      sections[p.section].push(p);
    });

    const companyName = (_company && _company.name) || (FG.state.company() || {}).name || '—';
    const plan        = (_company && _company.plan) || (FG.state.company() || {}).plan;
    const planLabel   = plan === 'all-access' ? 'All-Access Member' : 'À La Carte Member';

    let html = `
      <div class="sidebar-company">
        <div class="sidebar-logo" onclick="FG.app.showPage('home')">Fleet<span>Guard</span> PRO</div>
        <div class="sidebar-company-name">${FG.utils.escapeHtml(companyName)}</div>
        <div class="sidebar-company-plan">${planLabel}</div>
      </div>
    `;
    Object.keys(sections).forEach(section => {
      html += `<div class="sidebar-section">${section}</div>`;
      sections[section].forEach(p => {
        const badge = p.badge ? p.badge() : 0;
        html += `<a class="sidebar-link" data-panel="${p.id}">
          <span class="icon">${p.icon}</span>
          <span>${p.label}</span>
          ${badge ? `<span class="sidebar-badge" data-badge="${p.id}">${badge}</span>` : `<span class="sidebar-badge" data-badge="${p.id}" style="display:none"></span>`}
        </a>`;
      });
    });
    html += `
      <div class="sidebar-footer">
        <button class="btn btn-ghost btn-sm" onclick="FG.app.showPage('home')">← Back to Site</button>
        <button class="btn btn-ghost btn-sm" onclick="FG.app.resetData()" title="Reset demo data">⟲ Reset Demo</button>
      </div>
    `;
    sb.innerHTML = html;

    sb.querySelectorAll('[data-panel]').forEach(a => {
      a.addEventListener('click', () => navigate(a.dataset.panel));
    });
  };

  const refreshBadges = () => {
    PANELS.forEach(p => {
      const el = document.querySelector(`[data-badge="${p.id}"]`);
      if (!el) return;
      const v = p.badge ? p.badge() : 0;
      if (v > 0) { el.textContent = v; el.style.display = ''; }
      else el.style.display = 'none';
    });
  };

  const closeSidebar = () => {
    document.body.classList.remove('sidebar-open');
    const tog = document.getElementById('sidebar-toggle');
    if (tog) tog.setAttribute('aria-expanded', 'false');
  };
  const openSidebar = () => {
    document.body.classList.add('sidebar-open');
    const tog = document.getElementById('sidebar-toggle');
    if (tog) tog.setAttribute('aria-expanded', 'true');
  };
  const toggleSidebar = () => {
    if (document.body.classList.contains('sidebar-open')) closeSidebar();
    else openSidebar();
  };

  const navigate = (panelId) => {
    if (isTrialExpired()) { renderTrialExpired(); return; }

    // Service-gated panel that the user no longer has access to. Reroute
    // to overview rather than rendering a half-broken page. (Hits if the
    // sidebar was rendered before a grant change but the user still
    // clicked an old badge.)
    if (!visiblePanelIds().has(panelId)) {
      panelId = 'overview';
    }

    currentPanel = panelId;
    closeSidebar();
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.panel === panelId));
    document.getElementById('topbar-title').textContent = TITLES[panelId] || panelId;

    document.querySelectorAll('.dash-panel').forEach(p => p.classList.add('hidden'));
    let panel = document.getElementById('dash-' + panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'dash-' + panelId;
      panel.className = 'dash-panel';
      document.getElementById('dash-content').appendChild(panel);
    }
    panel.classList.remove('hidden');

    const renderer = FG.panels && FG.panels[panelId];
    if (typeof renderer === 'function') {
      try { renderer(panel); }
      catch (e) { console.error(e); panel.innerHTML = `<div class="alert alert-danger">Error rendering panel: ${FG.utils.escapeHtml(e.message)}</div>`; }
    } else {
      panel.innerHTML = `<div class="empty-state"><span class="icon">🚧</span>Panel "${panelId}" not implemented.</div>`;
    }

    refreshBadges();
    window.scrollTo(0, 0);
  };

  // Phase B: refresh the user + company rows on every dashboard entry so
  // grants applied while the tab was open (admin approval, plan change)
  // surface without requiring a hard reload. Failures here are loud —
  // we route back to login rather than render a half-broken sidebar.
  const refreshAccessContext = async () => {
    if (!FG.supabase) return false;
    try {
      const { data: { user: authUser } } = await FG.supabase.auth.getUser();
      if (!authUser) return false;

      const [{ data: userRow, error: ue }, ] = await Promise.all([
        FG.supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
      ]);
      if (ue || !userRow) {
        console.error('app: failed to load public.users row', ue);
        return false;
      }
      _user = userRow;

      const { data: companyRow, error: ce } = await FG.supabase
        .from('companies').select('*').eq('id', userRow.company_id).maybeSingle();
      if (ce || !companyRow) {
        console.error('app: failed to load companies row', ce);
        return false;
      }
      _company = companyRow;
      return true;
    } catch (e) {
      console.error('app: refreshAccessContext threw', e);
      return false;
    }
  };

  let dashInitialized = false;
  const initDashboard = async () => {
    // Phase 2B session gate.
    if (FG.supabase) {
      const { data: { user } } = await FG.supabase.auth.getUser();
      if (!user) { showPage('login'); return; }
      // Resolve tenant once; FG.db.create() needs this before any panel write.
      await FG.db.init();
      // Phase B: load the user + company rows (is_admin, plan, services,
      // access_type, trial_ends_at) so the sidebar / trial gate can
      // decide what to render.
      const ok = await refreshAccessContext();
      if (!ok) {
        // Treat unrecoverable load failure as a forced sign-out — the
        // alternative is rendering a sidebar that lies about access.
        try { await FG.supabase.auth.signOut(); } catch (_) {}
        showPage('login');
        return;
      }
    }
    FG.seed.ensureSeeded();
    // Recompute auto-generated alerts on every dashboard entry so expiring
    // dates / overdue tasks / low stock surface even after a day-of-the-week change.
    if (FG.state.generateAlerts) FG.state.generateAlerts();
    if (!dashInitialized) {
      const tog = document.getElementById('sidebar-toggle');
      if (tog) tog.addEventListener('click', toggleSidebar);
      const bd = document.getElementById('sidebar-backdrop');
      if (bd) bd.addEventListener('click', closeSidebar);
      // Esc closes the drawer too (only when no modal is open above it)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
          // Don't fight with modals: only handle when no modal-overlay is open
          if (!document.querySelector('.modal-overlay.open')) closeSidebar();
        }
      });
      dashInitialized = true;
    }
    // Sidebar rebuilt every entry so admin grants / plan changes propagate.
    renderSidebar();

    if (isTrialExpired()) { renderTrialExpired(); return; }

    // Honor a current panel selection that's no longer in the visible set
    // (e.g., service was revoked since last visit).
    if (!visiblePanelIds().has(currentPanel)) currentPanel = 'overview';
    navigate(currentPanel);
  };

  // ── AUTH ───────────────────────────────────────────────────
  // Email verification redirect lands at the deployed Site URL configured
  // in Supabase Studio → Authentication → URL Configuration. Test the full
  // verify-link round-trip on https://fleetguardpro.online, not file://.
  const showAuthError = (id, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = '';
  };
  const clearAuthError = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  };

  // Phase A — POST to the access-request Edge Function. Self-serve auth
  // signup is gone; admin tooling (Phase B) provisions the auth.users
  // row + companies row once a request is approved.
  const postAccessRequest = async (payload) => {
    const cfg = FG.supabaseConfig || {};
    const url = `${cfg.SUPABASE_URL}/functions/v1/access-request`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        // Even with verify_jwt=false on the function, the Supabase API
        // gateway requires apikey to route the request. The anon key is
        // public-by-design so shipping it here is fine.
        'apikey':        cfg.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await resp.json(); } catch (_) { /* non-JSON body — leave null */ }
    if (!resp.ok) {
      const err = new Error((data && data.error) || `Request failed (${resp.status}).`);
      err.field = data && data.field;
      throw err;
    }
    return data || {};
  };

  const submitAccessRequest = async () => {
    clearAuthError('ar-error');
    const company_name = (document.getElementById('ar-company-name')?.value || '').trim();
    const contact_name = (document.getElementById('ar-contact-name')?.value || '').trim();
    const email        = (document.getElementById('ar-email')?.value || '').trim();
    const phone        = (document.getElementById('ar-phone')?.value || '').trim();
    const fleet_size      = (document.getElementById('ar-fleet-size')?.value || '').trim();
    const referral_source = (document.getElementById('ar-referral')?.value   || '').trim();
    const notes           = (document.getElementById('ar-notes')?.value      || '').trim();

    // Mirror the Edge Function's validation so the user gets immediate
    // feedback without a network round-trip. The function re-validates
    // server-side regardless.
    if (!company_name) return showAuthError('ar-error', 'Company name is required.');
    if (!contact_name) return showAuthError('ar-error', 'Your name is required.');
    if (!EMAIL_RE.test(email)) return showAuthError('ar-error', 'Please enter a valid email address.');
    const digits = phoneDigits(phone);
    if (!PHONE_RE.test(phone) || digits.length < 10 || digits.length > 15) {
      return showAuthError('ar-error', 'Please enter a valid phone number (10+ digits).');
    }

    const btn = document.getElementById('ar-submit');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
    try {
      await postAccessRequest({
        source: 'access-form',
        company_name, contact_name, email, phone,
        fleet_size, referral_source, notes,
      });
      showPage('request-success');
    } catch (e) {
      showAuthError('ar-error', e.message || 'Could not submit request. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  };

  const completeLogin = async () => {
    clearAuthError('login-error');
    const email    = (document.getElementById('login-email')?.value || '').trim();
    const password = document.getElementById('login-password')?.value || '';

    if (!EMAIL_RE.test(email)) return showAuthError('login-error', 'Please enter a valid email address.');
    if (!password) return showAuthError('login-error', 'Password is required.');
    if (!FG.supabase) return showAuthError('login-error', 'Auth client not loaded. Refresh and try again.');

    const { error } = await FG.supabase.auth.signInWithPassword({ email, password });
    if (error) return showAuthError('login-error', error.message);

    showPage('dashboard');
  };

  const logout = async () => {
    if (FG.supabase) await FG.supabase.auth.signOut();
    showPage('home');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // 10–15 digits after stripping non-digits — covers US (10), with country code (11), intl (up to 15).
  const PHONE_RE = /^[\d\s().+\-]{7,}$/;
  const phoneDigits = (s) => (s || '').replace(/\D/g, '');

  // Self-serve password reset request. Modal collects the email and calls
  // supabase.auth.resetPasswordForEmail with redirectTo pointing at
  // /reset-password.html. Supabase intentionally does not reveal whether
  // the email exists — we surface a generic confirmation regardless.
  const openForgotPasswordModal = () => {
    const prefill = (document.getElementById('login-email')?.value || '').trim();
    FG.modal.form({
      title: 'Reset Your Password',
      fields: [
        { key: 'email', label: 'Email Address', type: 'email', required: true, full: true,
          placeholder: 'you@company.com',
          hint: 'We will send a reset link to this address.' },
      ],
      data: { email: prefill },
      submitText: 'Send Reset Link',
      onSubmit: async (data) => {
        const email = (data.email || '').trim();
        if (!EMAIL_RE.test(email)) {
          FG.toast('Please enter a valid email address.', 'error');
          return false;
        }
        if (!FG.supabase) {
          FG.toast('Auth client not loaded. Refresh and try again.', 'error');
          return false;
        }
        const { error } = await FG.supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password.html',
        });
        if (error) {
          // Surface real errors (rate limit, network). Supabase intentionally
          // does not report user-not-found, so success is generic below.
          FG.toast(error.message || 'Could not send reset link. Try again.', 'error');
          return false;
        }
        FG.toast('If that email is registered, a reset link is on its way.', 'success', 6000);
      },
    });
  };

  const openContactModal = () => {
    FG.modal.form({
      title: 'Talk to Our Team',
      fields: [
        { key: 'company_name', label: 'Company', required: true, full: true, placeholder: 'ABC Towing LLC' },
        { key: 'contact_name', label: 'Your Name', required: true, full: true },
        { key: 'email', label: 'Email', type: 'email', required: true, hint: 'name@company.com' },
        { key: 'phone', label: 'Phone', required: true, placeholder: '(614) 555-0100' },
        { key: 'fleet_size', label: 'Fleet Size', type: 'select', options: ['1–2 trucks', '3–5 trucks', '6–10 trucks', '11–25 trucks', '26+ trucks'], full: true },
        { key: 'notes', label: 'Message', type: 'textarea', rows: 3, full: true },
      ],
      submitText: 'Send Message',
      // Lands in the same access_requests table as the Request Access form
      // but with source='contact-form' so the two intents stay separable
      // in Phase B admin reports.
      onSubmit: async (data) => {
        const errs = [];
        if (!(data.company_name || '').trim()) errs.push('Company name is required.');
        if (!(data.contact_name || '').trim()) errs.push('Your name is required.');
        if (!EMAIL_RE.test((data.email || '').trim())) errs.push('Please enter a valid email address.');
        const digits = phoneDigits(data.phone);
        if (!PHONE_RE.test((data.phone || '').trim()) || digits.length < 10 || digits.length > 15) {
          errs.push('Please enter a valid phone number (10+ digits).');
        }
        if (errs.length) {
          FG.toast(errs[0], 'error', 5500);
          return false; // keep modal open
        }
        try {
          await postAccessRequest({
            source: 'contact-form',
            company_name: (data.company_name || '').trim(),
            contact_name: (data.contact_name || '').trim(),
            email:        (data.email || '').trim(),
            phone:        (data.phone || '').trim(),
            fleet_size:   (data.fleet_size || '').trim(),
            notes:        (data.notes || '').trim(),
          });
          FG.toast('Message sent! We will reach out within 1 business day.', 'success');
        } catch (e) {
          FG.toast(e.message || 'Could not send message. Please try again.', 'error', 6000);
          return false; // keep modal open so the user can retry
        }
      },
    });
  };

  const openRequestModal = () => {
    const trucks = FG.state.list('trucks').map(t => ({ value: t.id, label: t.unit_number }));
    FG.modal.form({
      title: 'Quick Request',
      fields: [
        { key: 'type', label: 'Request Type', type: 'select', required: true, full: true,
          options: ['Repair Scheduling', 'Parts Locator', 'DOT/PUCO Question', 'Insurance Question', 'Driver Safety Report', 'Other'] },
        { key: 'truck_id', label: 'Fleet Unit (if applicable)', type: 'select', full: true,
          options: [{ value: '', label: 'N/A' }, ...trucks] },
        { key: 'details', label: 'Details', type: 'textarea', rows: 4, full: true, required: true },
      ],
      submitText: 'Submit Request',
      onSubmit: () => FG.toast('Request submitted! Your FleetGuard specialist will respond within 2 business hours.', 'success'),
    });
  };

  const resetData = () => {
    FG.modal.confirm({
      title: 'Reset Demo Data?',
      message: 'This will restore all panels to the original ABC Towing LLC sample data. Any changes you made will be lost.',
      confirmText: 'Reset Now',
      onConfirm: () => {
        FG.seed.reset();
        FG.toast('Demo data reset.', 'success');
        dashInitialized = false;
        initDashboard();
      },
    });
  };

  // ── INIT ──
  const init = () => {
    FG.storage.ensureVersion();
    FG.seed.ensureSeeded();

    // wire global onclick handlers in HTML to namespaced functions
    window.showPage = showPage;
    window.scrollToSection = scrollToSection;
    window.submitAccessRequest = submitAccessRequest;
    window.completeLogin = completeLogin;
    window.openContactModal = openContactModal;
    window.openRequestModal = openRequestModal;
    window.openForgotPasswordModal = openForgotPasswordModal;

    // Honor ?next=login (password-reset success) and ?next=dashboard
    // (complete-signup activation) so post-flow landings route cleanly.
    const next = new URLSearchParams(window.location.search).get('next');
    if (next === 'login') showPage('login');
    else if (next === 'dashboard') showPage('dashboard');
  };

  return {
    init, showPage, scrollToSection, navigate, refreshBadges, currentPanelId: () => currentPanel,
    openRequestModal, openContactModal, resetData, logout,
    // Phase B accessors used by panels/admin.js and any future
    // access-aware UI.
    user:    () => _user,
    company: () => _company,
    isAdmin: () => !!(_user && _user.is_admin),
    visiblePanelIds,
    refreshAccessContext,
  };
})();

document.addEventListener('DOMContentLoaded', FG.app.init);
