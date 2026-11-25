import { T } from './i18n.js';

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
};

let lang = (() => { try { return localStorage.getItem('lang'); } catch { return null; } })()
  || new URLSearchParams(location.search).get('lang') || (navigator.language?.startsWith('fr') ? 'fr' : 'en');
const t = () => T[lang];
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TOP = ['planet', 'star', 'region', 'smallbody', 'other', 'live'];
const groupOf = k => (k === 'exoplanet' ? 'planet' : k === 'planet' ? 'planet' : k === 'star' ? 'star' : k);
const subOf = c => (c.k === 'exoplanet' ? 'exoplanet' : c.s);

const state = { q: '', cat: 'planet', sub: '', type: '', method: '', hz: false, sort: 'rel',
  m: [null, null], r: [null, null], d: [null, null], q2: [null, null], y: [null, null] };
let ALL = [], META = null, VIEW = [], shown = 0;
const PAGE = 48;

/* ---------- formatage ---------- */
function fmt(v) {
  if (v == null) return t().na;
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
    const [m, e] = v.toExponential(3).split('e');
    const sup = String(Number(e)).replace(/-/g, '⁻').replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
    return `${Number(m)}×10${sup}`;
  }
  return v.toLocaleString(lang, { maximumSignificantDigits: 5 });
}
function fmtProp(key, p) {
  const T_ = t();
  if (key === 'in_hz') return p.v ? T_.yes : T_.no;
  let s = (p.lim ? p.lim + ' ' : '') + fmt(p.v);
  if (p.ep != null || p.em != null) {
    const ep = p.ep ?? 0, em = Math.abs(p.em ?? 0);
    s += ep === em ? ` ± ${fmt(ep)}` : ` (+${fmt(ep)} / −${fmt(em)})`;
  }
  if (p.u) s += ` ${p.u}`;
  if (key === 'dist') s += ` (${fmt(p.v * 3.26156)} ${T_.ly})`;
  return s;
}
const srcOf = o => o.src === 'nea'
  ? { name: 'NASA Exoplanet Archive', url: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(o.name)}` }
  : { name: 'Système solaire OpenData', url: `https://api.le-systeme-solaire.net/rest/bodies/${o.ssodId}` };

/* ---------- carte ---------- */
const orb = sub => el('div', { class: `orb o-${sub || 'def'}`, 'aria-hidden': 'true' });
function tagLabel(x) { return t().tag[x] ?? t().exotype[x] ?? t().method[x] ?? x.replace(/-/g, ' '); }
function cardTags(c) {
  const out = [];
  if (c.k === 'exoplanet') out.push(t().exotype[c.s] ?? c.s);
  else out.push(t().sub[c.s] ?? c.s);
  if (c.md) out.push(t().method[c.md] ?? c.md);
  const tags = out.map(x => el('span', { class: 'tag', text: x }));
  if (c.hz === 1) tags.push(el('span', { class: 'tag hz', text: tagLabel('habitable-zone') }));
  return tags;
}
function card(c) {
  const pic = el('div', { class: 'pic' }, c.im ? el('img', { src: c.im, alt: '', loading: 'lazy', decoding: 'async' }) : orb(c.s),
    c.il ? el('span', { class: 'badge', text: t().illus }) : null);
  const name = lang === 'fr' && c.nf ? c.nf : c.n;
  const a = el('a', { class: 'card', href: `?o=${c.i}`, 'data-id': c.i }, pic,
    el('div', { class: 'body' }, el('h2', { text: name }), el('span', { class: 'code', text: c.c }), el('div', { class: 'tags' }, cardTags(c))));
  a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); openObj(c.i, true); });
  return el('li', {}, a);
}

