// « Quelle mission pour quel objectif ? » : associer quatre missions du site à leur objectif (tiré de leur description).
import { missionsMatch } from '../../../lib/games-more.mjs';
import { el, tx, gameData, mountBar } from './core.js';
import { mountMatch } from './quiz.js';
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  mountMatch(root, { game: 'mission-objectif', ptsPerPair: 5, make: (rng, lang, lv) => missionsMatch(d.missions, rng, lang, lv), prompt: () => tx('Associe chaque mission à son objectif ou à sa grande réussite.', 'Match each mission with its goal or great achievement.') });
}
