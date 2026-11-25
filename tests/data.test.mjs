// Tests de cohérence des données générées (lancer APRÈS `npm run build`) : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/%20/g, ' ');
const PUB = join(ROOT, 'public');
const have = existsSync(join(PUB, 'data', 'index.json'));
const opt = { skip: have ? false : 'public/data absent (lancer npm run build)' };
const J = p => JSON.parse(readFileSync(p, 'utf8'));
const index = have ? J(join(PUB, 'data', 'index.json')) : [];
const meta = have ? J(join(PUB, 'data', 'meta.json')) : {};
const detail = id => J(join(PUB, 'data', 'o', `${id}.json`));

test('index : identifiants uniques, champs obligatoires', opt, () => {
  const ids = new Set();
  for (const c of index) {
    assert.ok(c.i && c.n && c.k && c.s, `carte incomplète : ${JSON.stringify(c).slice(0, 120)}`);
    assert.ok(!ids.has(c.i), `identifiant en double : ${c.i}`); ids.add(c.i);
  }
  assert.equal(index.length, meta.total, 'meta.total ≠ taille de l’index');
});

test('chaque carte a un fichier de fiche, et chaque donnée est bien formée et sourcée', opt, () => {
  const problems = [];
  const dir = readdirSync(join(PUB, 'data', 'o'));
  assert.equal(dir.length, index.length, 'nombre de fiches ≠ nombre de cartes');
  for (const c of index) {
    const o = detail(c.i);
    for (const [k, p] of Object.entries(o.props ?? {})) {
      const numeric = p.v !== undefined, text = p.t !== undefined;
      if (!numeric && !text) problems.push(`${c.i}.${k} : ni valeur ni texte`);
      if (numeric && !Number.isFinite(p.v)) problems.push(`${c.i}.${k} : valeur non finie (${p.v})`);
      for (const e of ['ep', 'em']) if (p[e] !== undefined && !Number.isFinite(p[e])) problems.push(`${c.i}.${k}.${e} non fini`);
      if (!(p.s || o.src)) problems.push(`${c.i}.${k} : pas de source`);
    }
    if (!o.updated) problems.push(`${c.i} : date de mise à jour absente`);
  }
  assert.deepEqual(problems.slice(0, 15), [], `${problems.length} problème(s)`);
});

test('plausibilité physique (valeurs aberrantes = bug d’import ou d’unité)', opt, () => {
  const bad = [];
  for (const c of index) {
    if (c.k === 'exoplanet') {
      const o = detail(c.i);
      const P = o.props;
      if (P.mass && !(P.mass.v > 0 && P.mass.v < 1e5)) bad.push(`${c.i} masse ${P.mass.v}`);
      if (P.radius && !(P.radius.v > 0 && P.radius.v < 300)) bad.push(`${c.i} rayon ${P.radius.v}`);
      if (P.ecc && !(P.ecc.v >= 0 && P.ecc.v < 1)) bad.push(`${c.i} excentricité ${P.ecc.v}`);
      if (P.teq && !(P.teq.v > 0 && P.teq.v < 10000)) bad.push(`${c.i} température ${P.teq.v}`);
    }
    if (c.d != null && !(c.d > 0)) bad.push(`${c.i} distance ${c.d}`);
  }
  assert.deepEqual(bad.slice(0, 15), [], `${bad.length} valeur(s) aberrante(s)`);
});

test('images : crédit, licence et source présents', opt, () => {
  const bad = [];
  for (const c of index.filter(x => x.im)) {
    const o = detail(c.i);
    if (!o.image) { bad.push(`${c.i} : image dans l’index mais pas dans la fiche`); continue; }
    for (const k of ['url', 'credit', 'license', 'source']) if (!o.image[k]) bad.push(`${c.i} : image sans ${k}`);
  }
  assert.deepEqual(bad.slice(0, 15), [], `${bad.length} image(s) incomplète(s)`);
});

test('descriptions éditoriales : chaque clé correspond à un objet existant', opt, () => {
  const d = J(join(ROOT, 'scripts', 'descriptions.json'));
  const ids = new Set(index.map(c => c.i));
  const orphan = Object.keys(d).filter(k => !k.startsWith('_') && !ids.has(k));
  assert.deepEqual(orphan, [], 'clés de descriptions.json sans objet correspondant (faute de frappe ou objet manquant)');
  for (const [k, v] of Object.entries(d)) if (!k.startsWith('_')) assert.ok(v.fr && v.en, `${k} : traduction manquante`);
});

test('couverture minimale attendue', opt, () => {
  const n = k => index.filter(c => c.k === k).length;
  assert.ok(n('exoplanet') > 5000, 'exoplanètes');
  assert.equal(index.filter(c => c.s === 'constellation').length, 88);
  assert.ok(index.filter(c => c.s === 'solar-eclipse').length >= 200, 'éclipses solaires');
  assert.ok(index.filter(c => c.s === 'gravitational-wave').length >= 50, 'ondes gravitationnelles');
  assert.ok(n('planet') > 400, 'système solaire');
});

test('exports CSV présents et cohérents', opt, () => {
  const csv = readFileSync(join(PUB, 'export', 'encyclopedie-spatiale.csv'), 'utf8');
  assert.equal(csv.trim().split('\n').length - 1, index.length, 'lignes CSV ≠ objets');
});
