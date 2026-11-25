// Télécharge, pour chaque étoile / région sans image, une vue réelle du ciel (relevé DSS2, via NASA SkyView/HEASARC)
// centrée sur l'objet. Fichiers statiques : public/sky/<id>.jpg  (déjà présents = ignorés, le script est reprenable).
// Ce n'est PAS un portrait de l'étoile (impossible : ce sont des points lumineux) mais une vraie image du ciel à sa position.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DATA_DIR } from './lib/common.mjs';

const OUT = join(ROOT, 'public', 'sky');
await mkdir(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CONC = Number(process.env.SKY_CONC ?? 4);

const have = new Set();
for (const f of ['images.json', 'images-commons.json']) if (existsSync(join(DATA_DIR, f))) for (const k of Object.keys(JSON.parse(await readFile(join(DATA_DIR, f), 'utf8')))) have.add(k);
const simbad = JSON.parse(await readFile(join(DATA_DIR, 'simbad.json'), 'utf8')).objects;
// ids finaux = ceux calculés par build-site-data (suffixes -2 en cas de collision) : on lit public/data/index.json
const index = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'index.json'), 'utf8'));
const byName = new Map(simbad.map(o => [o.code + '|' + o.name, o]));
const todo = [];
for (const c of index) {
  if (c.im || (c.k !== 'star' && c.k !== 'region') || c.s === 'sun') continue;
  const o = byName.get(c.c + '|' + c.n) ?? simbad.find(s => s.name === c.n && s.code === c.c);
  if (!o || o.ra == null || o.dec == null) continue;
  const maj = Number(o.props.ang_major?.v ?? 0) / 60; // degrés
  const fov = c.k === 'region' ? Math.min(3, Math.max(0.25, maj * 2.5)) : 0.12;
  todo.push({ id: c.i, ra: o.ra, dec: o.dec, fov });
}
const pending = todo.filter(t => !existsSync(join(OUT, `${t.id}.jpg`)));
console.log(`${todo.length} objets éligibles, ${pending.length} à télécharger (concurrence ${CONC})`);

let done = 0, failed = 0, n = 0;
async function worker() {
  while (n < pending.length) {
    const t = pending[n++];
    const url = `https://skyview.gsfc.nasa.gov/cgi-bin/images?Position=${t.ra.toFixed(5)},${t.dec.toFixed(5)}&Survey=DSS2+Red&Size=${t.fov.toFixed(3)}&Pixels=240&Return=JPEG&Scaling=Log`;
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
        const b = Buffer.from(await r.arrayBuffer());
        if (r.ok && /image\/jpeg/.test(r.headers.get('content-type') ?? '') && b.length > 2000) { await writeFile(join(OUT, `${t.id}.jpg`), b); ok = true; }
        else await sleep(2000 * (a + 1));
      } catch { await sleep(2000 * (a + 1)); }
    }
    ok ? done++ : failed++;
    if ((done + failed) % 25 === 0) console.log(`  ${done + failed}/${pending.length} (échecs : ${failed})`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`✔ ${done} images téléchargées, ${failed} échecs`);
