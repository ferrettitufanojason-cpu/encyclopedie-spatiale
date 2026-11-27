// Niveaux scolaires des jeux (primaire, collège, lycée, université) : chaque niveau donne les questions prévues,
// et la réponse attendue reste juste à tous les niveaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngFrom, SCHOOL_LEVELS, orderPuzzle, guessPuzzle, hintsFor, habitablePuzzle, exoFromRow } from '../lib/games.mjs';
import * as G from '../lib/games-more.mjs';
import { FAMOUS_MOONS, FAMOUS_MISSIONS, BH_STATEMENTS } from '../lib/games-content.mjs';

const F = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'data', 'jeux.json');
const have = existsSync(F);
const opt = { skip: have ? false : 'public/data/jeux.json absent (lancer npm run build)' };
const d = have ? JSON.parse(readFileSync(F, 'utf8')) : {};
const BAD = /\b(null|undefined|NaN|Infinity)\b/;
const SEEDS = Array.from({ length: 80 }, (_, k) => k + 1);
const valid = Q => { assert.ok(Q, 'question absente'); assert.ok(Q.choices.some(c => c.id === Q.answer)); for (const t of [Q.q, Q.explain, ...Q.choices.map(c => c.label)]) assert.doesNotMatch(String(t), BAD); };

test('ordre des planètes : 4, 6, 8, 8 planètes, toujours rangées par distance au Soleil', opt, () => {
  SCHOOL_LEVELS.forEach((lv, k) => { for (const s of SEEDS.slice(0, 20)) {
    const pz = orderPuzzle(d.planets, rngFrom(s), lv), sma = id => d.planets.find(p => p.i === id).sma;
    assert.equal(pz.answer.length, [4, 6, 8, 8][k]);
    for (let j = 1; j < pz.answer.length; j++) assert.ok(sma(pz.answer[j - 1]) < sma(pz.answer[j]));
  } });
});

test('devine la planète : 3 / 4 / 6 / 8 planètes proposées, indices concrets au primaire, une seule planète possible', opt, () => {
  SCHOOL_LEVELS.forEach((lv, k) => { for (const s of SEEDS) {
    const pz = guessPuzzle(d.planets, rngFrom(s), 'fr', 'simple', lv);
    assert.equal(pz.choices.length, [3, 4, 6, 8][k]); assert.ok(pz.choices.includes(pz.target));
    if (lv === 'primaire') for (const h of pz.hints) assert.ok(['size', 'temp', 'moons', 'rank', 'year'].includes(h), `indice trop difficile au primaire : ${h}`);
    const text = p => { const H = hintsFor(p, 'fr', 'simple', lv); return pz.hints.map(key => H.find(h => h.key === key)?.text ?? '∅').join('|'); };
    const target = d.planets.find(p => p.i === pz.target);
    assert.deepEqual(d.planets.filter(p => text(p) === text(target)).map(p => p.i), [pz.target]);
  } });
});

test('qui est le plus grand : au primaire, seulement la taille d’astres très connus avec un écart net', opt, () => {
  const by = Object.fromEntries(d.bodies.map(r => [r[0], G.bodyFromRow(r)]));
  for (const s of SEEDS) {
    const Q = G.biggerQuestion(d.bodies, rngFrom(s), 'fr', 'simple', 'primaire'); valid(Q);
    assert.equal(Q.crit, 'radius');
    const [a, b] = Q.choices.map(c => by[c.id]);
    for (const o of [a, b]) assert.ok(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(o.i), o.i);
    assert.ok(Math.max(a.r, b.r) / Math.min(a.r, b.r) >= 1.5);
    assert.equal(Q.answer, a.r > b.r ? a.i : b.i);
  }
  for (const lv of SCHOOL_LEVELS) for (const s of SEEDS.slice(0, 30)) valid(G.biggerQuestion(d.bodies, rngFrom(s), 'fr', 'simple', lv));
});

