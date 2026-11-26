// Import SIMBAD (CDS) : étoiles hôtes d'exoplanètes, étoiles visibles à l'œil nu (V<4), étoiles proches (parallaxe ≥ 200 mas),
// objets compacts emblématiques, catalogue Messier et objets NGC/IC célèbres.
// -> data/simbad.json (schéma commun). Nécessite data/exoplanets.json (liste des étoiles hôtes).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, writeJson, slug, getText } from './lib/common.mjs';
import { tap, sq } from './lib/simbad.mjs';
import { CURATED, NGC_FAMOUS, MESSIER_NAMES, FR_NAMES } from './simbad-curated.mjs';

const today = new Date().toISOString().slice(0, 10);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const BASE = `select b.oid, b.main_id, b.otype, b.ra, b.dec, b.sp_type, b.plx_value, b.plx_err, b.galdim_majaxis, b.galdim_minaxis,
  b.morph_type, b.rvz_redshift, b.update_date, f.flux as vmag`;
const FROM = `from basic b left join flux f on f.oidref = b.oid and f.filter = 'V'`;

const objs = new Map(); // oid -> { row, why:Set, hostNames:Set, curated }
const add = (row, why, extra = {}) => {
  const o = objs.get(row.oid) ?? { row, why: new Set(), hostNames: new Set(), ...{} };
  o.why.add(why); Object.assign(o, extra); objs.set(row.oid, o); return o;
};

// ---- 1. étoiles hôtes (noms NASA ; repli sur HD / HIP / TIC / Gaia) ----
const exo = JSON.parse(await readFile(join(DATA_DIR, 'exoplanets.json'), 'utf8')).objects;
const hosts = new Map(); // hostname -> premier objet exoplanète
for (const p of exo) if (p.host && !hosts.has(p.host)) hosts.set(p.host, p);
const keyOf = (h, p) => [h, ...(p.aliases ?? []).filter(a => /^(HD|HIP) /.test(a))];
const lookup = new Map(); // identifiant -> hostname
for (const [h, p] of hosts) for (const k of keyOf(h, p)) if (!lookup.has(k)) lookup.set(k, h);
let found = 0; const hostFound = new Set();
for (const ids of chunk([...lookup.keys()], 150)) {
  const rows = await tap(`${BASE}, i.id as qid ${FROM} join ident i on i.oidref = b.oid where i.id in (${ids.map(sq).join(',')})`);
  for (const r of rows) {
    const h = lookup.get(r.qid); if (!h) continue;
    const o = add(r, 'host'); o.hostNames.add(h); hostFound.add(h);
  }
  found += ids.length; process.stdout.write(`\r  hôtes: ${found}/${lookup.size}`);
}
console.log(`\n  étoiles hôtes trouvées dans SIMBAD : ${hostFound.size}/${hosts.size}`);

// ---- 2. brillantes, proches ----
for (const r of await tap(`${BASE} ${FROM} where f.filter = 'V' and f.flux < 4`)) add(r, 'bright'); // V < 4 : toutes les étoiles des figures de constellations courantes
for (const r of await tap(`${BASE} ${FROM} where b.plx_value >= 200`)) add(r, 'near');
console.log(`  après brillantes/proches : ${objs.size} objets`);

// ---- 3. curés : compacts, Messier, NGC/IC célèbres ----
const curated = [...CURATED, ...NGC_FAMOUS];
for (let n = 1; n <= 110; n++) curated.push({ q: [`M ${String(n).padStart(3)}`], messier: n, ...(MESSIER_NAMES[n]?.[0] ? { name: MESSIER_NAMES[n][0], fr: MESSIER_NAMES[n][1] } : {}) });
const qmap = new Map(); // identifiant -> entrée
for (const c of curated) for (const q of c.q) qmap.set(q, c);
for (const ids of chunk([...qmap.keys()], 150)) {
  const rows = await tap(`${BASE}, i.id as qid ${FROM} join ident i on i.oidref = b.oid where i.id in (${ids.map(sq).join(',')})`);
  for (const r of rows) { const c = qmap.get(r.qid); if (c) add(r, 'curated', { cur: { ...(objs.get(r.oid)?.cur ?? {}), ...c } }); }
}
const missed = curated.filter(c => ![...objs.values()].some(o => o.cur === c || (o.cur && o.cur.q === c.q)));
console.log(`  après objets curés : ${objs.size} objets (${curated.length - missed.length}/${curated.length} curés trouvés)`);
if (missed.length) console.log('  introuvables :', missed.map(c => c.q[0]).join(' | '));

