// Fiche de la Station spatiale internationale (ISS), lue sur les pages officielles de la NASA :
//   https://www.nasa.gov/international-space-station/space-station-facts-and-figures/   (dimensions, masse, volumes, orbite)
//   https://www.nasa.gov/international-space-station/                                      (date de lancement du premier élément)
// + contour des terres (Natural Earth, domaine public) pour la carte du suivi en direct.
// Aucune valeur n'est saisie à la main : chaque chiffre est extrait de la page ; une valeur introuvable est simplement omise.
import { getText, writeJson, DATA_DIR } from './lib/common.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FACTS = 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/';
const HOME = 'https://www.nasa.gov/international-space-station/';
const today = new Date().toISOString().slice(0, 10);
const txt = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/(div|p|li|h\d|tr)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&#8217;/g, '’').replace(/[ \t]+/g, ' ').replace(/(\s*\n\s*)+/g, '\n');
const facts = txt(await getText(FACTS, { cacheKey: 'iss-facts.html', ttlHours: 24 }));
const home = txt(await getText(HOME, { cacheKey: 'iss-home.html', ttlHours: 24 }));
const m = (t, re) => t.match(re);
const num = s => Number(String(s).replace(/,/g, ''));

const props = {};
const T = (k, t, extra = {}) => { if (t) props[k] = { t: String(t), g: 'mission', s: 'nasaiss', ...extra }; };
const V = (k, v, u, extra = {}) => { if (v != null && !Number.isNaN(v)) props[k] = { v, u, g: 'mission', s: 'nasaiss', ...extra }; };

T('launch', m(home, /Launched in (\d{4})/)?.[1] && `${m(home, /Launched in (\d{4})/)[1]} (premier élément)`);
const MFR = { January: 'janvier', February: 'février', March: 'mars', April: 'avril', May: 'mai', June: 'juin', July: 'juillet', August: 'août', September: 'septembre', October: 'octobre', November: 'novembre', December: 'décembre' };
const occ = m(facts, /continuously occupied since ([A-Z][a-z]+) (\d{4})/);
T('occupied', occ && `${MFR[occ[1]] ?? occ[1]} ${occ[2]}`);
const crew = m(facts, /international crew of (\w+) people/)?.[1]; T('crew', crew && ({ seven: '7', six: '6', five: '5' }[crew] ?? crew));
V('mass_kg', num(m(facts, /Mass:[^\n]*?\(([\d,]+) kilograms\)/)?.[1]), 'kg');
V('length_m', num(m(facts, /(\d+) meters\) end-to-end/)?.[1]), 'm');
V('module_length_m', num(m(facts, /Pressurized Module Length:[^\n]*?\((\d+) meters\)/)?.[1]), 'm');
V('truss_length_m', num(m(facts, /Truss Length:[^\n]*?\((\d+) meters\)/)?.[1]), 'm');
V('array_span_m', num(m(facts, /Solar Array Length:[^\n]*?\((\d+) meters\)/)?.[1]), 'm');
V('hab_volume', num(m(facts, /Habitable Volume:[^\n]*?\(([\d,]+) cubic meters\)/)?.[1]), 'm³');
V('press_volume', num(m(facts, /Pressurized Volume:[^\n]*?\(([\d,]+) cubic meters\)/)?.[1]), 'm³');
const pw = m(facts, /provide ([\d]+) to ([\d]+) kilowatts/); T('power', pw && `${pw[1]} à ${pw[2]} kW`);
const per = m(facts, /orbiting Earth about every (\d+) minutes/)?.[1]; V('orbit_min', per && num(per), 'min');
V('orbits_day', num(m(facts, /makes (\d+) orbits of Earth/)?.[1]), '');
const sp = m(facts, /speed of (\w+) miles per second/)?.[1]; T('speed_text', sp && `${{ five: 5 }[sp] ?? sp} miles/s ≈ ${{ five: '8' }[sp] ?? '?'} km/s`);
T('agencies', m(facts, /Five space agencies including ([^.]+?) have contributed/)?.[1]?.replace(/\s*\([^)]*\)/g, '').replace(/,?\s+and\s+/, ' et ').replace(/,\s*$/, ''));

const objects = [{
  id: 'mission-international-space-station', cat: 'other', sub: 'mission', name: 'International Space Station', nameFr: 'Station spatiale internationale (ISS)',
  code: '1998-067A', aliases: ['ISS', 'Zarya (1998-067A)'], tags: ['mission', 'live'], props, nssdcaDesc: null, launchDate: null, live: 'iss',
  src: 'nasaiss', updated: today,
}];
await writeJson('iss.json', { source: { id: 'nasaiss', name: 'NASA — Station spatiale internationale (Facts and Figures)', url: FACTS, license: 'Contenu public NASA', fetched: today }, objects });

// Contour des terres (Natural Earth 110 m, domaine public) -> chemin SVG équirectangulaire 360 x 180
const geo = JSON.parse(await getText('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson', { cacheKey: 'ne_110m_land.geojson', ttlHours: 24 * 30 }));
const ring = r => r.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + 180).toFixed(1)} ${(90 - y).toFixed(1)}`).join('') + 'Z';
let d = '';
for (const f of geo.features) {
  const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const r of p) d += ring(r);
}
await writeFile(join(DATA_DIR, 'land-path.json'), JSON.stringify({ d, source: 'Natural Earth (domaine public) — naturalearthdata.com' }));
console.log('Propriétés lues :', Object.keys(props).join(', '));
console.log(JSON.stringify(Object.fromEntries(Object.entries(props).map(([k, p]) => [k, p.t ?? `${p.v} ${p.u}`]))));
