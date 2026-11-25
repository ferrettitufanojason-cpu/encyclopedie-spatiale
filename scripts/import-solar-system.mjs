// Import Système solaire OpenData (api.le-systeme-solaire.net) : Soleil, planètes, planètes naines, lunes.
// Nécessite SSOD_TOKEN dans .env (jeton gratuit : https://api.le-systeme-solaire.net/generatekey.html)
import { loadEnv, getText, writeJson, slug } from './lib/common.mjs';
await loadEnv();

const TOKEN = process.env.SSOD_TOKEN;
if (!TOKEN) {
  console.error('SSOD_TOKEN manquant. Générez un jeton gratuit sur https://api.le-systeme-solaire.net/generatekey.html puis ajoutez SSOD_TOKEN=... dans .env');
  process.exit(2);
}
const SRC = { id: 'ssod', name: 'Système solaire OpenData', url: 'https://api.le-systeme-solaire.net/', license: 'Données ouvertes (Etalab / usage libre avec citation)' };
const today = new Date().toISOString().slice(0, 10);

const raw = JSON.parse(await getText('https://api.le-systeme-solaire.net/rest/bodies', {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }, cacheKey: 'ssod-bodies.json', ttlHours: 6,
}));
const bodies = raw.bodies;
console.log(`${bodies.length} corps reçus`);
const byId = Object.fromEntries(bodies.map(b => [b.id, b]));

// Classification des 8 planètes (fait établi, NASA / UAI), non fournie par l'API.
const PLANET_SUB = { mercure: 'terrestrial', venus: 'terrestrial', terre: 'terrestrial', mars: 'terrestrial',
  jupiter: 'gas-giant', saturne: 'gas-giant', uranus: 'ice-giant', neptune: 'ice-giant' };
const GROUP = { mass: 'physical', radius: 'physical' };

const P = (v, u, g, extra = {}) => (v == null || v === 0 && u !== 'K' && u !== '°' ? null : { v, u, g, ...extra });
const prop = (props, k, p) => { if (p) props[k] = p; };

const objects = [];
for (const b of bodies) {
  const type = b.bodyType;
  let cat, sub;
  if (type === 'Star') { cat = 'star'; sub = 'sun'; }
  else if (b.isPlanet) { cat = 'planet'; sub = PLANET_SUB[b.id]; if (!sub) continue; }
  else if (type === 'Dwarf Planet') { cat = 'planet'; sub = 'dwarf-planet'; }
  else if (type === 'Moon') { cat = 'planet'; sub = 'moon'; }
  else continue; // astéroïdes / comètes : importés depuis JPL SBDB (étape 4)

  const props = {};
  const m = b.mass?.massValue != null ? b.mass.massValue * 10 ** b.mass.massExponent : null;
  prop(props, 'mass', P(m, 'kg', 'physical'));
  prop(props, 'radius', P(b.meanRadius, 'km', 'physical'));
  prop(props, 'radius_eq', P(b.equaRadius, 'km', 'physical'));
  prop(props, 'radius_pol', P(b.polarRadius, 'km', 'physical'));
  prop(props, 'density', P(b.density, 'g/cm³', 'physical'));
  prop(props, 'gravity', P(b.gravity, 'm/s²', 'physical'));
  prop(props, 'escape', P(b.escape, 'm/s', 'physical'));
  prop(props, 'teq', P(b.avgTemp, 'K', 'physical'));
  prop(props, 'axial_tilt', P(b.axialTilt, '°', 'physical'));
  prop(props, 'rotation', P(b.sideralRotation, 'h', 'physical'));
  prop(props, 'period', P(b.sideralOrbit, 'jours', 'orbit'));
  prop(props, 'sma', P(b.semimajorAxis, 'km', 'orbit'));
  prop(props, 'perihelion', P(b.perihelion, 'km', 'orbit'));
  prop(props, 'aphelion', P(b.aphelion, 'km', 'orbit'));
  prop(props, 'ecc', P(b.eccentricity, '', 'orbit'));
  prop(props, 'incl', P(b.inclination, '°', 'orbit'));
  for (const p of Object.values(props)) p.ref = { t: 'Système solaire OpenData', url: `https://api.le-systeme-solaire.net/rest/bodies/${b.id}` };

  const around = b.aroundPlanet?.planet;
  const parent = cat === 'star' ? null : (type === 'Moon' ? around : 'soleil');
  objects.push({
    id: slug(b.englishName || b.name) || b.id, cat, sub,
    name: b.englishName || b.name, nameFr: b.name, code: b.id.toUpperCase(),
    aliases: [b.alternativeName].filter(Boolean),
    tags: ['solar-system', sub],
    parent, moons: (b.moons || []).map(x => x.rel?.split('/').pop()),
    disc: b.discoveredBy ? { by: b.discoveredBy, date: b.discoveryDate || null } : null,
    props, src: 'ssod', updated: today, ssodId: b.id,
  });
}
// rattacher les ids slug (relations par id API -> id slug)
const idOf = Object.fromEntries(objects.map(o => [o.ssodId, o.id]));
for (const o of objects) {
  o.parent = o.parent ? idOf[o.parent] ?? null : null;
  o.moons = o.moons.map(x => idOf[x] ?? null).filter(Boolean);
}
await writeJson('solar-system.json', { source: { ...SRC, fetched: today }, objects });

