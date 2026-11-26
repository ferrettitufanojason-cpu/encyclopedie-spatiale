// Avis des visiteurs : note (1 à 5 étoiles), catégorie, message, pseudo facultatif.
// Principes : aucune donnée personnelle demandée (pas d'e-mail), publication seulement après modération,
// anti-spam par empreinte d'adresse IP brouillée (non réversible) conservée une minute (RATE_SECONDS).
//
// Stockage :
//  - en ligne : Redis Upstash (intégration Vercel « Upstash for Redis »), variables KV_REST_API_URL / KV_REST_API_TOKEN
//    (ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) ;
//  - en local : un fichier JSON (FEEDBACK_LOCAL_FILE), utilisé par scripts/serve-local.mjs ;
//  - sinon : fonction désactivée (réponse 503, le site l'indique).
// Modération : jeton ADMIN_TOKEN (variable d'environnement, jamais dans le code).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const CATEGORIES = ['avis', 'idee', 'probleme', 'erreur'];
const MAX_TEXT = 1500, MAX_NAME = 40, MAX_PAGE = 120, RATE_SECONDS = 60, PUBLIC_LIMIT = 100;

// ---------- validation ----------
const clean = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+\n/g, '\n').trim();
export function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Requête invalide.' };
  if (clean(body.website)) return { spam: true }; // champ piège invisible : rempli seulement par les robots
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Choisissez une note de 1 à 5 étoiles.' };
  const category = CATEGORIES.includes(body.category) ? body.category : 'avis';
  const text = clean(body.text);
  if (text.length < 3) return { error: 'Écrivez au moins quelques mots.' };
  if (text.length > MAX_TEXT) return { error: `Message trop long (${MAX_TEXT} caractères au maximum).` };
  const name = clean(body.name).replace(/\s+/g, ' ').slice(0, MAX_NAME);
  const page = clean(body.page).slice(0, MAX_PAGE).replace(/[^\w\-+./:?=&#%]/g, '');
  const lang = body.lang === 'en' ? 'en' : 'fr';
  return { item: { rating, category, text, name, page, lang } };
}

// ---------- stockage ----------
function redisStore(url, token) {
  const call = async cmds => {
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
    if (!r.ok) throw new Error(`stockage ${r.status}`);
    const out = await r.json();
    for (const x of out) if (x.error) throw new Error(x.error);
    return out.map(x => x.result);
  };
  const getMany = async ids => (ids.length ? (await call([['MGET', ...ids.map(i => `fb:${i}`)]]))[0].filter(Boolean).map(s => JSON.parse(s)) : []);
  return {
    async rateOk(key) { return (await call([['SET', `fb:rl:${key}`, '1', 'EX', String(RATE_SECONDS), 'NX']]))[0] === 'OK'; },
    async add(it) { await call([['SET', `fb:${it.id}`, JSON.stringify(it)], ['LPUSH', 'fb:pending', it.id]]); },
    async list(status, n = PUBLIC_LIMIT) { return getMany((await call([['LRANGE', `fb:${status}`, '0', String(n - 1)]]))[0]); },
    async move(id, from, to) {
      const [raw] = await call([['GET', `fb:${id}`]]); if (!raw) return false;
      const it = { ...JSON.parse(raw), status: to ?? 'deleted', moderated: new Date().toISOString() };
      const cmds = [['LREM', `fb:${from}`, '0', id]];
      if (to) cmds.push(['SET', `fb:${id}`, JSON.stringify(it)], ['LPUSH', `fb:${to}`, id]); else cmds.push(['DEL', `fb:${id}`]);
      await call(cmds); return true;
    },
  };
}
function fileStore(file) {
  const load = async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return { items: {}, pending: [], approved: [], rejected: [], rl: {} }; } };
  const save = async db => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(db, null, 1)); };
  return {
    async rateOk(key) { const db = await load(), now = Date.now(); if ((db.rl[key] ?? 0) > now) return false; db.rl[key] = now + RATE_SECONDS * 1000; await save(db); return true; },
    async add(it) { const db = await load(); db.items[it.id] = it; db.pending.unshift(it.id); await save(db); },
    async list(status, n = PUBLIC_LIMIT) { const db = await load(); return (db[status] ?? []).slice(0, n).map(i => db.items[i]).filter(Boolean); },
    async move(id, from, to) {
      const db = await load(); if (!db.items[id]) return false;
      db[from] = db[from].filter(x => x !== id);
      if (to) { db.items[id] = { ...db.items[id], status: to, moderated: new Date().toISOString() }; db[to].unshift(id); } else delete db.items[id];
      await save(db); return true;
    },
  };
}
export function getStore(env = process.env) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL, token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(url, token);
  if (env.FEEDBACK_LOCAL_FILE) return fileStore(env.FEEDBACK_LOCAL_FILE);
  return null;
}

