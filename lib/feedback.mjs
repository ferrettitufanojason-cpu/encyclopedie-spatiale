// Avis des visiteurs : note (1 à 5 étoiles), catégorie, message, pseudo facultatif.
// Fonctionnement SANS modération manuelle :
//  - un filtre automatique publie immédiatement les messages « propres » ;
//  - un message contenant un lien, une adresse e-mail, un numéro de téléphone ou un mot grossier/injurieux n'est PAS publié :
//    il est mis de côté et s'efface tout seul au bout de 30 jours (HOLD_DAYS) ;
//  - chaque avis publié peut être signalé par les visiteurs : à 3 signalements de personnes différentes (REPORTS_TO_HIDE),
//    il est masqué automatiquement (même effacement au bout de 30 jours).
//  - la page /avis/moderation/ (mot de passe ADMIN_TOKEN) reste disponible mais n'est pas nécessaire.
// Aucune donnée personnelle demandée (pas d'e-mail). Anti-spam : empreinte d'adresse IP brouillée (non réversible),
// conservée une minute pour les envois (RATE_SECONDS) et 90 jours pour éviter qu'une même personne signale deux fois.
//
// Stockage : Redis Upstash en ligne (KV_REST_API_URL / KV_REST_API_TOKEN, ou UPSTASH_REDIS_REST_URL / _TOKEN),
// fichier JSON en local (FEEDBACK_LOCAL_FILE), sinon fonction désactivée (503).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const CATEGORIES = ['avis', 'idee', 'probleme', 'erreur'];
const MAX_TEXT = 1500, MAX_NAME = 40, MAX_PAGE = 120, RATE_SECONDS = 60, PUBLIC_LIMIT = 100;
export const HOLD_DAYS = 30, REPORTS_TO_HIDE = 3;
const REPORT_DAYS = 90;

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

