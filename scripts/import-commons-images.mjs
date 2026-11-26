// Images libres de Wikimedia Commons (cartes officielles UAI des constellations, images NASA/ESA/ESO/EHT d'objets compacts et d'étoiles).
// Chaque image est vérifiée : licence libre (domaine public, CC0, CC BY, CC BY-SA) obligatoire, crédit + lien vers la page source conservés.
// Entrées : scripts/images-commons.json  { idObjet: { file: "Nom du fichier.jpg", kind?: "illustration", note?: {fr,en} } }
//          + les 88 cartes "<Nom> IAU.svg" pour les constellations.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, DATA_DIR } from './lib/common.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const OK = /^(public domain|cc0|no restrictions|cc by(-sa)?\b|attribution)/i;
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const spec = JSON.parse(await readFile(join(ROOT, 'scripts', 'images-commons.json'), 'utf8'));
const cons = JSON.parse(await readFile(join(DATA_DIR, 'constellations.json'), 'utf8')).objects;
const jobs = [
  ...Object.entries(spec).map(([id, s]) => ({ id, file: s.file, kind: s.kind, note: s.note, svg: /\.svg$/i.test(s.file) })),
  ...cons.map(c => ({ id: c.id, file: `${c.name} IAU.svg`, svg: true, chart: true })),
];

// Politique de Wikimedia : un robot doit s'identifier avec un moyen de contact (ici l'adresse publique du dépôt),
// sinon il est fortement limité, surtout depuis les serveurs d'intégration continue.
const cfg = (await import('../site.config.mjs')).default;
const UA = `EncyclopedieSpatiale/1.0 (${cfg.repo ?? 'https://github.com'}; import hebdomadaire des images libres) Node.js`;
async function api(params, tries = 6) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', maxlag: '5', ...params }), { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (r.status === 429 || r.status === 503) { await sleep(Math.max(Number(r.headers.get('retry-after')) || 0, 6 * (t + 1)) * 1000); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  throw new Error('limite de débit Commons');
}

const out = {}; const problems = [];
for (let i = 0; i < jobs.length; i += 15) {
  const part = jobs.slice(i, i + 15);
  const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960', iiextmetadatafilter: 'LicenseShortName|Artist|Credit', titles: part.map(p => `File:${p.file}`).join('|') });
  const norm = Object.fromEntries((j.query.normalized ?? []).map(n => [n.from, n.to]));
  const pages = Object.values(j.query.pages);
  for (const p of part) {
    const t = norm[`File:${p.file}`] ?? `File:${p.file}`;
    const page = pages.find(x => x.title === t);
    const ii = page?.imageinfo?.[0];
    if (!ii) { problems.push(`${p.id}: fichier introuvable (${p.file})`); continue; }
    const m = ii.extmetadata ?? {}; const lic = strip(m.LicenseShortName?.value);
    if (!OK.test(lic)) { problems.push(`${p.id}: licence refusée « ${lic} » (${p.file})`); continue; }
    const artist = strip(m.Artist?.value) || strip(m.Credit?.value) || 'Auteur indiqué sur la page source';
    out[p.id] = {
      url: p.svg ? ii.url.split('?')[0] : ii.thumburl, thumb: ii.thumburl, title: p.file.replace(/\.[a-z]+$/i, ''), alt: p.file.replace(/\.[a-z]+$/i, ''),
      credit: artist.slice(0, 200), license: lic, source: ii.descriptionurl, ...(p.kind ? { kind: p.kind } : {}), ...(p.chart ? { kind: 'chart' } : {}), ...(p.note ? { note: p.note } : {}),
    };
  }
  process.stdout.write(`\r  ${Math.min(i + 15, jobs.length)}/${jobs.length}`);
  await sleep(1500);
}
console.log();
await writeFile(join(DATA_DIR, 'images-commons.json'), JSON.stringify(out));
console.log(`✔ data/images-commons.json (${Object.keys(out).length} images)`);
if (problems.length) console.log('⚠', problems.join('\n⚠ '));
