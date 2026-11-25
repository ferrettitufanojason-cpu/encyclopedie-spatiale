// Associe des photos officielles de la bibliothèque NASA (images-api.nasa.gov) aux objets.
// Liste vérifiée à la main : scripts/images-curated.json  { idObjet: nasa_id }
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, getText } from './lib/common.mjs';
const curated = JSON.parse(await readFile(join(ROOT, 'scripts', 'images-curated.json'), 'utf8'));
const out = {};
for (const [id, spec] of Object.entries(curated)) {
  const nid = typeof spec === 'string' ? spec : spec.nasa;
  const extra = typeof spec === 'string' ? {} : { kind: spec.kind, scope: spec.scope, note: spec.note };
  try {
    const meta = JSON.parse(await getText(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(nid)}`, { cacheKey: `nasa-${nid}.json`, ttlHours: 168 }));
    const d = meta.collection.items[0]?.data[0]; if (!d) throw new Error('introuvable');
    const assets = JSON.parse(await getText(`https://images-api.nasa.gov/asset/${encodeURIComponent(nid)}`, { cacheKey: `nasa-asset-${nid}.json`, ttlHours: 168 })).collection.items.map(i => i.href);
    const pick = re => assets.find(h => re.test(h));
    const url = pick(/~medium\.jpg$/i) ?? pick(/~small\.jpg$/i) ?? pick(/\.jpe?g$/i);
    const thumb = pick(/~small\.jpg$/i) ?? pick(/~thumb\.jpg$/i) ?? url;
    if (!url) throw new Error('pas de jpg');
    const who = [d.photographer, d.secondary_creator].filter(Boolean).join(', ');
    out[id] = { url: url.replace(/^http:/, 'https:'), thumb: thumb.replace(/^http:/, 'https:'), title: d.title, alt: d.title,
      credit: `NASA${d.center ? '/' + d.center : ''}${who ? ' — ' + who : ''}`,
      license: 'Domaine public (NASA Media Usage Guidelines)', source: `https://images.nasa.gov/details/${nid}`, nasaId: nid, ...extra };
  } catch (e) { console.warn('✖', id, nid, e.message); }
}
await writeFile(join(ROOT, 'data', 'images.json'), JSON.stringify(out));
console.log(`✔ data/images.json (${Object.keys(out).length} images)`);