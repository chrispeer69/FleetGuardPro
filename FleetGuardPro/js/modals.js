// ============================================================
// MODALS + TOAST + FORM helpers
// ============================================================
window.FG = window.FG || {};

FG.modal = (function () {
  let stack = [];
  let modalCounter = 0;

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const ensureContainer = () => {
    let el = document.getElementById('modal-host');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-host';
      document.body.appendChild(el);
    }
    return el;
  };

  const focusables = (root) => Array.from(root.querySelectorAll(FOCUSABLE))
    .filter(el => el.offsetParent !== null || el === document.activeElement);

  const open = ({ title, body, footer, size = 'md', onClose }) => {
    const host = ensureContainer();
    const trigger = document.activeElement;
    const id = 'fg-modal-' + (++modalCounter);
    const titleId = id + '-title';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    const sizeClass = size === 'lg' ? 'modal-lg' : (size === 'xl' ? 'modal-xl' : '');
    overlay.innerHTML = `
      <div class="modal ${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-header">
          <span class="modal-title" id="${titleId}">${FG.utils.escapeHtml(title || 'Details')}</span>
          <button class="modal-close" data-close aria-label="Close dialog">✕</button>
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

    // Focus trap: on Tab at last → first; on Shift+Tab at first → last
    const trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const f = focusables(overlay);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    overlay.addEventListener('keydown', trapHandler);

    stack.push({ overlay, onClose, trigger, trapHandler });

    const closeFn = () => {
      const idx = stack.findIndex(s => s.overlay === overlay);
      if (idx !== -1) stack.splice(idx, 1);
      overlay.removeEventListener('keydown', trapHandler);
      overlay.remove();
      // Restore focus to the element that opened the modal
      if (trigger && typeof trigger.focus === 'function' && document.body.contains(trigger)) {
        try { trigger.focus(); } catch (e) { /* element may have been removed */ }
      }
      if (typeof onClose === 'function') onClose();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFn();
    });
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeFn));

    // Initial focus: first focusable inside body, falling back to first focusable in modal
    setTimeout(() => {
      const f = focusables(overlay);
      const firstInBody = bodyEl.querySelector(FOCUSABLE);
      const target = firstInBody || f[0];
      if (target) {
        try { target.focus(); } catch (e) { /* noop */ }
      }
    }, 0);

    return { close: closeFn, overlay, body: bodyEl, footer: footerEl };
  };

  const closeAll = () => {
    [...stack].forEach(s => {
      s.overlay.removeEventListener('keydown', s.trapHandler);
      s.overlay.remove();
      if (typeof s.onClose === 'function') s.onClose();
    });
    stack = [];
  };

  // ESC closes the topmost modal — captured at document level so it fires
  // even when focus is inside a form input (inputs don't intercept Escape).
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
        <div class="confirm-icon" aria-hidden="true">⚠️</div>
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
  let fieldCounter = 0;
  const renderField = (f, value) => {
    const v = (value !== undefined && value !== null) ? value : (f.value !== undefined ? f.value : '');
    const safe = FG.utils.escapeAttr(v);
    const fieldId = 'fg-field-' + (++fieldCounter);
    const required = f.required ? 'required aria-required="true"' : '';
    const placeholder = FG.utils.escapeAttr(f.placeholder || '');
    const hintId = f.hint ? fieldId + '-hint' : '';
    const describedBy = hintId ? `aria-describedby="${hintId}"` : '';
    let control = '';

    if (f.type === 'select') {
      control = `<select class="form-control" id="${fieldId}" name="${f.key}" ${required} ${describedBy}>` +
        (f.options || []).map(opt => {
          const ov = typeof opt === 'object' ? opt.value : opt;
          const ol = typeof opt === 'object' ? opt.label : opt;
          const sel = String(ov) === String(v) ? 'selected' : '';
          return `<option value="${FG.utils.escapeAttr(ov)}" ${sel}>${FG.utils.escapeHtml(ol)}</option>`;
        }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      control = `<textarea class="form-control" id="${fieldId}" name="${f.key}" rows="${f.rows || 3}" placeholder="${placeholder}" ${required} ${describedBy}>${FG.utils.escapeHtml(v)}</textarea>`;
    } else if (f.type === 'checkbox') {
      const checked = v ? 'checked' : '';
      control = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px" for="${fieldId}">
        <input type="checkbox" id="${fieldId}" name="${f.key}" ${checked} style="accent-color:var(--accent)" ${describedBy}> ${FG.utils.escapeHtml(f.checkboxLabel || f.label)}
      </label>`;
    } else {
      const t = f.type || 'text';
      const minAttr  = f.min  !== undefined ? `min="${FG.utils.escapeAttr(f.min)}"`   : '';
      const maxAttr  = f.max  !== undefined ? `max="${FG.utils.escapeAttr(f.max)}"`   : '';
      const stepAttr = f.step !== undefined ? `step="${FG.utils.escapeAttr(f.step)}"` : '';
      control = `<input class="form-control" id="${fieldId}" type="${t}" name="${f.key}" value="${safe}" placeholder="${placeholder}" ${minAttr} ${maxAttr} ${stepAttr} ${required} ${describedBy}>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="field-group">${control}${f.hint ? `<div id="${hintId}" class="field-hint">${FG.utils.escapeHtml(f.hint)}</div>` : ''}</div>`;
    }
    return `<div class="field-group">
      <label for="${fieldId}">${FG.utils.escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${control}
      ${f.hint ? `<div id="${hintId}" class="field-hint">${FG.utils.escapeHtml(f.hint)}</div>` : ''}
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
      <form id="fg-modal-form" novalidate>
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
      let valid = true;
      let firstInvalid = null;
      fields.forEach(f => {
        const el = formEl.elements[f.key];
        if (!el) return;
        if (f.required && !el.value) {
          el.style.borderColor = 'var(--danger)';
          el.setAttribute('aria-invalid', 'true');
          if (!firstInvalid) firstInvalid = el;
          valid = false;
        } else {
          el.style.borderColor = '';
          el.removeAttribute('aria-invalid');
        }
      });
      if (!valid) {
        FG.toast('Please fill in required fields.', 'error');
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      if (typeof onSubmit === 'function') {
        const result = onSubmit(collect(), m);
        if (result && typeof result.then === 'function') {
          submitBtn.disabled = true;
          submitBtn.dataset.busyLabel = submitBtn.textContent;
          submitBtn.textContent = 'Saving…';
          result.then(
            (r) => {
              submitBtn.disabled = false;
              submitBtn.textContent = submitBtn.dataset.busyLabel;
              if (r !== false) m.close();
            },
            () => {
              submitBtn.disabled = false;
              submitBtn.textContent = submitBtn.dataset.busyLabel;
            }
          );
        } else if (result !== false) {
          m.close();
        }
      } else {
        m.close();
      }
    });

    formEl.addEventListener('submit', (e) => { e.preventDefault(); submitBtn.click(); });

    return m;
  };

  // Single-button informational/blocking modal. Use for orphan-safety blocks
  // ("can't delete X because Y") where there's no destructive action to confirm.
  const alert = ({ title = 'Notice', message, icon = '🚫', okText = 'OK' }) => {
    return open({
      title,
      body: `<div class="confirm-icon" aria-hidden="true">${icon}</div><div class="confirm-msg">${message || ''}</div>`,
      footer: `<button class="btn btn-primary" data-close>${FG.utils.escapeHtml(okText)}</button>`,
      size: 'md',
    });
  };

  return { open, close: () => { if (stack.length) stack[stack.length - 1].overlay.querySelector('[data-close]').click(); }, closeAll, confirm, alert, form };
})();

// TOAST
FG.toast = function (message, type = 'info', duration = 4000) {
  let c = document.getElementById('toastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    c.setAttribute('role', 'status');
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span aria-hidden="true">${icons[type] || 'ℹ️'}</span><span>${FG.utils.escapeHtml(message)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, duration);
};
