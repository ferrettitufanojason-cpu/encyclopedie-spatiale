// Autres jeux (/jeux/) : questions issues des données du site, jamais d'une valeur manquante, et réponse attendue toujours juste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../lib/games.mjs';
import * as G from '../lib/games-more.mjs';
import { MOON_TRAITS, MISSION_GOALS, BH_STATEMENTS, STAR_FATES, fateOf } from '../lib/games-content.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const F = join(ROOT, 'public', 'data', 'jeux.json');
const have = existsSync(F);
const opt = { skip: have ? false : 'public/data/jeux.json absent (lancer npm run build)' };
const d = have ? JSON.parse(readFileSync(F, 'utf8')) : {};
const descs = JSON.parse(readFileSync(join(ROOT, 'scripts', 'descriptions.json'), 'utf8'));
const BAD = /\b(null|undefined|NaN|Infinity)\b/;
const SEEDS = Array.from({ length: 150 }, (_, k) => k + 1);
const clean = Q => { for (const t of [Q.q, Q.explain, ...Q.choices.map(c => c.label)]) assert.doesNotMatch(String(t), BAD, t); assert.ok(Q.choices.some(c => c.id === Q.answer), 'la bonne réponse fait partie des choix'); assert.equal(new Set(Q.choices.map(c => c.id)).size, Q.choices.length, 'choix en double'); };

test('textes des jeux : chaque fait sur un objet figure dans sa description sur le site', () => {
  for (const t of [...MOON_TRAITS, ...MISSION_GOALS, ...BH_STATEMENTS.filter(b => b.id)]) {
    assert.ok(descs[t.id]?.fr, `${t.id} : pas de description sur le site`);
    assert.match(descs[t.id].fr, t.kw, `${t.id} : le fait du jeu ne figure pas dans la description`);
  }
});

test('Qui est le plus grand ? : la réponse est bien la plus grande valeur, jamais une valeur manquante', opt, () => {
  const by = Object.fromEntries(d.bodies.map(r => [r[0], G.bodyFromRow(r)]));
  for (const lang of ['fr', 'en']) for (const s of SEEDS) {
    const Q = G.biggerQuestion(d.bodies, rngFrom(s), lang, s % 2 ? 'simple' : 'detail'); clean(Q);
    const k = { radius: 'r', teq: 'teq', mass: 'm' }[Q.crit], [a, b] = Q.choices.map(c => by[c.id]);
    assert.ok(a[k] > 0 && b[k] > 0, 'valeur manquante utilisée');
    assert.equal(Q.answer, a[k] > b[k] ? a.i : b.i);
  }
});

test('lunes et missions : association et question simple cohérentes avec les tables', opt, () => {
  for (const s of SEEDS.slice(0, 40)) {
    for (const [M, table] of [[G.moonsMatch(d.moons, rngFrom(s), 'fr'), MOON_TRAITS], [G.missionsMatch(d.missions, rngFrom(s), 'en'), MISSION_GOALS]]) {
      assert.equal(M.left.length, 4);
      for (const l of M.left) { assert.ok(table.some(t => t.id === M.answer[l.id])); assert.doesNotMatch(M.explain[l.id], BAD); assert.ok(M.right.some(r => r.id === M.answer[l.id])); }
    }
    clean(G.moonQuestion(d.moons, rngFrom(s), 'fr')); clean(G.missionQuestion(d.missions, rngFrom(s), 'en'));
  }
});

test('Trous noirs : vrai/faux justes (distances SIMBAD réelles ou multipliées par 10)', opt, () => {
  const dist = Object.fromEntries(d.blackHoles.map(r => [r[1], r[2]]));
  let checked = 0;
  for (const s of SEEDS) {
    const Q = G.bhQuestion(d.blackHoles, rngFrom(s), 'fr'); clean(Q);
    const m = Q.q.match(/^Le trou noir (.+) se trouve à environ ([\d\s ,]+) années-lumière/);
    if (m) { checked++; const shown = Number(m[2].replace(/[\s ]/g, '').replace(',', '.')), real = dist[m[1]]; assert.equal(Q.answer === 'true', Math.abs(shown - real) / real < 0.1, `${m[1]} : ${shown} vs ${real}`); }
  }
  assert.ok(checked > 10, 'les affirmations chiffrées ont bien été vérifiées');
});

test('Vie d’une étoile : seuils croissants, question jamais posée près d’un seuil', () => {
  assert.deepEqual(STAR_FATES.map(f => f.max), [0.08, 8, 20, Infinity]);
  assert.equal(fateOf(1).fate, 'white-dwarf'); assert.equal(fateOf(0.05).fate, 'brown-dwarf'); assert.equal(fateOf(12).fate, 'neutron-star'); assert.equal(fateOf(40).fate, 'black-hole');
  for (const s of SEEDS) { const Q = G.starFateQuestion(rngFrom(s), 'fr'); clean(Q); const m = Number(Q.q.match(/de ([\d,]+) fois/)[1].replace(',', '.'));
    for (const f of STAR_FATES.slice(0, 3)) assert.ok(Math.abs(Math.log(m / f.max)) > 0.2, `masse ${m} trop proche du seuil ${f.max}`); }
});

