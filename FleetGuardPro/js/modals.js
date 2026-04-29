// ============================================================
// MODALS + TOAST + FORM helpers
// ============================================================
window.FG = window.FG || {};

FG.modal = (function () {
  let stack = [];

  const ensureContainer = () => {
    let el = document.getElementById('modal-host');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-host';
      document.body.appendChild(el);
    }
    return el;
  };

  const open = ({ title, body, footer, size = 'md', onClose }) => {
    const host = ensureContainer();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    const sizeClass = size === 'lg' ? 'modal-lg' : (size === 'xl' ? 'modal-xl' : '');
    overlay.innerHTML = `
      <div class="modal ${sizeClass}">
        <div class="modal-header">
          <span class="modal-title">${FG.utils.escapeHtml(title || 'Details')}</span>
          <button class="modal-close" data-close>✕</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer"></div>
      </div>
    `;
    const bodyEl = overlay.querySelector('.modal-body');
    const footerEl = overlay.querySelector('.modal-footer');

    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);

    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) footerEl.appendChild(footer);
    else if (!footer) footerEl.innerHTML = '<button class="btn btn-ghost" data-close>Close</button>';

    host.appendChild(overlay);
    stack.push({ overlay, onClose });

    const closeFn = () => {
      const idx = stack.findIndex(s => s.overlay === overlay);
      if (idx !== -1) stack.splice(idx, 1);
      overlay.remove();
      if (typeof onClose === 'function') onClose();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFn();
    });
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeFn));

    return { close: closeFn, overlay, body: bodyEl, footer: footerEl };
  };

  const closeAll = () => {
    [...stack].forEach(s => {
      s.overlay.remove();
      if (typeof s.onClose === 'function') s.onClose();
    });
    stack = [];
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      const top = stack[stack.length - 1];
      const btn = top.overlay.querySelector('[data-close]');
      if (btn) btn.click();
    }
  });

  // Confirm helper
  const confirm = ({ title = 'Are you sure?', message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) => {
    const m = open({
      title,
      body: `
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-msg">${message || 'This action cannot be undone.'}</div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn ${confirmClass}" data-confirm>${FG.utils.escapeHtml(confirmText)}</button>
      `,
      size: 'md',
    });
    m.overlay.querySelector('[data-confirm]').addEventListener('click', () => {
      m.close();
      if (typeof onConfirm === 'function') onConfirm();
    });
    return m;
  };

  // Generic form builder
  // fields: [{ key, label, type, required, options, value, placeholder, half, full, hint }]
  const renderField = (f, value) => {
    const v = (value !== undefined && value !== null) ? value : (f.value !== undefined ? f.value : '');
    const safe = FG.utils.escapeAttr(v);
    const required = f.required ? 'required' : '';
    const placeholder = FG.utils.escapeAttr(f.placeholder || '');
    let control = '';
    if (f.type === 'select') {
      control = `<select class="form-control" name="${f.key}" ${required}>` +
        (f.options || []).map(opt => {
          const ov = typeof opt === 'object' ? opt.value : opt;
          const ol = typeof opt === 'object' ? opt.label : opt;
          const sel = String(ov) === String(v) ? 'selected' : '';
          return `<option value="${FG.utils.escapeAttr(ov)}" ${sel}>${FG.utils.escapeHtml(ol)}</option>`;
        }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      control = `<textarea class="form-control" name="${f.key}" rows="${f.rows || 3}" placeholder="${placeholder}" ${required}>${FG.utils.escapeHtml(v)}</textarea>`;
    } else if (f.type === 'checkbox') {
      const checked = v ? 'checked' : '';
      control = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" name="${f.key}" ${checked} style="accent-color:var(--accent)"> ${FG.utils.escapeHtml(f.checkboxLabel || f.label)}
      </label>`;
    } else {
      const t = f.type || 'text';
      control = `<input class="form-control" type="${t}" name="${f.key}" value="${safe}" placeholder="${placeholder}" ${required}>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="field-group">${control}${f.hint ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${FG.utils.escapeHtml(f.hint)}</div>` : ''}</div>`;
    }
    return `<div class="field-group">
      <label>${FG.utils.escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${control}
      ${f.hint ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${FG.utils.escapeHtml(f.hint)}</div>` : ''}
    </div>`;
  };

  // Open a form modal: fields grouped into rows of 2 by default unless `full`
  const form = ({ title, fields, data = {}, submitText = 'Save', onSubmit, size = 'md' }) => {
    const groups = [];
    let buf = [];
    fields.forEach(f => {
      if (f.full) {
        if (buf.length) { groups.push(buf); buf = []; }
        groups.push([f]);
      } else {
        buf.push(f);
        if (buf.length === 2) { groups.push(buf); buf = []; }
      }
    });
    if (buf.length) groups.push(buf);

    const html = `
      <form id="fg-modal-form">
        ${groups.map(g => {
          if (g.length === 1) return renderField(g[0], data[g[0].key]);
          return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${g.map(f => renderField(f, data[f.key])).join('')}</div>`;
        }).join('')}
      </form>
    `;
    const m = open({
      title,
      body: html,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-submit>${FG.utils.escapeHtml(submitText)}</button>`,
      size,
    });

    const submitBtn = m.overlay.querySelector('[data-submit]');
    const formEl = m.overlay.querySelector('#fg-modal-form');

    const collect = () => {
      const out = {};
      fields.forEach(f => {
        const el = formEl.elements[f.key];
        if (!el) return;
        if (f.type === 'checkbox') out[f.key] = !!el.checked;
        else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
        else out[f.key] = el.value;
      });
      return out;
    };

    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // basic required validation
      let valid = true;
      fields.forEach(f => {
        const el = formEl.elements[f.key];
        if (!el) return;
        if (f.required && !el.value) {
          el.style.borderColor = 'var(--danger)';
          valid = false;
        } else {
          el.style.borderColor = '';
        }
      });
      if (!valid) {
        FG.toast('Please fill in required fields.', 'error');
        return;
      }
      if (typeof onSubmit === 'function') {
        const result = onSubmit(collect(), m);
        if (result !== false) m.close();
      } else {
        m.close();
      }
    });

    formEl.addEventListener('submit', (e) => { e.preventDefault(); submitBtn.click(); });

    return m;
  };

  return { open, close: () => { if (stack.length) stack[stack.length - 1].overlay.querySelector('[data-close]').click(); }, closeAll, confirm, form };
})();

// TOAST
FG.toast = function (message, type = 'info', duration = 4000) {
  let c = document.getElementById('toastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${FG.utils.escapeHtml(message)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, duration);
};
