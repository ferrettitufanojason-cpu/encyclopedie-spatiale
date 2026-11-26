import { T } from './i18n.js';
import { scatter, bars, PALETTE } from './charts.js';
import { srcOf, objPath } from '../../lib/sources.mjs';
import { PROP_GLOSS } from '../data/glossary.mjs';
import { helio, orbitPoints, PLANET_IDS, VALID, dist as dist3, AU_KM, C_KMS } from '../../lib/planets.mjs';

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

// Français par défaut ; l'anglais seulement si choisi (bouton EN, ?lang=en) ou mémorisé.
const askedLang = new URLSearchParams(location.search).get('lang');
let lang = ['fr', 'en'].includes(askedLang) ? askedLang : (() => { try { return localStorage.getItem('lang'); } catch { return null; } })() || 'fr';
if (!['fr', 'en'].includes(lang)) lang = 'fr';
const t = () => T[lang];
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// catalogues, puis outils (affichés à droite)
const TOP = ['planet', 'star', 'region', 'smallbody', 'mission', 'event', 'charts', 'live', 'avis'];
const TOOLS = new Set(['charts', 'live', 'avis']);
const PANELS = new Set(['charts', 'live', 'avis']); // onglets sans grille de cartes
const CHARTS_N = 4;
const EVENT_SUBS = new Set(['meteor-shower', 'opposition', 'elongation', 'conjunction', 'solar-eclipse', 'lunar-eclipse', 'gravitational-wave']);
const groupOf = c => (EVENT_SUBS.has(c.s) ? 'event' : c.s === 'mission' ? 'mission' : c.k === 'other' ? 'region' : c.k === 'exoplanet' ? 'planet' : c.k);
const subOf = c => (c.k === 'exoplanet' ? 'exoplanet' : c.s);

const state = { q: '', cat: 'planet', sub: '', when: '', type: '', method: '', hz: false, sort: 'rel',
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
  return v.toLocaleString(lang, { maximumSignificantDigits: 6 });
}
function fmtProp(key, p) {
  const T_ = t();
  if (key === 'in_hz') return p.v ? T_.yes : T_.no;
  if (p.t != null) return p.t;
  let s = (p.lim ? p.lim + ' ' : '') + fmt(p.v);
  if (p.ep != null || p.em != null) {
    const ep = p.ep ?? 0, em = Math.abs(p.em ?? 0);
    s += ep === em ? ` ± ${fmt(ep)}` : ` (+${fmt(ep)} / −${fmt(em)})`;
  }
  if (p.u) s += ` ${p.u}`;
  if (key === 'dist') s += ` (${fmt(p.v * 3.26156)} ${T_.ly})`;
  return s;
}
// adresse de la fiche : /objet/<id> (page réelle) ; les anciens liens ?o=<id> restent acceptés
const curObj = () => { const m = location.pathname.match(/^\/objet\/([^/]+)/); return m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get('o'); };

/* ---------- schéma d'orbite (calculé à partir des éléments orbitaux, pas une photo) ---------- */
const PLANET_A = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.19, 30.07]; // demi-grands axes (UA) des 8 planètes
function orbitSvg([q, e, om, w, inc], size = 200) {
  const a = q / (1 - e), ad = a * (1 + e), rmax = Math.max(ad, 6);
  const R = size / 2 - 8, sc = r => (Math.sqrt(r / rmax) * R); // échelle en racine carrée
  const rad = Math.PI / 180, cO = Math.cos(om * rad), sO = Math.sin(om * rad), ci = Math.cos(inc * rad);
  const pt = nu => {
    const r = a * (1 - e * e) / (1 + e * Math.cos(nu)), u = w * rad + nu, k = sc(r) / r;
    return [(cO * Math.cos(u) - sO * Math.sin(u) * ci) * r * k, (sO * Math.cos(u) + cO * Math.sin(u) * ci) * r * k];
  };
  const c = size / 2, pts = [];
  for (let n = 0; n <= 240; n++) { const [x, y] = pt(-Math.PI + n / 240 * 2 * Math.PI); pts.push(`${(c + x).toFixed(1)},${(c - y).toFixed(1)}`); }
  const [px, py] = pt(0);
  const rings = PLANET_A.filter(r => r <= rmax * 1.05).map(r => `<circle cx="${c}" cy="${c}" r="${sc(r).toFixed(1)}" fill="none" stroke="#3a4b72" stroke-width="0.8"/>`).join('');
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma de l’orbite">${rings}<polyline points="${pts.join(' ')}" fill="none" stroke="#ffd36e" stroke-width="1.6"/>`
    + `<circle cx="${(c + px).toFixed(1)}" cy="${(c - py).toFixed(1)}" r="3" fill="#fff"/><circle cx="${c}" cy="${c}" r="4" fill="#ffcf4a"/></svg>`;
}
const svgEl = (svg, cls) => { const d = el('div', { class: cls }); d.innerHTML = svg; return d; };

/* ---------- carte ---------- */
const orb = sub => el('div', { class: `orb o-${sub || 'def'}`, 'aria-hidden': 'true' });
function tagLabel(x) { return t().tag[x] ?? t().sub[x] ?? t().lumClass?.[x] ?? t().exotype[x] ?? t().method[x] ?? x.replace(/-/g, ' '); }
function cardTags(c) {
  const out = [];
  if (c.k === 'exoplanet') out.push(t().exotype[c.s] ?? c.s);
  else out.push(t().subOne[c.s] ?? t().sub[c.s] ?? c.s);
  if (c.md) out.push(t().method[c.md] ?? c.md);
  const tags = out.map(x => el('span', { class: 'tag', text: x }));
  if (c.hz === 1) tags.push(el('span', { class: 'tag hz', text: tagLabel('habitable-zone') }));
  return tags;
}
function card(c) {
  const pic = el('div', { class: 'pic' }, c.im ? el('img', { src: c.im, alt: '', loading: 'lazy', decoding: 'async' }) : c.ob ? svgEl(orbitSvg(c.ob), 'orbit') : orb(c.s),
    c.il ? el('span', { class: 'badge', text: c.il === 3 ? t().orbitBadge : c.il === 2 ? t().skyBadge : t().illus }) : null,
    c.nw ? el('span', { class: 'badge-new', text: t().newBadge.toUpperCase() }) : null,
    c.il === 2 ? el('span', { class: 'crosshair', 'aria-hidden': 'true' }) : null);
  const name = lang === 'fr' && c.nf ? c.nf : c.n;
  const a = el('a', { class: 'card', href: objPath(c.i), 'data-id': c.i }, pic,
    el('div', { class: 'body' }, el('h2', { text: name }), el('span', { class: 'code', text: c.c }), el('div', { class: 'tags' }, cardTags(c))));
  a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); openObj(c.i, true); });
  return el('li', { class: 'has-cmp' }, a, cmpToggle(c.i, lang === 'fr' && c.nf ? c.nf : c.n));
}

/* ---------- filtrage ---------- */
const inR = (v, [lo, hi]) => (lo == null && hi == null) || (v != null && (lo == null || v >= lo) && (hi == null || v <= hi));
function apply() {
  if (state.cat === 'live') { showCharts(false); showAvis(false); showLive(true); drawSimbadBox(); return; }
  if (state.cat === 'charts') { showLive(false); showAvis(false); showCharts(true); drawSimbadBox(); return; }
  if (state.cat === 'avis') { showLive(false); showCharts(false); showAvis(true); drawSimbadBox(); return; }
  showLive(false); showCharts(false); showAvis(false);
  const nowIso = new Date().toISOString().slice(0, 10);
  const toks = norm(state.q).split(/\s+/).filter(Boolean);
  VIEW = ALL.filter(c => {
    if (groupOf(c) !== state.cat) return false;
    if (state.sub && subOf(c) !== state.sub) return false;
    if (state.cat === 'event' && state.when && (state.when === 'up') !== (c.dt != null && c.dt >= nowIso)) return false;
    if (state.type && !(c.k === 'exoplanet' && c.s === state.type)) return false;
    if (state.method && c.md !== state.method) return false;
    if (state.hz && c.hz !== 1) return false;
    if (!inR(c.m, state.m) || !inR(c.r, state.r) || !inR(c.d, state.d) || !inR(c.q, state.q2) || !inR(c.y, state.y)) return false;
    if (toks.length) { const h = c._h ?? (c._h = norm(`${c.n} ${c.nf ?? ''} ${c.c} ${c.h ?? ''} ${c.x ?? ''}`)); for (const k of toks) if (!h.includes(k)) return false; }
    return true;
  });
  const S = { rel: (a, b) => (b.ss ?? 0) - (a.ss ?? 0) || (a.dt && b.dt ? ((a.dt >= nowIso) !== (b.dt >= nowIso) ? (a.dt >= nowIso ? -1 : 1) : a.dt >= nowIso ? a.dt.localeCompare(b.dt) : b.dt.localeCompare(a.dt)) : 0) || (a.ss ? (b.m ?? 0) - (a.m ?? 0) : a.n.localeCompare(b.n, 'en', { numeric: true })),
    name: (a, b) => a.n.localeCompare(b.n, 'en', { numeric: true }),
    dist: (a, b) => (a.d ?? 1e18) - (b.d ?? 1e18), mass: (a, b) => (b.m ?? -1) - (a.m ?? -1),
    radius: (a, b) => (b.r ?? -1) - (a.r ?? -1), year: (a, b) => (b.y ?? -1) - (a.y ?? -1) };
  VIEW.sort(S[state.sort]);
  shown = 0; $('#grid').replaceChildren(); more();
  $('#count').textContent = t().results(VIEW.length);
  drawSubs();
  $('#exoOnly').hidden = !(state.cat === 'planet' && (state.sub === 'exoplanet' || !state.sub));
  $('#filters').classList.toggle('ev-mode', state.cat === 'event'); // masse, rayon… n'ont pas de sens pour un événement
  drawEvAgenda();
  drawSimbadBox();
}
function more() {
  const frag = document.createDocumentFragment();
  for (const c of VIEW.slice(shown, shown + PAGE)) frag.append(card(c));
  shown += PAGE; $('#grid').append(frag);
}
new IntersectionObserver(es => { if (es[0].isIntersecting && shown < VIEW.length) more(); }, { rootMargin: '800px' }).observe($('#sentinel'));