/* ---------- filtrage ---------- */
const inR = (v, [lo, hi]) => (lo == null && hi == null) || (v != null && (lo == null || v >= lo) && (hi == null || v <= hi));
function apply() {
  const toks = norm(state.q).split(/\s+/).filter(Boolean);
  VIEW = ALL.filter(c => {
    if (groupOf(c.k) !== state.cat) return false;
    if (state.sub && subOf(c) !== state.sub) return false;
    if (state.type && !(c.k === 'exoplanet' && c.s === state.type)) return false;
    if (state.method && c.md !== state.method) return false;
    if (state.hz && c.hz !== 1) return false;
    if (!inR(c.m, state.m) || !inR(c.r, state.r) || !inR(c.d, state.d) || !inR(c.q, state.q2) || !inR(c.y, state.y)) return false;
    if (toks.length) { const h = c._h ?? (c._h = norm(`${c.n} ${c.nf ?? ''} ${c.c} ${c.h ?? ''} ${c.x ?? ''}`)); for (const k of toks) if (!h.includes(k)) return false; }
    return true;
  });
  const S = { rel: (a, b) => (b.ss ?? 0) - (a.ss ?? 0) || (a.ss ? (b.m ?? 0) - (a.m ?? 0) : a.n.localeCompare(b.n, 'en', { numeric: true })),
    name: (a, b) => a.n.localeCompare(b.n, 'en', { numeric: true }),
    dist: (a, b) => (a.d ?? 1e18) - (b.d ?? 1e18), mass: (a, b) => (b.m ?? -1) - (a.m ?? -1),
    radius: (a, b) => (b.r ?? -1) - (a.r ?? -1), year: (a, b) => (b.y ?? -1) - (a.y ?? -1) };
  VIEW.sort(S[state.sort]);
  shown = 0; $('#grid').replaceChildren(); more();
  $('#count').textContent = t().results(VIEW.length);
  drawSubs();
  $('#exoOnly').hidden = !(state.cat === 'planet' && (state.sub === 'exoplanet' || !state.sub));
}
function more() {
  const frag = document.createDocumentFragment();
  for (const c of VIEW.slice(shown, shown + PAGE)) frag.append(card(c));
  shown += PAGE; $('#grid').append(frag);
}
new IntersectionObserver(es => { if (es[0].isIntersecting && shown < VIEW.length) more(); }, { rootMargin: '800px' }).observe($('#sentinel'));

/* ---------- navigation catégories ---------- */
function drawCats() {
  const counts = {}; for (const c of ALL) counts[groupOf(c.k)] = (counts[groupOf(c.k)] ?? 0) + 1;
  $('#cats').replaceChildren(...TOP.map(k => el('button', { type: 'button', 'aria-pressed': String(state.cat === k), disabled: !counts[k],
    onclick: () => { state.cat = k; state.sub = ''; state.type = ''; apply(); drawCats(); } },
    t().cat[k], el('em', { text: counts[k] ? counts[k].toLocaleString(lang) : t().soon }))));
}
function drawSubs() {
  const counts = {};
  for (const c of ALL) if (groupOf(c.k) === state.cat) counts[subOf(c)] = (counts[subOf(c)] ?? 0) + 1;
  const keys = Object.keys(counts);
  const mk = (k, label, n) => el('button', { type: 'button', 'aria-pressed': String(state.sub === k),
    onclick: () => { state.sub = k; if (k !== 'exoplanet') state.type = ''; apply(); } }, label, el('em', { text: n.toLocaleString(lang) }));
  $('#subs').replaceChildren(keys.length > 1 ? mk('', t().all, keys.reduce((s, k) => s + counts[k], 0)) : '',
    ...(keys.length > 1 ? keys.map(k => mk(k, t().sub[k] ?? k, counts[k])) : []));
}
function drawFilterOptions() {
  const T_ = t();
  const sel = (id, opts, cur) => { const s = $(id); s.replaceChildren(...opts.map(([v, l]) => el('option', { value: v, text: l, selected: v === cur }))); };
  sel('#f-type', [['', T_.any], ...Object.entries(T_.exotype)], state.type);
  const methods = [...new Set(ALL.map(c => c.md).filter(Boolean))].sort();
  sel('#f-method', [['', T_.any], ...methods.map(m => [m, T_.method[m] ?? m])], state.method);
  sel('#sort', [['rel', T_.s_rel], ['name', T_.s_name], ['dist', T_.s_dist], ['mass', T_.s_mass], ['radius', T_.s_radius], ['year', T_.s_year]], state.sort);
}

