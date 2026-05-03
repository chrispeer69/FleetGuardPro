// ============================================================
// PANEL: DOCUMENTS
// ============================================================
// Wave 5 (Phase 2C): reads/writes via FG.db (Supabase) instead of
// FG.state. Tenant scoping handled by RLS. documents has no FK
// relationships — fully standalone, scoped only by company_id.
//
// Mount fetches documents (orderBy uploaded_date desc) once.
// Mutations update the local cache and re-render in place.
//
// File-upload deferred to Phase 2D: the drop-zone is rendered
// inert (no click handler, "coming Phase 2D" copy) and the upload
// modal still asks for a manual byte count + file name. file_size
// gets a sane 50 MB max to catch fat-fingers; storage_path stays
// unwritten — Phase 2D will hook real Supabase Storage uploads in
// here.
window.FG = window.FG || {};
FG.panels = FG.panels || {};
FG._gen = FG._gen || {};

FG.panels.documents = function (root) {
  const myGen = FG._gen.documents = (FG._gen.documents || 0) + 1;

  const CATEGORIES = ['Compliance', 'Insurance', 'HR', 'Fleet', 'Safety', 'Financial', 'Legal', 'Other'];
  const FILE_SIZE_MAX = 50 * 1024 * 1024; // 52428800 bytes (50 MB) — matches the drop-zone copy

  let documents = [];

  const reportError = (err, fallback) => {
    FG.toast(err && err.message ? err.message : fallback, 'error');
    if (err && err.raw) console.error(fallback, err.raw);
  };

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
        { key: 'file_size', label: 'File Size (bytes)', type: 'number', value: 0, min: 0, max: FILE_SIZE_MAX },
        // FG.state.company() stays alive until Wave 9 — leaving the contact_name default as-is.
        { key: 'uploaded_by', label: 'Uploaded By', value: FG.state.company().contact_name || 'You', full: true },
      ],
      submitText: 'Upload',
      onSubmit: async (data) => {
        try {
          const row = await FG.db.create('documents', { ...data, uploaded_date: FG.utils.today() });
          documents.unshift(row);
          render();
          FG.toast('Document uploaded.', 'success');
        } catch (err) {
          reportError(err, 'Upload document failed.');
          return false;
        }
      },
    });
  };

  const onRename = (d) => {
    FG.modal.form({
      title: 'Rename File',
      fields: [{ key: 'name', label: 'New Name', required: true, full: true }],
      data: d,
      submitText: 'Rename',
      onSubmit: async (val) => {
        try {
          const row = await FG.db.update('documents', d.id, val);
          const idx = documents.findIndex(x => x.id === d.id);
          if (idx !== -1) documents[idx] = row;
          render();
          FG.toast('Renamed.', 'success');
        } catch (err) {
          reportError(err, 'Rename failed.');
          return false;
        }
      },
    });
  };

  const onDelete = (d) => {
    FG.modal.confirm({
      message: `Delete <strong>${FG.utils.escapeHtml(d.name)}</strong>?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await FG.db.remove('documents', d.id);
          documents = documents.filter(x => x.id !== d.id);
          render();
          FG.toast('Deleted.', 'success');
        } catch (err) {
          reportError(err, 'Delete failed.');
        }
      },
    });
  };

  const render = () => {
    const data = documents;
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

      <div class="file-drop" id="drop-zone" style="opacity:.6;cursor:not-allowed" aria-disabled="true">
        <div class="file-drop-icon">📁</div>
        <p><strong>Drag-and-drop upload coming in Phase 2D.</strong></p>
        <p style="font-size:11px;margin-top:6px">For now, use the "+ Upload Document" button above to add file metadata. Supported: PDF, DOCX, XLSX, PNG, JPG · Max 50 MB per file</p>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="card-header"><span class="card-title">All Documents</span><span class="toolbar-info">${data.length} files</span></div>
        <div class="card-body" style="padding:0" id="docs-host"></div>
      </div>
    `;

    root.querySelector('#btn-upload').addEventListener('click', openUpload);
    // drop-zone intentionally inert until Phase 2D — no click handler.

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
        rename: onRename,
        delete: onDelete,
      },
    });
    const hdr = root.querySelector('#docs-host .panel-header'); if (hdr) hdr.style.display = 'none';
  };

  const mount = async () => {
    root.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading documents…</div>`;
    try {
      documents = await FG.db.list('documents', { orderBy: 'uploaded_date', ascending: false });
    } catch (err) {
      console.error('documents.list failed', err && err.raw ? err.raw : err);
      if (myGen !== FG._gen.documents) return;
      root.innerHTML = `
        <div class="empty-state">
          <span class="icon">⚠️</span>
          <div>Failed to load documents. ${FG.utils.escapeHtml(err && err.message ? err.message : '')}</div>
          <button class="btn btn-ghost" data-retry style="margin-top:8px">Retry</button>
        </div>`;
      const btn = root.querySelector('[data-retry]');
      if (btn) btn.addEventListener('click', mount);
      return;
    }
    if (myGen !== FG._gen.documents) return;
    render();
  };

  mount();
};
