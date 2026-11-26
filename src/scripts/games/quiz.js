// Composants communs : quiz à choix (une question à la fois) et plateau d'association (listes déroulantes : clavier et tactile).
import { rngFrom, shuffle } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, mode, reward, verdict } from './core.js';

/**
 * Quiz : make(rng, lang, mode) renvoie une question { q, choices, answer, explain, objects, unlock } ou null.
 * La question est recréée avec la même graine quand on change de langue ou de style : c'est la même question, traduite.
 */
export function mountQuiz(root, { game, make, points = 10, header, newLabel }) {
  let seed, picked, streak = 0, badges = [];
  const q = () => make(rngFrom(seed), lang(), mode());
  const next = () => { seed = Math.floor(Math.random() * 2 ** 31); picked = null; badges = []; draw(); };
  function draw() {
    const Q = q();
    if (!Q) { root.replaceChildren(el('p', { class: 'na', text: tx('Pas de question disponible avec les données actuelles.', 'No question available with the current data.') })); return; }
    const out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      header ? header(Q) : '',
      el('p', { class: 'gm-q', text: Q.q }),
      el('div', { class: `gm-choices${Q.choices.length === 2 ? ' two' : ''}`, role: 'group', 'aria-label': tx('Réponses possibles', 'Possible answers') },
        Q.choices.map(c => el('button', { type: 'button', class: `btn gm-choice${picked != null && c.id === Q.answer ? ' ok' : ''}${picked === c.id && c.id !== Q.answer ? ' ko' : ''}`, disabled: picked != null, onclick: () => answer(c.id, Q) },
          c.img ? el('img', { src: c.img.src, alt: '', loading: 'lazy', width: 36, height: 36 }) : '', el('span', { text: c.label })))),
      picked != null ? el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: next, text: newLabel?.() ?? tx('Question suivante', 'Next question') }), el('small', { class: 'credit', text: tx(`Série : ${streak}`, `Streak: ${streak}`) })) : '',
      out);
    if (picked != null) {
      const ok = picked === Q.answer, pts = ok ? points + Math.min(streak - 1, 5) * 2 : 0;
      verdict(out, { ok, title: ok ? tx(`Bonne réponse ! +${pts} points.`, `Right! +${pts} points.`) : tx(`Raté : la bonne réponse était « ${Q.choices.find(c => c.id === Q.answer).label} ».`, `Missed: the right answer was “${Q.choices.find(c => c.id === Q.answer).label}”.`),
        text: Q.explain, objects: Q.objects, badges });
    }
  }
  function answer(id, Q) {
    picked = id; const ok = id === Q.answer; streak = ok ? streak + 1 : 0;
    badges = reward(game, ok ? points + Math.min(streak - 1, 5) * 2 : 0, ok ? Q.unlock : []);
    draw();
  }
  onLang(draw); document.addEventListener('jeux:update', () => { if (seed != null) draw(); });
  next();
}

/**
 * Plateau d'association : make(rng, lang) renvoie { left:[{id,label,img}], right:[{id,label}], answer:{leftId:rightId}, explain:{leftId:texte}, unlock }.
 * Chaque élément de gauche a une liste déroulante : accessible au clavier, au lecteur d'écran et au doigt (pas de glisser-déposer obligatoire).
 */
export function mountMatch(root, { game, make, ptsPerPair = 5, prompt, linkKind = 'objet' }) {
  let seed, choice, done, badges = [];
  const next = () => { seed = Math.floor(Math.random() * 2 ** 31); choice = {}; done = false; badges = []; draw(); };
  function draw() {
    const M = make(rngFrom(seed), lang());
    if (!M) { root.replaceChildren(el('p', { class: 'na', text: tx('Pas assez de données pour ce jeu.', 'Not enough data for this game.') })); return; }
    const out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      el('p', { class: 'gm-q', text: prompt() }),
      el('ul', { class: 'gm-match' }, M.left.map(l => {
        const sel = el('select', { id: `m-${l.id}`, disabled: done, onchange: e => { choice[l.id] = e.target.value; } },
          el('option', { value: '', text: tx('— choisir —', '— choose —') }), M.right.map(r => { const o = el('option', { value: r.id, text: r.label }); if (choice[l.id] === r.id) o.selected = true; return o; }));
        const good = done && choice[l.id] === M.answer[l.id];
        return el('li', { class: done ? (good ? 'ok' : 'ko') : '' },
          l.img ? el('img', { src: l.img.src, alt: '', loading: 'lazy', width: 56, height: 56 }) : el('span', { class: 'gm-noimg', 'aria-hidden': 'true' }),
          el('div', {}, el('label', { for: `m-${l.id}`, class: 'gm-name', text: l.label }), sel,
            done ? el('p', { class: 'gm-match-ex' }, el('b', { text: good ? '✔ ' : `✖ ${tx('Réponse', 'Answer')} : ${M.right.find(r => r.id === M.answer[l.id]).label}. ` }), M.explain[l.id], ' ', el('a', { href: `/objet/${encodeURIComponent(l.id)}`, text: tx('Voir la fiche', 'See the page') })) : '',
            done && l.img ? el('small', { class: 'credit', text: `${tx('Image', 'Image')} : ${l.img.credit} · ${l.img.license}` }) : ''));
      })),
      el('div', { class: 'gm-actions' }, done ? el('button', { type: 'button', class: 'btn primary', onclick: next, text: tx('Nouvelle série', 'New set') })
        : el('button', { type: 'button', class: 'btn primary', onclick: () => check(M), text: tx('Vérifier', 'Check') })),
      out);
    if (done) {
      const good = M.left.filter(l => choice[l.id] === M.answer[l.id]).length;
      verdict(out, { ok: good === M.left.length, title: tx(`${good} sur ${M.left.length} : +${good * ptsPerPair} points.`, `${good} of ${M.left.length}: +${good * ptsPerPair} points.`),
        text: tx('Les explications reprennent la description de chaque fiche.', 'Explanations come from each object’s page.'), badges });
    }
  }
  function check(M) {
    if (M.left.some(l => !choice[l.id])) { const first = M.left.find(l => !choice[l.id]); document.getElementById(`m-${first.id}`)?.focus(); return; }
    done = true;
    const okIds = M.left.filter(l => choice[l.id] === M.answer[l.id]).map(l => l.id);
    badges = reward(game, okIds.length * ptsPerPair, M.unlock.filter(u => okIds.includes(u.id)));
    draw();
  }
  onLang(draw); document.addEventListener('jeux:update', () => { if (seed != null && done) draw(); });
  next();
}
export { shuffle };
