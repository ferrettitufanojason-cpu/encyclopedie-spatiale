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
const starByName = new Map(objects.filter(o => o.cat === 'star').map(o => [o.name.toLowerCase(), o]));

const toEarthMass = p => !p ? null : p.u === 'kg' ? p.v / M_EARTH : p.v;
const toEarthRadius = p => !p ? null : p.u === 'km' ? p.v / R_EARTH : p.v;
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
  o.related = rel;
  if (descs[o.id]) o.desc = descs[o.id];

  const img = images[o.id] ?? null;
  const dist = o.props.dist ? o.props.dist.v * PC_LY : null;
  const card = {
    i: o.id, n: o.name, c: o.code, k: o.cat, s: o.sub, t: o.tags,
    m: round(toEarthMass(o.props.mass)), r: round(toEarthRadius(o.props.radius)), d: round(dist),
    q: o.props.teq?.v ?? null, y: o.disc?.year ?? null, md: o.disc?.method ?? null,
    ss: o.src === 'ssod' ? 1 : undefined,
    hz: o.props.in_hz ? o.props.in_hz.v : null, h: o.host ?? null,
    x: (o.aliases ?? []).filter(a => /^(HD|HIP) /.test(a)).join(' ') || undefined,
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
