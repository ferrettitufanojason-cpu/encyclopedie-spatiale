// « Les lunes mystérieuses » : associer quatre lunes à leur particularité (tirée de leur description sur le site).
import { moonsMatch } from '../../../lib/games-more.mjs';
import { el, tx, gameData, mountBar } from './core.js';
import { mountMatch } from './quiz.js';
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  mountMatch(root, { game: 'lunes-mysterieuses', ptsPerPair: 5, make: (rng, lang) => moonsMatch(d.moons, rng, lang, 4), prompt: () => tx('Associe chaque lune à sa particularité.', 'Match each moon with what makes it special.') });
}
