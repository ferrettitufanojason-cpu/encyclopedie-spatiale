// Pages par objet (/objet/<id>), glossaire et parcours : nécessitent le site construit (npm run build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderObjectPage } from '../lib/objet-page.mjs';
import { GLOSSARY, PROP_GLOSS } from '../src/data/glossary.mjs';

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const getText = async p => { const f = join(DIST, normalize(p).replace(/^([/\\])+/, '')); return existsSync(f) ? readFile(f, 'utf8') : null; };

test('page /objet/<id> : titre, description, adresse canonique, contenu lisible sans JavaScript, sources', async () => {
  const { status, html } = await renderObjectPage('kepler-452-b', getText, 'https://exemple.org');
  assert.equal(status, 200);
  assert.match(html, /<title>Kepler-452 b — Encyclopédie spatiale<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/exemple\.org\/objet\/kepler-452-b">/);
  assert.equal((html.match(/<title>/g) ?? []).length, 1, 'un seul <title>');
  assert.equal((html.match(/<meta name="description"/g) ?? []).length, 1, 'une seule description');
  assert.match(html, /<article id="ssr"/);
  assert.match(html, /NASA Exoplanet Archive/);
  assert.match(html, /valeur estimée/, 'la masse estimée par la NASA est signalée');
});

test('page /objet/<id> : identifiant inconnu ou invalide → 404', async () => {
  assert.equal((await renderObjectPage('objet-qui-n-existe-pas', getText, 'https://exemple.org')).status, 404);
  assert.equal((await renderObjectPage('../../etc/passwd', getText, 'https://exemple.org')).status, 404);
});

test('glossaire : identifiants uniques, chaque lien des fiches pointe vers une entrée existante', () => {
  const ids = GLOSSARY.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [k, id] of Object.entries(PROP_GLOSS)) assert.ok(ids.includes(id), `${k} → ${id}`);
  for (const g of GLOSSARY) for (const l of ['fr', 'en']) assert.ok(g[l][0] && g[l][1].length > 40, `${g.id} (${l})`);
});

test('pages construites : parcours, glossaire, mentions légales, 404, plan du site', async () => {
  for (const p of ['/parcours/index.html', '/glossaire/index.html', '/mentions-legales/index.html', '/404.html']) assert.ok(await getText(p), p);
  const parcours = await getText('/parcours/index.html');
  assert.ok(!/undefined|NaN/.test(parcours), 'aucune réponse de parcours vide ou non calculée');
  const sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
  assert.ok((sitemap.match(/<url>/g) ?? []).length > 10000, 'toutes les fiches sont dans le plan du site');
});
