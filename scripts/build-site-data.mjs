// Transforme /data/*.json (schéma normalisé) en fichiers statiques consommés par le site :
//   public/data/index.json      index léger (cartes, recherche, filtres)
//   public/data/o/<id>.json     fiche détaillée d'un objet
//   public/data/meta.json       sources, compteurs, dates
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DATA_DIR } from './lib/common.mjs';

const OUT = join(ROOT, 'public', 'data');
await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'o'), { recursive: true });

const PC_LY = 3.26156, M_EARTH = 5.9722e24, R_EARTH = 6371;
const sources = [];
let objects = [];
for (const f of (await readdir(DATA_DIR)).filter(f => f.endsWith('.json') && f !== 'images.json').sort()) {
  const d = JSON.parse(await readFile(join(DATA_DIR, f), 'utf8'));
  sources.push({ ...d.source, file: f, count: d.objects.length });
  objects.push(...d.objects);
}
const images = existsSync(join(DATA_DIR, 'images.json')) ? JSON.parse(await readFile(join(DATA_DIR, 'images.json'), 'utf8')) : {};

const descs = JSON.parse(await readFile(join(ROOT, 'scripts', 'descriptions.json'), 'utf8'));
// rang des 8 planètes par demi-grand axe
const PL = objects.filter(o => o.cat === 'planet' && ['terrestrial', 'gas-giant', 'ice-giant'].includes(o.sub) && o.props.sma)
  .sort((a, b) => a.props.sma.v - b.props.sma.v);
PL.forEach((p, i) => { p.rank = i + 1; });

// ids uniques
const ids = new Set();
for (const o of objects) { let id = o.id, n = 2; while (ids.has(id)) id = `${o.id}-${n++}`; o.id = id; ids.add(id); }
const byId = new Map(objects.map(o => [o.id, o]));

// systèmes d'exoplanètes : hôte -> planètes
const systems = new Map();
for (const o of objects) if (o.cat === 'exoplanet' && o.host) (systems.get(o.host) ?? systems.set(o.host, []).get(o.host)).push(o);
// étoiles : par nom (NASA + SIMBAD), et fusion des paramètres stellaires publiés par la NASA pour les hôtes
const starByName = new Map();
for (const o of objects) if (o.cat === 'star') for (const n of [o.name, ...(o.hostNames ?? [])]) starByName.set(n.toLowerCase(), o);
const STAR_MAP = { st_teff: 'teff', st_rad: 'radius', st_mass: 'mass', st_lum: 'lum', st_met: 'met', st_age: 'age', dist: 'dist' };
const hostPlanets = new Map(); // id étoile -> planètes
for (const [host, planets] of systems) {
  const star = starByName.get(host.toLowerCase()); if (!star) continue;
  hostPlanets.set(star.id, planets);
  const p0 = planets.find(p => p.props.st_teff || p.props.st_rad || p.props.st_mass) ?? planets[0];
  for (const [from, to] of Object.entries(STAR_MAP)) {
    const v = p0.props[from]; if (!v) continue;
    if (star.props[to] && !(to === 'dist' && star.props[to].calc)) continue; // garde la valeur SIMBAD si elle est mesurée
    star.props[to] = { ...v, g: to === 'dist' ? 'sys' : 'star', s: 'nea', ref: v.ref };
  }
  if (!star.props.sptype && p0.spectype) star.props.sptype = { t: p0.spectype, g: 'star', s: 'nea' };
  const sp = star.props.sptype?.t?.match(/^[a-z]*([OBAFGKM])/);
  if (star.sub === 'other-star' && sp) { star.sub = `spectral-${sp[1]}`; star.tags = star.tags.map(x => (x === 'other-star' ? star.sub : x)); }
  if (!star.props.vmag && p0.props.vmag) star.props.vmag = { ...p0.props.vmag, s: 'nea' };
  star.updated = star.updated ?? p0.updated;
}
// constellations : une étoile appartient à la constellation dont l'abréviation UAI termine sa désignation (Bayer, Flamsteed, variable)
const consts = objects.filter(o => o.sub === 'constellation');
const constByAbbr = new Map(consts.map(c => [c.code, c]));
const starsOfConst = new Map();
function constOf(o) {
  if (o.cat !== 'star' && o.cat !== 'region') return null;
  const toks = (o.code || '').split(' ');
  while (toks.length > 1 && /^([A-Z]|AB?|BC?|[Aa]a?|\d)$/.test(toks[toks.length - 1]) && !constByAbbr.has(toks[toks.length - 1])) toks.pop();
  return constByAbbr.get(toks[toks.length - 1]) ?? null;
}
for (const o of objects) {
  const c = o.cat === 'star' && o.src === 'simbad' && (o.sub.startsWith('spectral') || o.sub === 'other-star') ? constOf(o) : null;
  if (c) { o.constId = c.id; (starsOfConst.get(c.id) ?? starsOfConst.set(c.id, []).get(c.id)).push(o); }
}