/* ---------- navigation catégories ---------- */
function drawCats() {
  const counts = {}; for (const c of ALL) counts[groupOf(c)] = (counts[groupOf(c)] ?? 0) + 1;
  counts.live = 1; counts.charts = 1; counts.avis = 1;
  $('#cats').replaceChildren(...TOP.map(k => el('button', { type: 'button', class: TOOLS.has(k) ? 'tool' : null, 'aria-pressed': String(state.cat === k), disabled: !counts[k],
    onclick: () => { state.cat = k; state.sub = ''; state.type = ''; state.when = ''; apply(); drawCats(); } },
    t().cat[k], el('em', { text: k === 'live' ? '●' : k === 'avis' ? '★' : k === 'charts' ? String(CHARTS_N) : counts[k] ? counts[k].toLocaleString(lang) : t().soon }))));
  // sur mobile, la barre défile : on y amène l'onglet actif (sans faire bouger la page)
  const bar = $('#cats'), cur = bar.querySelector('[aria-pressed=true]');
  if (cur && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = cur.offsetLeft - bar.offsetLeft - (bar.clientWidth - cur.offsetWidth) / 2;
}
function drawSubs() {
  const counts = {};
  for (const c of ALL) if (groupOf(c) === state.cat) counts[subOf(c)] = (counts[subOf(c)] ?? 0) + 1;
  const SUBORDER = ['sun', 'spectral-O', 'spectral-B', 'spectral-A', 'spectral-F', 'spectral-G', 'spectral-K', 'spectral-M', 'other-star', 'brown-dwarf', 'white-dwarf', 'neutron-star', 'pulsar', 'magnetar', 'black-hole',
    'galaxy', 'galaxy-cluster', 'nebula', 'open-cluster', 'globular-cluster', 'main-belt', 'near-earth', 'trojan', 'other-asteroid', 'kuiper', 'comet', 'interstellar', 'mission', 'meteor-shower', 'opposition', 'elongation', 'conjunction', 'solar-eclipse', 'lunar-eclipse', 'gravitational-wave'];
  const keys = Object.keys(counts).sort((a, b) => (SUBORDER.indexOf(a) + 1 || 99) - (SUBORDER.indexOf(b) + 1 || 99));
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
  'period', 'sma', 'perihelion', 'aphelion', 'ecc', 'incl', 'date', 'etype', 'zhr', 'met_v', 'met_rad', 'met_lambda', 'met_r', 'iau', 'app_mag', 'elong', 'sep_deg', 'gw_m1', 'gw_m2', 'gw_mf', 'gw_dist', 'gw_snr', 'p_astro', 'gamma', 'ecl_mag', 'saros', 'ecl_loc', 'ecl_width', 'ecl_dur', 'diameter', 'abs_mag', 'albedo', 'spec', 'orbit_class', 'first_obs', 'moid', 'launch', 'occupied', 'crew', 'mtype', 'target', 'length_m', 'module_length_m', 'truss_length_m', 'array_span_m', 'hab_volume', 'press_volume', 'power', 'orbit_min', 'orbits_day', 'speed_text', 'agencies', 'vehicle', 'site', 'mass_kg', 'agency', 'disciplines', 'sptype', 'morph', 'teff', 'lum', 'met', 'age', 'ang_major', 'ang_minor', 'redshift', 'st_teff', 'st_rad', 'st_mass', 'st_lum', 'st_met', 'st_age', 'dist', 'vmag', 'hz_inner', 'hz_outer', 'in_hz'];
const GORDER = ['event', 'mission', 'physical', 'planet', 'orbit', 'star', 'sys', 'calc'];

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
  if (o.src === 'sbdb') {
    const nm = o.name, d = o.props.diameter?.v, per = o.props.period?.v;
    let s = fr ? `${nm} est ${T_.subKind[o.sub] ?? 'un petit corps'}` : `${nm} is ${T_.subKind[o.sub] ?? 'a small body'}`;
    if (d) s += fr ? `, d’environ ${fmt(d)} km de diamètre` : `, about ${fmt(d)} km across`;
    s += '.';
    if (per) { const y = per / 365.25; s += fr ? ` Il fait le tour du Soleil en ${y < 2 ? `${fmt(per)} jours` : `${fmt(y)} ans`}.` : ` It orbits the Sun in ${y < 2 ? `${fmt(per)} days` : `${fmt(y)} years`}.`; }
    if (o.tags.includes('hazardous')) s += fr ? ' Le JPL le classe parmi les astéroïdes potentiellement dangereux : il passe à moins de 0,05 UA de l’orbite terrestre et sa taille est notable.' : ' JPL classifies it as potentially hazardous: it can pass within 0.05 AU of Earth’s orbit and is of significant size.';
    if (o.tags.includes('visited')) s += fr ? ' Il a été visité ou survolé par au moins une sonde spatiale.' : ' It has been visited or flown past by at least one spacecraft.';
    return s;
  }
  if (o.src === 'imo' || o.src === 'horizons') {
    const p = o.props, dFmt = new Date(o.eventDate + 'T12:00:00Z').toLocaleDateString(lang, { dateStyle: 'long', timeZone: 'UTC' });
    const nm = (fr ? o.nameFr : o.name).split(' — ')[0];
    if (o.sub === 'meteor-shower') {
      const base = nm.replace(/ \d{4}$/, ''), act = p.date.t.match(/\((.+)\)/)?.[1];
      return fr ? `Les ${base} atteignent leur maximum vers le ${dFmt}${act ? ` (activité : ${act})` : ''}. ${p.zhr?.v != null ? `Taux horaire zénithal : environ ${p.zhr.v} météores par heure dans des conditions idéales (ciel parfaitement noir, radiant au zénith) ; on en voit en pratique moins.` : 'Activité variable d’une année à l’autre.'} Vitesse d’entrée : ${p.met_v.v} km/s.`
        : `The ${base} peak around ${dFmt}${act ? ` (active ${act})` : ''}. ${p.zhr?.v != null ? `Zenithal hourly rate: about ${p.zhr.v} meteors per hour under ideal conditions (perfectly dark sky, radiant overhead); fewer are seen in practice.` : 'Activity varies from year to year.'} Entry speed: ${p.met_v.v} km/s.`;
    }
    if (o.sub === 'opposition') return fr ? `${nm} : le ${dFmt}, la planète se trouve à l’opposé du Soleil vue de la Terre. Elle se lève au coucher du Soleil, reste visible toute la nuit et brille à son maximum (magnitude ${fmt(p.app_mag.v)}).`
      : `${nm}: on ${dFmt} the planet lies opposite the Sun as seen from Earth. It rises at sunset, stays visible all night and is at its brightest (magnitude ${fmt(p.app_mag.v)}).`;
    if (o.sub === 'elongation') return fr ? `${nm} : le ${dFmt}, la planète atteint son plus grand écart apparent au Soleil (${fmt(p.elong.v)}°). C’est la meilleure période pour l’observer ${/soir/.test(p.etype.t) ? 'au crépuscule, à l’ouest' : 'à l’aube, à l’est'}.`
      : `${nm}: on ${dFmt} the planet reaches its greatest apparent distance from the Sun (${fmt(p.elong.v)}°), the best time to observe it ${/soir/.test(p.etype.t) ? 'at dusk, in the west' : 'at dawn, in the east'}.`;
    if (o.sub === 'conjunction') return fr ? `${nm} : le ${dFmt}, les deux planètes ne sont séparées que de ${fmt(p.sep_deg.v)}° dans le ciel (la pleine Lune mesure environ 0,5°). Elles restent en réalité à des centaines de millions de kilomètres l’une de l’autre.`
      : `${nm}: on ${dFmt} the two planets are only ${fmt(p.sep_deg.v)}° apart in the sky (the full Moon is about 0.5° wide). In reality they remain hundreds of millions of kilometres apart.`;
  }
  if (o.src === 'gwosc' || o.src === 'nasaecl') {
    const p = o.props, today = new Date().toISOString().slice(0, 10), future = o.eventDate > today;
    const dFmt = new Date(o.eventDate + 'T12:00:00Z').toLocaleDateString(lang, { dateStyle: 'long', timeZone: 'UTC' });
    if (o.src === 'gwosc') {
      const d = p.gw_dist?.v, ly = d ? d * 3.26156e6 : null, big = ly ? (ly >= 1e9 ? `${(ly / 1e9).toLocaleString(lang, { maximumFractionDigits: 1 })} ${fr ? 'milliards' : 'billion'}` : `${(ly / 1e6).toLocaleString(lang, { maximumFractionDigits: 0 })} ${fr ? 'millions' : 'million'}`) : null;
      const kind = fr ? p.etype.t : { bbh: 'a binary black hole merger', bns: 'a binary neutron star merger', nsbh: 'a neutron star–black hole merger', gw: 'a gravitational-wave event' }[o.eventKind];
      let s = fr ? `${o.name} est ${/^fusion/.test(kind) ? 'une ' : 'un '}${kind}, détecté${/^fusion/.test(kind) ? 'e' : ''} le ${dFmt} par le réseau LIGO-Virgo-KAGRA.` : `${o.name} is ${kind}, detected on ${dFmt} by the LIGO-Virgo-KAGRA network.`;
      if (p.gw_m1 && p.gw_m2) s += fr ? ` Les deux astres avaient environ ${fmt(p.gw_m1.v)} et ${fmt(p.gw_m2.v)} masses solaires.` : ` The two bodies weighed about ${fmt(p.gw_m1.v)} and ${fmt(p.gw_m2.v)} solar masses.`;
      if (big) s += fr ? ` La source se trouve à environ ${big} d’années-lumière.` : ` The source lies about ${big} light-years away.`;
      return s;
    }
    const verb = future ? (fr ? 'aura lieu' : 'will take place') : (fr ? 'a eu lieu' : 'took place');
    const lc = x => x[0].toLowerCase() + x.slice(1);
    let s = fr ? `L’${lc(o.nameFr.split(' — ')[0])} ${verb} le ${dFmt} (heure universelle approximative : ${p.date.t.split(' ').slice(1).join(' ')}).` : `The ${lc(o.name.split(' — ')[0])} ${verb} on ${dFmt} (approximate universal time: ${p.date.t.split(' ').slice(1).join(' ')}).`;
    if (p.ecl_dur) s += fr ? ` Durée maximale de la totalité ou de l’annularité : ${p.ecl_dur.t}.` : ` Maximum duration of totality or annularity: ${p.ecl_dur.t}.`;
    s += fr ? ' L’éclipse n’est pas visible partout : seule une partie de la Terre est concernée.' : ' The eclipse is not visible everywhere: only part of the Earth is concerned.';
    return s;
  }
  if (o.src === 'nssdca' || o.src === 'nasasci') {
    const p = o.props, bits = [];
    const date = o.launchDate;
    bits.push(fr ? `${o.name} est une mission spatiale (identifiant COSPAR ${o.code})${date ? ` lancée le ${date}` : ''}${p.vehicle ? ` par ${p.vehicle.t}` : ''}${p.site ? ` depuis ${p.site.t}` : ''}.` : `${o.name} is a space mission (COSPAR ID ${o.code})${date ? ` launched on ${date}` : ''}${p.vehicle ? ` by ${p.vehicle.t}` : ''}${p.site ? ` from ${p.site.t}` : ''}.`);
    if (p.mass_kg) bits.push(fr ? `Masse au lancement : ${fmt(p.mass_kg.v)} kg.` : `Launch mass: ${fmt(p.mass_kg.v)} kg.`);
    return bits.join(' ');
  }
  if (o.src === 'simbad' || o.src === 'iau') {
    const nm = fr && o.nameFr ? o.nameFr : o.name;
    const cn = o.related.find(r => r.rel === 'constellation');
    if (o.sub === 'constellation') {
      const stars = o.related.filter(r => r.rel === 'star').slice(0, 5).map(r => r.name).join(', ');
      return fr ? `${nm} (${o.code}, génitif ${o.genitive}) est l’une des 88 constellations officielles de l’Union astronomique internationale. Son nom latin signifie « ${o.meaningFr ?? o.meaning} ».${stars ? ` Parmi les étoiles de ce catalogue : ${stars}.` : ''}`
        : `${o.name} (${o.code}, genitive ${o.genitive}) is one of the 88 official constellations of the International Astronomical Union. Its name means “${o.meaning}”.${stars ? ` Stars of this catalogue include ${stars}.` : ''}`;
    }
    const lum = (o.tags ?? []).find(x => T_.lumClass[x]);
    const kind = T_.subKind[o.sub] ?? T_.subKind['other-object'];
    const pl = o.related.filter(r => r.rel === 'planet').length;
    let s = fr ? `${nm} est ${kind}${lum ? ` (${T_.lumClass[lum]})` : ''}${o.props.sptype ? `, de type spectral ${o.props.sptype.t}` : ''}${o.props.morph ? `, de type morphologique ${o.props.morph.t}` : ''}.`
      : `${nm} is ${kind}${lum ? ` (${T_.lumClass[lum]})` : ''}${o.props.sptype ? `, of spectral type ${o.props.sptype.t}` : ''}${o.props.morph ? `, of morphological type ${o.props.morph.t}` : ''}.`;
    if (o.props.dist) {
      const ly = o.props.dist.v * 3.26156;
      const big = ly >= 1e9 ? `${(ly / 1e9).toLocaleString(lang, { maximumFractionDigits: 1 })} ${fr ? 'milliards' : 'billion'}` : ly >= 1e6 ? `${(ly / 1e6).toLocaleString(lang, { maximumFractionDigits: 1 })} ${fr ? 'millions' : 'million'}` : fmt(ly);
      s += fr ? ` Distance : environ ${big} ${ly >= 1e6 ? 'd’' : ''}années-lumière.` : ` Distance: about ${big} light-years.`;
    }
    if (cn) s += ' ' + T_.constLine(cn.name);
    if (pl) s += fr ? ` Ce système compte ${pl >= 12 ? 'au moins ' : ''}${pl} exoplanète${pl > 1 ? 's' : ''} confirmée${pl > 1 ? 's' : ''}.` : ` This system has ${pl >= 12 ? 'at least ' : ''}${pl} confirmed exoplanet${pl > 1 ? 's' : ''}.`;
    return s;
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
  const gLabel = g => (g === 'star' && o.cat === 'star' ? T_.g.starSelf : T_.g[g]);
  const frag = [];
  const parent = o.related.find(r => r.rel === 'parent');
  const pos = o.rank ? T_.posV(o.rank) : parent ? (lang === 'fr' ? `Satellite / corps lié : ${parent.name}` : `Satellite / related body: ${parent.name}`) : null;
  if (pos) frag.push(el('h3', { text: T_.pos }), el('table', { class: 'props' }, el('tbody', {}, el('tr', {}, el('th', { scope: 'row', text: T_.pos }),
    el('td', {}, el('span', { class: 'val', text: pos }), el('span', { class: 'src', text: `${T_.source} : ${s.name} · ${T_.updated} ${o.updated}` }))))));
  for (const g of GORDER) {
    if (!groups[g]) continue;
    const rows = groups[g].map(k => {
      const p = o.props[k];
      const ps = srcOf(o, p);
      const srcLine = p.calc && !['plx', 'masses', 'horizons'].includes(p.calcNote)
        ? el('span', { class: 'src calc', text: T_.hzNote })
        : el('span', { class: 'src' }, p.calc ? el('span', { class: 'calc', text: `${p.calcNote === 'masses' ? T_.massNote : p.calcNote === 'horizons' ? T_.hzCalcNote : T_.plxNote} ` }) : '', `${T_.source} : `, el('a', { href: ps.url, target: '_blank', rel: 'noopener', text: ps.name }),
          p.ref ? [` · ${T_.ref} `, p.ref.url ? el('a', { href: p.ref.url, target: '_blank', rel: 'noopener', text: p.ref.t }) : p.ref.t] : '',
          ` · ${T_.updated} ${o.updated}`, p.note ? ` · ${typeof p.note === 'object' ? p.note[lang] : p.note}` : '');
      const gl = PROP_GLOSS[k];
      return el('tr', {}, el('th', { scope: 'row' }, T_.p[k] ?? k, gl ? el('a', { class: 'gl', href: `/glossaire/#${gl}${lang === 'en' ? '-en' : ''}`, title: T_.glossary, 'aria-label': `${T_.glossary} : ${T_.p[k] ?? k}`, text: '?' }) : null), el('td', {}, el('span', { class: 'val', text: fmtProp(k, p) }), srcLine));
    });
    frag.push(el('h3', { text: gLabel(g) }), el('table', { class: 'props' }, el('tbody', {}, rows)));
  }
  // valeurs absentes les plus utiles : afficher explicitement « non disponible »
  const key = o.cat === 'exoplanet' ? ['mass', 'radius', 'period', 'sma', 'teq'] : o.cat === 'planet' ? ['mass', 'radius', 'density', 'teq']
    : o.cat === 'star' ? (/^spectral|other-star|^sun$/.test(o.sub) ? ['dist', 'teff', 'sptype'] : ['dist']) : o.cat === 'region' ? ['dist', 'redshift'] : [];
  const miss = key.filter(k => !o.props[k]);
  if (miss.length) frag.push(el('h3', { text: lang === 'fr' ? 'Données manquantes' : 'Missing data' }),
    el('table', { class: 'props' }, el('tbody', {}, miss.map(k => el('tr', {}, el('th', { scope: 'row', text: T_.p[k] }), el('td', { class: 'na', text: T_.na }))))));
  return frag;
}

async function openObj(id, push) {
  const dlg = $('#dlg'), body = $('#dlgBody');
  body.replaceChildren(el('p', { text: t().loading }));
  if (!dlg.open) dlg.showModal();
  if (push) history.pushState({ o: id }, '', objPath(id));
  let o;
  try { o = await (await fetch(`/data/o/${encodeURIComponent(id)}.json`)).json(); }
  catch { body.replaceChildren(el('p', { text: t().err }), el('button', { class: 'btn', onclick: () => dlg.close(), text: t().close })); return; }
  const T_ = t(), s = srcOf(o);
  document.title = `${o.name} — ${T_.title}`;
  const img = o.image;
  const ob = !img && o.src === 'sbdb' && o.props.perihelion && o.props.ecc?.v < 1 && o.props.node && o.props.peri_arg && o.props.incl
    ? [o.props.perihelion.v, o.props.ecc.v, o.props.node.v, o.props.peri_arg.v, o.props.incl.v] : null;
  const pic = el('div', { class: 'dlg-pic' + (img?.kind === 'sky' ? ' sky' : '') }, img ? el('img', { src: img.url, alt: img.alt ?? o.name }) : ob ? svgEl(orbitSvg(ob, 220), 'orbit') : orb(o.sub), img?.kind === 'sky' ? el('span', { class: 'crosshair', 'aria-hidden': 'true' }) : null);
  const credit = img ? el('div', { class: 'credit' }, `${img.kind === 'sky' ? T_.skyLong + ' — ' : ''}${img.kind === 'illustration' ? T_.illusLong + (img.scope === 'system' ? ' ' + T_.illusSys : img.scope === 'generic' ? ' ' + T_.illusGen : '') + ' — ' : ''}${T_.imgCredit} : ${img.credit} · ${img.license} · `,
      el('a', { href: img.source, target: '_blank', rel: 'noopener', text: 'source' }), img.note ? ` — ${img.note[lang]}` : '')
    : ob ? el('div', { class: 'credit', text: T_.orbitLong }) : el('div', { class: 'credit', text: T_.noImg });
  const title = lang === 'fr' && o.nameFr ? o.nameFr : o.name;
  const tags = (o.tags ?? []).filter(x => x !== o.otype && !['star', 'region', 'other', 'planet', 'smallbody'].includes(x) && (!/^[A-Z]{2,4}$/.test(x) || T_.tag[x])).map(x => el('span', { class: 'tag' + (x === 'habitable-zone' ? ' hz' : ''), text: tagLabel(x) }));
  const rel = o.related.map(r => r.id
    ? el('a', { href: objPath(r.id), onclick: e => { e.preventDefault(); openObj(r.id, true); } }, r.name, el('small', { text: T_.rel[r.rel] }))
    : el('span', {}, r.name, el('small', { text: T_.rel[r.rel] })));
  const disc = o.disc?.year ? [`${o.disc.year}`, o.disc.method && ` · ${T_.method[o.disc.method] ?? o.disc.method}`, o.disc.facility && ` · ${o.disc.facility}`].filter(Boolean).join('') : null;
  body.replaceChildren(
    el('button', { class: 'btn close', type: 'button', onclick: () => dlg.close(), 'aria-label': T_.close, text: '✕' }),
    el('div', { class: 'cmp-fiche' }, (() => { const b = cmpToggle(o.id, title); b.classList.add('btn'); b.append(' ' + T_.cmpAdd); return b; })(),
      (() => { const box = citeBox(o, title); const b = el('button', { class: 'btn', type: 'button', 'aria-expanded': 'false', onclick: () => { box.hidden = !box.hidden; b.setAttribute('aria-expanded', String(!box.hidden)); }, text: `❝ ${T_.citeBtn}` }); b._box = box; return [b, ' ', el('a', { class: 'btn', href: `/data/o/${encodeURIComponent(o.id)}.json`, target: '_blank', rel: 'noopener', text: `{ } ${T_.jsonLink}` }), ' ', el('a', { class: 'btn', href: `/avis/?cat=erreur&page=${encodeURIComponent(o.id)}`, text: `⚑ ${T_.reportErr}` }), box]; })()),
    el('div', { class: 'dlg-head' }, el('div', {}, pic, credit),
      el('div', { class: 'dlg-title' }, el('span', { class: 'kicker', text: o.code }), el('h2', { id: 'dlgTitle', text: title }),
        el('div', { class: 'tags' }, tags),
        el('p', { class: 'summary' }, summary(o), el('small', { text: o.desc ? `${T_.sumEdito} ${META?.review?.reviewers?.length ? `${T_.reviewBy} ${META.review.reviewers.map(r => `${r.name} (${r.date})`).join(', ')}.` : `${T_.reviewNone}.`}` : T_.sumAuto })),
        disc ? el('p', { class: 'credit' }, `${T_.sec.disc} : ${disc}`, o.disc.ref ? [' · ', el('a', { href: o.disc.ref.url, target: '_blank', rel: 'noopener', text: o.disc.ref.t })] : '') : null)),
    el('div', { class: 'sect' }, el('h3', { text: T_.sec.props }), propsTable(o)),
    o.nssdcaDesc ? el('div', { class: 'sect' }, el('h3', { text: T_.nasaDesc }), el('p', { class: 'summary', lang: 'en' }, o.nssdcaDesc.length > 900 ? o.nssdcaDesc.slice(0, o.nssdcaDesc.lastIndexOf(' ', 900)) + '…' : o.nssdcaDesc, el('small', { text: `${T_.source} : ${srcOf(o).name}` }))) : '',
    rel.length ? el('div', { class: 'sect' }, el('h3', { text: T_.sec.rel }), el('div', { class: 'rel' }, rel)) : '',
    el('div', { class: 'srcbox' }, `${T_.source} : `, el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.name }), ` · ${T_.updated} ${o.updated}`));
  if (o.live === 'iss') { mountIss(body); mountIssTv(body, { inFiche: true }); } else stopIss();
  dlg.scrollTop = 0; body.scrollTop = 0;
}
/* ---------- ISS TV : flux vidéo officiels en direct (NASA, Sen) avec plusieurs points de vue ---------- */
let ytReady = null;
const loadYT = () => ytReady ??= new Promise((ok, ko) => {
  if (window.YT?.Player) return ok(window.YT);
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { prev?.(); ok(window.YT); };
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = ko; document.head.append(s);
});

