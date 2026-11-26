// Graphiques interactifs (canvas, sans bibliothèque) : nuage de points avec échelles log/linéaire, survol, clic, zoom par
// sélection, légende cliquable, export PNG/CSV ; histogramme empilé. Couleurs lisibles sur fond sombre.
export const PALETTE = ['#6ea8ff', '#ffd36e', '#5ed6a4', '#ff8b8f', '#c39bff', '#7fdcff', '#ffb37a', '#b6e36b', '#f28fd0', '#9aa8c7', '#e8eefc'];

const niceLin = (a, b, n = 6) => {
  const raw = (b - a || 1) / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p, s = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) out.push(+v.toPrecision(12));
  return out;
};
const niceLog = (a, b) => { // décades, plus 2× et 5× quand l'axe couvre peu de décades
  const out = [], few = Math.log10(b / a) <= 2.5;
  for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) for (const m of few ? [1, 2, 5] : [1]) out.push(m * 10 ** e);
  return out.filter(v => v >= a * 0.999 && v <= b * 1.001);
};
const fmtTick = v => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(0).replace('e+', 'e') : String(+v.toPrecision(3)));

export function scatter(host, cfg) {
  // cfg: { points:[{x,y,s(series),id,label}], series:[{key,label,color}], x:{label,log,reverse,min,max}, y:{...}, onPick(id), title, ariaLabel, overlay:[{x,y,label}] }
  const wrap = document.createElement('div'); wrap.className = 'chart';
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', cfg.ariaLabel ?? cfg.title ?? '');
  canvas.tabIndex = 0;
  const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true;
  const legend = document.createElement('div'); legend.className = 'chart-legend';
  wrap.append(canvas, tip); host.append(wrap, legend);
  const hidden = new Set(cfg.hidden ?? []);
  let view = null, drag = null, hover = null, dpr = 1, W = 0, H = 0;
  const M = { l: 62, r: 14, t: 12, b: 46 };
  const ax = { x: { ...cfg.x }, y: { ...cfg.y } };
  const T = (a, v) => (a.log ? Math.log10(v) : v);
  const visible = () => cfg.points.filter(p => !hidden.has(p.s) && Number.isFinite(p.x) && Number.isFinite(p.y) && (!ax.x.log || p.x > 0) && (!ax.y.log || p.y > 0));
  const extent = (pts, k, a) => {
    if (view && view[k]) return view[k];
    let lo = a.min ?? Math.min(...pts.map(p => p[k])), hi = a.max ?? Math.max(...pts.map(p => p[k]));
    if (a.log) { lo = Math.max(lo, 1e-12); return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))]; }
    const pad = (hi - lo) * 0.05 || 1; return [lo - pad, hi + pad];
  };
  let ex, ey;
  const px = v => { const [a, b] = ex, f = (T(ax.x, v) - T(ax.x, a)) / (T(ax.x, b) - T(ax.x, a)); return M.l + (ax.x.reverse ? 1 - f : f) * (W - M.l - M.r); };
  const py = v => { const [a, b] = ey, f = (T(ax.y, v) - T(ax.y, a)) / (T(ax.y, b) - T(ax.y, a)); return H - M.b - (ax.y.reverse ? 1 - f : f) * (H - M.t - M.b); };
  const inv = (pxv, a, e, len, off, rev, flip) => { let f = (pxv - off) / len; if (flip) f = 1 - f; if (rev) f = 1 - f; const lo = T(a, e[0]), hi = T(a, e[1]); const v = lo + f * (hi - lo); return a.log ? 10 ** v : v; };
  function draw() {
    const r = wrap.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = Math.max(280, r.width); H = Math.max(260, Math.min(520, W * 0.62));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const pts = visible(); if (!pts.length) { g.fillStyle = '#9aa8c7'; g.fillText('—', W / 2, H / 2); return; }
    ex = extent(pts, 'x', ax.x); ey = extent(pts, 'y', ax.y);
    // grille + graduations
    g.font = '11px system-ui, sans-serif'; g.strokeStyle = '#22304d'; g.fillStyle = '#9aa8c7'; g.lineWidth = 1;
    const xt = ax.x.log ? niceLog(...ex) : niceLin(...ex), yt = ax.y.log ? niceLog(...ey) : niceLin(...ey);
    g.textAlign = 'center';
    for (const v of xt) { const x = px(v); if (x < M.l - 1 || x > W - M.r + 1) continue; g.beginPath(); g.moveTo(x, M.t); g.lineTo(x, H - M.b); g.stroke(); g.fillText(fmtTick(v), x, H - M.b + 15); }
    g.textAlign = 'right';
    for (const v of yt) { const y = py(v); if (y < M.t - 1 || y > H - M.b + 1) continue; g.beginPath(); g.moveTo(M.l, y); g.lineTo(W - M.r, y); g.stroke(); g.fillText(fmtTick(v), M.l - 6, y + 4); }
    g.fillStyle = '#cfd9f0'; g.textAlign = 'center'; g.font = '12px system-ui, sans-serif'; g.fillText(ax.x.label, M.l + (W - M.l - M.r) / 2, H - 8);
    g.save(); g.translate(14, M.t + (H - M.t - M.b) / 2); g.rotate(-Math.PI / 2); g.fillText(ax.y.label, 0, 0); g.restore();
    // points
    g.save(); g.beginPath(); g.rect(M.l, M.t, W - M.l - M.r, H - M.t - M.b); g.clip();
    const col = Object.fromEntries(cfg.series.map(s => [s.key, s.color]));
    g.globalAlpha = 0.72;
    for (const p of pts) { g.fillStyle = col[p.s] ?? '#9aa8c7'; g.beginPath(); g.arc(px(p.x), py(p.y), pts.length > 3000 ? 1.7 : 2.4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    for (const o of cfg.overlay ?? []) { const x = px(o.x), y = py(o.y); g.fillStyle = '#fff'; g.strokeStyle = '#04101f'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 11px system-ui'; g.textAlign = 'left'; g.fillText(o.label, x + 7, y - 5); }
    if (hover) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(px(hover.x), py(hover.y), 5, 0, 7); g.stroke(); }
    if (drag?.w) { g.fillStyle = '#6ea8ff22'; g.strokeStyle = '#6ea8ff'; g.fillRect(drag.x0, drag.y0, drag.w, drag.h); g.strokeRect(drag.x0, drag.y0, drag.w, drag.h); }
    g.restore();
  }
  function nearest(mx, my, r2 = 100) {
    let best = null, bd = r2; for (const p of visible()) { const d = (px(p.x) - mx) ** 2 + (py(p.y) - my) ** 2; if (d < bd) { bd = d; best = p; } } return best;
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const showTip = (p, mx, my, touch) => {
    if (!p) { tip.hidden = true; return; }
    tip.hidden = false; tip.innerHTML = cfg.tip(p) + (touch && cfg.onPick ? `<br><em class="tip-hint">${cfg.tapHint ?? ''}</em>` : '');
    tip.style.left = Math.max(4, Math.min(mx + 12, W - 220)) + 'px'; tip.style.top = (touch ? Math.max(4, my - 90) : my + 12) + 'px';
  };
  // souris : survol = info-bulle, clic = fiche, glisser = zoom sur un rectangle
  // tactile : 1er toucher = info-bulle, 2e toucher sur le même point = fiche (le glisser reste le défilement de la page)
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const [mx, my] = pos(e);
    if (drag) { drag.w = mx - drag.x0; drag.h = my - drag.y0; draw(); return; }
    hover = nearest(mx, my); canvas.style.cursor = hover ? 'pointer' : 'crosshair';
    showTip(hover, mx, my, false); draw();
  });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { hover = null; tip.hidden = true; draw(); } });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; const [x, y] = pos(e); drag = { x0: x, y0: y, w: 0, h: 0 }; });
  canvas.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const [mx, my] = pos(e), p = nearest(mx, my, 24 * 24);
    if (p && p === hover) { cfg.onPick?.(p.id); return; }
    hover = p; showTip(p, mx, my, true); draw();
  });
  addEventListener('pointerup', e => {
    if (e.pointerType === 'touch' || !drag) return; const d = drag; drag = null;
    if (Math.abs(d.w) > 8 && Math.abs(d.h) > 8) { // zoom sur la zone sélectionnée
      const x1 = Math.min(d.x0, d.x0 + d.w), x2 = Math.max(d.x0, d.x0 + d.w), y1 = Math.min(d.y0, d.y0 + d.h), y2 = Math.max(d.y0, d.y0 + d.h);
      const L = W - M.l - M.r, Hh = H - M.t - M.b;
      const xa = inv(x1, ax.x, ex, L, M.l, ax.x.reverse, false), xb = inv(x2, ax.x, ex, L, M.l, ax.x.reverse, false);
      const ya = inv(y2, ax.y, ey, Hh, M.t, ax.y.reverse, true), yb = inv(y1, ax.y, ey, Hh, M.t, ax.y.reverse, true);
      view = { x: [Math.min(xa, xb), Math.max(xa, xb)], y: [Math.min(ya, yb), Math.max(ya, yb)] }; cfg.onZoom?.(true);
    } else if (hover) cfg.onPick?.(hover.id);
    draw();
  });
  canvas.addEventListener('keydown', e => { if (e.key === 'Escape') { view = null; draw(); cfg.onZoom?.(false); } });
  function drawLegend() {
    legend.replaceChildren(...cfg.series.map(s => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lg'; b.setAttribute('aria-pressed', String(!hidden.has(s.key)));
      const n = cfg.points.filter(p => p.s === s.key).length;
      b.innerHTML = `<span style="background:${s.color}"></span>${s.label} <em>${n.toLocaleString()}</em>`;
      b.onclick = () => { hidden.has(s.key) ? hidden.delete(s.key) : hidden.add(s.key); drawLegend(); draw(); };
      return b;
    }));
  }
  drawLegend();
  new ResizeObserver(() => draw()).observe(wrap); draw(); // premier dessin sans attendre un redimensionnement
  return {
    redraw: draw, reset() { view = null; draw(); }, setLog(axis, on) { ax[axis].log = on; view = null; draw(); },
    // zoom par boutons (utile au doigt) : autour du point sélectionné s'il y en a un, sinon du centre
    zoom(f) {
      if (!ex || !ey) return;
      const one = (a, e, c) => { const lo = T(a, e[0]), hi = T(a, e[1]), m = c != null ? T(a, c) : (lo + hi) / 2, h = (hi - lo) / 2 / f; const back = v => (a.log ? 10 ** v : v); return [back(m - h), back(m + h)]; };
      view = { x: one(ax.x, ex, hover?.x), y: one(ax.y, ey, hover?.y) }; draw(); cfg.onZoom?.(true);
    },
    png() { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (cfg.file ?? 'graphique') + '.png'; a.click(); },
    visible,
  };
}

