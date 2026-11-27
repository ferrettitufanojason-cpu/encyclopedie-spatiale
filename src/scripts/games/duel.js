// « Duel » : deux joueurs sur le même écran, les mêmes questions ; le joueur 1 répond, puis passe l'appareil au joueur 2.
// Les bonnes réponses ne s'affichent qu'à la fin, pour ne rien dévoiler au joueur 2. Aucun surnom n'est enregistré.
import { rngFrom } from '../../../lib/games.mjs';
import { mixedQuestion } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, level, gameData, played, mountBar } from './core.js';
import { LEVEL_NAMES } from '../../../lib/games.mjs';

const N = 5;
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  let seed, phase = 'setup', names = ['', ''], ans = [[], []], k = 0, duelLv = level();
  // même graine → mêmes questions pour les deux joueurs (dans la langue affichée)
  const questions = () => { const rng = rngFrom(seed), qs = [], seen = new Set(); let guard = 0;
    while (qs.length < N && guard++ < 60) { const q = mixedQuestion(d, rng, lang(), duelLv === 'universite' ? 'detail' : 'simple', undefined, duelLv); if (q && !seen.has(q.q)) { seen.add(q.q); qs.push(q); } } return qs; };
  const who = p => names[p].trim() || tx(`Joueur ${p + 1}`, `Player ${p + 1}`);
  function draw() {
    if (phase === 'setup') {
      const inp = p => el('input', { id: `gm-p${p}`, type: 'text', maxlength: 20, autocomplete: 'off', class: 'gm-select', value: names[p], oninput: e => { names[p] = e.target.value; } });
      root.replaceChildren(
        el('p', { class: 'gm-q', text: tx(`${N} questions tirées de tous les jeux. Le joueur 1 répond d’abord, puis passe l’écran au joueur 2. Les réponses sont révélées à la fin.`, `${N} questions from all the games. Player 1 answers first, then hands the screen to player 2. Answers are revealed at the end.`) }),
        el('div', { class: 'gm-duel-setup' }, [0, 1].map(p => el('div', {}, el('label', { for: `gm-p${p}`, class: 'lbl', text: tx(`Surnom du joueur ${p + 1} (facultatif)`, `Player ${p + 1} nickname (optional)`) }), inp(p)))),
        el('p', { class: 'credit', text: tx('Les surnoms ne servent qu’à l’affichage et ne sont enregistrés nulle part.', 'Nicknames are only displayed and are not stored anywhere.') }),
        el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: () => { seed = Math.floor(Math.random() * 2 ** 31); ans = [[], []]; k = 0; duelLv = level(); phase = 'p0'; draw(); }, text: tx(`Commencer le duel (niveau ${LEVEL_NAMES[level()][0]})`, `Start the duel (${LEVEL_NAMES[level()][1]} level)`) })));
      return;
    }
    const qs = questions();
    if (phase === 'p0' || phase === 'p1') {
      const p = phase === 'p0' ? 0 : 1, Q = qs[k];
      root.replaceChildren(
        el('p', { class: 'gm-daily' }, el('b', { text: who(p) }), ` · ${tx('question', 'question')} ${k + 1}/${qs.length}`),
        el('p', { class: 'gm-q', text: Q.q }),
        el('div', { class: `gm-choices${Q.choices.length === 2 ? ' two' : ''}` }, Q.choices.map(c => el('button', { type: 'button', class: 'btn gm-choice', onclick: () => {
          ans[p][k] = c.id; k++;
          if (k >= qs.length) { k = 0; phase = p === 0 ? 'handover' : 'end'; if (phase === 'end') played('duel'); }
          draw(); root.querySelector('button')?.focus();
        }, text: c.label }))));
      return;
    }
    if (phase === 'handover') {
      root.replaceChildren(el('div', { class: 'gm-fate' }, el('p', { class: 'gm-v-title', text: tx(`${who(0)} a terminé !`, `${who(0)} is done!`) }),
        el('p', { text: tx(`Passe l’écran à ${who(1)} : mêmes questions, sans voir les réponses de ${who(0)}.`, `Hand the screen to ${who(1)}: same questions, without seeing ${who(0)}’s answers.`) }),
        el('button', { type: 'button', class: 'btn primary', onclick: () => { phase = 'p1'; draw(); }, text: tx(`C’est à ${who(1)} !`, `${who(1)}’s turn!`) })));
      root.querySelector('button')?.focus();
      return;
    }
    const score = p => qs.filter((Q, j) => ans[p][j] === Q.answer).length, s0 = score(0), s1 = score(1);
    root.replaceChildren(
      el('div', { class: 'gm-fate', role: 'status' }, el('p', { class: 'gm-v-title', text: s0 === s1 ? tx(`Égalité : ${s0} partout !`, `Draw: ${s0} each!`) : tx(`${s0 > s1 ? who(0) : who(1)} gagne !`, `${s0 > s1 ? who(0) : who(1)} wins!`) }),
        el('p', { text: `${who(0)} : ${s0}/${qs.length} · ${who(1)} : ${s1}/${qs.length}` })),
      el('ol', { class: 'gm-duel-res' }, qs.map((Q, j) => {
        const good = Q.choices.find(c => c.id === Q.answer).label, mark = p => (ans[p][j] === Q.answer ? '✔' : '✖');
        return el('li', {}, el('p', { class: 'gm-name', text: Q.q }), el('p', {}, el('b', { text: tx(`Réponse : ${good}`, `Answer: ${good}`) }), ` · ${who(0)} ${mark(0)} · ${who(1)} ${mark(1)}`),
          el('p', { class: 'gm-match-ex', text: Q.explain }), Q.objects.length ? el('p', {}, ...Q.objects.flatMap((o, m) => [m ? ' · ' : '', el('a', { href: `/objet/${encodeURIComponent(o.id)}`, text: o.n })])) : '');
      })),
      el('p', { class: 'credit', text: tx('Explications rédigées pour ces jeux à partir des données des fiches, non relues par un expert.', 'Explanations written for these games from the pages’ data, not reviewed by an expert.') }),
      el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: () => { phase = 'setup'; draw(); }, text: tx('Nouveau duel', 'New duel') })));
  }
  draw(); onLang(draw);
}
