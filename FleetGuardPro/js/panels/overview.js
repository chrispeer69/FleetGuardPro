// ============================================================
// PANEL: OVERVIEW
// ============================================================
// Wave 1.5 (Phase 2C): reads via FG.db (Supabase) instead of
// FG.state. Read-only — no writes from this panel. Tenant
// scoping is enforced by RLS (db/rls.sql); FG.db.list does not
// inject company_id.
//
// All 7 reads (trucks, drivers, maintenance, repairs, alerts,
// insurance_policies, dot_files) fire in parallel via
// Promise.all. Single try/catch — KPIs never render from
// partial data; on failure the panel shows a single empty-state
// with Retry, matching parts.js (no toast on cold-open).
//
// Welcome header reads from FG.app.company() — the live companies
// row loaded by initDashboard via refreshAccessContext (Phase B).
// FG.state.company() is the legacy localStorage seed cache; using
// it here surfaced "John Smith / ABC Towing LLC" for every tenant
// regardless of what Supabase actually held.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.overview = function (root) {
  // Mount-cycle generation. See parts.js for the rationale — guards
  // against a slow mount's renderPanel clobbering a later mount's UI
  // when the user navigates fleet → drivers → fleet quickly.
  const myGen = FG._gen.overview = (FG._gen.overview || 0) + 1;

  // ── Render ──────────────────────────────────────────────────
  const renderPanel = ({ trucks, drivers, maintenance, repairs, alerts, policies, dotFiles }) => {
    const truckLabel = FG.utils.truckLabel(trucks);

    const activeTrucks = trucks.filter(t => t.status === 'Active').length;
    const fleetSafety = drivers.length ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length) : 0;
    const overdueMaint = maintenance.filter(m => m.status === 'Overdue').length;
    const openRepairs = repairs.filter(r => r.status === 'Open' || r.status === 'In Progress').length;
    const activeDotFiles = dotFiles.filter(f => f.status === 'Active').length;
    const dotCompliance = dotFiles.length ? Math.round((activeDotFiles / dotFiles.length) * 100) : 0;

    const upcomingMaint = maintenance
      .filter(m => m.status !== 'Completed')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);

    const recentActivity = [
      ...alerts.slice(0, 3).map(a => ({ time: a.date, text: a.title, color: a.severity === 'high' ? 'var(--danger)' : (a.severity === 'medium' ? 'var(--accent)' : 'var(--steel)') })),
      ...maintenance.filter(m => m.status === 'Completed').slice(0, 2).map(m => ({ time: m.completed_date, text: `Maintenance completed: ${m.type} on ${truckLabel(m.truck_id)}`, color: 'var(--success)' })),
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

    const company = (FG.app.company && FG.app.company()) || {};
    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Welcome back, ${FG.utils.escapeHtml(company.contact_name || 'Fleet Owner')}</h2>
          <p>${FG.utils.escapeHtml(company.name || '')} · ${trucks.length} trucks · ${drivers.length} drivers</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" onclick="FG.app.navigate('reports')">📊 View Reports</button>
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
          <div class="metric-sub">${activeDotFiles} active files</div>
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
            <div class="table-wrap"><table class="data-table">
              <thead><tr><th>Unit</th><th>Status</th><th>Next PM</th><th style="text-align:right">Score</th></tr></thead>
              <tbody>
                ${trucks.map(t => `
                  <tr><td>${FG.utils.escapeHtml(t.unit_number)} — ${FG.utils.escapeHtml((t.year + ' ' + t.make).trim())}</td>
                  <td>${FG.utils.statusBadge(t.status)}</td>
                  <td>${FG.utils.fmtDateShort(t.next_pm_date)}</td>
                  <td style="text-align:right;color:${FG.utils.scoreColor(t.safety_score)};font-weight:600">${t.safety_score}</td></tr>
                `).join('')}
              </tbody>
            </table></div>
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

  // ── Mount ───────────────────────────────────────────────────
  // Cache scope = this single panel mount. Re-entry via
  // FG.app.navigate('overview') re-invokes the renderer and
  // refetches — same contract as parts.js Wave 1.
  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading dashboard…</div>`;
    let data;
    try {
      const [trucks, drivers, maintenance, repairs, alerts, policies, dotFiles] = await Promise.all([
        FG.db.list('trucks',             { orderBy: 'unit_number', ascending: true  }),
        FG.db.list('drivers',            { orderBy: 'name',        ascending: true  }),
        FG.db.list('maintenance',        { orderBy: 'due_date',    ascending: true  }),
        FG.db.list('repairs'),
        FG.db.list('alerts',             { orderBy: 'date',        ascending: false }),
        FG.db.list('insurance_policies', { orderBy: 'expiry_date', ascending: true  }),
        FG.db.list('dot_files'),
      ]);
      data = { trucks, drivers, maintenance, repairs, alerts, policies, dotFiles };
    } catch (err) {
      console.error('overview.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.overview) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load dashboard. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.overview) return;
    renderPanel(data);
  };

  mount();
};
