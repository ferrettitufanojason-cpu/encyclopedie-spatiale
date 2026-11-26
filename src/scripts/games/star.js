// « Vie d'une étoile » : un curseur de masse, la fin de vie correspondante, de vrais exemples de l'encyclopédie, puis un quiz.
import { starLife, starFateQuestion } from '../../../lib/games-more.mjs';
import { fmt } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, mode, gameData, mountBar } from './core.js';
import { mountQuiz } from './quiz.js';

const MIN = Math.log10(0.03), MAX = Math.log10(60);
const massOf = v => 10 ** (MIN + (v / 1000) * (MAX - MIN));
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  let v = Math.round(((Math.log10(1) - MIN) / (MAX - MIN)) * 1000); // départ : 1 masse solaire
  const explore = el('section', { class: 'gm-star' }), quiz = el('div');
  root.replaceChildren(explore, el('h2', { class: 'gm-title', text: tx('À toi de jouer', 'Your turn') }), quiz);
  const life = (m, L) => {
    if (m < 0.08) return '';
    if (m < 0.5) return tx('Durée de vie : bien plus longue que l’âge actuel de l’Univers (13,8 milliards d’années).', 'Lifetime: far longer than the current age of the Universe (13.8 billion years).');
    if (m > 10) return tx('Durée de vie : seulement quelques millions d’années.', 'Lifetime: only a few million years.');
    const g = starLife(m, L).lifeGyr;
    return g >= 1 ? tx(`Durée de vie : environ ${fmt(g, L, 2)} milliards d’années.`, `Lifetime: about ${fmt(g, L, 2)} billion years.`)
      : tx(`Durée de vie : environ ${fmt(g * 1000, L, 2)} millions d’années.`, `Lifetime: about ${fmt(g * 1000, L, 2)} million years.`);
  };
  // le curseur est créé une seule fois (le recréer interromprait le glissement au doigt) ; seuls les textes changent
  const label = el('label', { for: 'gm-mass', class: 'gm-q' }), fateBox = el('div', { class: 'gm-fate', role: 'status', 'aria-live': 'polite' });
  const slider = el('input', { type: 'range', id: 'gm-mass', min: 0, max: 1000, step: 1, value: v, oninput: e => { v = Number(e.target.value); draw(); } });
  const scale = el('div', { class: 'gm-scale', 'aria-hidden': 'true' });
  explore.append(label, slider, scale, fateBox);
  function draw() {
    const L = lang(), m = massOf(v), s = starLife(m, L), ex = d.remnants.filter(r => r[2] === s.fate).slice(0, 6);
    label.replaceChildren(tx('Masse de l’étoile : ', 'Star mass: '), el('b', { text: tx(`${fmt(m, L, 2)} fois le Soleil`, `${fmt(m, L, 2)} times the Sun`) }));
    slider.setAttribute('aria-valuetext', tx(`${fmt(m, L, 2)} masses solaires : ${s.title}`, `${fmt(m, L, 2)} solar masses: ${s.title}`));
    // repères placés à leur vraie position sur l'échelle logarithmique du curseur
    scale.replaceChildren(...[0.03, 0.08, 1, 8, 20, 60].map(x => el('span', { style: `left:${((Math.log10(x) - MIN) / (MAX - MIN)) * 100}%`, text: fmt(x, L, 2) })));
    fateBox.className = `gm-fate f-${s.fate}`;
    fateBox.replaceChildren(
      el('p', { class: 'gm-v-title', text: s.title }), el('p', { text: s.text }), el('p', { class: 'credit', text: life(m, L) }),
      mode() === 'detail' ? el('p', { class: 'credit', text: tx('Seuils approximatifs : 0,08 masse solaire (fusion de l’hydrogène), environ 8 (supernova), environ 20 (trou noir) ; ils dépendent aussi de la composition et de la rotation de l’étoile. Durée de vie ≈ 10 milliards d’années × M^−2,5 (valable entre 0,5 et 10 masses solaires).', 'Approximate thresholds: 0.08 solar mass (hydrogen fusion), about 8 (supernova), about 20 (black hole); they also depend on the star’s composition and spin. Lifetime ≈ 10 billion years × M^−2.5 (valid between 0.5 and 10 solar masses).') }) : '',
      ex.length ? el('p', {}, tx('Exemples réels dans l’encyclopédie : ', 'Real examples in the encyclopedia: '), ...ex.flatMap((r, k) => [k ? ', ' : '', el('a', { href: `/objet/${encodeURIComponent(r[0])}`, text: r[1] })])) : '');
  }
  draw(); onLang(draw); document.addEventListener('jeux:update', draw);
  mountQuiz(quiz, { game: 'vie-d-une-etoile', points: 10, make: (rng, L) => starFateQuestion(rng, L) });
}