/* ---------- fiche détaillée ---------- */
const ORDER = ['mass', 'radius', 'radius_eq', 'radius_pol', 'density', 'gravity', 'escape', 'teq', 'insol', 'axial_tilt', 'rotation',
  'period', 'sma', 'perihelion', 'aphelion', 'ecc', 'incl', 'st_teff', 'st_rad', 'st_mass', 'st_lum', 'st_met', 'st_age', 'dist', 'vmag', 'hz_inner', 'hz_outer', 'in_hz'];
const GORDER = ['physical', 'planet', 'orbit', 'star', 'sys', 'calc'];

function summary(o) {
  const T_ = t(), fr = lang === 'fr';
  if (o.desc) return o.desc[lang] ?? o.desc.fr;
  const name = fr && o.nameFr ? o.nameFr : o.name;
  if (o.cat === 'exoplanet') {
    const bits = [];
    const type = T_.exotype[o.sub]?.toLowerCase();
    bits.push(fr ? `${o.name} est une exoplanète confirmée${o.sub !== 'unclassified' ? ` de type ${type}` : ''}` : `${o.name} is a confirmed exoplanet${o.sub !== 'unclassified' ? ` (${type})` : ''}`);
    if (o.disc?.year) bits[0] += fr ? `, découverte en ${o.disc.year}` : `, discovered in ${o.disc.year}`;
    if (o.disc?.method) bits[0] += fr ? ` par la méthode « ${T_.method[o.disc.method] ?? o.disc.method} »` : ` by the ${o.disc.method} method`;
    bits[0] += '.';
    if (o.host) bits.push(fr ? `Elle orbite l’étoile ${o.host}${o.spectype ? ` (type spectral ${o.spectype})` : ''}.` : `It orbits the star ${o.host}${o.spectype ? ` (spectral type ${o.spectype})` : ''}.`);
    if (o.nPlanets > 1) bits.push(fr ? `Le système compte ${o.nPlanets} planètes confirmées.` : `The system has ${o.nPlanets} confirmed planets.`);
    if (o.props.in_hz?.v === 1) bits.push(fr ? 'Son orbite se situe dans la zone habitable calculée de son étoile.' : 'Its orbit lies within the computed habitable zone of its star.');
    if (o.controversial) bits.push(fr ? 'Son statut est signalé comme controversé.' : 'Its status is flagged as controversial.');
    return bits.join(' ');
  }
  const kind = T_.sub[o.sub]?.toLowerCase();
  const parent = o.related.find(r => r.rel === 'parent');
  let s = fr ? `${name} : ${kind ?? o.cat}${parent ? `, lié à ${parent.name}` : ''}.` : `${name}: ${kind ?? o.cat}${parent ? `, related to ${parent.name}` : ''}.`;
  if (o.disc?.by) s += fr ? ` Découvert par ${o.disc.by}${o.disc.date ? ` (${o.disc.date})` : ''}.` : ` Discovered by ${o.disc.by}${o.disc.date ? ` (${o.disc.date})` : ''}.`;
  return s;
}

