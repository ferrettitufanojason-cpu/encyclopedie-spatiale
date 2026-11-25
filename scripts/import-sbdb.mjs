// Import JPL Small-Body Database (API sbdb_query) : astéroïdes (≥ 50 km, potentiellement dangereux, visités par sonde),
// comètes périodiques numérotées + comètes célèbres + interstellaires, objets numérotés de la ceinture de Kuiper (TNO).
// -> data/small-bodies.json
import { writeJson, slug } from './lib/common.mjs';

const API = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const FIELDS = 'full_name,pdes,name,prefix,kind,neo,pha,H,M1,diameter,albedo,rot_per,a,e,i,om,w,per,q,ad,class,spec_B,spec_T,first_obs,epoch,moid,condition_code';
const today = new Date().toISOString().slice(0, 10);
const SKIP = new Set(['134340', '136199', '136108', '136472']); // Pluton, Éris, Hauméa, Makémaké : déjà importés (planètes naines)

async function query(params, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(`${API}?${new URLSearchParams({ fields: FIELDS, ...params })}`, { headers: { 'User-Agent': 'encyclopedie-spatiale-import/0.1' }, signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 150)}`);
      const j = await r.json(); const f = j.fields;
      return (j.data ?? []).map(row => Object.fromEntries(f.map((k, i) => [k, row[i]])));
    } catch (e) { if (t === tries - 1) throw e; await new Promise(r => setTimeout(r, 2000 * (t + 1))); }
  }
}
const OR = pdes => JSON.stringify({ OR: pdes.map(p => `pdes|EQ|${p}`) });

// astéroïdes explorés par des sondes ou emblématiques (numéros officiels)
const VISITED = ['1', '2', '4', '10', '16', '21', '216', '243', '253', '433', '951', '2867', '4179', '5535', '9969', '25143', '65803', '99942', '101955', '152830', '162173', '3200', '52246', '486958', '2060', '2101', '3122', '3552', '8405', '5261', '3353', '4015', '1862'];
// comètes célèbres non numérotées ou à désignation particulière
const COMETS = ['1995 O1', '1996 B2', '2012 S1', '2020 F3', '2011 W3', '2006 P1', '2019 Y4', '2013 A1', '1965 S1', '2023 A3', '2025 N1', '2019 Q4', '1811 F1', '1680 V1', '1882 R1', '1910 A1', '1973 E1', '1975 V1', '2007 N3'];

const rows = new Map(); // kind:pdes -> {r, why}
const put = (list, why) => { for (const r of list) { const k = `${r.kind}:${r.pdes}`; if (!rows.has(k)) rows.set(k, { r, why: new Set() }); rows.get(k).why.add(why); } };
put(await query({ 'sb-kind': 'a', 'sb-cdata': JSON.stringify({ AND: ['diameter|GE|50'] }) }), 'big');
console.log(`  ≥ 50 km : ${rows.size}`);
put(await query({ 'sb-kind': 'a', 'sb-group': 'pha' }), 'pha');
console.log(`  + dangereux : ${rows.size}`);
put(await query({ 'sb-kind': 'a', 'sb-cdata': OR(VISITED) }), 'visited');
put(await query({ 'sb-kind': 'c', 'sb-ns': 'n' }), 'periodic');
put((await query({ 'sb-kind': 'c', 'sb-cdata': JSON.stringify({ OR: COMETS.map(p => `pdes|RE|${p}`) }) })).filter(r => COMETS.includes(r.pdes.trim())), 'famous');
console.log(`  + comètes : ${rows.size}`);
put((await query({ 'sb-kind': 'a', 'sb-cdata': JSON.stringify({ AND: ['pdes|RE|2017 U1'] }) })).filter(r => r.pdes.trim() === 'A/2017 U1' || r.pdes.trim() === '2017 U1'), 'interstellar'); // 1I/ʻOumuamua
put(await query({ 'sb-kind': 'a', 'sb-class': 'TNO', 'sb-ns': 'n' }), 'tno');
console.log(`  + TNO : ${rows.size}`);

const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const SRC = { id: 'sbdb', name: 'JPL Small-Body Database', url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html', license: 'Données publiques NASA/JPL' };
const objects = [];
for (const { r, why } of rows.values()) {
  if (SKIP.has(r.pdes?.trim())) continue;
  const isComet = r.kind?.startsWith('c');
  const cls = r.class;
  const full = r.full_name.trim();
  const numPart = full.match(/^(\d+)\s/)?.[1];
  const nm = r.name?.trim();
  const prov = full.match(/\(([^)]+)\)\s*$/)?.[1];
  const display = isComet ? full : nm ? nm : numPart ? `(${numPart}) ${prov ?? ''}`.trim() : r.pdes.trim();
  let cat = 'smallbody', sub;
  if (r.pdes.trim() === '1') { cat = 'planet'; sub = 'dwarf-planet'; }
  else if (why.has('interstellar')) sub = 'interstellar';
  else if (isComet) sub = ['2019 Q4', '2025 N1'].includes(r.pdes.trim()) ? 'interstellar' : 'comet';
  else if (cls === 'TNO') sub = 'kuiper';
  else if (cls === 'TJN') sub = 'trojan';
  else if (r.neo === 'Y') sub = 'near-earth';
  else if (['MBA', 'IMB', 'OMB', 'MCA'].includes(cls)) sub = 'main-belt';
  else sub = 'other-asteroid';
  const props = {};
  const P = (k, v, u, g, extra = {}) => { if (v != null) props[k] = { v, u, g, s: 'sbdb', ...extra }; };
  P('diameter', num(r.diameter), 'km', 'physical');
  P('abs_mag', num(r.H) ?? num(r.M1), 'mag', 'physical');
  P('albedo', num(r.albedo), '', 'physical');
  P('rotation', num(r.rot_per), 'h', 'physical');
  P('sma', num(r.a), 'UA', 'orbit'); P('ecc', num(r.e), '', 'orbit'); P('incl', num(r.i), '°', 'orbit');
  P('period', num(r.per), 'jours', 'orbit'); P('perihelion', num(r.q), 'UA', 'orbit'); P('aphelion', num(r.ad), 'UA', 'orbit');
  P('moid', num(r.moid), 'UA', 'orbit'); P('node', num(r.om), '°', 'orbit'); P('peri_arg', num(r.w), '°', 'orbit');
  const spec = [r.spec_B, r.spec_T].filter(Boolean).join(' / ');
  if (spec) props.spec = { t: spec, g: 'physical', s: 'sbdb' };
  if (cls) props.orbit_class = { t: cls, g: 'orbit', s: 'sbdb' };
  if (r.first_obs) props.first_obs = { t: r.first_obs, g: 'physical', s: 'sbdb' };
  const tags = [cat, sub, cls, why.has('pha') || r.pha === 'Y' ? 'hazardous' : null, r.neo === 'Y' ? 'near-earth' : null, why.has('visited') ? 'visited' : null].filter(Boolean);
  objects.push({
    id: slug(isComet ? full : (nm || display)) || `sbdb-${slug(r.pdes)}`, cat, sub, name: display, code: full, aliases: [r.pdes.trim(), numPart && `(${numPart})`].filter(Boolean),
    tags: [...new Set(tags)], props, src: 'sbdb', updated: today, sbdbId: r.pdes.trim(), kind: r.kind, orbitEpoch: r.epoch ? `JD ${r.epoch}` : null,
  });
}
await writeJson('small-bodies.json', { source: { ...SRC, fetched: today, query: 'sbdb_query.api' }, objects });
const c = {}; for (const o of objects) c[`${o.cat}/${o.sub}`] = (c[`${o.cat}/${o.sub}`] ?? 0) + 1;
console.log(c);
