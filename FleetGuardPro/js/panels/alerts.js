// ============================================================
// PANEL: ALERTS & NOTICES
// ============================================================
window.FG = window.FG || {};
FG.panels = FG.panels || {};

FG.panels.alerts = function (root) {
  const SEV_COLOR = { high: 'var(--danger)', medium: 'var(--accent)', low: 'var(--steel)' };
  const SEV_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
  const TYPE_ICON = { maintenance: '🔧', safety: '🛡️', compliance: '📋', insurance: '📄', parts: '📦', billing: '💳', system: '🛠️' };

  const render = () => {
    const alerts = FG.state.list('alerts').sort((a, b) => new Date(b.date) - new Date(a.date));
    const unread = alerts.filter(a => !a.read).length;

    FG.table.panel({
      container: root,
      title: 'Alerts & Notices',
      subtitle: `${unread} unread · ${alerts.length} total`,
      addLabel: 'Mark All Read',
      onAdd: () => {
        if (!unread) { FG.toast('All alerts already read.', 'info'); return; }
        const items = FG.state.list('alerts').map(a => ({ ...a, read: true }));
        FG.state.save('alerts', items);
        FG.toast(`Marked ${unread} alert${unread === 1 ? '' : 's'} as read.`, 'success');
        FG.app.refreshBadges();
        render();
      },
      data: alerts,
      searchFields: ['title', 'message'],
      filters: [
        { key: 'severity', label: 'Severity', options: [
          { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        ]},
        { key: 'type', label: 'Type', options: ['maintenance', 'safety', 'compliance', 'insurance', 'parts', 'billing'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
        { key: 'read', label: 'Status', options: [
          { value: 'false', label: 'Unread' }, { value: 'true', label: 'Read' },
        ], match: (item, v) => String(!!item.read) === v },
      ],
      defaultSort: 'date',
      defaultDir: 'desc',
      columns: [
        { key: 'severity', label: '', width: '4px', sortable: false, render: (a) => `<div style="width:4px;height:24px;background:${SEV_COLOR[a.severity] || 'var(--muted)'};border-radius:2px"></div>` },
        { key: 'title', label: 'Alert', render: (a) => `
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">${TYPE_ICON[a.type] || '🔔'}</span>
            <div>
              <div style="${a.read ? 'color:var(--muted)' : 'font-weight:600'}">${FG.utils.escapeHtml(a.title)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${FG.utils.escapeHtml(a.message)}</div>
            </div>
          </div>` },
        { key: 'severity', label: 'Severity', render: (a) => `<span class="badge ${a.severity === 'high' ? 'badge-red' : a.severity === 'medium' ? 'badge-orange' : 'badge-blue'}">${SEV_LABEL[a.severity] || a.severity}</span>`, sortable: false },
        { key: 'date', label: 'When', render: (a) => `<span style="color:var(--muted);font-family:var(--font-mono);font-size:12px">${FG.utils.fmtDateTime(a.date)}</span>` },
      ],
      rowActions: (a) => `
        ${a.read ? '' : '<button data-action="read">Mark Read</button>'}
        <button data-action="delete" class="danger">✕</button>
      `,
      actionHandlers: {
        read: (a) => { FG.state.update('alerts', a.id, { read: true }); FG.toast('Marked as read.', 'success'); FG.app.refreshBadges(); render(); },
        delete: (a) => {
          FG.modal.confirm({
            message: `Delete alert <strong>"${FG.utils.escapeHtml(a.title)}"</strong>?`,
            confirmText: 'Delete', onConfirm: () => { FG.state.remove('alerts', a.id); FG.toast('Alert deleted.', 'success'); FG.app.refreshBadges(); render(); }
          });
        },
      },
      rowClick: (a) => {
        if (!a.read) { FG.state.update('alerts', a.id, { read: true }); FG.app.refreshBadges(); }
        FG.modal.open({
          title: a.title,
          body: `
            <div class="confirm-msg" style="text-align:left;color:var(--text);font-size:14px">${FG.utils.escapeHtml(a.message)}</div>
            <div style="margin-top:14px;font-size:12px;color:var(--muted);font-family:var(--font-mono)">
              ${TYPE_ICON[a.type] || '🔔'} ${a.type} · ${FG.utils.fmtDateTime(a.date)}
            </div>
          `,
          footer: `<button class="btn btn-ghost" data-close>Close</button>`,
        });
        render();
      },
    });
  };

  render();
};