function propsTable(o) {
  const T_ = t(), s = srcOf(o);
  const groups = {};
  for (const k of ORDER) if (o.props[k]) (groups[o.props[k].g ?? 'physical'] ??= []).push(k);
  const frag = [];
  const parent = o.related.find(r => r.rel === 'parent');
  const pos = o.rank ? T_.posV(o.rank) : parent ? (lang === 'fr' ? `Satellite / corps lié : ${parent.name}` : `Satellite / related body: ${parent.name}`) : null;
  if (pos) frag.push(el('h3', { text: T_.pos }), el('table', { class: 'props' }, el('tbody', {}, el('tr', {}, el('th', { scope: 'row', text: T_.pos }),
    el('td', {}, el('span', { class: 'val', text: pos }), el('span', { class: 'src', text: `${T_.source} : ${s.name} · ${T_.updated} ${o.updated}` }))))));
  for (const g of GORDER) {
    if (!groups[g]) continue;
    const rows = groups[g].map(k => {
      const p = o.props[k];
      const srcLine = p.calc
        ? el('span', { class: 'src calc', text: T_.hzNote })
        : el('span', { class: 'src' }, `${T_.source} : `, el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.name }),
          p.ref ? [` · ${T_.ref} `, p.ref.url ? el('a', { href: p.ref.url, target: '_blank', rel: 'noopener', text: p.ref.t }) : p.ref.t] : '',
          ` · ${T_.updated} ${o.updated}`, p.note ? ` · ${p.note}` : '');
      return el('tr', {}, el('th', { scope: 'row', text: T_.p[k] ?? k }), el('td', {}, el('span', { class: 'val', text: fmtProp(k, p) }), srcLine));
    });
    frag.push(el('h3', { text: T_.g[g] }), el('table', { class: 'props' }, el('tbody', {}, rows)));
  }
  // valeurs absentes les plus utiles : afficher explicitement « non disponible »
  const key = o.cat === 'exoplanet' ? ['mass', 'radius', 'period', 'sma', 'teq'] : ['mass', 'radius', 'density', 'teq'];
  const miss = key.filter(k => !o.props[k]);
  if (miss.length) frag.push(el('h3', { text: lang === 'fr' ? 'Données manquantes' : 'Missing data' }),
    el('table', { class: 'props' }, el('tbody', {}, miss.map(k => el('tr', {}, el('th', { scope: 'row', text: T_.p[k] }), el('td', { class: 'na', text: T_.na }))))));
  return frag;
}

async function openObj(id, push) {
  const dlg = $('#dlg'), body = $('#dlgBody');
  body.replaceChildren(el('p', { text: t().loading }));
  if (!dlg.open) dlg.showModal();
  if (push) history.pushState({ o: id }, '', `?o=${id}`);
  let o;
  try { o = await (await fetch(`/data/o/${encodeURIComponent(id)}.json`)).json(); }
  catch { body.replaceChildren(el('p', { text: t().err }), el('button', { class: 'btn', onclick: () => dlg.close(), text: t().close })); return; }
  const T_ = t(), s = srcOf(o);
  document.title = `${o.name} — ${T_.title}`;
  const img = o.image;
  const pic = el('div', { class: 'dlg-pic' }, img ? el('img', { src: img.url, alt: img.alt ?? o.name }) : orb(o.sub));
  const credit = img ? el('div', { class: 'credit' }, `${img.kind === 'illustration' ? T_.illusLong + (img.scope === 'system' ? ' ' + T_.illusSys : '') + ' — ' : ''}${T_.imgCredit} : ${img.credit} · ${img.license} · `,
      el('a', { href: img.source, target: '_blank', rel: 'noopener', text: 'source' }), img.note ? ` — ${img.note[lang]}` : '')
    : el('div', { class: 'credit', text: T_.noImg });
  const title = lang === 'fr' && o.nameFr ? o.nameFr : o.name;
  const tags = (o.tags ?? []).map(x => el('span', { class: 'tag' + (x === 'habitable-zone' ? ' hz' : ''), text: tagLabel(x) }));
  const rel = o.related.map(r => r.id
    ? el('a', { href: `?o=${r.id}`, onclick: e => { e.preventDefault(); openObj(r.id, true); } }, r.name, el('small', { text: T_.rel[r.rel] }))
    : el('span', {}, r.name, el('small', { text: T_.rel[r.rel] })));
  const disc = o.disc?.year ? [`${o.disc.year}`, o.disc.method && ` · ${T_.method[o.disc.method] ?? o.disc.method}`, o.disc.facility && ` · ${o.disc.facility}`].filter(Boolean).join('') : null;
  body.replaceChildren(
    el('button', { class: 'btn close', type: 'button', onclick: () => dlg.close(), 'aria-label': T_.close, text: '✕' }),
    el('div', { class: 'dlg-head' }, el('div', {}, pic, credit),
      el('div', { class: 'dlg-title' }, el('span', { class: 'kicker', text: o.code }), el('h2', { id: 'dlgTitle', text: title }),
        el('div', { class: 'tags' }, tags),
        el('p', { class: 'summary' }, summary(o), el('small', { text: o.desc ? T_.sumEdito : T_.sumAuto })),
        disc ? el('p', { class: 'credit' }, `${T_.sec.disc} : ${disc}`, o.disc.ref ? [' · ', el('a', { href: o.disc.ref.url, target: '_blank', rel: 'noopener', text: o.disc.ref.t })] : '') : null)),
    el('div', { class: 'sect' }, el('h3', { text: T_.sec.props }), propsTable(o)),
    rel.length ? el('div', { class: 'sect' }, el('h3', { text: T_.sec.rel }), el('div', { class: 'rel' }, rel)) : null,
    el('div', { class: 'srcbox' }, `${T_.source} : `, el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.name }), ` · ${T_.updated} ${o.updated}`));
  dlg.scrollTop = 0; body.scrollTop = 0;
}
$('#dlg').addEventListener('close', () => {
  document.title = t().title;
  if (new URLSearchParams(location.search).get('o')) { history.state?.o ? history.back() : history.replaceState(null, '', location.pathname); }
});
$('#dlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('o');
  if (id) openObj(id, false); else if ($('#dlg').open) { $('#dlg').removeEventListener; $('#dlg').close(); }
});