// ---------- traitement des requêtes (partagé entre Vercel et le serveur local) ----------
const pub = it => ({ id: it.id, rating: it.rating, category: it.category, text: it.text, name: it.name || null, date: it.date.slice(0, 10), page: it.page || null, lang: it.lang });
const stats = items => {
  const dist = [0, 0, 0, 0, 0]; for (const it of items) dist[it.rating - 1]++;
  return { count: items.length, average: items.length ? Math.round(items.reduce((s, it) => s + it.rating, 0) / items.length * 10) / 10 : null, distribution: dist };
};
const ipKey = (ip, salt) => createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 24); // empreinte non réversible

export async function handlePublic({ method, body, ip }, env = process.env) {
  const store = getStore(env);
  if (!store) return { status: 503, json: { error: 'Les avis ne sont pas encore activés sur ce site.', disabled: true } };
  if (method === 'GET') {
    const items = await store.list('approved');
    return { status: 200, json: { items: items.map(pub), stats: stats(items) }, cache: 30 };
  }
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } };
  const v = validate(body);
  if (v.spam) return { status: 200, json: { ok: true } }; // on ne dit rien au robot
  if (v.error) return { status: 400, json: { error: v.error } };
  if (!(await store.rateOk(ipKey(ip ?? 'inconnue', env.ADMIN_TOKEN ?? 'sel-local')))) return { status: 429, json: { error: 'Merci ! Attendez une minute avant d’envoyer un autre avis.' } };
  const it = { id: `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`, ...v.item, date: new Date().toISOString(), status: 'pending' };
  await store.add(it);
  return { status: 201, json: { ok: true } };
}

const sameSecret = (a, b) => { const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? '')); return x.length > 0 && x.length === y.length && timingSafeEqual(x, y); };
export async function handleAdmin({ method, body, auth }, env = process.env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 12) return { status: 503, json: { error: 'Modération non configurée : définissez ADMIN_TOKEN (12 caractères au moins).' } };
  if (!sameSecret(String(auth ?? '').replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN)) return { status: 401, json: { error: 'Mot de passe de modération incorrect.' } };
  const store = getStore(env);
  if (!store) return { status: 503, json: { error: 'Stockage des avis non configuré.' } };
  if (method === 'GET') {
    const [pending, approved] = await Promise.all([store.list('pending', 200), store.list('approved', 200)]);
    return { status: 200, json: { pending, approved } };
  }
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } };
  const { id, action } = body ?? {};
  if (!/^[a-z0-9]{8,40}$/.test(String(id))) return { status: 400, json: { error: 'Identifiant invalide.' } };
  // refuser = supprimer (rien n'est conservé)
  const moves = { approve: ['pending', 'approved'], reject: ['pending', null], unpublish: ['approved', 'pending'], delete: [body.from === 'approved' ? 'approved' : 'pending', null] };
  if (!moves[action]) return { status: 400, json: { error: 'Action inconnue.' } };
  const ok = await store.move(id, ...moves[action]);
  return ok ? { status: 200, json: { ok: true } } : { status: 404, json: { error: 'Avis introuvable.' } };
}
