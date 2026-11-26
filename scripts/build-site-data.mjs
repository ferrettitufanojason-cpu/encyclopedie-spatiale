// Transforme /data/*.json (schéma normalisé) en fichiers statiques consommés par le site :
//   public/data/index.json      index léger (cartes, recherche, filtres)
//   public/data/o/<id>.json     fiche détaillée d'un objet
//   public/data/meta.json       sources, compteurs, dates
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DATA_DIR } from './lib/common.mjs';
import { buildGamesData } from './lib/games-data.mjs';

const OUT = join(ROOT, 'public', 'data');
await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'o'), { recursive: true });

const PC_LY = 3.26156, M_EARTH = 5.9722e24, R_EARTH = 6371;
const sources = [];
let objects = [];
const imageFiles = (await readdir(DATA_DIR)).filter(f => /^images.*\.json$/.test(f)).sort();
// Le Système solaire passe en premier : en cas d'identifiants identiques (ex. la lune Io et l'astéroïde 85 Io), il garde l'identifiant court.
const dataFiles = (await readdir(DATA_DIR)).filter(f => f.endsWith('.json') && !imageFiles.includes(f) && f !== 'land-path.json').sort((a, b) => (b === 'solar-system.json') - (a === 'solar-system.json') || a.localeCompare(b));
for (const f of dataFiles) {
  const d = JSON.parse(await readFile(join(DATA_DIR, f), 'utf8'));
  if (!Array.isArray(d.objects)) continue; // fichiers annexes (rapport d'import, contour des terres…)
  sources.push({ ...d.source, file: f, count: d.objects.length });
  objects.push(...d.objects);
}
const images = {};
for (const f of imageFiles) Object.assign(images, JSON.parse(await readFile(join(DATA_DIR, f), 'utf8')));

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
const radiusOf = o => (o.props.radius ? toEarthRadius(o.props.radius) : o.props.diameter ? o.props.diameter.v / 2 / R_EARTH : null);
const round = (x, d = 4) => x == null ? null : Number(x.toPrecision(d));

const index = [];
const csvRows = [];
const SITE = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://encyclopedie-spatiale.example');
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

  // pas d'image générique : « pas d'image » vaut mieux qu'une fausse image. Repli : vue réelle du ciel (relevé DSS2) à la position de l'objet.
  const img = images[o.id] ?? (existsSync(join(ROOT, 'public', 'sky', `${o.id}.jpg`))
    ? { url: `/sky/${encodeURIComponent(o.id)}.jpg`, thumb: `/sky/${encodeURIComponent(o.id)}.jpg`, kind: 'sky', title: `${o.name} — vue du ciel (DSS2)`, alt: `Vue du ciel (DSS2) centrée sur ${o.name}`,
      credit: 'Digitized Sky Survey 2 (STScI / Palomar Observatory) via NASA SkyView (HEASARC)', license: 'Usage éducatif et non commercial (STScI)', source: 'https://skyview.gsfc.nasa.gov/' }
    : null);
  const dist = o.props.dist ? o.props.dist.v * PC_LY : null;
  const card = {
    i: o.id, n: o.name, c: o.code, k: o.cat, s: o.sub, t: o.tags,
    m: round(toEarthMass(o.props.mass)), r: round(radiusOf(o)), d: round(dist),
    q: o.props.teq?.v ?? o.props.teff?.v ?? null, y: o.disc?.year ?? null, md: o.disc?.method ?? null,
    ss: o.src === 'ssod' || o.live ? 1 : undefined, dt: o.eventDate, zh: o.sub === 'meteor-shower' ? (o.zhr ?? 0) : undefined,
    nw: o.cat === 'exoplanet' && o.disc?.pubdate && Date.now() - Date.parse(`${o.disc.pubdate}-15`) < 183 * 86400000 ? 1 : undefined, // découverte publiée depuis moins de ~6 mois
    hz: o.props.in_hz ? o.props.in_hz.v : null, h: o.host ?? null,
    x: (o.aliases ?? []).filter(a => /^(HD|HIP|NGC|IC|M|GJ) /.test(a)).join(' ') || undefined,
    im: img?.thumb ?? img?.url ?? null, il: img?.kind === 'illustration' ? 1 : img?.kind === 'sky' ? 2 : undefined,
  };
  // Éléments orbitaux compacts [q, e, Ω, ω, i] : permettent de dessiner le schéma d'orbite quand il n'existe aucune photo.
  const P_ = o.props;
  if (o.src === 'sbdb' && !img && P_.perihelion && P_.ecc && P_.ecc.v < 1 && P_.node && P_.peri_arg && P_.incl) {
    card.ob = [P_.perihelion.v, P_.ecc.v, P_.node.v, P_.peri_arg.v, P_.incl.v].map(v => Number(v.toPrecision(5)));
    card.il = 3;
  }
  if (o.nameFr && o.nameFr !== o.name) card.nf = o.nameFr;
  // masse ou rayon ESTIMÉ par la NASA (relation masse-rayon, « Calculated Value ») et non mesuré : à distinguer dans les graphiques
  if (o.cat === 'exoplanet' && [o.props.mass, o.props.radius].some(p => /calculated/i.test(p?.ref?.t ?? ''))) card.ec = 1;
  // pour le diagramme de Hertzsprung-Russell : température effective et magnitude absolue V = V + 5 − 5 log10(d / 1 pc) (calculée)
  if (o.cat === 'star') {
    if (o.props.teff?.v) card.te = round(o.props.teff.v);
    if (o.props.vmag?.v != null && o.props.dist?.v > 0) card.mv = round(o.props.vmag.v + 5 - 5 * Math.log10(o.props.dist.v), 3);
  }
  index.push(card);
  csvRows.push([o.id, o.name, o.nameFr ?? '', o.cat === 'exoplanet' ? 'exoplanet' : o.cat, o.sub, o.code, card.m ?? '', card.r ?? '', card.d ?? '', card.q ?? '', o.disc?.year ?? '', o.disc?.method ?? '', o.ra ?? '', o.dec ?? '',
    o.src, o.updated ?? '', `${SITE}/objet/${encodeURIComponent(o.id)}`, o.cat]);
  const { parent, moons, ...detail } = o;
  await writeFile(join(OUT, 'o', `${o.id}.json`), JSON.stringify({ ...detail, image: img }));
}
const today = new Date().toISOString().slice(0, 10);
if (existsSync(join(DATA_DIR, 'land-path.json'))) await writeFile(join(OUT, 'land.json'), await readFile(join(DATA_DIR, 'land-path.json')));
await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
// données compactes des jeux (/jeux/) : planètes et exoplanètes avec zone habitable calculée
await writeFile(join(OUT, 'jeux.json'), JSON.stringify(buildGamesData(objects, images, today)));

