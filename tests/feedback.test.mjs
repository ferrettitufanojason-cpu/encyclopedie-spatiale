// Avis : validation, anti-spam, modération (stockage fichier temporaire, sans réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, handlePublic, handleAdmin } from '../lib/feedback.mjs';

test('avis : validation des champs', () => {
  assert.ok(validate({ rating: 0, text: 'bonjour' }).error);
  assert.ok(validate({ rating: 6, text: 'bonjour' }).error);
  assert.ok(validate({ rating: 4, text: 'a' }).error);
  assert.ok(validate({ rating: 4, text: 'x'.repeat(1501) }).error);
  assert.ok(validate({ rating: 4, text: 'super site', website: 'http://spam' }).spam, 'champ piège');
  const ok = validate({ rating: 5, text: '  Très bien \u0007 !  ', name: 'Léa   la   curieuse', category: 'inconnue', page: 'kepler-452-b<script>' });
  assert.deepEqual(ok.item, { rating: 5, category: 'avis', text: 'Très bien  !', name: 'Léa la curieuse', page: 'kepler-452-bscript', lang: 'fr' });
});

test('avis : publication seulement après modération, anti-spam, mot de passe requis', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-'));
  const env = { FEEDBACK_LOCAL_FILE: join(dir, 'fb.json'), ADMIN_TOKEN: 'un-mot-de-passe-solide' };
  try {
    assert.equal((await handlePublic({ method: 'GET' }, {})).status, 503, 'désactivé sans stockage');
    assert.equal((await handlePublic({ method: 'POST', body: { rating: 5, text: 'Génial pour la classe' }, ip: '1.2.3.4' }, env)).status, 201);
    assert.equal((await handlePublic({ method: 'POST', body: { rating: 4, text: 'Encore un' }, ip: '1.2.3.4' }, env)).status, 429, 'une minute entre deux envois');
    assert.equal((await handlePublic({ method: 'GET' }, env)).json.items.length, 0, 'rien de public avant modération');
    assert.equal((await handleAdmin({ method: 'GET', auth: 'Bearer mauvais' }, env)).status, 401);
    const { pending } = (await handleAdmin({ method: 'GET', auth: 'Bearer un-mot-de-passe-solide' }, env)).json;
    assert.equal(pending.length, 1);
    assert.equal((await handleAdmin({ method: 'POST', auth: 'Bearer un-mot-de-passe-solide', body: { id: pending[0].id, action: 'approve' } }, env)).status, 200);
    const pub = (await handlePublic({ method: 'GET' }, env)).json;
    assert.equal(pub.items.length, 1);
    assert.deepEqual(pub.stats, { count: 1, average: 5, distribution: [0, 0, 0, 0, 1] });
    assert.ok(!('ip' in pub.items[0]) && !('status' in pub.items[0]), 'aucun champ interne exposé');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