// ---- 4. noms, alias, distances, Teff ----
const oids = [...objs.keys()];
const names = new Map(), aliases = new Map();
for (const ids of chunk(oids, 300)) {
  const rows = await tap(`select oidref, id from ident where oidref in (${ids.join(',')}) and (id like 'NAME %' or id like 'HD %' or id like 'HIP %' or id like 'NGC %' or id like 'IC %' or id like 'M %' or id like 'GJ %' or id like 'Gaia DR3 %')`);
  for (const r of rows) {
    const id = r.id.replace(/\s+/g, ' ').trim();
    if (id.startsWith('NAME ')) { (names.get(r.oidref) ?? names.set(r.oidref, []).get(r.oidref)).push(id.slice(5)); }
    else (aliases.get(r.oidref) ?? aliases.set(r.oidref, []).get(r.oidref)).push(id);
  }
  process.stdout.write(`\r  noms: ${Math.min(oids.length, 300 * (1 + chunk(oids, 300).indexOf(ids)))}/${oids.length}`);
}
console.log();
const detailOids = oids.filter(k => { const o = objs.get(k); return o.why.has('bright') || o.why.has('near') || o.why.has('curated'); });
const dist = new Map(), teff = new Map();
const UNIT = { pc: 1, kpc: 1e3, mpc: 1e6, gpc: 1e9 };
for (const ids of chunk(detailOids, 300)) {
  for (const r of await tap(`select oidref, dist, unit, bibcode, minus_err, plus_err from mesDistance where oidref in (${ids.join(',')})`)) {
    const f = UNIT[r.unit.trim().toLowerCase()]; const d = Number(r.dist) * f; if (!f || !(d > 0)) continue;
    (dist.get(r.oidref) ?? dist.set(r.oidref, []).get(r.oidref)).push({ pc: d, bib: r.bibcode, em: Number(r.minus_err) * f || null, ep: Number(r.plus_err) * f || null });
  }
  for (const r of await tap(`select oidref, teff, bibcode from mesFe_h where oidref in (${ids.join(',')}) and teff is not null`)) {
    (teff.get(r.oidref) ?? teff.set(r.oidref, []).get(r.oidref)).push({ v: Number(r.teff), bib: r.bibcode });
  }
}
const median = arr => { const s = [...arr].sort((a, b) => a.v - b.v); return s[Math.floor(s.length / 2)]; };

