// Socle commun des jeux : langue, données, progression (UNIQUEMENT dans ce navigateur, rien n'est envoyé), barre d'outils, correction.
import { BADGES, badgesFor, nextBadge } from '../../../lib/games.mjs';

/* ---------- langue (même mécanisme que le reste du site : localStorage « lang » + évènement « langchange ») ---------- */
export const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'fr');
export const onLang = cb => document.addEventListener('langchange', () => cb(lang()));
export const tx = (fr, en) => (lang() === 'en' ? en : fr);

/* ---------- petit constructeur d'éléments ---------- */
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
};

/* ---------- données des jeux (fichier compact construit avec le site) ---------- */
let dataP = null;
export const gameData = () => (dataP ??= fetch('/data/jeux.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));

/* ---------- progression locale ---------- */
const KEY = 'jeux-v1';
const fresh = () => ({ v: 1, points: 0, unlocked: {}, games: {}, mode: 'simple' });
export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s && s.v === 1) return { ...fresh(), ...s }; } catch { /* stockage indisponible */ }
  return fresh();
}
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* navigation privée, stockage plein… : on continue sans sauvegarde */ } };
const changed = () => { save(); document.dispatchEvent(new CustomEvent('jeux:update')); };
export const progress = () => state;
export const mode = () => (state.mode === 'detail' ? 'detail' : 'simple');
export function setMode(m) { state.mode = m === 'detail' ? 'detail' : 'simple'; changed(); }
/** Ajoute des points et débloque des objets ; renvoie les badges nouvellement obtenus. */
export function reward(game, pts, unlock = []) {
  const before = badgesFor(state.points).length;
  state.points += Math.max(0, Math.round(pts));
  const g = (state.games[game] ??= { played: 0, won: 0, best: 0 });
  g.played++; if (pts > 0) g.won++; g.best = Math.max(g.best, pts);
  const today = new Date().toISOString().slice(0, 10);
  for (const u of unlock) if (u?.id && !state.unlocked[u.id]) state.unlocked[u.id] = { n: u.n, k: u.k, d: today };
  changed();
  return badgesFor(state.points).slice(before);
}
export function played(game) { (state.games[game] ??= { played: 0, won: 0, best: 0 }).played++; changed(); }
export function resetAll() { state = fresh(); try { localStorage.removeItem(KEY); } catch {} changed(); }

/* ---------- barre d'outils : style de texte, points, badge ---------- */
export function mountBar(host) {
  const draw = () => {
    const p = state.points, nb = nextBadge(p), got = badgesFor(p).at(-1), m = mode();
    const seg = (val, fr, en) => el('button', { type: 'button', class: 'btn', 'aria-pressed': String(m === val), onclick: () => setMode(val), text: tx(fr, en) });
    host.replaceChildren(
      el('div', { class: 'gm-mode', role: 'group', 'aria-label': tx('Style des textes', 'Text style') },
        el('span', { class: 'gm-lbl', text: tx('Textes :', 'Texts:') }), seg('simple', 'Simple', 'Simple'), seg('detail', 'Détaillé', 'Detailed')),
      el('p', { class: 'gm-score' }, el('b', { text: `${p.toLocaleString(lang())} ${tx('points', 'points')}` }),
        got ? ` · ${got.icon} ${got[lang()]}` : '',
        nb ? el('small', { text: ` · ${tx('prochain badge : ', 'next badge: ')}${nb[lang()]} (${nb.pts})` }) : ''),
      el('a', { class: 'btn', href: '/jeux/collection/', text: tx('Ma collection', 'My collection') }));
  };
  draw(); document.addEventListener('jeux:update', draw); onLang(draw);
}

/* ---------- correction après chaque réponse : explication courte + lien vers la fiche ---------- */
export function verdict(host, { ok, title, text, objects = [], badges = [] }) {
  host.replaceChildren(el('div', { class: `gm-verdict ${ok ? 'ok' : 'ko'}`, role: 'status', tabindex: '-1' },
    el('p', { class: 'gm-v-title' }, el('span', { 'aria-hidden': 'true', text: ok ? '✔ ' : '✖ ' }), title),
    text ? el('p', { text }) : '',
    objects.length ? el('p', {}, tx('Voir la fiche : ', 'See the page: '), ...objects.flatMap((o, k) => [k ? ' · ' : '', el('a', { href: `/objet/${encodeURIComponent(o.id)}`, text: o.n })])) : '',
    ...badges.map(b => el('p', { class: 'gm-badge-new', text: `${b.icon} ${tx(`Nouveau badge : ${b.fr} !`, `New badge: ${b.en}!`)}` })),
    el('p', { class: 'credit', text: tx('Explication rédigée pour ce jeu à partir des données de la fiche, non relue par un expert.', 'Explanation written for this game from the page’s data, not reviewed by an expert.') })));
  host.querySelector('.gm-verdict').focus({ preventScroll: false });
}
export { BADGES };
