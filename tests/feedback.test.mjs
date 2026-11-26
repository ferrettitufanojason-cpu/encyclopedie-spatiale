// Avis : validation, filtre automatique, publication immédiate, signalements, anti-spam (stockage fichier temporaire, sans réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, screen, handlePublic, handleAdmin, REPORTS_TO_HIDE } from '../lib/feedback.mjs';

test('avis : validation des champs', () => {
  assert.ok(validate({ rating: 0, text: 'bonjour' }).error);
  assert.ok(validate({ rating: 6, text: 'bonjour' }).error);
  assert.ok(validate({ rating: 4, text: 'a' }).error);
  assert.ok(validate({ rating: 4, text: 'x'.repeat(1501) }).error);
  assert.ok(validate({ rating: 4, text: 'super site', website: 'http://spam' }).spam, 'champ piège');
  const ok = validate({ rating: 5, text: '  Très bien \u0007 !  ', name: 'Léa   la   curieuse', category: 'inconnue', page: 'kepler-452-b<script>' });
  assert.deepEqual(ok.item, { rating: 5, category: 'avis', text: 'Très bien  !', name: 'Léa la curieuse', page: 'kepler-452-bscript', lang: 'fr' });
});

test('avis : filtre automatique (messages normaux publiés, liens / e-mails / téléphones / gros mots bloqués)', () => {
  const clean = ['Super site pour la classe, merci !', 'Kepler-455 et TOI-1452 b sont super', 'L’opposition de Mars le 20/02/2027 est géniale', 'Le fils de mon voisin adore',
    'Erreur : la masse de Jupiter est 1,898×10^27 kg', 'J ai 12 ans et j adore les planètes', 'La constellation du Cygne est belle', 'Le contre-exemple de Pluton',
    'Les éclipses de 2026, 2027 et 2028', 'HD 209458 b, 51 Peg b, Gaia DR3 2079597124345617280', 'La galaxie M 87 est à 56 millions d’années-lumière', 'Great site, the Saturn page is amazing'];
  const blocked = ['Le site class.fr est cité', 'C est vraiment de la m3rde', 'connnnard', 'visitez www.spam-site.com', 'écris moi a lea@mail.fr', 'appelle 06 12 34 56 78',
    'm e r d e', 'fuck this', 'Ferme ta gueule', 'p u t a i n', 'sh1t'];
  for (const t of clean) assert.deepEqual(screen({ text: t }), [], t);
  for (const t of blocked) assert.ok(screen({ text: t }).length > 0, t);
  assert.ok(screen({ text: 'Bonjour', name: 'connard' }).length > 0, 'le pseudo est aussi filtré');
});

test('avis : publication immédiate, mise de côté automatique, signalements, anti-spam, modération facultative', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-'));
  const env = { FEEDBACK_LOCAL_FILE: join(dir, 'fb.json'), ADMIN_TOKEN: 'un-mot-de-passe-solide' };
  const post = (body, ip) => handlePublic({ method: 'POST', body, ip }, env);
  try {
    assert.equal((await handlePublic({ method: 'GET' }, {})).status, 503, 'désactivé sans stockage');
    const r1 = await post({ rating: 5, text: 'Génial pour la classe' }, '1.1.1.1');
    assert.equal(r1.status, 201); assert.equal(r1.json.published, true);
    assert.equal((await post({ rating: 4, text: 'Encore un' }, '1.1.1.1')).status, 429, 'une minute entre deux envois');
    const r2 = await post({ rating: 1, text: 'site de merde' }, '2.2.2.2');
    assert.equal(r2.json.published, false); assert.deepEqual(r2.json.reasons, ['langage inapproprié']);
    let pub = (await handlePublic({ method: 'GET' }, env)).json;
    assert.equal(pub.items.length, 1, 'seul le message propre est public');
    assert.deepEqual(pub.stats, { count: 1, average: 5, distribution: [0, 0, 0, 0, 1] });
    assert.ok(!('held' in pub.items[0]) && !('status' in pub.items[0]), 'aucun champ interne exposé');
    // signalements : une même personne ne compte qu'une fois ; masqué au 3e signalement distinct
    const id = pub.items[0].id;
    for (let k = 0; k < 3; k++) await handlePublic({ method: 'POST', body: { action: 'report', id }, ip: '9.9.9.9' }, env);
    assert.equal((await handlePublic({ method: 'GET' }, env)).json.items.length, 1, 'trois signalements de la même personne = un seul');
    for (let k = 1; k < REPORTS_TO_HIDE; k++) await handlePublic({ method: 'POST', body: { action: 'report', id }, ip: `8.8.8.${k}` }, env);
    assert.equal((await handlePublic({ method: 'GET' }, env)).json.items.length, 0, 'masqué après 3 signalements distincts');
    // modération facultative : mot de passe requis, voit les messages mis de côté avec la raison
    assert.equal((await handleAdmin({ method: 'GET', auth: 'Bearer mauvais' }, env)).status, 401);
    const { pending } = (await handleAdmin({ method: 'GET', auth: 'Bearer un-mot-de-passe-solide' }, env)).json;
    assert.equal(pending.length, 2);
    assert.ok(pending.every(it => it.held));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
