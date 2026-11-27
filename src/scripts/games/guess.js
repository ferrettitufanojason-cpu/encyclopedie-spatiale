// Jeu « Devine la planète » : 3 indices issus des données de la fiche, révélés un à un ; 30 / 20 / 10 points.
import { guessPuzzle, planetHints, nameOf, rngFrom, GUESS_POINTS } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, mode, level, onLevel, gameData, reward, verdict, mountBar } from './core.js';

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let data;
  try { data = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const planets = data.planets, by = Object.fromEntries(planets.map(p => [p.i, p]));
  let pz, shown, wrong, done, result;

  const newGame = () => { pz = guessPuzzle(planets, rngFrom(), lang(), mode(), level()); shown = 1; wrong = new Set(); done = false; result = null; draw(); };
  // les textes sont recalculés à chaque affichage : changer de langue ou de style garde les mêmes indices
  const hintTexts = () => { const all = planetHints(by[pz.target], lang(), mode()); return pz.hints.map(k => all.find(h => h.key === k).text); };

  function draw() {
    if (!pz) { root.replaceChildren(el('p', { class: 'na', text: tx('Jeu indisponible : pas assez de données.', 'Game unavailable: not enough data.') })); return; }
    const L = lang(), H = hintTexts();
    const out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      el('p', { class: 'gm-q', text: tx('Quelle planète du Système solaire se cache derrière ces indices ?', 'Which Solar System planet do these clues describe?') }),
      el('ol', { class: 'gm-hints' }, H.map((t, k) => el('li', { class: k < shown ? '' : 'locked' }, k < shown ? t : el('span', { text: tx('Indice caché', 'Hidden clue') })))),
      done ? '' : el('div', { class: 'gm-actions' },
        el('button', { type: 'button', class: 'btn', disabled: shown >= 3, onclick: () => { shown++; draw(); }, text: tx(`Un autre indice (${shown}/3)`, `Another clue (${shown}/3)`) }),
        el('small', { class: 'credit', text: tx(`Bonne réponse maintenant : ${GUESS_POINTS[shown - 1]} points.`, `Right answer now: ${GUESS_POINTS[shown - 1]} points.`) })),
      el('div', { class: 'gm-choices', role: 'group', 'aria-label': tx('Choisis une planète', 'Choose a planet') },
        (pz.choices ?? planets.map(p => p.i)).map(id => by[id]).map(p => el('button', { type: 'button', class: `btn gm-choice${wrong.has(p.i) ? ' ko' : ''}${done && p.i === pz.target ? ' ok' : ''}`, disabled: done || wrong.has(p.i), onclick: () => answer(p.i) },
          p.img ? el('img', { src: p.img.src, alt: '', loading: 'lazy', width: 48, height: 48 }) : '', el('span', { text: nameOf(p, L) })))),
      done ? el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: newGame, text: tx('Nouvelle planète', 'New planet') })) : '',
      out);
    if (result) verdict(out, result());
  }
  function answer(id) {
    const t = by[pz.target];
    if (id === pz.target) {
      done = true;
      const pts = GUESS_POINTS[shown - 1], badges = reward('devine-la-planete', pts, [{ id: t.i, n: nameOf(t, lang()), k: 'planet' }]);
      result = () => ({ ok: true, title: tx(`Oui, c’est ${nameOf(t, 'fr')} ! +${pts} points (${shown} indice${shown > 1 ? 's' : ''}).`, `Yes, it’s ${t.n}! +${pts} points (${shown} clue${shown > 1 ? 's' : ''}).`),
        text: tx('Tous les indices de sa fiche : ', 'All the clues from its page: ') + planetHints(t, lang(), mode()).map(h => h.text).join(' '), objects: [{ id: t.i, n: nameOf(t, lang()) }], badges });
    } else {
      wrong.add(id);
      const w = by[id];
      if (shown < 3) shown++;
      else if (wrong.size >= 3) { // trois erreurs avec tous les indices : on donne la réponse, sans points
        done = true; reward('devine-la-planete', 0);
        result = () => ({ ok: false, title: tx(`C’était ${nameOf(t, 'fr')}.`, `It was ${t.n}.`), text: planetHints(t, lang(), mode()).map(h => h.text).join(' '), objects: [{ id: t.i, n: nameOf(t, lang()) }] });
        draw(); return;
      }
      result = () => ({ ok: false, title: tx(`Ce n’est pas ${nameOf(w, 'fr')}.`, `It isn’t ${w.n}.`), text: tx('Un nouvel indice est révélé si possible. Regarde la fiche de cette planète pour comparer :', 'A new clue is revealed if possible. Look at this planet’s page to compare:'), objects: [{ id: w.i, n: nameOf(w, lang()) }] });
    }
    draw();
  }
  onLang(draw); onLevel(newGame); document.addEventListener('jeux:update', () => { if (pz) draw(); });
  newGame();
}
