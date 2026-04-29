// ============================================================
// PANEL: DOT / PUCO FILES
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.dot = function (root) {
  const TYPES = ['Driver Qualification File', 'Annual Vehicle Inspection', 'Medical Certificate', 'Drug Test Result', 'IFTA Registration', 'PUCO Authority', 'IRP Registration', 'Operating Authority', 'Other'];
  const STATUS_OPTIONS = ['Active', 'Expiring', 'Expired'];

  const computeStatus = (expiry) => {
    const days = FG.utils.daysFromNow(expiry);
    if (days == null) return 'Active';
    if (days < 0) return 'Expired';
    if (days < 60) return 'Expiring';
    return 'Active';
  };

  const fields = () => {
    const drivers = FG.state.list('drivers');
    const trucks = FG.state.list('trucks');
    return [
      { key: 'type', label: 'File Type', type: 'select', required: true, options: TYPES },
      { key: 'name', label: 'Document Name', required: true, full: true },
      { key: 'driver_id', label: 'Related Driver (if any)', type: 'select', options: [{ value: '', label: '— None —' }, ...drivers.map(d => ({ value: d.id, label: d.name }))] },
      { key: 'truck_id', label: 'Related Truck (if any)', type: 'select', options: [{ value: '', label: '— None —' }, ...trucks.map(t => ({ value: t.id, label: t.unit_number }))] },
      { key: 'uploaded_date', label: 'Uploaded Date', type: 'date', value: FG.utils.today() },
      { key: 'expires_date', label: 'Expiration Date', type: 'date' },
      { key: 'file_size', label: 'File Size (bytes)', type: 'number' },
    ];
  };

  const openAdd = () => {
    FG.modal.form({
      title: 'Upload DOT File',
      fields: fields(),
      data: { uploaded_date: FG.utils.today() },
      submitText: 'Save File',
      onSubmit: (data) => {
        const status = computeStatus(data.expires_date);
        FG.state.create('dot_files', { ...data, status });
        FG.toast('DOT file added.', 'success');
        render();
      },
    });
  };

  const openEdit = (f) => {
    FG.modal.form({
      title: 'Edit DOT File',
      fields: fields(),
      data: f,
      submitText: 'Save',
      onSubmit: (data) => {
        const status = computeStatus(data.expires_date);
        FG.state.update('dot_files', f.id, { ...data, status });
        FG.toast('Updated.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('dot_files').map(f => ({ ...f, status: computeStatus(f.expires_date) }));
    const drivers = FG.state.list('drivers');
    const trucks = FG.state.list('trucks');

    const compliance = data.length ? Math.round((data.filter(f => f.status === 'Active').length / data.length) * 100) : 0;
    const expiring = data.filter(f => f.status === 'Expiring').length;
    const expired = data.filter(f => f.status === 'Expired').length;

    const kpisHtml = `
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Files</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Compliance</div><div class="kpi-value" style="color:${compliance >= 90 ? 'var(--success)' : compliance >= 70 ? 'var(--warning)' : 'var(--danger)'}">${compliance}%</div></div>
        <div class="kpi"><div class="kpi-label">Expiring &lt; 60d</div><div class="kpi-value" style="color:${expiring ? 'var(--warning)' : 'var(--text)'}">${expiring}</div></div>
        <div class="kpi"><div class="kpi-label">Expired</div><div class="kpi-value" style="color:${expired ? 'var(--danger)' : 'var(--text)'}">${expired}</div></div>
      </div>
    `;

    FG.table.panel({
      container: root,
      title: 'DOT / PUCO Files',
      subtitle: 'Driver qualification files, vehicle inspection certs, and regulatory paperwork.',
      addLabel: 'Upload File',
      onAdd: openAdd,
      data,
      kpisHtml,
      searchFields: ['name', 'type'],
      filters: [
        { key: 'type', label: 'Type', options: TYPES.map(v => ({ value: v, label: v })) },
        { key: 'status', label: 'Status', options: STATUS_OPTIONS.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'expires_date',
      defaultDir: 'asc',
      columns: [
        { key: 'name', label: 'Document', render: (f) => `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">📄</span><strong>${FG.utils.escapeHtml(f.name)}</strong></div>` },
        { key: 'type', label: 'Type' },
        { key: 'driver_id', label: 'Related', sortable: false, render: (f) => f.driver_id ? FG.utils.escapeHtml(FG.state.driverLabel(f.driver_id)) : f.truck_id ? FG.utils.escapeHtml(FG.state.truckLabel(f.truck_id)) : '—' },
        { key: 'uploaded_date', label: 'Uploaded', render: (f) => FG.utils.fmtDateShort(f.uploaded_date) },
        { key: 'expires_date', label: 'Expires', render: (f) => {
          const days = FG.utils.daysFromNow(f.expires_date);
          const color = days != null && days < 0 ? 'var(--danger)' : days != null && days < 60 ? 'var(--warning)' : 'var(--text)';
          return `<span style="color:${color}">${FG.utils.fmtDateShort(f.expires_date)}</span>`;
        }},
        { key: 'status', label: 'Status', render: (f) => FG.utils.statusBadge(f.status) },
      ],
      rowActions: () => `<button data-action="download">⬇</button><button data-action="edit">Edit</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        download: (f) => FG.toast(`Downloading ${f.name}…`, 'info'),
        edit: openEdit,
        delete: (f) => FG.modal.confirm({
          message: `Delete <strong>${FG.utils.escapeHtml(f.name)}</strong>?`,
          confirmText: 'Delete', onConfirm: () => { FG.state.remove('dot_files', f.id); FG.toast('Deleted.', 'success'); render(); }
        }),
      },
    });
  };

  render();
};