// ---- exports ouverts (CSV UTF-8 avec BOM pour Excel) : un fichier global + un par catégorie ----
const EXP = join(ROOT, 'public', 'export');
await rm(EXP, { recursive: true, force: true }); await mkdir(EXP, { recursive: true });
const HEAD = ['id', 'name', 'name_fr', 'category', 'subcategory', 'catalog_code', 'mass_earth_masses', 'radius_earth_radii', 'distance_light_years', 'temperature_K', 'discovery_year', 'discovery_method', 'ra_deg', 'dec_deg', 'source', 'last_update', 'url'];
const cell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const BOM = String.fromCharCode(0xfeff);
const toCsv = rows => BOM + [HEAD, ...rows.map(r => r.slice(0, HEAD.length))].map(r => r.map(cell).join(',')).join('\n') + '\n';
await writeFile(join(EXP, 'encyclopedie-spatiale.csv'), toCsv(csvRows));
const byCat = {}; for (const r of csvRows) (byCat[r[17]] ??= []).push(r);
for (const [cat, rows] of Object.entries(byCat)) await writeFile(join(EXP, `${cat}.csv`), toCsv(rows));

// ---- version des données, rapport d'import, relecture ----
let commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? null;
try { commit ??= (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
const report = existsSync(join(DATA_DIR, 'import-report.json')) ? JSON.parse(await readFile(join(DATA_DIR, 'import-report.json'), 'utf8')) : null;
const review = existsSync(join(ROOT, 'scripts', 'review.json')) ? JSON.parse(await readFile(join(ROOT, 'scripts', 'review.json'), 'utf8')) : { reviewers: [] };
const counts = {}; for (const c of index) counts[c.k] = (counts[c.k] ?? 0) + 1;
// comptes par onglet du site (même regroupement que groupOf() dans src/scripts/app.js) et date du dernier import des données
const EVENT_SUBS = new Set(['meteor-shower', 'opposition', 'elongation', 'conjunction', 'solar-eclipse', 'lunar-eclipse', 'gravitational-wave']);
const groupOf = c => (EVENT_SUBS.has(c.s) ? 'event' : c.s === 'mission' ? 'mission' : c.k === 'other' ? 'region' : c.k === 'exoplanet' ? 'planet' : c.k);
const groups = {}; for (const c of index) groups[groupOf(c)] = (groups[groupOf(c)] ?? 0) + 1;
const dataDate = report?.date?.slice(0, 10) ?? null;
await writeFile(join(OUT, 'meta.json'), JSON.stringify({ built: today, version: today.replace(/-/g, '.'), commit, total: index.length, counts, groups, dataDate, newExoplanets: index.filter(c => c.nw).length, sources, importReport: report, review, exports: Object.keys(byCat) }));
// ---- plan du site et robots.txt (adresses absolues : SITE_URL, ou l'adresse de production fournie par Vercel) ----
const { GAME_SECTIONS } = await import('../src/data/games.mjs');
const PAGES = ['/', '/jeux/', ...GAME_SECTIONS.flatMap(s => s.games.filter(g => g.ready).map(g => `/jeux/${g.slug}/`)), '/methodologie/', '/glossaire/', '/parcours/', '/avis/', '/mentions-legales/'];
const xmlEsc = x => x.replace(/&/g, '&amp;');
const urls = [...PAGES.map(u => SITE + u), ...index.map(c => `${SITE}/objet/${encodeURIComponent(c.i)}`)];
await writeFile(join(ROOT, 'public', 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(u => `<url><loc>${xmlEsc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
await writeFile(join(ROOT, 'public', 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (SITE.endsWith('.example')) console.warn('⚠ SITE_URL non défini : le plan du site utilise une adresse provisoire (normal en local ; sur Vercel, l’adresse de production est utilisée).');
console.log(`✔ public/data : ${index.length} objets, ${sources.length} source(s) ; exports CSV : ${Object.keys(byCat).length + 1}`);