export function bars(host, cfg) {
  // cfg: { cats:[x labels], series:[{key,label,color,values:[...]}], yLabel, tip(cat, s, v) }
  const wrap = document.createElement('div'); wrap.className = 'chart';
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', cfg.ariaLabel ?? '');
  const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true;
  const legend = document.createElement('div'); legend.className = 'chart-legend';
  wrap.append(canvas, tip); host.append(wrap, legend);
  const hidden = new Set(); const M = { l: 52, r: 10, t: 12, b: 40 }; let W = 0, H = 0, rects = [];
  function draw() {
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; W = Math.max(280, r.width); H = Math.max(240, Math.min(420, W * 0.5));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const S = cfg.series.filter(s => !hidden.has(s.key));
    const tot = cfg.cats.map((_, i) => S.reduce((a, s) => a + (s.values[i] ?? 0), 0)), max = Math.max(1, ...tot);
    const yt = niceLin(0, max, 5), bw = (W - M.l - M.r) / cfg.cats.length;
    g.font = '11px system-ui'; g.strokeStyle = '#22304d'; g.fillStyle = '#9aa8c7'; g.textAlign = 'right';
    const y = v => H - M.b - v / max * (H - M.t - M.b);
    for (const v of yt) { if (v > max) continue; g.beginPath(); g.moveTo(M.l, y(v)); g.lineTo(W - M.r, y(v)); g.stroke(); g.fillText(fmtTick(v), M.l - 6, y(v) + 4); }
    rects = []; g.textAlign = 'center';
    cfg.cats.forEach((c, i) => {
      let acc = 0; const x = M.l + i * bw;
      for (const s of S) { const v = s.values[i] ?? 0; if (!v) continue; const y0 = y(acc), y1 = y(acc + v); g.fillStyle = s.color; g.fillRect(x + 1, y1, Math.max(1, bw - 2), y0 - y1); rects.push({ x: x + 1, y: y1, w: bw - 2, h: y0 - y1, c, s, v }); acc += v; }
      if (cfg.cats.length <= 40 || i % Math.ceil(cfg.cats.length / 20) === 0) { g.fillStyle = '#9aa8c7'; g.fillText(c, x + bw / 2, H - M.b + 14); }
    });
    g.fillStyle = '#cfd9f0'; g.font = '12px system-ui'; g.save(); g.translate(14, M.t + (H - M.t - M.b) / 2); g.rotate(-Math.PI / 2); g.fillText(cfg.yLabel, 0, 0); g.restore();
  }
  // souris : survol ; tactile : toucher une barre (avec un peu de marge, les barres sont fines sur téléphone)
  const at = (e, slack) => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const h = rects.find(q => mx >= q.x - slack && mx <= q.x + q.w + slack && my >= q.y && my <= q.y + q.h);
    if (h) { tip.hidden = false; tip.innerHTML = cfg.tip(h.c, h.s, h.v); tip.style.left = Math.max(4, Math.min(mx + 12, W - 200)) + 'px'; tip.style.top = (e.pointerType === 'touch' ? Math.max(4, my - 70) : my + 12) + 'px'; } else tip.hidden = true;
  };
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') at(e, 0); });
  canvas.addEventListener('pointerup', e => { if (e.pointerType === 'touch') at(e, 6); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') tip.hidden = true; });
  function drawLegend() {
    legend.replaceChildren(...cfg.series.map(s => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lg'; b.setAttribute('aria-pressed', String(!hidden.has(s.key)));
      b.innerHTML = `<span style="background:${s.color}"></span>${s.label} <em>${s.values.reduce((a, v) => a + (v ?? 0), 0).toLocaleString()}</em>`;
      b.onclick = () => { hidden.has(s.key) ? hidden.delete(s.key) : hidden.add(s.key); drawLegend(); draw(); };
      return b;
    }));
  }
  drawLegend(); new ResizeObserver(() => draw()).observe(wrap); draw();
  return { redraw: draw, png() { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (cfg.file ?? 'graphique') + '.png'; a.click(); } };
}