async function mountIssTv(host, { inFiche = false } = {}) {
  const T_ = t();
  const box = el('section', { class: 'tv' });
  const stage = el('div', { class: 'tv-stage' });
  const side = el('div', { class: 'tv-side', role: 'group', 'aria-label': T_.tvPov });
  const meta = el('div', { class: 'tv-meta' });
  const status = el('div', { class: 'tv-status', role: 'status', 'aria-live': 'polite' });
  const controls = el('div', { class: 'tv-controls' });
  const msg = el('p', { class: 'credit tv-msg', 'aria-live': 'polite' });
  box.append(el('h3', { text: T_.tvTitle }), el('div', { class: 'tv-grid' }, el('div', { class: 'tv-main' }, stage, status, controls, msg, meta), side), el('p', { class: 'credit', text: T_.tvNote }));
  if (inFiche) host.querySelector('.dlg-head').after(box); else host.append(box);
  stage.append(el('p', { class: 'na', text: T_.loading }));
  let streams = [];
  try { streams = (await getJson('/api/iss-tv')).streams; } catch {}
  if (!streams.length) { stage.replaceChildren(el('div', { class: 'tv-poster' }, el('p', { text: T_.tvNone }), el('a', { class: 'btn', href: 'https://www.nasa.gov/live/', target: '_blank', rel: 'noopener', text: T_.tvNasaLive }))); return; }

  let cur = null, player = null, lastDay = null;
  const btn = (label, onclick, cls = '') => el('button', { class: 'btn tv-btn ' + cls, type: 'button', onclick, text: label });
  const seek = async (minBack, label) => { // retour en arrière dans l'enregistrement tampon du direct (DVR YouTube), si le flux le permet
    msg.textContent = '';
    if (!player?.getDuration) { msg.textContent = T_.tvStartFirst; return; }
    const dur = player.getDuration(), target = Math.max(0, dur - minBack * 60);
    player.seekTo(minBack === 0 ? dur : target, true); player.playVideo?.();
    await new Promise(r => setTimeout(r, 2500));
    const now = player.getCurrentTime?.() ?? 0;
    if (minBack > 0 && Math.abs(now - target) > 120) msg.textContent = T_.tvNoDvr; else if (label) msg.textContent = label;
  };
  const play = async () => {
    stage.replaceChildren(el('div', { id: 'ytp' }));
    try {
      const YT = await loadYT();
      player = new YT.Player('ytp', { host: 'https://www.youtube-nocookie.com', videoId: cur.video, width: '100%', height: '100%',
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, fs: 1 }, events: { onReady: e => e.target.playVideo() } });
    } catch { stage.replaceChildren(el('p', { class: 'na', text: T_.liveErr })); }
  };
  const fullscreen = () => { const n = stage; (n.requestFullscreen ?? n.webkitRequestFullscreen)?.call(n); };
  const dayBtn = btn('', () => lastDay != null ? seek(lastDay, T_.tvDayShown) : null, 'tv-day'); dayBtn.hidden = true;
  const rew = [btn('−5 min', () => seek(5)), btn('−15 min', () => seek(15)), btn('−1 h', () => seek(60))];
  const syncDvr = () => { // seul un flux dont l'enregistrement tampon est activé permet de remonter dans le temps
    const ok = !!cur?.dvr; [...rew, dayBtn].forEach(b => { b.disabled = !ok; b.title = ok ? '' : T_.tvNoDvrShort; });
    msg.textContent = ok ? '' : T_.tvNoDvrShort;
  };
  controls.append(btn('● ' + T_.tvLive, () => seek(0), 'tv-live-btn'), ...rew, dayBtn,
    btn('⛶ ' + T_.tvFull, fullscreen), btn(T_.tvTheater, e => { const on = box.classList.toggle('theater'); e.currentTarget.setAttribute('aria-pressed', String(on)); }));
  const show = (s, start) => {
    cur = s; syncDvr();
    side.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === s.id)));
    if (start) { if (player?.loadVideoById) player.loadVideoById(s.video); else play(); }
    else stage.replaceChildren(el('button', { class: 'tv-poster', type: 'button', onclick: () => show(cur, true), 'aria-label': `${T_.tvPlay} — ${s.label[lang]}` },
      el('span', { class: 'live-badge', text: T_.tvLive }), el('span', { class: 'tv-play', 'aria-hidden': 'true', text: '▶' }), el('strong', { text: T_.tvPlay }), el('small', { text: s.label[lang] }), el('small', { class: 'tv-priv', text: T_.tvPrivacy })));
    meta.replaceChildren(el('div', { class: 'tv-title' }, el('span', { class: 'live-badge', text: T_.tvLive }), el('b', { text: s.label[lang] })), el('p', { text: s.desc[lang] }),
      el('p', { class: 'credit' }, `${T_.source} : ${s.owner} (YouTube) · `, el('a', { href: s.watch, target: '_blank', rel: 'noopener', text: T_.tvYoutube })));
  };
  streams.forEach(s => side.append(el('button', { type: 'button', 'data-id': s.id, 'aria-pressed': 'false', onclick: () => show(s, !!player || stage.querySelector('#ytp')) },
    el('span', { class: 'tv-dot', 'aria-hidden': 'true' }), el('span', {}, el('b', { text: s.label[lang] }), el('small', { text: s.owner })))));
  show(streams[0], false);

  // jour / nuit à bord : expliquer l'écran noir et proposer de revenir à la dernière portion éclairée
  const refresh = async () => {
    if (!box.isConnected) return;
    try {
      const d = await getJson('/api/iss'); const m = d.minutes_to_change;
      status.className = 'tv-status ' + (d.sunlit ? 'day' : 'night');
      status.textContent = d.sunlit ? T_.tvDay(m) : T_.tvNight(m);
      const ld = d.last_daylight;
      lastDay = !d.sunlit && ld ? -ld.mid_min : null;
      dayBtn.hidden = lastDay == null; if (lastDay != null) { dayBtn.textContent = `☀ ${T_.tvLastDay(lastDay)}`; dayBtn.disabled = !cur?.dvr; }
    } catch { status.textContent = ''; }
    setTimeout(refresh, 30000);
  };
  refresh();
}

