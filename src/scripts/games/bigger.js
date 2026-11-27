// « Qui est le plus grand ? » : deux astres du Système solaire, critère tiré au hasard (taille, température, masse).
import { biggerQuestion } from '../../../lib/games-more.mjs';
import { el, tx, gameData, mountBar } from './core.js';
import { mountQuiz } from './quiz.js';
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  mountQuiz(root, { game: 'le-plus-grand', points: 10, make: (rng, lang, mode, lv) => biggerQuestion(d.bodies, rng, lang, mode, lv) });
}