// ---------- filtre automatique ----------
// Mots grossiers, injurieux ou haineux (français et anglais), comparés après normalisation :
// minuscules, sans accents, chiffres « leet » remplacés (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), lettres répétées réduites.
const BAD = [
  // français
  'con', 'conne', 'connard', 'conard', 'connasse', 'connards', 'cons', 'salope', 'salopes', 'salaud', 'salauds', 'pute', 'putes', 'putain', 'ptn', 'merde', 'merdes', 'merdique',
  'encule', 'encules', 'enculer', 'enculee', 'batard', 'batards', 'nique', 'niquer', 'niquez', 'ntm', 'fdp', 'tg', 'pd', 'pede', 'pedes', 'tapette', 'gouine',
  'abruti', 'abrutis', 'debile', 'debiles', 'cretin', 'cretins', 'chier', 'chiant', 'chiante', 'bite', 'bites', 'couille', 'couilles', 'foutre', 'petasse', 'pouffiasse',
  'bouffon', 'bouffons', 'enfoire', 'enfoires', 'enfoiree', 'gueule', 'trouduc', 'bougnoule', 'negre', 'negro', 'youpin', 'bicot', 'chintok', 'nazi', 'hitler',
  'mongol', 'mongolien', 'attarde', 'tarlouze', 'branleur', 'branler', 'sucer', 'suceur', 'zizi', 'nichon', 'nichons', 'cul', 'pisse', 'vagin', 'penis', 'porno', 'sexe', 'sexy',
  // anglais
  'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'bastard', 'asshole', 'arsehole', 'ass', 'dick', 'dicks', 'cock',
  'cunt', 'whore', 'slut', 'wtf', 'stfu', 'retard', 'retarded', 'nigger', 'nigga', 'fag', 'faggot', 'porn', 'pussy', 'tits', 'boobs', 'wanker', 'twat', 'piss', 'crap', 'damn', 'sex',
];
const BAD_SET = new Set(BAD);
const BAD_PHRASES = ['ta gueule', 'ferme ta gueule', 'nique ta', 'ta mere','va te faire', 'kill yourself', 'kys', 'shut up'];
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // chiffres « leet » convertis seulement dans les mots qui contiennent aussi des lettres (« m3rde » oui, « Kepler-455 » non)
  .replace(/[a-z0-9@$]+/g, w => (/[a-z]/.test(w) ? w.replace(/[0134578@$]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' }[c])) : w))
  .replace(/(.)\1{2,}/g, '$1$1');
// Renvoie la liste des raisons de ne pas publier (vide = publiable).
export function screen({ text, name }) {
  const raw = `${name ?? ''}\n${text ?? ''}`, reasons = [];
  if (/https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|fr|net|org|io|ru|xyz|info|be|ch|ca|co|me|tv|gg|ly)\b/i.test(raw)) reasons.push('lien');
  if (/[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(raw)) reasons.push('e-mail');
  // numéro de téléphone : 9 à 13 chiffres commençant par 0 ou + (les identifiants de catalogue, plus longs ou sans 0 initial, passent)
  if ((raw.match(/(?<![\d\w])(?:\+|00|0)\d[\d\s.\-()]{6,}\d(?!\d)/g) ?? []).some(m => { const d = m.replace(/\D/g, '').length; return d >= 9 && d <= 13; })) reasons.push('numéro de téléphone');
  const n = norm(raw), words = n.split(/[^a-z]+/).filter(Boolean);
  const collapsed = words.map(w => w.replace(/(.)\1+/g, '$1')); // « connnnard » -> « conard »
  if (words.some(w => BAD_SET.has(w)) || collapsed.some(w => BAD_SET.has(w)) || BAD_PHRASES.some(p => ` ${words.join(' ')} `.includes(` ${p} `)))
    reasons.push('langage inapproprié');
  // lettres espacées pour contourner le filtre (« m e r d e »)
  const joined = n.replace(/\b([a-z])\s(?=[a-z]\b)/g, '$1');
  if (joined !== n && joined.split(/[^a-z]+/).some(w => w.length > 2 && BAD_SET.has(w))) reasons.push('langage inapproprié');
  return [...new Set(reasons)];
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
  const setCmd = it => (it.status === 'approved' ? ['SET', `fb:${it.id}`, JSON.stringify(it)] : ['SET', `fb:${it.id}`, JSON.stringify(it), 'EX', String(HOLD_DAYS * 86400)]);
  return {
    async rateOk(key) { return (await call([['SET', `fb:rl:${key}`, '1', 'EX', String(RATE_SECONDS), 'NX']]))[0] === 'OK'; },
    async add(it) { await call([setCmd(it), ['LPUSH', `fb:${it.status}`, it.id], ['LTRIM', `fb:${it.status}`, '0', '999']]); },
    async list(status, n = PUBLIC_LIMIT) { return getMany((await call([['LRANGE', `fb:${status}`, '0', String(n - 1)]]))[0]); },
    async get(id) { const [raw] = await call([['GET', `fb:${id}`]]); return raw ? JSON.parse(raw) : null; },
    async move(id, from, to, extra = {}) {
      const [raw] = await call([['GET', `fb:${id}`]]); if (!raw) return false;
      const it = { ...JSON.parse(raw), ...extra, status: to ?? 'deleted', moderated: new Date().toISOString() };
      const cmds = [['LREM', `fb:${from}`, '0', id]];
      if (to) cmds.push(setCmd(it), ['LPUSH', `fb:${to}`, id]); else cmds.push(['DEL', `fb:${id}`, `fb:rep:${id}`]);
      await call(cmds); return true;
    },
    async report(id, who) { const [, n] = await call([['SADD', `fb:rep:${id}`, who], ['SCARD', `fb:rep:${id}`], ['EXPIRE', `fb:rep:${id}`, String(REPORT_DAYS * 86400)]]); return n; },
  };
}
function fileStore(file) {
  const empty = () => ({ items: {}, pending: [], approved: [], rl: {}, rep: {} });
  const load = async () => {
    let db; try { db = { ...empty(), ...JSON.parse(await readFile(file, 'utf8')) }; } catch { db = empty(); }
    const limit = Date.now() - HOLD_DAYS * 86400000; // effacement automatique des messages mis de côté
    for (const id of db.pending) if (Date.parse(db.items[id]?.moderated ?? db.items[id]?.date ?? 0) < limit) delete db.items[id];
    db.pending = db.pending.filter(id => db.items[id]);
    return db;
  };
  const save = async db => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(db, null, 1)); };
  return {
    async rateOk(key) { const db = await load(), now = Date.now(); if ((db.rl[key] ?? 0) > now) return false; db.rl[key] = now + RATE_SECONDS * 1000; await save(db); return true; },
    async add(it) { const db = await load(); db.items[it.id] = it; db[it.status].unshift(it.id); await save(db); },
    async list(status, n = PUBLIC_LIMIT) { const db = await load(); return (db[status] ?? []).slice(0, n).map(i => db.items[i]).filter(Boolean); },
    async get(id) { return (await load()).items[id] ?? null; },
    async move(id, from, to, extra = {}) {
      const db = await load(); if (!db.items[id]) return false;
      db[from] = db[from].filter(x => x !== id);
      if (to) { db.items[id] = { ...db.items[id], ...extra, status: to, moderated: new Date().toISOString() }; db[to].unshift(id); } else { delete db.items[id]; delete db.rep[id]; }
      await save(db); return true;
    },
    async report(id, who) { const db = await load(); const s = new Set(db.rep[id] ?? []); s.add(who); db.rep[id] = [...s]; await save(db); return s.size; },
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
const ID_RE = /^[a-z0-9]{8,40}$/;

export async function handlePublic({ method, body, ip }, env = process.env) {
  const store = getStore(env);
  if (!store) return { status: 503, json: { error: 'Les avis ne sont pas encore activés sur ce site.', disabled: true } };
  if (method === 'GET') {
    const items = await store.list('approved');
    return { status: 200, json: { items: items.map(pub), stats: stats(items) }, cache: 30 };
  }
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } };
  // sel secret de l'empreinte : jeton de la base (toujours présent en ligne), sinon ADMIN_TOKEN, sinon valeur locale
  const who = ipKey(ip ?? 'inconnue', env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.ADMIN_TOKEN || 'sel-local');
  // signalement d'un avis publié
  if (body?.action === 'report') {
    if (!ID_RE.test(String(body.id))) return { status: 400, json: { error: 'Identifiant invalide.' } };
    const it = await store.get(body.id);
    if (!it || it.status !== 'approved') return { status: 200, json: { ok: true } };
    const n = await store.report(body.id, who);
    if (n >= REPORTS_TO_HIDE) await store.move(body.id, 'approved', 'pending', { held: `masqué après ${n} signalements` });
    return { status: 200, json: { ok: true } };
  }
  const v = validate(body);
  if (v.spam) return { status: 200, json: { ok: true } }; // on ne dit rien au robot
  if (v.error) return { status: 400, json: { error: v.error } };
  if (!(await store.rateOk(who))) return { status: 429, json: { error: 'Merci ! Attendez une minute avant d’envoyer un autre avis.' } };
  const reasons = screen(v.item);
  const it = { id: `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`, ...v.item, date: new Date().toISOString(),
    status: reasons.length ? 'pending' : 'approved', ...(reasons.length ? { held: reasons.join(', ') } : {}) };
  await store.add(it);
  return { status: 201, json: { ok: true, published: !reasons.length, reasons } };
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
  if (!ID_RE.test(String(id))) return { status: 400, json: { error: 'Identifiant invalide.' } };
  // refuser = supprimer (rien n'est conservé)
  const moves = { approve: ['pending', 'approved'], reject: ['pending', null], unpublish: ['approved', 'pending'], delete: [body.from === 'approved' ? 'approved' : 'pending', null] };
  if (!moves[action]) return { status: 400, json: { error: 'Action inconnue.' } };
  const ok = await store.move(id, ...moves[action]);
  return ok ? { status: 200, json: { ok: true } } : { status: 404, json: { error: 'Avis introuvable.' } };
}