/* ---------- ISS en direct (position calculée côté serveur depuis l'éphéméride officielle de la NASA) ---------- */
let issTimer = null, landPath = null;
function stopIss() { clearInterval(issTimer); issTimer = null; }
async function mountIss(host, { inFiche = true } = {}) {
  stopIss();
  const T_ = t();
  const box = el('div', { class: 'iss' });
  const info = el('div', { class: 'iss-info', 'aria-live': 'polite' });
  const map = el('div', { class: 'iss-map' });
  box.append(el('h3', { text: T_.issLive }), map, info, el('p', { class: 'credit', text: T_.issNote }));
  if (inFiche) host.querySelector('.dlg-head').after(box); else host.append(box);
  try { landPath ??= (await (await fetch('/data/land.json')).json()).d; } catch { landPath = ''; }
  const draw = d => {
    const segs = []; let cur = [];
    for (let i = 0; i < d.track.length; i++) {
      const [la, lo] = d.track[i], pt = `${(lo + 180).toFixed(1)},${(90 - la).toFixed(1)}`;
      if (cur.length && Math.abs(lo - d.track[i - 1][1]) > 180) { segs.push(cur); cur = []; }
      cur.push(pt);
    }
    segs.push(cur);
    const x = d.lon + 180, y = 90 - d.lat;
    map.innerHTML = `<svg viewBox="0 0 360 180" role="img" aria-label="${T_.issMapAlt}"><rect width="360" height="180" fill="#0a1426"/>`
      + [-60, -30, 0, 30, 60].map(la => `<line x1="0" x2="360" y1="${90 - la}" y2="${90 - la}" stroke="#16264a" stroke-width=".4"/>`).join('')
      + `<path d="${landPath}" fill="#1b3358" stroke="#2f4f84" stroke-width=".3"/>`
      + segs.map(s => `<polyline points="${s.join(' ')}" fill="none" stroke="#ffd36e" stroke-width=".8" stroke-dasharray="2 1.5"/>`).join('')
      + `<circle cx="${x}" cy="${y}" r="5" fill="#ffd36e33"/><circle cx="${x}" cy="${y}" r="2.2" fill="#fff" stroke="#ffd36e" stroke-width=".8"/></svg>`;
    const f = v => v.toLocaleString(lang, { maximumFractionDigits: 2 });
    info.replaceChildren(
      ...[[T_.issLat, `${f(Math.abs(d.lat))}° ${d.lat >= 0 ? 'N' : 'S'}`], [T_.issLon, `${f(Math.abs(d.lon))}° ${d.lon >= 0 ? 'E' : 'O'}`.replace('O', lang === 'fr' ? 'O' : 'W')],
        [T_.issAlt, `${f(d.alt_km)} km`], [T_.issSpeed, `${d.speed_kmh.toLocaleString(lang)} km/h`], [T_.issTime, new Date(d.time).toLocaleTimeString(lang)]]
        .map(([k, v]) => el('div', { class: 'iss-kv' }, el('span', { text: k }), el('b', { text: v }))));
  };
  const tick = async () => {
    try { const r = await fetch('/api/iss'); if (!r.ok) throw new Error(r.status); draw(await r.json()); }
    catch { info.replaceChildren(el('p', { class: 'na', text: T_.issErr })); }
  };
  await tick();
  issTimer = setInterval(() => { if ($('#dlg').open || state.cat === 'live') tick(); else stopIss(); }, 5000);
}

