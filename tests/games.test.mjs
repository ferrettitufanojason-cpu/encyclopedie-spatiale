// Jeux (/jeux/) : les questions viennent des vraies données (public/data/jeux.json, construit par npm run build),
// n'utilisent jamais une valeur manquante, et la réponse attendue est toujours juste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderPuzzle, checkOrder, planetHints, guessPuzzle, habitablePuzzle, habitableFacts, habitableExplain, exoFromRow, rngFrom, badgesFor, nextBadge, BADGES } from '../lib/games.mjs';

const F = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'data', 'jeux.json');
const have = existsSync(F);
const opt = { skip: have ? false : 'public/data/jeux.json absent (lancer npm run build)' };
const data = have ? JSON.parse(readFileSync(F, 'utf8')) : { planets: [], exoplanets: [] };
const BAD = /\b(null|undefined|NaN|Infinity)\b/;
const SEEDS = Array.from({ length: 300 }, (_, k) => k + 1);

test('jeux.json : 8 planètes classées, aucune valeur impossible conservée', opt, () => {
  assert.equal(data.planets.length, 8);
  assert.deepEqual(data.planets.map(p => p.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const p of data.planets) for (const k of ['sma', 'teq', 'per', 'g', 'r', 'm']) assert.ok(p[k] == null || p[k] > 0, `${p.i}.${k} = ${p[k]}`);
  assert.equal(data.planets.find(p => p.i === 'mercury').teq, null, 'Mercure : 0 K dans la source = valeur manquante');
  for (const p of data.planets) if (p.img) assert.ok(p.img.credit && p.img.license && p.img.source, `${p.i} : image sans crédit/licence`);
});

test('L’ordre des planètes : réponse = ordre des demi-grands axes, correction et indice justes', opt, () => {
  const truth = [...data.planets].sort((a, b) => a.sma - b.sma).map(p => p.i);
  for (const s of SEEDS.slice(0, 50)) {
    const pz = orderPuzzle(data.planets, rngFrom(s));
    assert.deepEqual(pz.answer, truth);
    assert.notDeepEqual(pz.start, pz.answer, 'la partie ne commence jamais déjà résolue');
    assert.equal(checkOrder(data.planets, pz.answer, pz.answer).ok, true);
    const r = checkOrder(data.planets, pz.answer, pz.start, 'fr', 'detail');
    assert.equal(r.ok, false);
    const [closer, placed] = r.pair.map(id => data.planets.find(p => p.i === id));
    assert.ok(closer.sma < placed.sma, 'l’indice désigne bien la planète la plus proche du Soleil');
    assert.doesNotMatch(r.hint, BAD);
  }
  // une distance manquante : le jeu n'est pas proposé
  assert.equal(orderPuzzle(data.planets.map((p, k) => (k === 3 ? { ...p, sma: null } : p)), rngFrom(1)), null);
});

test('Devine la planète : jamais d’indice sur une donnée manquante, et les 3 indices désignent une seule planète', opt, () => {
  for (const lang of ['fr', 'en']) for (const mode of ['simple', 'detail']) {
    for (const p of data.planets) {
      const H = planetHints(p, lang, mode);
      for (const h of H) assert.doesNotMatch(h.text, BAD, `${p.i}/${h.key} : ${h.text}`);
      if (p.teq == null) assert.ok(!H.some(h => h.key === 'temp'), `${p.i} : indice de température sans donnée`);
    }
    for (const s of SEEDS.slice(0, 80)) {
      const pz = guessPuzzle(data.planets, rngFrom(s), lang, mode);
      assert.equal(pz.hints.length, 3); assert.equal(new Set(pz.hints).size, 3);
      const text = p => { const H = planetHints(p, lang, mode); return pz.hints.map(k => H.find(h => h.key === k)?.text ?? '∅').join('|'); };
      const target = data.planets.find(p => p.i === pz.target);
      assert.ok(!text(target).includes('∅'), 'indice absent pour la planète cible');
      const same = data.planets.filter(p => text(p) === text(target));
      assert.deepEqual(same.map(p => p.i), [pz.target], `indices ambigus (graine ${s}) : ${text(target)}`);
    }
  }
  // une planète sans température : l'indice n'existe pas
  assert.ok(!planetHints({ ...data.planets[4], teq: null }).some(h => h.key === 'temp'));
});

test('Habitable ou pas ? : réponse conforme à la zone habitable calculée, aucune valeur manquante affichée', opt, () => {
  assert.ok(data.exoplanets.length > 1000);
  for (const row of data.exoplanets) {
    const e = exoFromRow(row);
    assert.equal(e.sma >= e.hi && e.sma <= e.ho, e.inHz === 1, `${e.i} : drapeau incohérent avec les bornes`);
  }
  let inside = 0;
  for (const s of SEEDS) {
    const { exo: e, answer, where } = habitablePuzzle(data.exoplanets, rngFrom(s));
    for (const k of ['sma', 'hi', 'ho', 'teq', 'r', 'st']) assert.ok(e[k] > 0, `${e.i}.${k}`);
    assert.equal(answer, e.sma >= e.hi && e.sma <= e.ho);
    assert.equal(where === 'inside', answer);
    if (where === 'tooClose') assert.ok(e.sma < e.hi); if (where === 'tooFar') assert.ok(e.sma > e.ho);
    for (const lang of ['fr', 'en']) for (const mode of ['simple', 'detail']) {
      for (const t of habitableFacts(e, lang, mode)) assert.doesNotMatch(t, BAD);
      const ex = habitableExplain(e, where, lang, mode);
      assert.doesNotMatch(ex, BAD);
      assert.match(ex, lang === 'fr' ? /ne veut pas dire « habitée »/ : /does not mean “inhabited”/);
    }
    inside += answer;
  }
  assert.ok(inside > 90 && inside < 210, `équilibre oui/non : ${inside} / 300`);
  // lignes incomplètes : jamais tirées
  const rows = [['x', 'X', 1, 0.9, 1.5, 1, null, 1, 5000, null, null], ...data.exoplanets.slice(0, 5)];
  for (const s of SEEDS.slice(0, 50)) assert.notEqual(habitablePuzzle(rows, rngFrom(s)).exo.i, 'x');
});

test('badges : paliers croissants', () => {
  assert.deepEqual(BADGES.map(b => b.fr), ['Petit explorateur', 'Astronome', 'Cosmonaute']);
  assert.equal(badgesFor(0).length, 0); assert.equal(badgesFor(50).length, 1); assert.equal(badgesFor(10000).length, 3);
  assert.equal(nextBadge(60).id, 'astronomer'); assert.equal(nextBadge(10000), null);
});
