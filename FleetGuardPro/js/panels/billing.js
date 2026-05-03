// ============================================================
// PANEL: BILLING
// ============================================================
// Wave 6 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. billing has no FK out
// — fully standalone, scoped only by company_id.
//
// Mount fetches billing (orderBy issued_date desc) once. The two
// "mark as paid" call sites (modal Pay Now button and row pay
// action) converge on the shared markPaid(inv) async helper.
//
// FG.state.company() reads stay — billing is read-only on company
// data, gets fresh values via the profile.js Wave-9 write-through
// shim. Locked architectural decision: FG.state stays alive until
// Wave 9.
//
// Status drift fix: pre-Wave-6 STATUS_OPTIONS shipped 'Overdue',
// but the schema CHECK is ('Draft','Pending','Paid','Failed',
// 'Refunded','Void'). 'Overdue' would 23514 against the live DB.
// UI now uses ['Pending','Paid','Failed','Refunded'] — schema-
// aligned subset that excludes admin-only Draft/Void.
//
// No invoice create/delete from this panel — invoices come from
// Stripe webhooks (Phase 2D). Update Payment is a demo-only form
// stub (no DB write). Change Plan navigates to profile.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.billing = function (root) {
  const myGen = FG._gen.billing = (FG._gen.billing || 0) + 1;

  const STATUS_OPTIONS = ['Pending', 'Paid', 'Failed', 'Refunded'];

  let invoices = [];

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const markPaid = async (inv) => {
    try {
      const row = await FG.db.update('billing', inv.id, { status: 'Paid', paid_date: FG.utils.today() });
      const idx = invoices.findIndex(x => x.id === inv.id);
      if (idx !== -1) invoices[idx] = row;
      render();
      FG.toast('Payment processed.', 'success');
      return true;
    } catch (err) {
      reportError(err, 'Payment failed.');
      return false;
    }
  };

  const viewInvoice = (inv) => {
    const c = FG.state.company();
    const m = FG.modal.open({
      title: `Invoice ${inv.invoice_number}`,
      size: 'lg',
      body: `
        <div class="invoice">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:20px">
          <div>
            <div style="font-family:var(--font-display);font-size:24px;letter-spacing:1px;color:var(--accent)">FleetGuard PRO</div>
            <div style="font-size:12px;color:var(--muted-strong);margin-top:4px">FleetGuard Pro LLC<br>Columbus, OH 43215<br>billing@fleetguardpro.com</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted-strong)">Invoice</div>
            <div style="font-family:var(--font-mono);font-size:18px">${FG.utils.escapeHtml(inv.invoice_number)}</div>
            <div style="margin-top:8px">${FG.utils.statusBadge(inv.status)}</div>
          </div>
        </div>
        <div style="background:var(--dark);padding:16px;border-radius:8px;margin-bottom:20px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted-strong);margin-bottom:6px">Bill To</div>
          <div style="font-weight:600">${FG.utils.escapeHtml(c.name || '')}</div>
          <div style="font-size:13px;color:var(--muted)">${FG.utils.escapeHtml(c.address || '')}</div>
        </div>
        <div class="table-wrap"><table class="data-table" style="margin-bottom:20px">
          <thead><tr><th>Description</th><th>Period</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>FleetGuard Pro — ${FG.utils.escapeHtml(inv.plan)} Plan</strong></td>
              <td>${FG.utils.fmtDateShort(inv.period_start)} – ${FG.utils.fmtDateShort(inv.period_end)}</td>
              <td style="text-align:right">${FG.utils.fmtMoney(inv.amount, 2)}</td>
            </tr>
          </tbody>
        </table></div>
        <div style="display:flex;justify-content:flex-end">
          <div style="min-width:240px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span>Subtotal</span><span>${FG.utils.fmtMoney(inv.amount, 2)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted)"><span>Tax</span><span>$0.00</span></div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;font-family:var(--font-display);font-size:22px;letter-spacing:1px"><span>Total</span><span style="color:var(--accent)">${FG.utils.fmtMoney(inv.amount, 2)}</span></div>
          </div>
        </div>
        ${inv.paid_date ? `<div class="alert alert-success" style="margin-top:16px">✅ <strong>Paid:</strong> ${FG.utils.fmtDate(inv.paid_date)}</div>` : `<div class="alert alert-warning" style="margin-top:16px">⏳ <strong>Pending:</strong> Auto-charge on ${FG.utils.fmtDate(inv.period_start)}</div>`}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close data-no-print>Close</button>
        <button class="btn btn-secondary" data-print data-no-print>🖨️ Print / PDF</button>
        ${inv.status === 'Pending' ? '<button class="btn btn-primary" data-pay data-no-print>Pay Now</button>' : ''}
        <button class="btn btn-ghost" data-phase="2" data-no-print disabled
                title="Coming in Phase 2"
                style="opacity:.55;cursor:not-allowed">✉ Email — Phase 2</button>
      `,
    });
    m.overlay.querySelector('[data-print]').addEventListener('click', () => FG.print(m.overlay));
    const pay = m.overlay.querySelector('[data-pay]');
    if (pay) pay.addEventListener('click', async () => {
      // Close the modal only on success — failure leaves it open with the
      // error toast visible, so the operator can retry.
      const ok = await markPaid(inv);
      if (ok) m.close();
    });
  };

  const updatePayment = () => {
    FG.modal.form({
      title: 'Update Payment Method',
      fields: [
        { key: 'card_name', label: 'Cardholder Name', required: true, full: true },
        { key: 'card_number', label: 'Card Number', required: true, full: true, placeholder: '•••• •••• •••• 4242' },
        { key: 'exp', label: 'Expiry MM/YY', required: true, placeholder: '12/27' },
        { key: 'cvc', label: 'CVC', required: true, placeholder: '•••' },
        { key: 'billing_zip', label: 'Billing ZIP', required: true, full: true },
      ],
      submitText: 'Save Card',
      onSubmit: () => FG.toast('Payment method updated. Demo only — no real charge processed.', 'success'),
    });
  };

  const render = () => {
    const data = invoices;
    const c = FG.state.company();
    const lifetime = data.filter(d => d.status === 'Paid').reduce((s, d) => s + (d.amount || 0), 0);
    const next = data.filter(d => d.status === 'Pending').sort((a, b) => new Date(a.period_start) - new Date(b.period_start))[0];
    const lastPaid = data.filter(d => d.status === 'Paid').sort((a, b) => new Date(b.paid_date) - new Date(a.paid_date))[0];

    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Billing &amp; Subscription</h2>
          <p>Invoice history, payment method, and plan details.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="btn-payment">Update Payment</button>
          <button class="btn btn-primary btn-sm" id="btn-change-plan">Change Plan</button>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Current Plan</div><div class="kpi-value" style="font-size:18px">${c.plan === 'all-access' ? 'All-Access' : 'À La Carte'}</div><div class="kpi-trend">${c.plan === 'all-access' ? '$399/mo' : '$149/svc/mo'}</div></div>
        <div class="kpi"><div class="kpi-label">Next Invoice</div><div class="kpi-value" style="font-size:18px">${next ? FG.utils.fmtMoney(next.amount, 2) : '—'}</div><div class="kpi-trend">${next ? FG.utils.fmtDate(next.period_start) : 'No pending'}</div></div>
        <div class="kpi"><div class="kpi-label">Lifetime Paid</div><div class="kpi-value">${FG.utils.fmtMoney(lifetime)}</div></div>
        <div class="kpi"><div class="kpi-label">Last Payment</div><div class="kpi-value" style="font-size:18px">${lastPaid ? FG.utils.fmtMoney(lastPaid.amount, 2) : '—'}</div><div class="kpi-trend">${lastPaid ? FG.utils.fmtDate(lastPaid.paid_date) : '—'}</div></div>
      </div>

      <div class="grid-2 gap-24">
        <div class="card">
          <div class="card-header"><span class="card-title">Payment Method</span></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--dark);border:1px solid var(--border);border-radius:8px">
              <div style="font-size:32px">💳</div>
              <div style="flex:1">
                <div style="font-weight:600">Visa ending in 4242</div>
                <div style="font-size:12px;color:var(--muted-strong)">Expires 12/27 · Auto-renew enabled</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('btn-payment').click()">Update</button>
            </div>
            <div style="margin-top:16px;font-size:12px;color:var(--muted-strong)">Auto-charged on the 1st of each month. Demo card — no real charges processed.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Subscription Status</span><span class="badge badge-green">Active</span></div>
          <div class="card-body">
            <div style="text-align:center;padding:8px 0">
              <div style="font-family:var(--font-display);font-size:32px;letter-spacing:2px;color:var(--accent);text-transform:uppercase">${c.plan === 'all-access' ? 'All-Access' : 'À La Carte'}</div>
              <div style="font-family:var(--font-mono);font-size:14px;color:var(--muted);margin-top:4px">${c.plan === 'all-access' ? '$399 / month flat' : '$149 / service / month'}</div>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px;font-size:13px;color:var(--muted)">
              <div style="margin-bottom:6px">Member since ${FG.utils.fmtDate(c.member_since)}</div>
              <div>Cancel anytime. No long-term contracts.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Invoice History</span><span class="toolbar-info">${data.length} invoices</span></div>
        <div class="card-body" style="padding:0" id="invoices-host"></div>
      </div>
    `;

    root.querySelector('#btn-payment').addEventListener('click', updatePayment);
    root.querySelector('#btn-change-plan').addEventListener('click', () => FG.app.navigate('profile'));

    FG.table.panel({
      container: root.querySelector('#invoices-host'),
      title: '',
      data,
      filters: [
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'issued_date',
      defaultDir: 'desc',
      columns: [
        { key: 'invoice_number', label: 'Invoice', render: (i) => `<strong style="font-family:var(--font-mono)">${FG.utils.escapeHtml(i.invoice_number)}</strong>` },
        { key: 'period_start', label: 'Period', render: (i) => `${FG.utils.fmtDateShort(i.period_start)} – ${FG.utils.fmtDateShort(i.period_end)}` },
        { key: 'plan', label: 'Plan' },
        { key: 'amount', label: 'Amount', align: 'right', render: (i) => FG.utils.fmtMoney(i.amount, 2) },
        { key: 'status', label: 'Status', render: (i) => FG.utils.statusBadge(i.status) },
        { key: 'paid_date', label: 'Paid On', render: (i) => i.paid_date ? FG.utils.fmtDateShort(i.paid_date) : '—' },
      ],
      rowClick: viewInvoice,
      rowActions: (i) => `<button data-action="view">View</button>${i.status === 'Pending' ? '<button data-action="pay">Pay</button>' : ''}<button data-action="download">⬇</button>`,
      actionHandlers: {
        view: viewInvoice,
        pay: markPaid,
        download: (i) => viewInvoice(i),
      },
    });
    const hdr = root.querySelector('#invoices-host .panel-header'); if (hdr) hdr.style.display = 'none';
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading invoices…</div>`;
    try {
      invoices = await FG.db.list('billing', { orderBy: 'issued_date', ascending: false });
    } catch (err) {
      console.error('billing.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.billing) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load invoices. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.billing) return;
    render();
  };

  mount();
};