/* ---------- onglet « En direct » : ISS, APOD, EPIC, rovers (flux officiels NASA, via nos fonctions serveur) ---------- */
const getJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
const fmtDate = s => { const d = new Date(String(s).replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')); return isNaN(d) ? s : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }); };
/* ---------- Système solaire en direct : vue de dessus (pôle nord de l'écliptique), positions calculées ---------- */
const PL_COL = { mercury: '#b9b4ad', venus: '#e8cda2', earth: '#6ea8ff', mars: '#e27b58', jupiter: '#d8b48a', saturn: '#e6d08a', uranus: '#9fe3e8', neptune: '#5b7fff', pluto: '#c9a98a' };
const PL_R = { mercury: 4, venus: 5.5, earth: 6, mars: 5, jupiter: 9, saturn: 8, uranus: 7, neptune: 7, pluto: 3.5 };
let plTimer = null, plRedraw = null;
addEventListener('resize', () => { clearTimeout(plRedraw?.t); if (plRedraw) plRedraw.t = setTimeout(plRedraw.fn, 150); });
function mountPlanets(host) {
  const T_ = t(), NS = 'http://www.w3.org/2000/svg', S = 600, C = S / 2, R = S / 2 - 22;
  const svgN = (tag, a = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); return n; };
  const byId = new Map(ALL.map(c => [c.i, c]));
  const name = id => { const c = byId.get(id); return c ? (lang === 'fr' && c.nf ? c.nf : c.n) : id; };
  let date = new Date(), live = true, view = 'all', anim = null;
  // échelles : « tout le système » logarithmique (sinon les planètes intérieures seraient collées au Soleil), « intérieur » linéaire
  const proj = p => {
    const r = Math.hypot(p.x, p.y), k = view === 'all' ? (r ? R * Math.log1p(r / 0.3) / Math.log1p(50 / 0.3) / r : 0) : R / 1.75;
    return [C + p.x * k, C - p.y * k];
  };
  const shown = () => (view === 'all' ? PLANET_IDS : ['mercury', 'venus', 'earth', 'mars']);
  const svg = svgN('svg', { viewBox: `0 0 ${S} ${S}`, class: 'pl-map', role: 'img' });
  const when = el('p', { class: 'pl-date', 'aria-live': 'polite' });
  const tbody = el('tbody');
  const viewBtn = (v, label) => el('button', { class: 'btn tv-btn', type: 'button', 'aria-pressed': String(view === v), onclick: e => { view = v; e.target.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); draw(); } }, label);
  const step = days => () => { stopAnim(); live = false; setDate(new Date(+date + days * 86400000)); };
  const setDate = d => { date = new Date(Math.min(VALID[1], Math.max(VALID[0], +d))); draw(); };
  const playBtn = el('button', { class: 'btn tv-btn', type: 'button', 'aria-pressed': 'false', onclick: () => (anim ? stopAnim() : startAnim()) }, T_.plPlay);
  function startAnim() { live = false; playBtn.textContent = T_.plPause; playBtn.setAttribute('aria-pressed', 'true'); anim = setInterval(() => { if (!host.isConnected) return stopAnim(); setDate(new Date(+date + 2 * 86400000)); if (+date >= VALID[1]) stopAnim(); }, 50); }
  function stopAnim() { clearInterval(anim); anim = null; playBtn.textContent = T_.plPlay; playBtn.setAttribute('aria-pressed', 'false'); }
  host.append(el('p', { class: 'credit', text: T_.plIntro }),
    el('div', { class: 'pl-tools' },
      el('div', { class: 'tv-tabs', role: 'group', 'aria-label': T_.plView }, viewBtn('all', T_.plAll), viewBtn('inner', T_.plInner)),
      el('div', { class: 'tv-tabs', role: 'group', 'aria-label': T_.plTime },
        el('button', { class: 'btn tv-btn', type: 'button', onclick: step(-30) }, T_.plMinus30), el('button', { class: 'btn tv-btn', type: 'button', onclick: step(-1) }, T_.plMinus1),
        el('button', { class: 'btn tv-btn', type: 'button', onclick: () => { stopAnim(); live = true; setDate(new Date()); } }, T_.plNow),
        el('button', { class: 'btn tv-btn', type: 'button', onclick: step(1) }, T_.plPlus1), el('button', { class: 'btn tv-btn', type: 'button', onclick: step(30) }, T_.plPlus30), playBtn)),
    when, el('div', { class: 'pl-wrap' }, svg),
    el('div', { class: 'pl-table' }, el('table', { class: 'props' }, el('caption', { class: 'sr', text: T_.plTitle }),
      el('thead', {}, el('tr', {}, ...[T_.plName, T_.plSun, T_.plEarth, T_.plLight].map(h => el('th', { scope: 'col', text: h })))), tbody)),
    el('p', { class: 'credit' }, T_.plCredit, ' ', el('a', { href: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', target: '_blank', rel: 'noopener', text: 'JPL — Approximate Positions of the Planets' })));
  function draw() {
    const pos = Object.fromEntries(PLANET_IDS.map(id => [id, helio(id, date)])), earth = pos.earth;
    svg.setAttribute('aria-label', T_.plAria(date.toLocaleDateString(lang, { dateStyle: 'long' })));
    when.replaceChildren(el('b', { text: date.toLocaleString(lang, { dateStyle: 'full', timeStyle: 'short' }) }), live ? el('span', { class: 'pl-live', text: ` · ${T_.plLive}` }) : '');
    const kids = [];
    for (const id of shown()) {
      const pts = orbitPoints(id, date, 200).map(p => proj(p).map(v => v.toFixed(1)).join(',')).join(' ');
      kids.push(svgN('polyline', { points: pts, fill: 'none', stroke: id === 'earth' ? '#6ea8ff88' : '#3a4b72', 'stroke-width': id === 'earth' ? 1.4 : 1 }));
    }
    // direction du point vernal (axe x de l'écliptique)
    kids.push(svgN('line', { x1: C + 12, y1: C, x2: S - 6, y2: C, stroke: '#ffffff22', 'stroke-dasharray': '3 5' }));
    const g = svgN('text', { x: S - 8, y: C + 16, 'text-anchor': 'end', class: 'pl-axis', style: `font-size:${(Math.max(11, 9 * S / (svg.clientWidth || S))).toFixed(1)}px` }); g.textContent = T_.plVernal; kids.push(g);
    kids.push(svgN('circle', { cx: C, cy: C, r: view === 'all' ? 7 : 10, fill: '#ffcf4a' }));
    // étiquettes : à droite du point (à gauche près du bord), décalées verticalement si elles en chevauchent une autre
    const fs = Math.max(13, 10.5 * S / (svg.clientWidth || S)); // au moins ~10,5 px à l'écran, même sur mobile
    const placed = [{ x0: C - 12, x1: C + 12, y0: C - 12, y1: C + 12 }];
    const dots = shown().map(id => ({ id, xy: proj(pos[id]) }));
    for (const { xy: [x, y] } of dots) placed.push({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 });
    for (const { id, xy: [x, y] } of dots) {
      const a = svgN('a', { href: objPath(id), class: 'pl-dot' });
      a.addEventListener('click', e => { e.preventDefault(); openObj(id, true); });
      const w = name(id).length * fs * 0.56 + 4, left = x + PL_R[id] + 4 + w > S - 4, gap = PL_R[id] + 4;
      const box = dy => (left ? { x0: x - gap - w, x1: x - gap, y0: y + dy - fs * 0.8, y1: y + dy + fs * 0.3 } : { x0: x + gap, x1: x + gap + w, y0: y + dy - fs * 0.8, y1: y + dy + fs * 0.3 });
      const hit = b => placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0 && !(q.x0 === x - 7 && q.y0 === y - 7));
      const dy = [0.3, -0.8, 1.4, -1.9, 2.5].map(k => k * fs).find(d => !hit(box(d))) ?? 0.3 * fs;
      placed.push(box(dy));
      const lab = svgN('text', { x: left ? x - gap : x + gap, y: y + dy, 'text-anchor': left ? 'end' : 'start', class: 'pl-lab', style: `font-size:${fs.toFixed(1)}px` }); lab.textContent = name(id);
      const ttl = svgN('title'); ttl.textContent = name(id);
      a.append(ttl, svgN('circle', { cx: x, cy: y, r: PL_R[id] * (view === 'all' ? 1 : 1.3), fill: PL_COL[id], stroke: id === 'earth' ? '#fff' : 'none', 'stroke-width': 1.5 }), lab);
      kids.push(a);
    }
    svg.replaceChildren(...kids);
    const n = (v, d = 3) => v.toLocaleString(lang, { maximumSignificantDigits: d });
    tbody.replaceChildren(...PLANET_IDS.map(id => {
      const rs = dist3(pos[id]), re = id === 'earth' ? null : dist3(pos[id], earth), lt = re == null ? null : re * AU_KM / C_KMS;
      return el('tr', {}, el('th', { scope: 'row' }, el('span', { class: 'pl-sw', style: `background:${PL_COL[id]}`, 'aria-hidden': 'true' }), el('a', { href: objPath(id), onclick: e => { e.preventDefault(); openObj(id, true); }, text: name(id) })),
        el('td', { text: `${n(rs, 4)} ${T_.au}` }),
        el('td', { text: re == null ? '—' : `${n(re * AU_KM / 1e6)} ${T_.mkm}` }),
        el('td', { text: lt == null ? '—' : lt < 3600 ? `${n(lt / 60)} min` : `${n(lt / 3600)} h` }));
    }));
  }
  draw();
  plRedraw = { fn: () => host.isConnected && draw() }; // taille des étiquettes recalculée si la largeur change
  clearInterval(plTimer);
  plTimer = setInterval(() => { if (!host.isConnected) { clearInterval(plTimer); stopAnim(); return; } if (live) { date = new Date(); draw(); } }, 60000);
}

async function mountLive() {
  const T_ = t(), host = $('#live');
  host.replaceChildren(el('h2', { text: T_.cat.live }), el('p', { class: 'credit', text: T_.liveIntro }));
  const section = (title, ...kids) => { const s = el('section', { class: 'live-sec' }, el('h3', { text: title }), ...kids); host.append(s); return s; };
  // ISS TV (flux vidéo) puis position
  const tvHost = el('div', { class: 'live-sec' }); host.append(tvHost); mountIssTv(tvHost);
  const issHost = section(T_.issLive); issHost.querySelector('h3').remove();
  mountIss(issHost, { inFiche: false });
  issHost.append(el('p', {}, el('a', { href: objPath('mission-international-space-station'), onclick: e => { e.preventDefault(); openObj('mission-international-space-station', true); }, text: T_.issFiche })));
  // Position des planètes (calculée dans le navigateur, éléments orbitaux du JPL)
  mountPlanets(section(T_.plTitle));
  // APOD
  const ap = section(T_.apodTitle, el('p', { class: 'na', text: T_.loading }));
  getJson('/api/apod').then(a => {
    const media = a.media_type === 'video_file' ? el('video', { src: a.url, controls: true, preload: 'metadata', class: 'apod-img', 'aria-label': a.title })
      : a.media_type === 'image' ? el('a', { href: a.hdurl ?? a.url, target: '_blank', rel: 'noopener' }, el('img', { src: a.url, alt: a.title, loading: 'lazy', class: 'apod-img' }))
      : el('p', {}, el('a', { href: a.url, target: '_blank', rel: 'noopener', text: T_.apodVideo }));
    ap.replaceChildren(el('h3', { text: T_.apodTitle }), media, el('h4', { text: `${a.title} — ${a.date}` }),
      el('p', { class: 'summary', lang: 'en' }, a.explanation, el('small', { text: T_.apodNote })),
      el('p', { class: 'credit' }, `${T_.imgCredit} : ${a.credit ?? (a.copyright ? `© ${a.copyright}` : 'NASA')} · `, el('a', { href: a.page, target: '_blank', rel: 'noopener', text: T_.source + ' : NASA APOD' }),
        a.fallback_days ? ` · ${T_.apodOld}` : ''));
  }).catch(() => ap.append(el('p', { class: 'na', text: T_.liveErr })));
  // EPIC
  const ep = section(T_.epicTitle, el('p', { class: 'na', text: T_.loading }));
  getJson('/api/epic').then(d => {
    ep.replaceChildren(el('h3', { text: T_.epicTitle }), el('p', { class: 'credit', text: T_.epicNote }),
      el('div', { class: 'gal' }, d.images.map(i => el('a', { href: i.url, target: '_blank', rel: 'noopener', title: `${fmtDate(i.date)} (UTC) · ${i.lat?.toFixed(1)}°, ${i.lon?.toFixed(1)}°` },
        el('img', { src: i.thumb, alt: `${T_.epicAlt} — ${i.date}`, loading: 'lazy' }), el('small', { text: fmtDate(i.date) })))),
      el('p', { class: 'credit' }, `${T_.imgCredit} : NASA/NOAA DSCOVR EPIC · `, el('a', { href: d.page, target: '_blank', rel: 'noopener', text: T_.source + ' : EPIC' })));
  }).catch(() => ep.append(el('p', { class: 'na', text: T_.liveErr })));
  // Rovers
  const rv = section(T_.roverTitle, el('p', { class: 'na', text: T_.loading }));
  getJson('/api/rovers').then(d => {
    rv.replaceChildren(el('h3', { text: T_.roverTitle }), el('p', { class: 'credit', text: T_.roverNote }),
      ...Object.values(d.rovers).flatMap(r => [el('h4', { text: `${r.name} — sol ${r.sol}` }),
        el('div', { class: 'gal' }, r.images.map(i => el('a', { href: i.full ?? i.medium, target: '_blank', rel: 'noopener', title: `${i.camera} · ${fmtDate(i.taken)}` },
          el('img', { src: i.small ?? i.medium, alt: `${r.name} — ${i.camera}`, loading: 'lazy' }), el('small', { text: `${i.camera.replace(/_/g, ' ')}` })))),
        el('p', { class: 'credit' }, `${T_.imgCredit} : NASA/JPL-Caltech · `, el('a', { href: r.page, target: '_blank', rel: 'noopener', text: T_.source + ' : ' + r.name }))]));
  }).catch(() => rv.append(el('p', { class: 'na', text: T_.liveErr })));
}
/* ---------- onglet « Événements » : agenda des 12 prochains mois + choix à venir / passés ---------- */
const EV_ICON = { 'solar-eclipse': '🌑', 'lunar-eclipse': '🌕', 'meteor-shower': '☄', opposition: '🪐', elongation: '✦', conjunction: '⚭' };
function drawEvAgenda() {
  const host = $('#evAgenda'), T_ = t();
  host.hidden = state.cat !== 'event';
  if (host.hidden) { host.replaceChildren(); return; }
  const wb = (k, label) => el('button', { type: 'button', 'aria-pressed': String(state.when === k), onclick: () => { state.when = k; apply(); } }, label);
  host.replaceChildren(el('h2', { text: T_.cat.event }), el('p', { class: 'credit', text: T_.evIntro }),
    el('div', { class: 'subs when', role: 'group', 'aria-label': T_.whenLabel }, wb('', T_.whenAll), wb('up', T_.whenUp), wb('past', T_.whenPast)));
  if (state.when === 'past' || state.q || (state.sub && !EV_ICON[state.sub])) return;
  const t0 = new Date().toISOString().slice(0, 10), t1 = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const items = ALL.filter(c => c.dt && c.dt >= t0 && c.dt <= t1 && EV_ICON[c.s] && (!state.sub || c.s === state.sub)
    && (c.s !== 'meteor-shower' || (c.zh >= 10 && !/^Dayt/.test(c.n)))).sort((a, b) => a.dt.localeCompare(b.dt));
  const byMonth = new Map();
  for (const c of items) { const k = c.dt.slice(0, 7); (byMonth.get(k) ?? byMonth.set(k, []).get(k)).push(c); }
  host.append(el('section', { class: 'live-sec' }, el('h3', { text: T_.agendaTitle }), el('p', { class: 'credit', text: T_.agendaNote }),
    items.length ? el('div', { class: 'agenda' }, [...byMonth].map(([m, list]) => el('div', { class: 'ag-month' },
      el('h4', { text: new Date(m + '-15T12:00:00Z').toLocaleDateString(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }) }),
      el('ul', {}, list.map(c => el('li', {}, el('span', { class: 'ag-day', text: new Date(c.dt + 'T12:00:00Z').toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }) }),
        el('span', { class: 'ag-ico', 'aria-hidden': 'true', text: EV_ICON[c.s] }),
        el('a', { href: objPath(c.i), onclick: e => { e.preventDefault(); openObj(c.i, true); }, text: (lang === 'fr' && c.nf ? c.nf : c.n).split(' — ')[0] }),
        el('small', { text: t().subOne[c.s] ?? '' }))))))) : el('p', { class: 'na', text: T_.agendaEmpty })),
    el('h3', { class: 'ev-all', text: T_.evAllTitle }));
}
function showLive(on) {
  $('#live').hidden = !on; ['#filters', '#grid', '.exp-bar', '#subs', '#sentinel'].forEach(s => { const n = $(s); if (n) n.hidden = on; });
  $('.layout').classList.toggle('live-mode', on || PANELS.has(state.cat));
  if (on) mountLive(); else { $('#live').replaceChildren(); if (!$('#dlg').open) stopIss(); } // vide aussi les lecteurs vidéo
}

