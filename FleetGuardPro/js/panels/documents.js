// ============================================================
// PANEL: DOCUMENTS
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.documents = function (root) {
  const CATEGORIES = ['Compliance', 'Insurance', 'HR', 'Fleet', 'Safety', 'Financial', 'Legal', 'Other'];

  const fileIcon = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📘';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📗';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return '🖼️';
    return '📄';
  };

  const openUpload = () => {
    FG.modal.form({
      title: 'Upload Document',
      fields: [
        { key: 'name', label: 'Document Name', required: true, full: true, placeholder: 'e.g. Driver Handbook v3.pdf' },
        { key: 'category', label: 'Category', type: 'select', required: true, options: CATEGORIES },
        { key: 'file_size', label: 'File Size (bytes)', type: 'number', value: 0 },
        { key: 'uploaded_by', label: 'Uploaded By', value: FG.state.company().contact_name || 'You', full: true },
      ],
      submitText: 'Upload',
      onSubmit: (data) => {
        FG.state.create('documents', { ...data, uploaded_date: FG.utils.today() });
        FG.toast('Document uploaded.', 'success');
        render();
      },
    });
  };

  const render = () => {
    const data = FG.state.list('documents');
    const totalSize = data.reduce((s, d) => s + (d.file_size || 0), 0);
    const byCategory = {};
    data.forEach(d => { byCategory[d.category] = (byCategory[d.category] || 0) + 1; });

    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Document Storage</h2>
          <p>Your secure portal for compliance, HR, and operational paperwork.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary" id="btn-upload">+ Upload Document</button>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Files</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi"><div class="kpi-label">Storage Used</div><div class="kpi-value">${FG.utils.fileSize(totalSize)}</div></div>
        <div class="kpi"><div class="kpi-label">Categories</div><div class="kpi-value">${Object.keys(byCategory).length}</div></div>
        <div class="kpi"><div class="kpi-label">Plan Limit</div><div class="kpi-value" style="color:var(--success)">Unlimited</div></div>
      </div>

      <div class="file-drop" id="drop-zone">
        <div class="file-drop-icon">📁</div>
        <p><strong>Drop files here</strong> or click to browse — secure encrypted upload.</p>
        <p style="font-size:11px;margin-top:6px">Supported: PDF, DOCX, XLSX, PNG, JPG · Max 50 MB per file</p>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="card-header"><span class="card-title">All Documents</span><span class="toolbar-info">${data.length} files</span></div>
        <div class="card-body" style="padding:0" id="docs-host"></div>
      </div>
    `;

    root.querySelector('#btn-upload').addEventListener('click', openUpload);
    root.querySelector('#drop-zone').addEventListener('click', openUpload);

    FG.table.panel({
      container: root.querySelector('#docs-host'),
      title: '',
      data,
      searchFields: ['name', 'uploaded_by'],
      filters: [
        { key: 'category', label: 'Category', options: CATEGORIES.map(v => ({ value: v, label: v })) },
      ],
      defaultSort: 'uploaded_date',
      defaultDir: 'desc',
      columns: [
        { key: 'name', label: 'File', render: (d) => `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:20px">${fileIcon(d.name)}</span><strong>${FG.utils.escapeHtml(d.name)}</strong></div>` },
        { key: 'category', label: 'Category', render: (d) => FG.utils.statusBadge(d.category || 'Other') },
        { key: 'file_size', label: 'Size', align: 'right', render: (d) => FG.utils.fileSize(d.file_size) },
        { key: 'uploaded_by', label: 'Uploaded By' },
        { key: 'uploaded_date', label: 'Date', render: (d) => FG.utils.fmtDateShort(d.uploaded_date) },
      ],
      rowActions: () => `<button data-action="download">⬇</button><button data-action="rename">✎</button><button data-action="delete" class="danger">✕</button>`,
      actionHandlers: {
        download: (d) => FG.toast(`Downloading ${d.name}…`, 'info'),
        rename: (d) => FG.modal.form({
          title: 'Rename File',
          fields: [{ key: 'name', label: 'New Name', required: true, full: true }],
          data: d,
          submitText: 'Rename',
          onSubmit: (val) => { FG.state.update('documents', d.id, val); FG.toast('Renamed.', 'success'); render(); },
        }),
        delete: (d) => FG.modal.confirm({
          message: `Delete <strong>${FG.utils.escapeHtml(d.name)}</strong>?`,
          confirmText: 'Delete',
          onConfirm: () => { FG.state.remove('documents', d.id); FG.toast('Deleted.', 'success'); render(); }
        }),
      },
    });
    const hdr = root.querySelector('#docs-host .panel-header'); if (hdr) hdr.style.display = 'none';
  };

  render();
};
