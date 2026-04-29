// ============================================================
// TABLE — generic interactive table renderer with search/sort/filter
// ============================================================
window.FG = window.FG || {};

FG.table = (function () {

  // Render a panel with toolbar + table + empty state
  // opts: {
  //   container, title, subtitle, addLabel, onAdd,
  //   data, columns: [{ key, label, sortable, render(item), align, width }],
  //   searchFields, filters: [{ key, label, options:[{value,label}], match(item, value) }],
  //   defaultSort, defaultDir, rowClick(item), rowActions(item), pageSize, kpis: [],
  // }
  const panel = (opts) => {
    const root = (typeof opts.container === 'string') ? document.querySelector(opts.container) : opts.container;
    if (!root) return;

    const state = {
      data: opts.data || [],
      filtered: [],
      query: '',
      filters: {},
      sortKey: opts.defaultSort || null,
      sortDir: opts.defaultDir || 'asc',
    };

    if (opts.filters) opts.filters.forEach(f => state.filters[f.key] = '');

    root.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>${FG.utils.escapeHtml(opts.title)}</h2>
          ${opts.subtitle ? `<p>${FG.utils.escapeHtml(opts.subtitle)}</p>` : ''}
        </div>
        <div class="panel-actions">
          ${opts.extraActions || ''}
          ${opts.onAdd ? `<button class="btn btn-primary" data-add>+ ${FG.utils.escapeHtml(opts.addLabel || 'Add')}</button>` : ''}
        </div>
      </div>
      ${opts.kpisHtml || ''}
      <div class="toolbar">
        ${opts.searchFields ? `<div class="search"><input type="text" placeholder="Search…" data-search></div>` : ''}
        ${(opts.filters || []).map(f => `
          <select data-filter="${f.key}">
            <option value="">${FG.utils.escapeHtml(f.label)}: All</option>
            ${(f.options || []).map(o => `<option value="${FG.utils.escapeAttr(o.value)}">${FG.utils.escapeHtml(o.label)}</option>`).join('')}
          </select>
        `).join('')}
        <span class="toolbar-info" data-count></span>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0" data-table-host></div>
      </div>
    `;

    if (opts.onAdd) {
      root.querySelector('[data-add]').addEventListener('click', opts.onAdd);
    }

    if (opts.searchFields) {
      root.querySelector('[data-search]').addEventListener('input', FG.utils.debounce((e) => {
        state.query = e.target.value;
        rerender();
      }, 150));
    }

    (opts.filters || []).forEach(f => {
      root.querySelector(`[data-filter="${f.key}"]`).addEventListener('change', (e) => {
        state.filters[f.key] = e.target.value;
        rerender();
      });
    });

    const recompute = () => {
      let arr = state.data;
      if (opts.searchFields && state.query) {
        arr = FG.utils.filterBy(arr, state.query, opts.searchFields);
      }
      (opts.filters || []).forEach(f => {
        const v = state.filters[f.key];
        if (v) arr = arr.filter(item => f.match ? f.match(item, v) : String(item[f.key]) === String(v));
      });
      if (state.sortKey) arr = FG.utils.sortBy(arr, state.sortKey, state.sortDir);
      state.filtered = arr;
    };

    const rerender = () => {
      recompute();
      const host = root.querySelector('[data-table-host]');
      const cnt = root.querySelector('[data-count]');
      if (cnt) cnt.textContent = `${state.filtered.length} of ${state.data.length}`;

      if (!state.filtered.length) {
        host.innerHTML = `<div class="empty-state"><span class="icon">📭</span>No records found.</div>`;
        return;
      }

      const cols = opts.columns;
      const showActions = !!opts.rowActions;

      const ths = cols.map(c => {
        const sortable = c.sortable !== false;
        const sorted = state.sortKey === c.key;
        const arrow = sorted ? (state.sortDir === 'asc' ? '▲' : '▼') : '↕';
        return `<th ${sortable ? `class="sortable ${sorted ? 'sorted' : ''}" data-sort="${c.key}"` : ''} ${c.width ? `style="width:${c.width}"` : ''}>
          ${FG.utils.escapeHtml(c.label)}
          ${sortable ? `<span class="sort-arrow">${arrow}</span>` : ''}
        </th>`;
      }).join('') + (showActions ? '<th style="width:1px;text-align:right">Actions</th>' : '');

      const trs = state.filtered.map((item, i) => {
        const tds = cols.map(c => {
          const v = c.render ? c.render(item) : (item[c.key] != null ? FG.utils.escapeHtml(item[c.key]) : '—');
          return `<td ${c.align ? `style="text-align:${c.align}"` : ''}>${v}</td>`;
        }).join('');
        const actions = showActions ? `<td><div class="row-actions">${opts.rowActions(item, i)}</div></td>` : '';
        return `<tr ${opts.rowClick ? `class="row-clickable" data-row="${i}"` : ''}>${tds}${actions}</tr>`;
      }).join('');

      host.innerHTML = `<table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;

      if (opts.rowClick) {
        host.querySelectorAll('tr.row-clickable').forEach(tr => {
          tr.addEventListener('click', (e) => {
            if (e.target.closest('.row-actions') || e.target.closest('button')) return;
            const idx = Number(tr.dataset.row);
            opts.rowClick(state.filtered[idx]);
          });
        });
      }

      host.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const k = th.dataset.sort;
          if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          else { state.sortKey = k; state.sortDir = 'asc'; }
          rerender();
        });
      });

      // wire row-action buttons
      if (showActions) {
        host.querySelectorAll('tbody tr').forEach((tr, i) => {
          tr.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const action = btn.dataset.action;
              const handler = opts.actionHandlers && opts.actionHandlers[action];
              if (handler) handler(state.filtered[i], btn);
            });
          });
        });
      }
    };

    rerender();
    return { rerender, state };
  };

  return { panel };
})();