/* ---------- langue & init ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t()[n.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t()[n.dataset.i18nPh]; });
  $('#lang').textContent = lang === 'fr' ? 'EN' : 'FR';
  document.title = t().title;
  drawCats(); drawFilterOptions(); if (META) $('#foot').textContent = t().foot(META.total, META.built);
}
$('#lang').addEventListener('click', () => {
  lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('lang', lang); } catch {}
  applyLang(); apply();
  const id = new URLSearchParams(location.search).get('o'); if ($('#dlg').open && id) openObj(id, false);
});

let timer;
$('#q').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value; apply(); }, 150); });
const bindRange = (a, b, key, idx) => [a, b].forEach((id, i) => $(id).addEventListener('input', e => {
  const v = e.target.value === '' ? null : Number(e.target.value); state[key][i] = v; apply(); }));
bindRange('#f-m-min', '#f-m-max', 'm'); bindRange('#f-r-min', '#f-r-max', 'r'); bindRange('#f-d-min', '#f-d-max', 'd');
bindRange('#f-q-min', '#f-q-max', 'q2'); bindRange('#f-y-min', '#f-y-max', 'y');
$('#f-type').addEventListener('change', e => { state.type = e.target.value; apply(); });
$('#f-method').addEventListener('change', e => { state.method = e.target.value; apply(); });
$('#f-hz').addEventListener('change', e => { state.hz = e.target.checked; apply(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; apply(); });
$('#reset').addEventListener('click', () => {
  Object.assign(state, { q: '', sub: '', type: '', method: '', hz: false, m: [null, null], r: [null, null], d: [null, null], q2: [null, null], y: [null, null] });
  document.querySelectorAll('#filters input[type=number], #q').forEach(i => { i.value = ''; }); $('#f-hz').checked = false;
  drawFilterOptions(); apply();
});
$('#filtToggle').addEventListener('click', e => {
  const open = $('#filtBody').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open));
});

try {
  const [idx, meta] = await Promise.all([fetch('/data/index.json').then(r => r.json()), fetch('/data/meta.json').then(r => r.json())]);
  ALL = idx; META = meta;
} catch { $('#count').textContent = t().err; }
applyLang(); apply();
const first = new URLSearchParams(location.search).get('o');
if (first) openObj(first, false);
