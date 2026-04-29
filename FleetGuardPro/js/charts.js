// ============================================================
// CHARTS — minimal SVG bar/line/donut, no dependencies
// ============================================================
window.FG = window.FG || {};

FG.charts = (function () {

  const COLORS = {
    accent: '#f5a623',
    steel: '#1f6feb',
    success: '#2ea043',
    danger: '#da3633',
    warning: '#d29922',
    purple: '#a371f7',
    muted: '#7d8590',
  };

  // values: array of numbers; labels: array of strings
  const bar = (container, { values, labels, color = COLORS.accent, height = 220, formatY = (v) => v }) => {
    const el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return;
    const w = el.clientWidth || 600;
    const h = height;
    const padL = 36, padR = 12, padT = 12, padB = 28;
    const max = Math.max(...values, 1);
    const niceMax = Math.ceil(max * 1.1);
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const n = values.length;
    const barW = innerW / n * 0.62;
    const slot = innerW / n;

    const yTicks = 4;
    const ticks = [];
    for (let i = 0; i <= yTicks; i++) {
      const v = Math.round((niceMax * i) / yTicks);
      const y = padT + innerH - (v / niceMax) * innerH;
      ticks.push(`<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(125,133,144,.15)" stroke-dasharray="2,4"/>`);
      ticks.push(`<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="${COLORS.muted}" font-size="10" font-family="DM Mono, monospace">${formatY(v)}</text>`);
    }

    const bars = values.map((v, i) => {
      const x = padL + slot * i + (slot - barW) / 2;
      const bh = (v / niceMax) * innerH;
      const y = padT + innerH - bh;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${color}" opacity="0.85">
        <title>${labels[i]}: ${formatY(v)}</title>
      </rect>`;
    }).join('');

    const xLabels = labels.map((l, i) => {
      const x = padL + slot * i + slot / 2;
      return `<text x="${x}" y="${h - 8}" text-anchor="middle" fill="${COLORS.muted}" font-size="10" font-family="DM Mono, monospace">${l}</text>`;
    }).join('');

    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${ticks.join('')}${bars}${xLabels}
    </svg>`;
  };

  const line = (container, { values, labels, color = COLORS.accent, height = 220, formatY = (v) => v }) => {
    const el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return;
    const w = el.clientWidth || 600;
    const h = height;
    const padL = 36, padR = 12, padT = 12, padB = 28;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const niceMax = Math.ceil(max * 1.1);
    const niceMin = Math.floor(min * 0.95);
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const n = values.length;

    const yScale = (v) => padT + innerH - ((v - niceMin) / (niceMax - niceMin || 1)) * innerH;
    const xScale = (i) => padL + (innerW / Math.max(1, n - 1)) * i;

    const yTicks = 4;
    const ticks = [];
    for (let i = 0; i <= yTicks; i++) {
      const v = Math.round(niceMin + ((niceMax - niceMin) * i) / yTicks);
      const y = yScale(v);
      ticks.push(`<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(125,133,144,.15)" stroke-dasharray="2,4"/>`);
      ticks.push(`<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="${COLORS.muted}" font-size="10" font-family="DM Mono, monospace">${formatY(v)}</text>`);
    }

    const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const area = `M ${xScale(0)} ${padT + innerH} ` + values.map((v, i) => `L ${xScale(i)} ${yScale(v)}`).join(' ') + ` L ${xScale(n - 1)} ${padT + innerH} Z`;

    const dots = values.map((v, i) => `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="3" fill="${color}"><title>${labels[i]}: ${formatY(v)}</title></circle>`).join('');

    const xLabels = labels.map((l, i) => {
      // skip some labels if crowded
      if (n > 8 && i % 2 !== 0 && i !== n - 1) return '';
      const x = xScale(i);
      return `<text x="${x}" y="${h - 8}" text-anchor="middle" fill="${COLORS.muted}" font-size="10" font-family="DM Mono, monospace">${l}</text>`;
    }).join('');

    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${ticks.join('')}
      <path d="${area}" fill="${color}" opacity="0.12"/>
      <path d="${path}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
  };

  // segments: [{ value, color, label }]
  const donut = (container, { segments, height = 200, centerText = '', centerSub = '' }) => {
    const el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return;
    const w = el.clientWidth || 200;
    const size = Math.min(w, height);
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const r = size / 2 - 12;
    const cx = size / 2, cy = size / 2;
    const inner = r * 0.62;

    let acc = 0;
    const arcs = segments.map(seg => {
      const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += seg.value;
      const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const large = (end - start) > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(start), y0 = cy + r * Math.sin(start);
      const x1 = cx + r * Math.cos(end),   y1 = cy + r * Math.sin(end);
      const ix0 = cx + inner * Math.cos(end),   iy0 = cy + inner * Math.sin(end);
      const ix1 = cx + inner * Math.cos(start), iy1 = cy + inner * Math.sin(start);
      return `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${ix0} ${iy0} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z" fill="${seg.color}" opacity="0.9"><title>${seg.label}: ${seg.value}</title></path>`;
    }).join('');

    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${size} ${size}" style="max-height:${height}px">
      ${arcs}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#e6edf3" font-size="${size * 0.18}" font-family="Bebas Neue, sans-serif" letter-spacing="1">${centerText}</text>
      <text x="${cx}" y="${cy + size * 0.11}" text-anchor="middle" fill="${COLORS.muted}" font-size="${size * 0.06}" font-family="DM Mono, monospace" letter-spacing="1">${centerSub}</text>
    </svg>`;
  };

  return { bar, line, donut, COLORS };
})();
