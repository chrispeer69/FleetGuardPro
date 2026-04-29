// ============================================================
// PANEL: DRIVER SAFETY
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.safety = function (root) {
  const TYPES = ['Speeding', 'Hard Braking', 'Hard Cornering', 'Distracted Driving', 'Idling', 'Seatbelt', 'Accident', 'Other'];
  const SEVERITY = ['High', 'Medium', 'Low'];
  const STATUS_OPTIONS = ['Open', 'Reviewed', 'Closed'];

  const fields = () => {
    const drivers = FG.state.list('drivers');
    const trucks = FG.state.list('trucks');
    return [
      { key: 'driver_id', label: 'Driver', type: 'select', required: true, options: drivers.map(d => ({ value: d.id, label: d.name })) },
      { key: 'truck_id', label: 'Truck', type: 'select', options: [{ value: '', label: '— None —' }, ...trucks.map(t => ({ value: t.id, label: t.unit_number }))] },
      { key: 'type', label: 'Incident Type', type: 'select', required: true, options: TYPES },
      { key: 'severity', label: 'Severity', type: 'select', required: true, options: SEVERITY },
      { key: 'date', label: 'Date', type: 'date', required: true, value: FG.utils.today() },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
    ];
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Log Safety Incident',
      fields: fields(),
      data: { date: FG.utils.today(), status: 'Open' },
      submitText: 'Log Incident',
      onSubmit: (data) => {
        FG.state.create('safety_incidents', data);
        FG.toast('Incident logged.', 'success');
        render();
      },
    });
  };

  const openEdit = (s) => {
    FG.modal.form({
      title: 'Edit Incident',
      fields: fields(),
      data: s,
      submitText: 'Save',
      onSubmit: (data) => {
        FG.state.update('safety_incidents', s.id, data);
        FG.toast('Incident updated.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('safety_incidents');
    const drivers = FG.state.list('drivers');
    const fleetScore = drivers.length ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length) : 0;
    const open = data.filter(s => s.status === 'Open').length;
    const last30 = data.filter(s => FG.utils.daysFromNow(s.date) >= -30).length;
    const high = data.filter(s => s.severity === 'High' && s.status !== 'Closed').length;

    // Build type distribution
    const byType = TYPES.map(t => ({ type: t, count: data.filter(s => s.type === t).length })).filter(x => x.count > 0);
    const top = drivers.slice().sort((a, b) => (b.safety_score || 0) - (a.safety_score || 0));

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Fleet Avg Score</div><div class="kpi-value" style="color:${FG.utils.scoreColor(fleetScore)}">${fleetScore}</div></div>
        <div class="kpi"><div class="kpi-label">Open Incidents</div><div class="kpi-value" style="color:${open ? 'var(--accent)' : 'var(--text)'}">${open}</div></div>
        <div class="kpi"><div class="kpi-label">Last 30 Days</div><div class="kpi-value">${last30}</div></div>
        <div class="kpi"><div class="kpi-label">High Severity Open</div><div class="kpi-value" style="color:${high ? 'var(--danger)' : 'var(--text)'}">${high}</div></div>
      </div>
    `;

    // Render with extra summary cards above the standard table panel
    const wrapper = document.createElement('div');
    root.innerHTML = '';
    root.appendChild(wrapper);

    wrapper.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Driver Safety</h2>
          <p>Telematics-driven incident tracking and driver scorecards.</p>
        </div>
      </div>
      ${kpisHtml}
      <div class="grid-2 gap-24">
        <div class="card">
          <div class="card-header"><span class="card-title">Driver Scorecards</span></div>
          <div class="card-body" style="padding:0">
            <div class="table-wrap"><table class="data-table">
              <thead><tr><th>Driver</th><th>Status</th><th style="text-align:right">Score</th><th>Bar</th></tr></thead>
              <tbody>
                ${top.map(d => `
                  <tr>
                    <td><strong>${FG.utils.escapeHtml(d.name)}</strong></td>
                    <td>${FG.utils.statusBadge(d.status)}</td>
                    <td style="text-align:right;color:${FG.utils.scoreColor(d.safety_score)};font-weight:600">${d.safety_score || '—'}</td>
                    <td style="min-width:120px"><div class="progress-wrap"><div class="progress-bar ${d.safety_score >= 90 ? 'green' : d.safety_score >= 75 ? '' : 'red'}" style="width:${d.safety_score || 0}%"></div></div></td>
                  </tr>
                `).join('')}
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
      <div class="card gap-24" style="margin-top:24px"><div id="incidents-table-host"></div></div>
    `;

    if (byType.length) {
      FG.charts.bar(wrapper.querySelector('[data-chart="types"]'), {
        values: byType.map(b => b.count),
        labels: byType.map(b => b.type.split(' ')[0]),
        color: '#f5a623',
        height: 220,
        formatY: v => v,
        ariaLabel: `Safety incidents by type: ${byType.map(b => `${b.count} ${b.type.toLowerCase()}`).join(', ')}`,
      });
    }

    FG.table.panel({
      container: wrapper.querySelector('#incidents-table-host'),
      title: 'Incident Log',
      addLabel: 'Log Incident',
      onAdd: openAdd,
      data,
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
        { key: 'driver_id', label: 'Driver', render: (s) => FG.utils.escapeHtml(FG.state.driverLabel(s.driver_id)) },
        { key: 'truck_id', label: 'Truck', render: (s) => FG.utils.escapeHtml(FG.state.truckLabel(s.truck_id)) },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity', render: (s) => FG.utils.statusBadge(s.severity) },
        { key: 'status', label: 'Status', render: (s) => FG.utils.statusBadge(s.status) },
        { key: 'description', label: 'Description', sortable: false, render: (s) => `<span style="color:var(--muted)">${FG.utils.escapeHtml(s.description || '')}</span>` },
      ],
      rowActions: () => `<button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        edit: openEdit,
        delete: (s) => FG.modal.confirm({
          message: 'Delete this incident?', confirmText: 'Delete',
          onConfirm: () => { FG.state.remove('safety_incidents', s.id); FG.toast('Deleted.', 'success'); render(); }
        }),
      },
    });
  };

  render();
};