/* ---------- onglet « Graphiques » : diagrammes interactifs construits à partir des données du site ---------- */
let chartsBuilt = null;
function showCharts(on) {
  $('#charts').hidden = !on;
  if (on) { ['#filters', '#grid', '.exp-bar', '#subs', '#sentinel'].forEach(s => { const n = $(s); if (n) n.hidden = true; }); $('.layout').classList.add('live-mode'); if (chartsBuilt !== lang) mountCharts(); }
  else if (!PANELS.has(state.cat)) { ['#filters', '#grid', '.exp-bar', '#subs', '#sentinel'].forEach(s => { const n = $(s); if (n) n.hidden = false; }); $('.layout').classList.remove('live-mode'); }
}
// onglet « Commentaires » : le formulaire et les avis (composant FeedbackBox inclus dans la page, une version par langue)
function showAvis(on) {
  $('#avisTab').hidden = !on;
  document.querySelectorAll('#avisTab .fb-box').forEach(b => { b.hidden = b.dataset.l !== lang; });
  if (on) { ['#filters', '#grid', '.exp-bar', '#subs', '#sentinel'].forEach(s => { const n = $(s); if (n) n.hidden = true; }); $('.layout').classList.add('live-mode'); }
}
function mountCharts() {
  chartsBuilt = lang;
  const T_ = t(), host = $('#charts'); host.replaceChildren(el('h2', { text: T_.cat.charts }), el('p', { class: 'credit', text: T_.chIntro }));
  const pick = id => openObj(id, true);
  const nm = c => (lang === 'fr' && c.nf ? c.nf : c.n);
  const f = v => (v == null ? T_.na : v.toLocaleString(lang, { maximumSignificantDigits: 4 }));
  const csvDl = (name, head, rows) => {
    const cell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const a = el('a', { href: URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + [head, ...rows].map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })), download: `${name}.csv` });
    document.body.append(a); a.click(); a.remove();
  };
  const card = (title, text, src) => { const s = el('section', { class: 'chart-card' }, el('h3', { text: title }), el('p', { class: 'chart-text', text }));
    const tools = el('div', { class: 'chart-tools' }); const body = el('div'); s.append(tools, body, el('p', { class: 'credit', text: src })); host.append(s); return { tools, body }; };
  const btn = (label, onclick, pressed) => el('button', { class: 'btn tv-btn', type: 'button', onclick, ...(pressed != null ? { 'aria-pressed': String(pressed) } : {}), text: label });

  // 1. Masse - rayon des exoplanètes
  {
    const ex = ALL.filter(c => c.k === 'exoplanet' && c.m > 0 && c.r > 0);
    const cnt = {}; ex.forEach(c => { cnt[c.md] = (cnt[c.md] ?? 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 5);
    const ser = c => (c.ec ? 'calc' : top.includes(c.md) ? c.md : 'other');
    const series = [...top.map((k, i) => ({ key: k, label: T_.method[k] ?? k, color: PALETTE[i] })), { key: 'other', label: T_.chOther, color: PALETTE[9] }, { key: 'calc', label: T_.chCalc, color: '#5b6b8c' }];
    const solar = ALL.filter(c => c.k === 'planet' && ['terrestrial', 'gas-giant', 'ice-giant'].includes(c.s) && c.m > 0 && c.r > 0).map(c => ({ x: c.m, y: c.r, label: nm(c) }));
    const { tools, body } = card(T_.chMR, T_.chMRText, T_.chMRSrc);
    const ch = scatter(body, { points: ex.map(c => ({ x: c.m, y: c.r, s: ser(c), id: c.i, c })), series, overlay: solar, file: 'masse-rayon-exoplanetes', hidden: ['calc'],
      x: { label: T_.chMass, log: true }, y: { label: T_.chRadius, log: true }, ariaLabel: T_.chMR, onPick: pick, tapHint: T_.chTap,
      tip: p => `<b>${nm(p.c)}</b><br>${T_.p.mass} : ${f(p.c.m)} M⊕<br>${T_.p.radius} : ${f(p.c.r)} R⊕<br>${T_.method[p.c.md] ?? p.c.md ?? ''} · ${p.c.y ?? ''}` });
    let lx = true, ly = true;
    tools.append(btn(T_.chLogX, e => { lx = !lx; ch.setLog('x', lx); e.target.setAttribute('aria-pressed', String(lx)); }, true), btn(T_.chLogY, e => { ly = !ly; ch.setLog('y', ly); e.target.setAttribute('aria-pressed', String(ly)); }, true),
      btn(T_.chZoomIn, () => ch.zoom(2)), btn(T_.chZoomOut, () => ch.zoom(0.5)), btn(T_.chReset, () => ch.reset()), btn('PNG', () => ch.png()), btn('CSV', () => csvDl('masse-rayon-exoplanetes', ['id', 'name', 'mass_earth', 'radius_earth', 'method', 'year', 'estimated_by_mass_radius_relation'], ch.visible().map(p => [p.id, p.c.n, p.c.m, p.c.r, p.c.md, p.c.y, p.c.ec ? 'yes' : 'no']))));
  }
  // 2. Diagramme de Hertzsprung-Russell
  {
    const st = ALL.filter(c => c.k === 'star' && c.te > 0 && c.mv != null && c.te < 60000);
    const ORDER = ['spectral-O', 'spectral-B', 'spectral-A', 'spectral-F', 'spectral-G', 'spectral-K', 'spectral-M', 'white-dwarf', 'brown-dwarf', 'other-star'];
    const COL = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffb56c', '#7fdcff', '#c39bff', '#9aa8c7'];
    const series = ORDER.filter(k => st.some(c => c.s === k)).map(k => ({ key: k, label: T_.sub[k] ?? k, color: COL[ORDER.indexOf(k)] }));
    const { tools, body } = card(T_.chHR, T_.chHRText, T_.chHRSrc);
    const ch = scatter(body, { points: st.map(c => ({ x: c.te, y: c.mv, s: ORDER.includes(c.s) ? c.s : 'other-star', id: c.i, c })), series, file: 'diagramme-hr',
      overlay: [{ x: 5772, y: 4.83, label: lang === 'fr' ? 'Soleil' : 'Sun' }],
      x: { label: T_.chTeff, log: true, reverse: true }, y: { label: T_.chMv, reverse: true }, ariaLabel: T_.chHR, onPick: pick, tapHint: T_.chTap,
      tip: p => `<b>${nm(p.c)}</b><br>T<sub>eff</sub> : ${f(p.c.te)} K<br>M<sub>V</sub> : ${f(p.c.mv)}<br>${T_.subOne[p.c.s] ?? ''}${p.c.d ? ` · ${f(p.c.d)} ${T_.ly}` : ''}` });
    tools.append(btn(T_.chZoomIn, () => ch.zoom(2)), btn(T_.chZoomOut, () => ch.zoom(0.5)), btn(T_.chReset, () => ch.reset()), btn('PNG', () => ch.png()), btn('CSV', () => csvDl('diagramme-hr', ['id', 'name', 'teff_K', 'abs_mag_V', 'class', 'distance_ly'], ch.visible().map(p => [p.id, p.c.n, p.c.te, p.c.mv, p.c.s, p.c.d]))));
  }
  // 3. Découvertes d'exoplanètes par année et par méthode
  {
    const ex = ALL.filter(c => c.k === 'exoplanet' && c.y);
    const y0 = Math.min(...ex.map(c => c.y)), y1 = Math.max(...ex.map(c => c.y)), cats = []; for (let y = y0; y <= y1; y++) cats.push(String(y));
    const cnt = {}; ex.forEach(c => { cnt[c.md] = (cnt[c.md] ?? 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 5);
    const series = [...top, 'other'].map((k, i) => ({ key: k, label: k === 'other' ? T_.chOther : (T_.method[k] ?? k), color: k === 'other' ? PALETTE[9] : PALETTE[i],
      values: cats.map(y => ex.filter(c => String(c.y) === y && (k === 'other' ? !top.includes(c.md) : c.md === k)).length) }));
    const { tools, body } = card(T_.chDisc, T_.chDiscText, T_.chMRSrc);
    const ch = bars(body, { cats, series, yLabel: T_.chCount, file: 'decouvertes-par-an', ariaLabel: T_.chDisc, tip: (c, s, v) => `<b>${c}</b><br>${s.label} : ${v}` });
    tools.append(btn('PNG', () => ch.png()), btn('CSV', () => csvDl('decouvertes-par-an', ['year', ...series.map(s => s.label)], cats.map((c, i) => [c, ...series.map(s => s.values[i])]))));
  }
  // 4. Échelle des distances : de la Lune aux quasars (valeurs des fiches, échelle logarithmique)
  {
    const { tools, body } = card(T_.chScale, T_.chScaleText, T_.chScaleSrc);
    const KM_LY = 9.4607304725808e12, KM_AU = 149597870.7, C_KMS = 299792.458;
    // [id, référence de la distance] — système solaire : demi-grand axe lu dans la fiche ; au-delà : distance de la carte (années-lumière)
    const STEPS = [['moon', 'earth'], ['sun', 'earthSun'], ['mars', 'sun'], ['jupiter', 'sun'], ['neptune', 'sun'], ['pluto', 'sun'], ['proxima-cen', 'sun'], ['sirius-a', 'sun'], ['vega', 'sun'],
      ['pleiades', 'sun'], ['betelgeuse', 'sun'], ['orion-nebula', 'sun'], ['crab-pulsar', 'sun'], ['omega-centauri', 'sun'], ['large-magellanic-cloud', 'sun'], ['andromeda-galaxy', 'sun'],
      ['whirlpool-galaxy', 'sun'], ['virgo-a-m87', 'sun'], ['3c-273', 'sun']];
    const byId = new Map(ALL.map(c => [c.i, c]));
    const n0 = v => v.toLocaleString(lang, { maximumSignificantDigits: 3 });
    const big = v => (v >= 1e9 ? `${n0(v / 1e9)} ${T_.billion}` : v >= 1e6 ? `${n0(v / 1e6)} ${T_.million}` : n0(v));
    // « 2,5 millions d’années-lumière » / « 2.5 million light-years »
    const unit = (v, u) => `${big(v)} ${v >= 1e6 && lang === 'fr' ? 'd’' + u : u}`;
    const fmtDist = km => (km < 0.1 * KM_AU ? `${big(km)} km` : km < 0.05 * KM_LY ? `${n0(km / KM_AU)} ${T_.au}` : unit(km / KM_LY, T_.lyLong));
    const fmtLight = km => { const s = km / C_KMS, y = s / (86400 * 365.25); return s < 60 ? `${n0(s)} s` : s < 3600 ? `${n0(s / 60)} min` : s < 86400 ? `${n0(s / 3600)} h` : y < 1 ? `${n0(s / 86400)} ${T_.days}` : unit(y, y >= 1e6 ? T_.yearsLong : T_.years); };
    const list = el('ol', { class: 'scale' }); body.append(list);
    const rows = [];
    const smaKm = async id => { try { const o = await (await fetch(`/data/o/${id}.json`)).json(); const p = o.props.sma; return p ? (p.u === 'km' ? p.v : p.u === 'UA' ? p.v * KM_AU : null) : null; } catch { return null; } };
    (async () => {
      for (const [id, ref] of STEPS) {
        const c = byId.get(id); if (!c) continue;
        const km = ref === 'earth' || ref === 'earthSun' || (ref === 'sun' && c.d == null) ? await smaKm(ref === 'earthSun' ? 'earth' : id) : c.d * KM_LY;
        if (km) rows.push({ c, km, ref });
      }
      const lo = Math.log10(rows[0].km), hi = Math.log10(rows.at(-1).km);
      list.replaceChildren(...rows.map((r, i) => {
        const w = 4 + 96 * (Math.log10(r.km) - lo) / (hi - lo), prev = rows[i - 1];
        return el('li', {},
          el('div', { class: 'sc-head' }, el('a', { href: objPath(r.c.i), onclick: e => { e.preventDefault(); pick(r.c.i); }, text: nm(r.c) }),
            el('span', { class: 'sc-ref', text: T_.scRef[r.ref] }), el('b', { text: fmtDist(r.km) })),
          el('div', { class: 'sc-bar', style: `width:${w.toFixed(1)}%`, 'aria-hidden': 'true' }),
          el('div', { class: 'sc-meta', text: `${T_.scLight} ${fmtLight(r.km)}${prev ? ` · ${T_.scTimes(n0(r.km / prev.km))}` : ''}` }));
      }));
      tools.append(btn('CSV', () => csvDl('echelle-des-distances', ['id', 'name', 'distance_km', 'distance_au', 'distance_ly', 'light_travel_time_s', 'measured_from'],
        rows.map(r => [r.c.i, r.c.n, r.km, r.km / KM_AU, r.km / KM_LY, r.km / C_KMS, r.ref === 'earth' || r.ref === 'earthSun' ? 'Earth' : 'Sun']))));
    })();
    // répartition de tout le catalogue par tranche de distance (puissances de 10 en années-lumière)
    const withD = ALL.filter(c => c.d > 0 && ['exoplanet', 'star', 'region'].includes(c.k));
    const dec = c => Math.max(0, Math.min(9, Math.floor(Math.log10(c.d))));
    const cats = Array.from({ length: 10 }, (_, i) => (i === 0 ? `< 10` : i === 9 ? `≥ 10⁹` : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[i]}–10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[i + 1]}`));
    const series = [['star', T_.cat.star, PALETTE[1]], ['exoplanet', T_.exoShort, PALETTE[0]], ['region', T_.cat.region, PALETTE[2]]].map(([k, label, color]) =>
      ({ key: k, label, color, values: cats.map((_, i) => withD.filter(c => c.k === k && dec(c) === i).length) }));
    body.append(el('h4', { class: 'sc-h', text: T_.scHist }));
    const hb = el('div'); body.append(hb);
    bars(hb, { cats, series, yLabel: T_.scCount, file: 'distances-catalogue', ariaLabel: T_.scHist, tip: (c, s, v) => `<b>${c} ${T_.ly}</b><br>${s.label} : ${v}` });
  }
}

/* ---------- recherche SIMBAD en direct (pour les objets absents du catalogue local) ---------- */
function drawSimbadBox() {
  const box = $('#simbadBox'), q = state.q.trim();
  if (q.length < 2 || PANELS.has(state.cat)) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(el('button', { class: 'btn', type: 'button', onclick: () => runSimbad(q) }, t().simbadBtn(q)), el('span', { class: 'credit', text: ' ' + t().simbadHint }));
}
async function runSimbad(q) {
  const box = $('#simbadBox'), T_ = t();
  box.replaceChildren(el('p', { class: 'na', text: T_.loading }));
  try {
    const r = await getJson(`/api/simbad?q=${encodeURIComponent(q)}`);
    if (!r.found) { box.replaceChildren(el('p', {}, T_.simbadNone(q)), el('a', { href: `https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=${encodeURIComponent(q)}`, target: '_blank', rel: 'noopener', text: 'SIMBAD' })); return; }
    const local = ALL.find(c => norm(c.c) === norm(r.main_id) || norm(c.n) === norm(r.main_id));
    const f = v => v.toLocaleString(lang, { maximumSignificantDigits: 5 });
    const img = r.ra != null ? `https://skyview.gsfc.nasa.gov/cgi-bin/images?Position=${r.ra},${r.dec}&Survey=DSS2+Red&Size=0.12&Pixels=240&Return=JPEG&Scaling=Log` : null;
    box.replaceChildren(el('div', { class: 'sb-card' },
      img ? el('div', { class: 'sb-pic' }, el('img', { src: img, alt: `${T_.skyBadge} ${r.main_id}`, loading: 'lazy' }), el('span', { class: 'crosshair', 'aria-hidden': 'true' })) : '',
      el('div', {}, el('h3', { text: r.main_id }), el('p', { class: 'credit', text: [r.otype_label ?? r.otype, r.sp_type && `${T_.p.sptype} ${r.sp_type}`, r.vmag && `V = ${r.vmag}`, r.distance_pc && `${f(r.distance_pc * 3.26156)} ${T_.ly}`].filter(Boolean).join(' · ') }),
        el('p', { class: 'credit', text: `RA ${r.ra}°, Dec ${r.dec}° (ICRS)` }), el('p', { class: 'credit', text: r.ids.slice(0, 8).join(' · ') }),
        el('p', {}, local ? el('a', { href: objPath(local.i), onclick: e => { e.preventDefault(); openObj(local.i, true); }, text: T_.simbadLocal }) : '', local ? ' · ' : '',
          el('a', { href: r.url, target: '_blank', rel: 'noopener', text: T_.simbadOpen })),
        el('p', { class: 'credit', text: T_.simbadSrc }))));
  } catch { box.replaceChildren(el('p', { class: 'na', text: T_.liveErr })); }
}

$('#dlg').addEventListener('close', () => {
  stopIss();
  $('#dlgBody').querySelectorAll('iframe').forEach(f => f.remove()); // coupe la vidéo en direct à la fermeture de la fiche
  document.title = t().title;
  document.getElementById('ssr')?.remove(); // contenu pré-rendu de la page /objet/<id> (pour les moteurs de recherche)
  if (curObj()) { history.state?.o ? history.back() : history.replaceState(null, '', '/'); }
});
$('#dlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
addEventListener('popstate', () => {
  const sp = new URLSearchParams(location.search), id = curObj(), c = sp.get('cmp');
  if (c) { cmpSet(c.split(',').filter(Boolean)); openCompare(false); return; }
  if ($('#cmpDlg').open) $('#cmpDlg').close();
  if (id) openObj(id, false); else if ($('#dlg').open) { $('#dlg').close(); }
});

/* ---------- export CSV des résultats filtrés + citation d'une fiche ---------- */
function downloadCsv() {
  const cell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['id', 'name', 'name_fr', 'category', 'subcategory', 'catalog_code', 'mass_earth_masses', 'radius_earth_radii', 'distance_light_years', 'temperature_K', 'discovery_year', 'discovery_method', 'url'];
  const rows = VIEW.map(c => [c.i, c.n, c.nf ?? '', c.k, c.s, c.c, c.m ?? '', c.r ?? '', c.d ?? '', c.q ?? '', c.y ?? '', c.md ?? '', `${location.origin}${objPath(c.i)}`]);
  const csv = String.fromCharCode(0xfeff) + [head, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
  const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `encyclopedie-spatiale-${state.cat}-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove();
}
function citeBox(o, title) {
  const T_ = t(), ver = META?.version ?? '', today = new Date().toISOString().slice(0, 10);
  const url = `${location.origin}${objPath(o.id)}`, year = today.slice(0, 4), src = srcOf(o).name;
  const text = `${T_.siteName} (${year}). ${title}${o.code ? ` [${o.code}]` : ''}. ${T_.siteName}, version ${ver}. ${url} (${T_.accessed} ${today}). ${lang === 'fr' ? 'Données : ' : 'Data: '}${src}.`;
  const key = `encyclopedie_spatiale_${o.id}`.replace(/[^A-Za-z0-9_]/g, '_');
  const bib = `@misc{${key},\n  title = {${title}${o.code ? ` [${o.code}]` : ''}},\n  author = {{${T_.siteName}}},\n  year = {${year}},\n  howpublished = {\\url{${url}}},\n  note = {Version ${ver}; ${T_.accessed} ${today}; data: ${src}}\n}`;
  const copy = (txt, btn) => async () => { try { await navigator.clipboard.writeText(txt); btn.textContent = T_.citeCopied; } catch { /* presse-papiers indisponible */ } };
  const b1 = el('button', { class: 'btn', type: 'button', text: T_.citeCopy }), b2 = el('button', { class: 'btn', type: 'button', text: `${T_.citeCopy} BibTeX` });
  b1.onclick = copy(text, b1); b2.onclick = copy(bib, b2);
  return el('div', { class: 'cite-box', hidden: true }, el('p', { class: 'credit', text: T_.citeHint }),
    el('textarea', { readonly: true, 'aria-label': T_.citeTitle }, text), b1, el('textarea', { readonly: true, 'aria-label': T_.citeBib }, bib), b2);
}

/* ---------- comparateur : 2 à 3 objets côte à côte, tailles à l'échelle, URL partageable (?cmp=a,b,c) ---------- */
const CMP_MAX = 3;
let cmp = [];
const cmpNames = new Map(); // id -> nom (pour le bandeau)
function cmpSet(next) { cmp = next.slice(0, CMP_MAX); drawTray(); document.querySelectorAll('.cmp-add').forEach(b => b.setAttribute('aria-pressed', String(cmp.includes(b.dataset.id)))); }
function cmpToggle(id, name) {
  cmpNames.set(id, name);
  return el('button', { class: 'cmp-add', type: 'button', 'data-id': id, 'aria-pressed': String(cmp.includes(id)), title: t().cmpAdd, 'aria-label': `${t().cmpAdd} : ${name}`,
    onclick: e => { e.stopPropagation(); cmpSet(cmp.includes(id) ? cmp.filter(x => x !== id) : cmp.length >= CMP_MAX ? cmp : [...cmp, id]); if (!cmp.includes(id) && cmp.length >= CMP_MAX) flashTray(); } }, '⚖');
}
function flashTray() { const tr = $('#cmpTray'); tr.classList.add('full'); setTimeout(() => tr.classList.remove('full'), 900); }
function drawTray() {
  const tr = $('#cmpTray'), T_ = t();
  tr.hidden = cmp.length === 0;
  tr.replaceChildren(el('b', { text: `${T_.cmpTitle} (${cmp.length}/${CMP_MAX})` }),
    ...cmp.map(id => el('span', { class: 'chip' }, cmpNames.get(id) ?? id, el('button', { type: 'button', 'aria-label': `${T_.cmpRemove} ${cmpNames.get(id) ?? id}`, onclick: () => cmpSet(cmp.filter(x => x !== id)), text: '✕' }))),
    el('button', { class: 'btn', type: 'button', disabled: cmp.length < 2, onclick: () => openCompare(true), text: cmp.length < 2 ? T_.cmpNeed : T_.cmpGo }),
    el('button', { class: 'btn', type: 'button', onclick: () => cmpSet([]), text: T_.cmpClear }));
}
const R_KM = { 'km': 1, 'R⊕': 6371, 'R☉': 695700 };
const radiusKm = o => (o.props.radius ? o.props.radius.v * (R_KM[o.props.radius.u] ?? NaN) : o.props.diameter ? o.props.diameter.v / 2 : null);
const CMP_ROWS = ['mass', 'mass_kg', 'radius', 'diameter', 'density', 'gravity', 'teq', 'teff', 'period', 'sma', 'ecc', 'dist', 'vmag', 'sptype', 'abs_mag', 'launch'];
function sizeSvg(items, log) {
  const W = 600, H = 230, base = 190;
  const vals = items.map(i => i.r).filter(Boolean); if (!vals.length) return '';
  const rmax = Math.max(...vals), maxPx = 90, colors = ['#6ea8ff', '#ffd36e', '#5ed6a4'];
  const px = r => (log ? Math.max(2, 14 + (Math.log10(r / Math.min(...vals) || 1) / (Math.log10(rmax / Math.min(...vals)) || 1)) * (maxPx - 14)) : Math.max(1.5, r / rmax * maxPx));
  const slot = W / items.length;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t().cmpScale}">` + items.map((it, k) => {
    const cx = slot * k + slot / 2, c = colors[k];
    if (!it.r) return `<text x="${cx}" y="${base - 20}" text-anchor="middle" fill="#9aa8c7" font-size="12">${t().na}</text><text x="${cx}" y="${H - 6}" text-anchor="middle" fill="#e8eefc" font-size="13">${it.name}</text>`;
    const r = px(it.r);
    return `<circle cx="${cx}" cy="${base - r}" r="${r.toFixed(1)}" fill="${c}22" stroke="${c}" stroke-width="1.6"/>`
      + `<text x="${cx}" y="${H - 6}" text-anchor="middle" fill="#e8eefc" font-size="13">${it.name}</text>`
      + `<text x="${cx}" y="${base + 12}" text-anchor="middle" fill="#9aa8c7" font-size="11">R = ${fmt(it.r)} km</text>`;
  }).join('') + '</svg>';
}
async function openCompare(push) {
  const dlg = $('#cmpDlg'), body = $('#cmpBody'), T_ = t();
  if (cmp.length < 2) return;
  if (push) history.pushState({ cmp }, '', `/?cmp=${cmp.join(',')}`);
  body.replaceChildren(el('p', { text: T_.loading }));
  if (!dlg.open) dlg.showModal();
  let objs;
  try { objs = await Promise.all(cmp.map(id => fetch(`/data/o/${encodeURIComponent(id)}.json`).then(r => r.json()))); }
  catch { body.replaceChildren(el('p', { text: T_.err })); return; }
  objs.forEach(o => cmpNames.set(o.id, lang === 'fr' && o.nameFr ? o.nameFr : o.name)); drawTray();
  const items = objs.map(o => ({ name: cmpNames.get(o.id), r: radiusKm(o) }));
  let log = false;
  const sizes = el('div', { class: 'cmp-sizes' });
  const drawSizes = () => {
    sizes.innerHTML = sizeSvg(items, log);
    const ref = items[0]; const lines = [];
    const f3 = q => q.toLocaleString(lang, { maximumSignificantDigits: 3 });
    for (let i = 1; i < items.length; i++) if (ref.r && items[i].r) { const q = items[i].r / ref.r; lines.push(q >= 1 ? T_.cmpBigger(items[i].name, ref.name, f3(q)) : T_.cmpSmaller(items[i].name, ref.name, f3(1 / q))); }
    sizes.append(el('p', { class: 'credit', text: log ? T_.cmpLog : T_.cmpLinear }), ...lines.map(l => el('p', { class: 'cmp-ratio', text: l })));
  };
  drawSizes();
  const rows = CMP_ROWS.filter(k => objs.some(o => o.props[k]));
  const table = el('table', { class: 'props cmp-table' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: '' }), ...objs.map(o => el('th', { scope: 'col' }, el('a', { href: objPath(o.id), onclick: e => { e.preventDefault(); dlg.close(); openObj(o.id, true); }, text: cmpNames.get(o.id) }), el('div', { class: 'credit', text: o.code }))))),
    el('tbody', {}, rows.map(k => el('tr', {}, el('th', { scope: 'row', text: T_.p[k] ?? k }),
      ...objs.map(o => el('td', { class: o.props[k] ? '' : 'na', text: o.props[k] ? fmtProp(k, o.props[k]) : T_.na }))))));
  const pics = el('div', { class: 'cmp-pics' }, objs.map(o => el('div', { class: 'cmp-pic' }, o.image ? el('img', { src: o.image.thumb ?? o.image.url, alt: o.name, loading: 'lazy' }) : orb(o.sub))));
  body.replaceChildren(
    el('button', { class: 'btn close', type: 'button', onclick: () => dlg.close(), 'aria-label': T_.close, text: '✕' }),
    el('h2', { id: 'cmpTitle', text: `${T_.cmpTitle} : ${objs.map(o => cmpNames.get(o.id)).join(' · ')}` }),
    pics, el('h3', { class: 'cmp-h', text: T_.cmpSizes }),
    el('label', { class: 'chk' }, el('input', { type: 'checkbox', onchange: e => { log = e.target.checked; drawSizes(); } }), el('span', { text: ' ' + T_.cmpLogLabel })),
    sizes, el('h3', { class: 'cmp-h', text: T_.sec.props }), el('div', { class: 'cmp-scroll' }, table),
    el('p', { class: 'credit', text: T_.cmpSrc }),
    el('p', {}, el('a', { href: `/?cmp=${cmp.join(',')}`, onclick: async e => { e.preventDefault(); try { await navigator.clipboard.writeText(location.href); e.target.textContent = T_.cmpCopied; } catch { /* presse-papiers indisponible */ } }, text: T_.cmpShare })));
}
$('#cmpDlg').addEventListener('close', () => { if (new URLSearchParams(location.search).get('cmp')) { history.state?.cmp ? history.back() : history.replaceState(null, '', location.pathname); } });
$('#cmpDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

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
  applyLang(); apply(); drawTray();
  const id = curObj(); if ($('#dlg').open && id) openObj(id, false);
  if ($('#cmpDlg').open) openCompare(false);
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
$('#exportCsv').addEventListener('click', downloadCsv);
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
const askedCat = new URLSearchParams(location.search).get('cat'); // ?cat=event, ?cat=charts… (liens des parcours)
if (TOP.includes(askedCat)) state.cat = askedCat;
applyLang(); apply();
const first = curObj(), firstCmp = new URLSearchParams(location.search).get('cmp');
if (firstCmp) { cmpSet(firstCmp.split(',').filter(Boolean)); openCompare(false); }
else if (first) openObj(first, false);