// ---- 5. classification ----
const GAL = new Set(['G', 'GiC', 'GiG', 'GiP', 'LIN', 'SyG', 'Sy1', 'Sy2', 'AGN', 'Sy*', 'BiC', 'rG', 'SBG', 'H2G', 'LSB', 'EmG', 'QSO', 'Bla', 'BLL', 'Seyfert_1', 'Seyfert_2', 'StarburstG', 'PartofG', 'BClG', 'IG']);
const STAR_EXTRA = new Set(['EB?', 'mul', 'LXB', 'HXB', 'XB', 'LMXB', 'HMXB', 'CV*', 'Sy*']);
const CLUSTER_G = new Set(['ClG', 'GrG', 'CGG', 'PaG', 'SCG', 'ClG?']);
const NEB = new Set(['PN', 'Neb', 'HII', 'RNe', 'SNR', 'DNe', 'EmO', 'MoC', 'Cld', 'ISM', 'bub', 'SFR', 'HH', 'PN?', 'SNR?', 'Cl*', 'cor', 'glb', 'CGb']);
const STARS = /\*|^(Psr|Mi|Er|Pu|RR|Ce|Or|FU|TT|Be|Em|BY|RS|Ir|Fl|dS|bC|gD|gB|Al|Ro|Ae|SN|Pe|HB|HS|sg|s\*|sd|Ma|Y\*|C\*|S\*|HV|No|Hv|BD|WD|N\*|AB|TT|Ev|LP|PM|Pl|Er)/;
function classify(o) {
  const t = o.row.otype, cur = o.cur ?? {};
  if (cur.sub) return { cat: cur.cat ?? 'star', sub: cur.sub };
  if (/^(OpC|Cl\*|MGr|As\*)$/.test(t)) return { cat: 'region', sub: 'open-cluster' };
  if (t === 'GlC') return { cat: 'region', sub: 'globular-cluster' };
  if (CLUSTER_G.has(t)) return { cat: 'region', sub: 'galaxy-cluster' };
  if (GAL.has(t)) return { cat: 'region', sub: 'galaxy' };
  if (NEB.has(t)) return { cat: 'region', sub: 'nebula' };
  if (t === 'WD*' || t === 'WD?') return { cat: 'star', sub: 'white-dwarf' };
  if (t === 'N*' || t === 'N*?') return { cat: 'star', sub: 'neutron-star' };
  if (t === 'Psr' || t === 'Psr?') return { cat: 'star', sub: 'pulsar' };
  if (t === 'BH' || t === 'BH?' || t === 'BHCand') return { cat: 'star', sub: 'black-hole' };
  if (t === 'BD*' || t === 'BD?' || t === 'brownD*') return { cat: 'star', sub: 'brown-dwarf' };
  if (STARS.test(t) || STAR_EXTRA.has(t) || t === 'Star' || t === 'SB*' || t === 'EB*' || t === 'V*') {
    const m = (o.row.sp_type || '').match(/^[a-z]*([OBAFGKM])/);
    return { cat: 'star', sub: m ? `spectral-${m[1]}` : 'other-star' };
  }
  return { cat: 'other', sub: 'other-object' };
}
const LUM = [[/^(Ia\+|Iab|Ia|Ib|I)(?![a-zA-Z])/, 'supergiant'], [/^III/, 'giant'], [/^II(?![I])/, 'bright-giant'], [/^IV/, 'subgiant'], [/^VII/, 'white-dwarf-class'], [/^VI/, 'subdwarf'], [/^V/, 'main-sequence']];
function lumTag(sp) {
  const rest = (sp || '').replace(/^[a-z]*[OBAFGKM][0-9.]*(?:[-/][OBAFGKM]?[0-9.]*)?/, '').replace(/^[:?\s]+/, '');
  for (const [re, tag] of LUM) if (re.test(rest)) return tag;
  return null;
}

// ---- 6. construction des objets ----
const SIM = { id: 'simbad', name: 'SIMBAD (CDS)', url: 'https://simbad.cds.unistra.fr/' };

