// ============================================================
// PANEL: DRIVER SAFETY
// ============================================================
// Wave 3 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping via RLS. Two FKs to manage:
//   driver_id  NOT NULL (form requires it)
//   truck_id   nullable (post-Wave-2 prep migration is ON DELETE
//                        SET NULL — sold trucks no longer cascade-
//                        delete safety records).
//
// Mount fetches [safety_incidents, drivers, trucks] in parallel.
// Both drivers and trucks needed for form dropdowns, the scorecard
// summary table, the table column labels, and the filter dropdowns.
//
// Layout is unusual relative to other panels: a custom panel-header
// + KPI strip + grid-2 (driver scorecards card / incidents-by-type
// chart) appears above the standard FG.table.panel — same shape as
// the pre-migration version, just rebuilt around the cached data.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.safety = function (root) {
  const myGen = FG._gen.safety = (FG._gen.safety || 0) + 1;

  const TYPES = ['Speeding', 'Hard Braking', 'Hard Cornering', 'Distracted Driving', 'Idling', 'Seatbelt', 'Accident', 'Other'];
  const SEVERITY = ['High', 'Medium', 'Low'];
  const STATUS_OPTIONS = ['Open', 'Reviewed', 'Closed'];

  let incidents = [];
  let drivers = [];
  let trucks = [];
  let tableHandle = null;

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

  const fields = () => [
    { key: 'driver_id', label: 'Driver', type: 'select', required: true,
      options: drivers.map(d => ({ value: d.id, label: d.name })) },
    { key: 'truck_id', label: 'Truck', type: 'select',
      options: [{ value: '', label: '— None —' }, ...trucks.map(t => ({ value: t.id, label: t.unit_number }))] },
    { key: 'type', label: 'Incident Type', type: 'select', required: true, options: TYPES },
    { key: 'severity', label: 'Severity', type: 'select', required: true, options: SEVERITY },
    { key: 'date', label: 'Date', type: 'date', required: true, value: FG.utils.today() },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
  ];

  const openAdd = () => {
    FG.modal.form({
      title: 'Log Safety Incident',
      fields: fields(),
      data: { date: FG.utils.today(), status: 'Open' },
      submitText: 'Log Incident',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('safety_incidents', data);
          incidents.unshift(row);
          tableHandle.state.data = incidents;
          renderSummary();
          tableHandle.rerender();
          FG.toast('Incident logged.', 'success');
        } catch (err) {
          reportError(err, 'Log incident failed.');
          return false;
        }
      },
    });
  };

  const openEdit = (s) => {
    FG.modal.form({
      title: 'Edit Incident',
      fields: fields(),
      data: s,
      submitText: 'Save',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.update('safety_incidents', s.id, data);
          const idx = incidents.findIndex(x => x.id === s.id);
          if (idx !== -1) incidents[idx] = row;
          tableHandle.state.data = incidents;
          renderSummary();
          tableHandle.rerender();
          FG.toast('Incident updated.', 'success');
        } catch (err) {
          reportError(err, 'Update incident failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (s) => {
    FG.modal.confirm({
      message: 'Delete this incident?',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('safety_incidents', s.id);
          incidents = incidents.filter(x => x.id !== s.id);
          tableHandle.state.data = incidents;
          renderSummary();
          tableHandle.rerender();
          FG.toast('Deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete incident failed.');
        }
      },
    });
  };

  // The summary block above the incidents table is recomputed
  // whenever incident data changes. Lives in a sibling container
  // (NOT wrapping the table host) so renderSummary's innerHTML
  // overwrite leaves the table's DOM and tableHandle intact.
  const summaryHtml = () => {
    const fleetScore = drivers.length ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length) : 0;
    const open = incidents.filter(s => s.status === 'Open').length;
    const last30 = incidents.filter(s => FG.utils.daysFromNow(s.date) >= -30).length;
    const high = incidents.filter(s => s.severity === 'High' && s.status !== 'Closed').length;
    const byType = TYPES.map(t => ({ type: t, count: incidents.filter(s => s.type === t).length })).filter(x => x.count > 0);
    const top = drivers.slice().sort((a, b) => (b.safety_score || 0) - (a.safety_score || 0));

    return `
      <div class="panel-header">
        <div>
          <h2>Driver Safety</h2>
          <p>Telematics-driven incident tracking and driver scorecards.</p>
        </div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Fleet Avg Score</div><div class="kpi-value" style="color:${FG.utils.scoreColor(fleetScore)}">${fleetScore}</div></div>
        <div class="kpi"><div class="kpi-label">Open Incidents</div><div class="kpi-value" style="color:${open ? 'var(--accent)' : 'var(--text)'}">${open}</div></div>
        <div class="kpi"><div class="kpi-label">Last 30 Days</div><div class="kpi-value">${last30}</div></div>
        <div class="kpi"><div class="kpi-label">High Severity Open</div><div class="kpi-value" style="color:${high ? 'var(--danger)' : 'var(--text)'}">${high}</div></div>
      </div>
      <div class="grid-2 gap-24">
        <div class="card">
          <div class="card-header"><span class="card-title">Driver Scorecards</span></div>
          <div class="card-body" style="padding:0">
            <div class="table-wrap"><table class="data-table">
              <thead><tr><th>Driver</th><th>Status</th><th style="text-align:right">Score</th><th>Bar</th></tr></thead>
              <tbody>
                ${top.length ? top.map(d => `
                  <tr>
                    <td><strong>${FG.utils.escapeHtml(d.name)}</strong></td>
                    <td>${FG.utils.statusBadge(d.status)}</td>
                    <td style="text-align:right;color:${FG.utils.scoreColor(d.safety_score)};font-weight:600">${d.safety_score || '—'}</td>
                    <td style="min-width:120px"><div class="progress-wrap"><div class="progress-bar ${d.safety_score >= 90 ? 'green' : d.safety_score >= 75 ? '' : 'red'}" style="width:${d.safety_score || 0}%"></div></div></td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="empty-state">No drivers yet.</td></tr>'}
              </tbody>
            </table></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Incidents by Type</span></div>
          <div class="card-body">
            ${byType.length ? `<div class="chart-wrap" data-chart="types"></div>` : '<div class="empty-state">No incidents recorded.</div>'}
          </div>
        </div>
      </div>
    `;
  };

  const renderSummary = () => {
    const summaryRoot = root.querySelector('[data-summary]');
    if (!summaryRoot) return;
    summaryRoot.innerHTML = summaryHtml();
    paintTypeChart();
  };

  const paintTypeChart = () => {
    const byType = TYPES.map(t => ({ type: t, count: incidents.filter(s => s.type === t).length })).filter(x => x.count > 0);
    const el = root.querySelector('[data-chart="types"]');
    if (!el || !byType.length) return;
    FG.charts.bar(el, {
      values: byType.map(b => b.count),
      labels: byType.map(b => b.type.split(' ')[0]),
      color: '#f5a623',
      height: 220,
      formatY: v => v,
      ariaLabel: `Safety incidents by type: ${byType.map(b => `${b.count} ${b.type.toLowerCase()}`).join(', ')}`,
    });
  };

  const renderPanel = () => {
    const driverLabel = FG.utils.driverLabel(drivers);
    const truckLabel = FG.utils.truckLabel(trucks);

    root.innerHTML = `
      <div data-summary>${summaryHtml()}</div>
      <div class="card gap-24" style="margin-top:24px"><div id="incidents-table-host"></div></div>
    `;
    paintTypeChart();

    tableHandle = FG.table.panel({
      container: root.querySelector('#incidents-table-host'),
      title: 'Incident Log',
      addLabel: 'Log Incident',
      onAdd: openAdd,
      data: incidents,
      emptyMessage: 'No incidents recorded yet.',
      searchFields: ['type', 'description'],
      filters: [
        { key: 'driver_id', label: 'Driver', options: drivers.map(d => ({ value: d.id, label: d.name })) },
        { key: 'severity', label: 'Severity', options: SEVERITY.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'date',
      defaultDir: 'desc',
      columns: [
        { key: 'date', label: 'Date', render: (s) => FG.utils.fmtDateShort(s.date) },
        { key: 'driver_id', label: 'Driver', render: (s) => FG.utils.escapeHtml(driverLabel(s.driver_id)) },
        { key: 'truck_id', label: 'Truck', render: (s) => FG.utils.escapeHtml(truckLabel(s.truck_id)) },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity', render: (s) => FG.utils.statusBadge(s.severity) },
        { key: 'status', label: 'Status', render: (s) => FG.utils.statusBadge(s.status) },
        { key: 'description', label: 'Description', sortable: false, render: (s) => `<span style="color:var(--muted)">${FG.utils.escapeHtml(s.description || '')}</span>` },
      ],
      rowActions: () => `<button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        edit: openEdit,
        delete: onDelete,
      },
    });
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading safety…</div>`;
    try {
      const [s, d, t] = await Promise.all([
        FG.db.list('safety_incidents', { orderBy: 'date',        ascending: false }),
        FG.db.list('drivers',          { orderBy: 'name',        ascending: true }),
        FG.db.list('trucks',           { orderBy: 'unit_number', ascending: true }),
      ]);
      incidents = s;
      drivers = d;
      trucks = t;
    } catch (err) {
      console.error('safety.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.safety) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load safety data. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.safety) return;
    renderPanel();
  };

  mount();
};