test('lunes et missions : objets très connus et 3 paires au primaire, 5 à l’université', opt, () => {
  for (const s of SEEDS.slice(0, 30)) {
    const m = G.moonsMatch(d.moons, rngFrom(s), 'fr', 'primaire'); assert.equal(m.left.length, 3); for (const l of m.left) assert.ok(FAMOUS_MOONS.includes(l.id));
    const x = G.missionsMatch(d.missions, rngFrom(s), 'fr', 'primaire'); assert.equal(x.left.length, 3); for (const l of x.left) assert.ok(FAMOUS_MISSIONS.includes(l.id));
    assert.equal(G.moonsMatch(d.moons, rngFrom(s), 'fr', 'universite').left.length, 5);
    const q = G.missionQuestion(d.missions, rngFrom(s), 'fr', 'primaire'); valid(q); assert.equal(q.choices.length, 3); for (const c of q.choices) assert.ok(FAMOUS_MISSIONS.includes(c.id));
  }
});

test('trous noirs : pas de chiffres au primaire ni au collège, affirmations simples au primaire', opt, () => {
  const hard = BH_STATEMENTS.filter(x => x.min).map(x => x.fr);
  for (const s of SEEDS) {
    const p = G.bhQuestion(d.blackHoles, rngFrom(s), 'fr', 'primaire'); valid(p);
    assert.doesNotMatch(p.q, /années-lumière/); assert.ok(!hard.includes(p.q), 'affirmation réservée au lycée');
    assert.doesNotMatch(G.bhQuestion(d.blackHoles, rngFrom(s), 'fr', 'college').q, /années-lumière/);
  }
});

test('vie d’une étoile : 2 fins possibles au primaire, 3 au collège, 4 ensuite', () => {
  SCHOOL_LEVELS.forEach((lv, k) => { for (const s of SEEDS.slice(0, 30)) { const Q = G.starFateQuestion(rngFrom(s), 'fr', lv); valid(Q); assert.equal(Q.choices.length, [2, 3, 4, 4][k]); } });
});

test('habitable ou pas : cas nets au primaire et au collège, réponse toujours conforme à la zone calculée', opt, () => {
  for (const lv of ['primaire', 'college']) for (const s of SEEDS) {
    const { exo: e, answer } = habitablePuzzle(d.exoplanets, rngFrom(s), lv);
    assert.equal(answer, e.sma >= e.hi && e.sma <= e.ho);
    if (answer) assert.ok(e.sma >= e.hi * 1.1 && e.sma <= e.ho * 0.9, `${e.i} trop près du bord`);
    else assert.ok(e.sma < e.hi * 0.5 || e.sma > e.ho * 2, `${e.i} trop près de la zone`);
  }
});

test('ciel de ce soir : au primaire, seulement planètes visibles et étoiles filantes, 2 réponses très différentes', opt, () => {
  let n = 0;
  for (const e of d.events) {
    const Q = G.eventQuestion(e, d.events, rngFrom(1), 'fr', 'primaire'); if (!Q) continue; n++; valid(Q);
    assert.ok(['opposition', 'elongation', 'meteor-shower'].includes(e.s), e.s);
    if (e.s === 'meteor-shower') { assert.equal(Q.choices.length, 2); const [a, b] = Q.choices.map(c => Number(c.id)); assert.ok(Math.max(a, b) / Math.min(a, b) >= 3); }
  }
  assert.ok(n > 5, 'assez de questions au primaire');
});

test('relie les étoiles et destination : moins de choix et leurres plus éloignés aux petits niveaux', opt, () => {
  for (const c of d.constellations) { const Q = G.brightestQuestion(c, 'fr', 'primaire'); valid(Q); assert.equal(Q.choices.length, 3); }
  const earth = d.planets.find(p => p.i === 'earth').sma;
  for (const t of d.destinations) for (const lv of SCHOOL_LEVELS) valid(G.tripQuestion(t, earth, rngFrom(2), 'fr', lv));
});

test('défi du jour et duel : une question valable à chaque niveau, identique pour un même jour et un même niveau', opt, () => {
  for (const lv of SCHOOL_LEVELS) {
    for (const s of SEEDS.slice(0, 40)) valid(G.mixedQuestion(d, rngFrom(s), 'fr', 'simple', d.built, lv));
    const a = G.mixedQuestion(d, rngFrom(`defi-2026-12-01-${lv}`), 'fr', 'simple', '2026-12-01', lv), b = G.mixedQuestion(d, rngFrom(`defi-2026-12-01-${lv}`), 'fr', 'simple', '2026-12-01', lv);
    assert.deepEqual(a, b);
  }
});
