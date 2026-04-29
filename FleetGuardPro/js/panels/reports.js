// ============================================================
// PANEL: REPORTS ENGINE (NEW)
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.reports = function (root) {
  const TYPES = [
    { value: 'safety', label: 'Driver Safety Summary', icon: '🛡️', color: '#1f6feb' },
    { value: 'maintenance', label: 'Maintenance Cost Report', icon: '🔧', color: '#f5a623' },
    { value: 'compliance', label: 'DOT Compliance Audit', icon: '📋', color: '#2ea043' },
    { value: 'insurance', label: 'Insurance Loss Run', icon: '📄', color: '#a371f7' },
    { value: 'fleet', label: 'Fleet Utilization', icon: '🚛', color: '#d29922' },
    { value: 'parts', label: 'Parts & Inventory', icon: '📦', color: '#da3633' },
  ];

  const generateSummary = (type) => {
    if (type === 'safety') {
      const incidents = FG.state.list('safety_incidents');
      const drivers = FG.state.list('drivers');
      const avg = drivers.length ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length) : 0;
      return `${incidents.length} incidents tracked. Fleet avg score ${avg}. ${incidents.filter(i => i.severity === 'High').length} high-severity events.`;
    }
    if (type === 'maintenance') {
      const m = FG.state.list('maintenance').filter(x => x.status === 'Completed');
      const total = m.reduce((s, x) => s + (x.cost || 0), 0);
      return `${m.length} completed services. Total spend ${FG.utils.fmtMoney(total, 2)}.`;
    }
    if (type === 'compliance') {
      const f = FG.state.list('dot_files');
      const active = f.filter(x => x.status === 'Active').length;
      return `${f.length} files on record. ${active} active, ${f.length - active} expiring/expired.`;
    }
    if (type === 'insurance') {
      const p = FG.state.list('insurance_policies');
      const total = p.reduce((s, x) => s + (x.premium || 0), 0);
      return `${p.length} active policies. Total annual premium ${FG.utils.fmtMoney(total)}.`;
    }
    if (type === 'fleet') {
      const t = FG.state.list('trucks');
      const active = t.filter(x => x.status === 'Active').length;
      return `${active} of ${t.length} units active. Total mileage ${FG.utils.fmtNum(t.reduce((s, x) => s + (x.mileage || 0), 0))}.`;
    }
    if (type === 'parts') {
      const p = FG.state.list('parts');
      const value = p.reduce((s, x) => s + (x.qty_on_hand || 0) * (x.unit_cost || 0), 0);
      return `${p.length} SKUs tracked. Inventory value ${FG.utils.fmtMoney(value, 0)}.`;
    }
    return 'Generated report.';
  };

  const generateReport = (type) => {
    const t = TYPES.find(x => x.value === type);
    const period = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const summary = generateSummary(type);
    const report = FG.state.create('reports', {
      type,
      name: `${t.label} — ${period}`,
      period,
      generated_date: new Date().toISOString().slice(0, 10),
      summary,
    });
    FG.toast(`Report generated: ${report.name}`, 'success');
    render();
  };

  const viewReport = (rep) => {
    const t = TYPES.find(x => x.value === rep.type) || { label: rep.type, icon: '📄', color: 'var(--accent)' };
    const m = FG.modal.open({
      title: rep.name,
      size: 'lg',
      body: `
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Report Type</div><div class="kpi-value" style="font-size:18px">${t.icon} ${t.label}</div></div>
          <div class="kpi"><div class="kpi-label">Period</div><div class="kpi-value" style="font-size:18px">${FG.utils.escapeHtml(rep.period || '—')}</div></div>
          <div class="kpi"><div class="kpi-label">Generated</div><div class="kpi-value" style="font-size:18px">${FG.utils.fmtDate(rep.generated_date)}</div></div>
        </div>
        <div class="modal-section-title">Summary</div>
        <p style="font-size:14px;line-height:1.7">${FG.utils.escapeHtml(rep.summary || 'No summary available.')}</p>
        <div class="modal-section-title">Sample Data</div>
        ${renderReportData(rep.type)}
      `,
      footer: `
        <button class="btn btn-ghost" data-close data-no-print>Close</button>
        <button class="btn btn-secondary" data-print data-no-print>🖨️ Print / PDF</button>
        <button class="btn btn-primary" data-phase="2" data-no-print disabled
                title="Coming in Phase 2"
                style="opacity:.55;cursor:not-allowed">✉ Email — Phase 2</button>
      `,
    });
    m.overlay.querySelector('[data-print]').addEventListener('click', () => FG.print(m.overlay));
  };

  const renderReportData = (type) => {
    if (type === 'safety') {
      const drivers = FG.state.list('drivers').slice().sort((a, b) => (b.safety_score || 0) - (a.safety_score || 0));
      return `<table class="data-table"><thead><tr><th>Driver</th><th>Score</th><th>Status</th></tr></thead><tbody>
        ${drivers.map(d => `<tr><td>${FG.utils.escapeHtml(d.name)}</td><td style="color:${FG.utils.scoreColor(d.safety_score)};font-weight:600">${d.safety_score}</td><td>${FG.utils.statusBadge(d.status)}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if (type === 'maintenance') {
      const m = FG.state.list('maintenance').filter(x => x.status === 'Completed');
      return `<table class="data-table"><thead><tr><th>Truck</th><th>Service</th><th>Date</th><th style="text-align:right">Cost</th></tr></thead><tbody>
        ${m.map(x => `<tr><td>${FG.utils.escapeHtml(FG.state.truckLabel(x.truck_id))}</td><td>${FG.utils.escapeHtml(x.type)}</td><td>${FG.utils.fmtDateShort(x.completed_date)}</td><td style="text-align:right">${FG.utils.fmtMoney(x.cost, 2)}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if (type === 'compliance') {
      const f = FG.state.list('dot_files');
      return `<table class="data-table"><thead><tr><th>Document</th><th>Type</th><th>Expires</th><th>Status</th></tr></thead><tbody>
        ${f.map(x => `<tr><td>${FG.utils.escapeHtml(x.name)}</td><td>${FG.utils.escapeHtml(x.type)}</td><td>${FG.utils.fmtDateShort(x.expires_date)}</td><td>${FG.utils.statusBadge(x.status)}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if (type === 'insurance') {
      const p = FG.state.list('insurance_policies');
      return `<table class="data-table"><thead><tr><th>Carrier</th><th>Type</th><th style="text-align:right">Premium</th><th>Expiry</th></tr></thead><tbody>
        ${p.map(x => `<tr><td>${FG.utils.escapeHtml(x.carrier)}</td><td>${FG.utils.escapeHtml(x.type)}</td><td style="text-align:right">${FG.utils.fmtMoney(x.premium)}</td><td>${FG.utils.fmtDateShort(x.expiry_date)}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if (type === 'fleet') {
      const t = FG.state.list('trucks');
      return `<table class="data-table"><thead><tr><th>Unit</th><th>Status</th><th style="text-align:right">Mileage</th><th>Score</th></tr></thead><tbody>
        ${t.map(x => `<tr><td>${FG.utils.escapeHtml(x.unit_number)}</td><td>${FG.utils.statusBadge(x.status)}</td><td style="text-align:right">${FG.utils.fmtNum(x.mileage)}</td><td>${x.safety_score}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if (type === 'parts') {
      const p = FG.state.list('parts');
      return `<table class="data-table"><thead><tr><th>Part</th><th>SKU</th><th style="text-align:right">On Hand</th><th style="text-align:right">Value</th></tr></thead><tbody>
        ${p.map(x => `<tr><td>${FG.utils.escapeHtml(x.name)}</td><td style="font-family:var(--font-mono);font-size:12px">${FG.utils.escapeHtml(x.sku)}</td><td style="text-align:right">${x.qty_on_hand}</td><td style="text-align:right">${FG.utils.fmtMoney((x.qty_on_hand || 0) * (x.unit_cost || 0), 2)}</td></tr>`).join('')}
      </tbody></table>`;
    }
    return '<div class="empty-state">No data.</div>';
  };

  const render = () => {
    const reports = FG.state.list('reports').sort((a, b) => new Date(b.generated_date) - new Date(a.generated_date));

    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Reports Engine</h2>
          <p>Generate, view, and export executive reports across all modules.</p>
        </div>
      </div>

      <div class="card gap-24">
        <div class="card-header"><span class="card-title">Generate New Report</span></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
            ${TYPES.map(t => `
              <div data-gen="${t.value}" style="cursor:pointer;padding:18px;border:1px solid var(--border);border-radius:10px;transition:all .15s;background:var(--dark)">
                <div style="font-size:32px;margin-bottom:8px">${t.icon}</div>
                <div style="font-family:var(--font-display);font-size:16px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${t.label}</div>
                <div style="font-size:11px;color:var(--muted-strong)">Click to generate</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Generated Reports</span><span class="toolbar-info">${reports.length} on file</span></div>
        <div class="card-body" style="padding:0">
          ${reports.length ? `<table class="data-table">
            <thead><tr><th>Report</th><th>Type</th><th>Period</th><th>Generated</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>
              ${reports.map((r, i) => {
                const t = TYPES.find(x => x.value === r.type) || { icon: '📄', label: r.type, color: 'var(--accent)' };
                return `<tr data-rep="${i}" class="row-clickable">
                  <td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">${t.icon}</span><strong>${FG.utils.escapeHtml(r.name)}</strong></div></td>
                  <td>${FG.utils.escapeHtml(t.label)}</td>
                  <td>${FG.utils.escapeHtml(r.period || '—')}</td>
                  <td>${FG.utils.fmtDateShort(r.generated_date)}</td>
                  <td><div class="row-actions">
                    <button data-act="view-${r.id}">View</button>
                    <button data-act="del-${r.id}" class="danger">✕</button>
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : '<div class="empty-state"><span class="icon">📊</span>No reports generated yet. Click a card above to create one.</div>'}
        </div>
      </div>
    `;

    root.querySelectorAll('[data-gen]').forEach(el => {
      el.addEventListener('mouseenter', () => { el.style.borderColor = 'var(--accent)'; el.style.transform = 'translateY(-2px)'; });
      el.addEventListener('mouseleave', () => { el.style.borderColor = 'var(--border)'; el.style.transform = ''; });
      el.addEventListener('click', () => generateReport(el.dataset.gen));
    });

    root.querySelectorAll('tr.row-clickable').forEach((tr, i) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-actions')) return;
        viewReport(reports[i]);
      });
    });

    reports.forEach(r => {
      const view = root.querySelector(`[data-act="view-${r.id}"]`);
      if (view) view.addEventListener('click', (e) => { e.stopPropagation(); viewReport(r); });
      const del = root.querySelector(`[data-act="del-${r.id}"]`);
      if (del) del.addEventListener('click', (e) => {
        e.stopPropagation();
        FG.modal.confirm({
          message: `Delete report <strong>${FG.utils.escapeHtml(r.name)}</strong>?`,
          confirmText: 'Delete',
          onConfirm: () => { FG.state.remove('reports', r.id); FG.toast('Report deleted.', 'success'); render(); },
        });
      });
    });
  };

  render();
};
