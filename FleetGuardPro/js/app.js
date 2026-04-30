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
  ];

  const TITLES = {
    overview: 'Dashboard Overview', alerts: 'Alerts & Notices',
    fleet: 'Fleet Units', drivers: 'Driver Roster', maintenance: 'Maintenance Schedule',
    repairs: 'Repair & Parts Requests', parts: 'Parts Inventory',
    dot: 'DOT & PUCO Compliance', safety: 'Driver Safety',
    insurance: 'Insurance Management', garage: 'Garage Network', reports: 'Reports Engine',
    profile: 'Company Profile', documents: 'Document Storage', billing: 'Billing & Subscription',
  };

  let currentPanel = 'overview';

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

  // ── SIDEBAR ──
  const renderSidebar = () => {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const company = FG.state.company();
    const sections = {};
    PANELS.forEach(p => {
      sections[p.section] = sections[p.section] || [];
      sections[p.section].push(p);
    });

    let html = `
      <div class="sidebar-company">
        <div class="sidebar-logo" onclick="FG.app.showPage('home')">Fleet<span>Guard</span> PRO</div>
        <div class="sidebar-company-name">${FG.utils.escapeHtml(company.name || '—')}</div>
        <div class="sidebar-company-plan">${company.plan === 'all-access' ? 'All-Access Member' : 'À La Carte Member'}</div>
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

  let dashInitialized = false;
  const initDashboard = async () => {
    // Phase 2B session gate. Phase 2C will wire the panels themselves
    // to read company-scoped data via this user's session.
    if (FG.supabase) {
      const { data: { user } } = await FG.supabase.auth.getUser();
      if (!user) { showPage('login'); return; }
    }
    FG.seed.ensureSeeded();
    // Recompute auto-generated alerts on every dashboard entry so expiring
    // dates / overdue tasks / low stock surface even after a day-of-the-week change.
    if (FG.state.generateAlerts) FG.state.generateAlerts();
    if (!dashInitialized) {
      renderSidebar();
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
    navigate(currentPanel);
  };

  // ── REGISTRATION / LOGIN demo ──
  const selectPlan = (plan, el) => {
    document.querySelectorAll('.plan-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const svc = document.getElementById('serviceSelection');
    if (svc) {
      if (plan === 'all-access') {
        svc.style.opacity = '.4'; svc.style.pointerEvents = 'none';
        document.querySelectorAll('.service-check input').forEach(c => c.checked = true);
      } else {
        svc.style.opacity = '1'; svc.style.pointerEvents = '';
      }
    }
  };

  // ── AUTH (Phase 2B) ────────────────────────────────────────
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

  const completeRegistration = async () => {
    clearAuthError('reg-error');
    const companyName = (document.getElementById('reg-company-name')?.value || '').trim();
    const email       = (document.getElementById('reg-email')?.value || '').trim();
    const password    = document.getElementById('reg-password')?.value || '';
    const confirm     = document.getElementById('reg-password-confirm')?.value || '';

    if (!companyName) return showAuthError('reg-error', 'Company name is required.');
    if (!EMAIL_RE.test(email)) return showAuthError('reg-error', 'Please enter a valid email address.');
    if (password.length < 8) return showAuthError('reg-error', 'Password must be at least 8 characters.');
    if (password !== confirm) return showAuthError('reg-error', 'Passwords do not match.');

    if (!FG.supabase) return showAuthError('reg-error', 'Auth client not loaded. Refresh and try again.');

    const { error } = await FG.supabase.auth.signUp({
      email,
      password,
      // The on_auth_user_created trigger reads company_name from
      // raw_user_meta_data and inserts the companies row.
      options: { data: { company_name: companyName } },
    });
    if (error) return showAuthError('reg-error', error.message);

    FG.toast('Check your email to verify your account.', 'success', 6000);
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

  const openContactModal = () => {
    FG.modal.form({
      title: 'Talk to Our Team',
      fields: [
        { key: 'name', label: 'Your Name', required: true, full: true },
        { key: 'email', label: 'Email', type: 'email', required: true, hint: 'name@company.com' },
        { key: 'phone', label: 'Phone', required: true, placeholder: '(614) 555-0100' },
        { key: 'fleet_size', label: 'Fleet Size', type: 'select', options: ['3 trucks', '4 trucks', '5 trucks', '6-10 trucks'], full: true },
        { key: 'message', label: 'Message', type: 'textarea', rows: 3, full: true },
      ],
      submitText: 'Send Message',
      onSubmit: (data) => {
        const errs = [];
        if (!EMAIL_RE.test((data.email || '').trim())) errs.push('Please enter a valid email address.');
        const digits = phoneDigits(data.phone);
        if (!PHONE_RE.test((data.phone || '').trim()) || digits.length < 10 || digits.length > 15) {
          errs.push('Please enter a valid phone number (10+ digits).');
        }
        if (errs.length) {
          FG.toast(errs[0], 'error', 5500);
          return false; // keep modal open
        }
        FG.toast('Message sent! We will reach out within 1 business day.', 'success');
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
    window.selectPlan = selectPlan;
    window.completeRegistration = completeRegistration;
    window.completeLogin = completeLogin;
    window.openContactModal = openContactModal;
    window.openRequestModal = openRequestModal;
  };

  return {
    init, showPage, scrollToSection, navigate, refreshBadges, currentPanelId: () => currentPanel,
    openRequestModal, openContactModal, resetData, logout,
  };
})();

document.addEventListener('DOMContentLoaded', FG.app.init);