test('Chasseur d’exoplanètes : profondeur réelle, baisses aux bons endroits, rayon retrouvé = rayon publié', opt, () => {
  for (const s of SEEDS.slice(0, 40)) {
    const row = d.transits[s % d.transits.length], cv = G.transitCurve(row, rngFrom(s));
    assert.ok(cv.dips.length >= 2, 'au moins deux passages visibles');
    const p = cv.planet; assert.ok(p.depth >= 0.002 && p.r > 0 && p.rs > 0 && p.per > 0);
    assert.ok(Math.abs(G.transitRadius(p) - p.r) / p.r < 0.01, `${p.i} : rayon calculé ${G.transitRadius(p)} ≠ ${p.r}`);
  }
});

test('Relie les étoiles : projection dans le cadre, étoile la plus brillante = plus petite magnitude', opt, () => {
  for (const c of d.constellations) {
    const P = G.projectStars(c.stars); for (const p of P) assert.ok(p.x >= -1e-9 && p.x <= 1 + 1e-9 && p.y >= -1e-9 && p.y <= 1 + 1e-9);
    const Q = G.brightestQuestion(c, 'fr'); clean(Q); assert.equal(Q.answer, [...c.stars].sort((a, b) => a[4] - b[4])[0][0]);
    if (c.chart) assert.ok(c.chart.credit && c.chart.license && c.chart.source, `${c.i} : carte sans crédit`);
  }
  const orion = d.constellations.find(c => c.i === 'constellation-orion'), P = Object.fromEntries(G.projectStars(orion.stars).map(p => [p.n, p]));
  assert.ok(P.Betelgeuse.x < P.Rigel.x && P.Betelgeuse.y < P.Rigel.y, 'Orion : Bételgeuse en haut à gauche, Rigel en bas à droite');
});

test('Le ciel de ce soir : chaque question vient des données de l’événement et ne dévoile pas la réponse', opt, () => {
  let n = 0;
  for (const e of d.events) for (const lang of ['fr', 'en']) {
    const Q = G.eventQuestion(e, d.events, rngFrom(1), lang); if (!Q) continue; n++; clean(Q);
    if (e.s === 'meteor-shower') assert.equal(Q.answer, String(e.zhr));
    if (e.s === 'elongation') { assert.equal(Q.answer, G.eventKind(e)); assert.doesNotMatch(Q.q, /matin|soir|morning|evening/i); }
    if (e.s.endsWith('eclipse')) { assert.equal(Q.answer, G.eventKind(e)); assert.doesNotMatch(Q.q, /annul|total|partiel|partial|pénombre|penumbral|hybrid/i); }
  }
  assert.ok(n > 20);
});

test('Choisis ta destination : durées de Hohmann classiques, dangers sans valeur manquante', opt, () => {
  const earth = d.planets.find(p => p.i === 'earth').sma, mars = d.destinations.find(t => t.i === 'mars');
  const days = G.trip(mars, earth).days; assert.ok(days > 250 && days < 270, `Terre → Mars : ${days} j (attendu ≈ 259 j)`);
  for (const t of d.destinations) for (const lang of ['fr', 'en']) {
    const T = G.trip(t, earth, lang); for (const x of [T.dur, T.hyp, ...T.dangers, ...T.bag]) assert.doesNotMatch(x, BAD);
    if (t.teq == null) assert.ok(!T.dangers.some(x => /°C/.test(x)), `${t.i} : température inventée`);
    clean(G.tripQuestion(t, earth, rngFrom(3), lang));
  }
});

test('Défi du jour et Duel : question du jour identique pour tous, série de jours correcte', opt, () => {
  for (const day of ['2026-12-01', '2027-03-15']) assert.deepEqual(G.mixedQuestion(d, rngFrom(`defi-${day}`), 'fr', 'simple', day), G.mixedQuestion(d, rngFrom(`defi-${day}`), 'fr', 'simple', day));
  for (const s of SEEDS) clean(G.mixedQuestion(d, rngFrom(s), s % 2 ? 'fr' : 'en'));
  assert.equal(G.nextStreak(null, '2026-12-01'), 1);
  assert.equal(G.nextStreak({ last: '2026-11-30', streak: 4 }, '2026-12-01'), 5);
  assert.equal(G.nextStreak({ last: '2026-12-01', streak: 4 }, '2026-12-01'), 4);
  assert.equal(G.nextStreak({ last: '2026-11-28', streak: 4 }, '2026-12-01'), 1);
  assert.equal(G.nextStreak({ last: '2026-12-31', streak: 2 }, '2027-01-01'), 3);
});
