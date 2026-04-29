// ============================================================
// PANEL: OVERVIEW
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.overview = function (root) {
  const trucks = FG.state.list('trucks');
  const drivers = FG.state.list('drivers');
  const maintenance = FG.state.list('maintenance');
  const repairs = FG.state.list('repairs');
  const alerts = FG.state.list('alerts');
  const policies = FG.state.list('insurance_policies');

  const activeTrucks = trucks.filter(t => t.status === 'Active').length;
  const fleetSafety = drivers.length ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length) : 0;
  const overdueMaint = maintenance.filter(m => m.status === 'Overdue').length;
  const openRepairs = repairs.filter(r => r.status === 'Open' || r.status === 'In Progress').length;
  const dotCompliance = (() => {
    const files = FG.state.list('dot_files');
    if (!files.length) return 0;
    const active = files.filter(f => f.status === 'Active').length;
    return Math.round((active / files.length) * 100);
  })();

  const upcomingMaint = maintenance
    .filter(m => m.status !== 'Completed')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  const recentActivity = [
    ...alerts.slice(0, 3).map(a => ({ time: a.date, text: a.title, color: a.severity === 'high' ? 'var(--danger)' : (a.severity === 'medium' ? 'var(--accent)' : 'var(--steel)') })),
    ...maintenance.filter(m => m.status === 'Completed').slice(0, 2).map(m => ({ time: m.completed_date, text: `Maintenance completed: ${m.type} on ${FG.state.truckLabel(m.truck_id)}`, color: 'var(--success)' })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);

  // Build chart data — last 6 months synthetic spend
  const months = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(d.toLocaleString('en-US', { month: 'short' }));
  }
  const maintSpend = [3200, 4100, 2800, 3600, 4900, 3700];
  const fuelSpend = [9800, 10200, 11400, 10900, 11800, 12100];

  // Fleet score donut: distribution across grades
  const scoreBuckets = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
  drivers.forEach(d => {
    if (d.safety_score >= 90) scoreBuckets.Excellent++;
    else if (d.safety_score >= 80) scoreBuckets.Good++;
    else if (d.safety_score >= 70) scoreBuckets.Fair++;
    else scoreBuckets.Poor++;
  });

  root.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Welcome back, ${FG.utils.escapeHtml(FG.state.company().contact_name || 'Fleet Owner')}</h2>
        <p>${FG.utils.escapeHtml(FG.state.company().name || '')} · ${trucks.length} trucks · ${drivers.length} drivers</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-secondary btn-sm" onclick="FG.app.navigate('reports')">📊 View Reports</button>
        <button class="btn btn-primary btn-sm" onclick="FG.app.openRequestModal()">+ New Request</button>
      </div>
    </div>

    <div class="metrics-row">
      <div class="metric-card" style="color:var(--accent)">
        <div class="metric-label">Active Trucks</div>
        <div class="metric-value">${activeTrucks}</div>
        <div class="metric-sub">of ${trucks.length} registered units</div>
      </div>
      <div class="metric-card" style="color:var(--success)">
        <div class="metric-label">DOT Compliance</div>
        <div class="metric-value">${dotCompliance}%</div>
        <div class="metric-sub">${FG.state.list('dot_files').filter(f => f.status === 'Active').length} active files</div>
      </div>
      <div class="metric-card" style="color:var(--steel)">
        <div class="metric-label">Fleet Safety Score</div>
        <div class="metric-value">${fleetSafety}</div>
        <div class="metric-sub">${drivers.length} drivers · avg score</div>
      </div>
      <div class="metric-card" style="color:${overdueMaint ? 'var(--danger)' : '#c9d1d9'}">
        <div class="metric-label">Pending Maintenance</div>
        <div class="metric-value">${maintenance.filter(m => m.status !== 'Completed').length}</div>
        <div class="metric-sub">${overdueMaint} overdue · ${openRepairs} open repairs</div>
      </div>
    </div>

    <div class="grid-2 gap-24">
      <div class="card">
        <div class="card-header"><span class="card-title">Operating Costs (6 Mo)</span><span class="badge badge-orange">Live</span></div>
        <div class="card-body">
          <div class="chart-legend">
            <span><span class="swatch" style="background:#1f6feb"></span>Maintenance</span>
            <span><span class="swatch" style="background:#f5a623"></span>Fuel (est)</span>
          </div>
          <div class="chart-wrap" data-chart="costs"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Driver Safety Distribution</span></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
            <div style="width:200px;height:200px" data-chart="safety"></div>
            <div style="flex:1;min-width:160px">
              ${Object.entries(scoreBuckets).map(([k, v]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
                  <span><span class="swatch" style="background:${k === 'Excellent' ? '#2ea043' : k === 'Good' ? '#f5a623' : k === 'Fair' ? '#d29922' : '#da3633'}"></span>${k}</span>
                  <span style="font-family:var(--font-mono);color:var(--muted)">${v} driver${v === 1 ? '' : 's'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2 gap-24">
      <div class="card">
        <div class="card-header"><span class="card-title">Fleet Status</span><a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="FG.app.navigate('fleet')">View all →</a></div>
        <div class="card-body" style="padding:0">
          <table class="data-table">
            <thead><tr><th>Unit</th><th>Status</th><th>Next PM</th><th style="text-align:right">Score</th></tr></thead>
            <tbody>
              ${trucks.map(t => `
                <tr><td>${FG.utils.escapeHtml(t.unit_number)} — ${FG.utils.escapeHtml((t.year + ' ' + t.make).trim())}</td>
                <td>${FG.utils.statusBadge(t.status)}</td>
                <td>${FG.utils.fmtDateShort(t.next_pm_date)}</td>
                <td style="text-align:right;color:${FG.utils.scoreColor(t.safety_score)};font-weight:600">${t.safety_score}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div class="card-body">
          <div class="timeline">
            ${recentActivity.length ? recentActivity.map(a => `
              <div class="tl-item">
                <div class="tl-dot-wrap"><div class="tl-dot" style="background:${a.color}"></div><div class="tl-line"></div></div>
                <div class="tl-content"><div class="tl-time">${FG.utils.fmtDateTime(a.time)}</div><div class="tl-text">${FG.utils.escapeHtml(a.text)}</div></div>
              </div>
            `).join('') : '<div class="empty-state">No recent activity.</div>'}
          </div>
        </div>
      </div>
    </div>

    ${overdueMaint || openRepairs || alerts.filter(a => !a.read && a.severity === 'high').length ? `
    <div style="margin-top:20px">
      ${overdueMaint ? `<div class="alert alert-warning">⚠️ <strong>Action Required:</strong> ${overdueMaint} maintenance task${overdueMaint === 1 ? ' is' : 's are'} overdue. <a style="color:inherit;text-decoration:underline;cursor:pointer" onclick="FG.app.navigate('maintenance')">Review now</a></div>` : ''}
      ${policies.length ? (() => {
        const next = policies.map(p => ({ ...p, days: FG.utils.daysFromNow(p.expiry_date) })).filter(p => p.days != null && p.days < 90 && p.days >= 0).sort((a, b) => a.days - b.days)[0];
        if (next) return `<div class="alert alert-info">ℹ️ <strong>${FG.utils.escapeHtml(next.carrier)} renewal:</strong> ${FG.utils.escapeHtml(next.type)} expires in ${next.days} days. <a style="color:inherit;text-decoration:underline;cursor:pointer" onclick="FG.app.navigate('insurance')">View policy</a></div>`;
        return '';
      })() : ''}
    </div>` : ''}
  `;

  setTimeout(() => {
    const costsEl = root.querySelector('[data-chart="costs"]');
    if (costsEl) {
      const combined = maintSpend.map((m, i) => m + Math.round(fuelSpend[i] / 4));
      const min = Math.min(...combined), max = Math.max(...combined);
      FG.charts.bar(costsEl, {
        values: combined, labels: months, color: '#1f6feb', height: 220,
        formatY: v => '$' + (v / 1000).toFixed(1) + 'k',
        ariaLabel: `Operating costs by month, last 6 months, ranging from $${(min / 1000).toFixed(1)}k to $${(max / 1000).toFixed(1)}k`,
      });
    }
    const safetyEl = root.querySelector('[data-chart="safety"]');
    if (safetyEl) {
      const segs = [
        { value: scoreBuckets.Excellent, color: '#2ea043', label: 'Excellent' },
        { value: scoreBuckets.Good, color: '#f5a623', label: 'Good' },
        { value: scoreBuckets.Fair, color: '#d29922', label: 'Fair' },
        { value: scoreBuckets.Poor, color: '#da3633', label: 'Poor' },
      ].filter(s => s.value > 0);
      FG.charts.donut(safetyEl, {
        segments: segs, height: 200, centerText: fleetSafety, centerSub: 'AVG SCORE',
        ariaLabel: `Driver safety score distribution: ${segs.map(s => `${s.value} ${s.label.toLowerCase()}`).join(', ')}. Fleet average ${fleetSafety}`,
      });
    }
  }, 0);
};