const toEarthMass = p => !p ? null : p.u === 'kg' ? p.v / M_EARTH : p.u === 'M☉' ? p.v * 332946 : p.v;
const toEarthRadius = p => !p ? null : p.u === 'km' ? p.v / R_EARTH : p.u === 'R☉' ? p.v * 109.076 : p.v;
const round = (x, d = 4) => x == null ? null : Number(x.toPrecision(d));

const index = [];
for (const o of objects) {
  const rel = [];
  if (o.cat === 'exoplanet') {
    const host = starByName.get(o.host?.toLowerCase());
    rel.push({ id: host?.id ?? null, name: o.host, rel: 'host' });
    for (const s of systems.get(o.host) ?? []) if (s !== o) rel.push({ id: s.id, name: s.name, rel: 'sibling' });
  }
  if (o.parent && byId.get(o.parent)) rel.push({ id: o.parent, name: byId.get(o.parent).name, rel: 'parent' });
  for (const m of o.moons ?? []) if (byId.get(m)) rel.push({ id: m, name: byId.get(m).name, rel: 'moon' });
  if (o.cat === 'star' && o.sub === 'sun') for (const c of objects) if (c.parent === o.id) rel.push({ id: c.id, name: c.name, rel: 'child' });
  for (const p of (hostPlanets.get(o.id) ?? []).slice(0, 12)) rel.push({ id: p.id, name: p.name, rel: 'planet' });
  if (o.constId) rel.push({ id: o.constId, name: byId.get(o.constId).name, rel: 'constellation' });
  if (o.sub === 'constellation') {
    const list = (starsOfConst.get(o.id) ?? []).filter(s => s.tags.includes('bright') || s.hostNames?.length || s.messier || true)
      .sort((a, b) => (a.props.vmag?.v ?? 99) - (b.props.vmag?.v ?? 99)).slice(0, 15);
    for (const s of list) rel.push({ id: s.id, name: s.name, rel: 'star' });
    o.nStars = (starsOfConst.get(o.id) ?? []).length;
  }
  o.related = rel;
  if (descs[o.id]) o.desc = descs[o.id];

  const img = images[o.id] ?? null; // pas d'image générique : « pas d'image » vaut mieux qu'une fausse image
  const dist = o.props.dist ? o.props.dist.v * PC_LY : null;
  const card = {
    i: o.id, n: o.name, c: o.code, k: o.cat, s: o.sub, t: o.tags,
    m: round(toEarthMass(o.props.mass)), r: round(toEarthRadius(o.props.radius)), d: round(dist),
    q: o.props.teq?.v ?? o.props.teff?.v ?? null, y: o.disc?.year ?? null, md: o.disc?.method ?? null,
    ss: o.src === 'ssod' ? 1 : undefined,
    hz: o.props.in_hz ? o.props.in_hz.v : null, h: o.host ?? null,
    x: (o.aliases ?? []).filter(a => /^(HD|HIP|NGC|IC|M|GJ) /.test(a)).join(' ') || undefined,
    im: img?.thumb ?? img?.url ?? null, il: img?.kind === 'illustration' ? 1 : undefined,
  };
  if (o.nameFr && o.nameFr !== o.name) card.nf = o.nameFr;
  index.push(card);
  const { parent, moons, ...detail } = o;
  await writeFile(join(OUT, 'o', `${o.id}.json`), JSON.stringify({ ...detail, image: img }));
}
const today = new Date().toISOString().slice(0, 10);
await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
await writeFile(join(OUT, 'meta.json'), JSON.stringify({ built: today, total: index.length, sources }));
console.log(`✔ public/data : ${index.length} objets, ${sources.length} source(s)`);