// ---- noms officiels des étoiles : catalogue de l'UAI (IAU-CSN, groupe de travail WGSN ; CC BY) ----
// SIMBAD donne souvent plusieurs noms pour une même étoile (« Polaris », « North Star », « Lodestar »…) sans dire lequel est officiel :
// le nom de l'UAI est prioritaire. Correspondance par numéro HIP ou HD. En cas d'échec du téléchargement, on garde le choix SIMBAD.
const IAU_URL = 'https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt';
const iauByCat = new Map();
try {
  const txt = await getText(IAU_URL, { headers: { 'User-Agent': 'EncyclopedieSpatiale/1.0 (https://github.com/ferrettitufanojason-cpu/encyclopedie-spatiale)' }, cacheKey: 'iau-csn.txt', ttlHours: 24 });
  for (const line of txt.split('\n')) {
    if (!line.trim() || /^[#$]/.test(line)) continue;
    const t = line.trim().split(/\s+/); if (t.at(-1) === '*') t.pop();
    const hd = t.at(-4), hip = t.at(-5), name = line.slice(18, 36).trim(); // colonnes : nom ASCII (0-17), nom avec diacritiques (18-35)
    if (!name) continue;
    if (/^\d+$/.test(hip)) iauByCat.set(`HIP ${hip}`, name);
    if (/^\d+$/.test(hd)) iauByCat.set(`HD ${hd}`, name);
  }
  console.log(`  noms officiels UAI : ${new Set(iauByCat.values()).size}`);
} catch (e) { console.warn('  ⚠ catalogue des noms de l’UAI indisponible :', e.message, '(noms SIMBAD conservés)'); }
const out = [];
const clean = s => s.replace(/^(\*{1,2}|V\*|NAME|\*\*)\s+/, '').replace(/\s+/g, ' ').trim();
// Abréviations SIMBAD des lettres de Bayer -> lettres grecques (affichage uniquement ; le code SIMBAD reste affiché tel quel)
const GREEK = { alf: 'α', bet: 'β', gam: 'γ', del: 'δ', eps: 'ε', zet: 'ζ', eta: 'η', tet: 'θ', iot: 'ι', kap: 'κ', lam: 'λ', 'mu.': 'μ', 'nu.': 'ν', ksi: 'ξ', omi: 'ο', 'pi.': 'π', rho: 'ρ', sig: 'σ', tau: 'τ', ups: 'υ', phi: 'φ', khi: 'χ', psi: 'ψ', ome: 'ω' };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const greek = s => s.replace(/^([a-z.]{3})(\d{2})? /, (m, g, n) => GREEK[g] ? GREEK[g] + (n && n !== '00' ? [...String(Number(n))].map(d => SUP[d]).join('') : '') + ' ' : m);
const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
// Un nom de l'UAI ne va qu'à UN objet : si plusieurs entrées SIMBAD partagent le même numéro HIP/HD (étoile double, source X…),
// le nom va à la plus brillante ; les autres gardent leur désignation (pas de doublons de noms dans l'encyclopédie).
const iauOwner = new Map(), iauBest = new Map();
for (const [oid, o] of objs) {
  if (classify(o).cat !== 'star') continue;
  const name = (aliases.get(oid) ?? []).map(a => iauByCat.get(a)).find(Boolean); if (!name) continue;
  const v = num(o.row.vmag) ?? 99, cur = iauBest.get(name);
  if (!cur || v < cur.v) iauBest.set(name, { oid, v });
}
for (const [name, { oid }] of iauBest) iauOwner.set(oid, name);
for (const [oid, o] of objs) {
  const r = o.row, { cat, sub } = classify(o);
  const nm = names.get(oid) ?? [];
  const main = clean(r.main_id);
  const hostName = [...o.hostNames][0];
  const pickName = () => nm.find(n => /(Galaxy|Nebula|Cluster|Cloud|Pulsar|Group)/.test(n) && n !== n.toUpperCase()) ?? nm.find(n => n !== n.toUpperCase()) ?? nm[0];
  const best = pickName();
  const baseName = o.cur?.name ?? hostName ?? best ?? main; // sert à l'identifiant (stable : les adresses /objet/… ne changent pas)
  // Nom affiché : le nom propre officiel de SIMBAD (« Aldebaran ») passe avant le nom de catalogue de l'étoile hôte
  // d'exoplanète (« alf Tau ») ; seulement un vrai nom propre (sans chiffres), pas une désignation comme « Kepler-452 ».
  const iau = iauOwner.get(oid) ?? null;
  const shown = o.cur?.name ?? iau ?? (hostName && best && !/\d/.test(best) ? best : baseName);
  const display = shown === main ? greek(main) : shown;
  const ref = bib => ({ t: bib, url: `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(bib)}/abstract` });
  const props = {};
  const P = (k, v, u, g, extra = {}) => { if (v != null) props[k] = { v, u, g, s: 'simbad', ...extra }; };
  const plx = num(r.plx_value);
  if (plx && plx > 0 && (cat === 'star')) {
    const e = num(r.plx_err), d = 1000 / plx, ok = e && plx - e > 0 && e / plx < 0.5; // incertitude fournie seulement si la parallaxe est fiable
    P('dist', +d.toPrecision(5), 'pc', 'sys', { calc: true, calcNote: 'plx', ...(ok ? { ep: +(1000 / (plx - e) - d).toPrecision(2), em: -+(d - 1000 / (plx + e)).toPrecision(2) } : {}) });
  }
  const dd = dist.get(oid);
  if (cat === 'region' && dd?.length) { const m = median(dd.map(x => ({ v: x.pc, bib: x.bib }))); P('dist', m.v, 'pc', 'sys', { ref: ref(m.bib), note: { fr: `médiane de ${dd.length} mesure(s)`, en: `median of ${dd.length} measurement(s)` } }); }
  const v = num(r.vmag); P('vmag', v, 'mag', 'sys');
  const ma = num(r.galdim_majaxis), mi = num(r.galdim_minaxis);
  if (ma) P('ang_major', ma, 'arcmin', 'sys'); if (mi) P('ang_minor', mi, 'arcmin', 'sys');
  const z = num(r.rvz_redshift); if (z != null && cat === 'region') P('redshift', z, '', 'sys');
  const tf = cat === 'star' ? teff.get(oid) : null; if (tf?.length) { const m = median(tf); P('teff', m.v, 'K', 'star', { ref: ref(m.bib), note: { fr: `médiane de ${tf.length} mesure(s)`, en: `median of ${tf.length} measurement(s)` } }); }
  if (r.sp_type) props.sptype = { t: r.sp_type, g: 'star', s: 'simbad' };
  if (r.morph_type) props.morph = { t: r.morph_type, g: 'sys', s: 'simbad' };

  const tags = [cat, sub, r.otype];
  const lt = cat === 'star' ? lumTag(r.sp_type) : null; if (lt) tags.push(lt);
  if (o.hostNames.size) tags.push('exoplanet-host');
  if (o.cur?.tags) tags.push(...o.cur.tags);
  out.push({
    id: slug(baseName) || `simbad-${oid}`, cat, sub, name: display, code: main, aliases: [...new Set([main, hostName, ...nm, ...(aliases.get(oid) ?? [])].filter(a => a && a !== display))].slice(0, 12),
    tags: [...new Set(tags.filter(Boolean))], otype: r.otype,
    hostNames: [...o.hostNames], ra: num(r.ra), dec: num(r.dec), messier: o.cur?.messier ?? undefined,
    props, src: 'simbad', updated: r.update_date || today, simbadId: r.main_id, ...((o.cur?.fr ?? FR_NAMES[display]) ? { nameFr: o.cur?.fr ?? FR_NAMES[display] } : {}),
    _iau: !!iau,
  });
}
// Pas deux fiches avec le même nom affiché : le nom officiel de l'UAI (ou, à défaut, le premier objet) le garde ;
// les autres reprennent leur désignation de catalogue (ex. le système « β Sco » face à l'étoile Acrab).
const byName = new Map(); for (const o of out) (byName.get(o.name) ?? byName.set(o.name, []).get(o.name)).push(o);
for (const list of byName.values()) {
  if (list.length < 2) continue;
  const keep = list.find(o => o._iau) ?? list[0];
  for (const o of list) if (o !== keep) { const alt = greek(o.code); if (alt !== o.name) { o.aliases = [...new Set([o.name, ...o.aliases])].filter(a => a !== alt).slice(0, 12); o.name = alt; delete o.nameFr; } }
}
for (const o of out) delete o._iau;
// compacts et régions d'abord pour garder l'id le plus « propre » en cas de collision
await writeJson('simbad.json', { source: { ...SIM, license: 'Données CDS (usage libre avec citation, voir cds.unistra.fr/cds-aknowledgement)', fetched: today, query: 'SIMBAD TAP (ADQL)' }, objects: out });
const c = {}; for (const o of out) c[`${o.cat}/${o.sub}`] = (c[`${o.cat}/${o.sub}`] ?? 0) + 1;
console.log(c);
