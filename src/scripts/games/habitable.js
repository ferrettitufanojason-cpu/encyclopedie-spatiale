// Jeu « Habitable ou pas ? » : une exoplanète réelle ; est-elle dans la zone habitable (calculée) de son étoile ?
import { habitablePuzzle, habitableFacts, habitableExplain, rngFrom } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, mode, level, onLevel, gameData, reward, verdict, mountBar } from './core.js';

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let data;
  try { data = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  let pz, picked, streak = 0;
  const newGame = () => { pz = habitablePuzzle(data.exoplanets, rngFrom(), level()); picked = null; draw(); };

  // schéma : l'étoile à gauche, la zone habitable en vert, la planète à sa distance (échelle logarithmique pour tout faire tenir)
  function diagram(e) {
    const lo = Math.min(e.sma, e.hi) / 3, hi = Math.max(e.sma, e.ho) * 3, X = v => 30 + (Math.log(v / lo) / Math.log(hi / lo)) * 560;
    const svg = `<svg viewBox="0 0 620 70" role="img" aria-label="${tx('Schéma : étoile, zone habitable et position de la planète (échelle logarithmique)', 'Diagram: star, habitable zone and planet position (log scale)')}">
      <circle cx="12" cy="35" r="10" fill="#ffd27a"/><rect x="${X(e.hi)}" y="20" width="${X(e.ho) - X(e.hi)}" height="30" rx="6" fill="#5ed6a433" stroke="#5ed6a4"/>
      <text x="${(X(e.hi) + X(e.ho)) / 2}" y="15" fill="#5ed6a4" font-size="12" text-anchor="middle">${tx('zone habitable', 'habitable zone')}</text>
      <circle cx="${X(e.sma)}" cy="35" r="7" fill="#6ea8ff" stroke="#fff"/><text x="${X(e.sma)}" y="64" fill="#e8eefc" font-size="12" text-anchor="middle">${e.n.replace(/[<&]/g, '')}</text></svg>`;
    const d = el('div', { class: 'gm-hz' }); d.innerHTML = svg; return d;
  }
  function draw() {
    if (!pz) { root.replaceChildren(el('p', { class: 'na', text: tx('Jeu indisponible : aucune exoplanète avec toutes les données nécessaires.', 'Game unavailable: no exoplanet with all the required data.') })); return; }
    const e = pz.exo, L = lang(), m = mode(), out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      el('h2', { class: 'gm-title' }, e.n, e.dist ? el('small', { text: ` · ${e.dist.toLocaleString(L)} ${tx('années-lumière', 'light-years')}` }) : ''),
      el('ul', { class: 'gm-facts' }, habitableFacts(e, L, m).map(t => el('li', { text: t }))),
      level() === 'primaire' ? diagram(e) : '',
      el('p', { class: 'gm-q', text: level() === 'primaire'
        ? tx('La planète (le point bleu) est-elle dans la zone verte, la zone habitable de son étoile ?', 'Is the planet (the blue dot) in the green zone, its star’s habitable zone?')
        : tx('Cette planète est-elle dans la zone habitable de son étoile ?', 'Is this planet in its star’s habitable zone?') }),
      el('div', { class: 'gm-choices two' },
        [[true, tx('Oui, dans la zone habitable', 'Yes, in the habitable zone')], [false, tx('Non, en dehors', 'No, outside it')]].map(([v, t]) =>
          el('button', { type: 'button', class: `btn gm-choice${picked != null && v === pz.answer ? ' ok' : ''}${picked === v && v !== pz.answer ? ' ko' : ''}`, disabled: picked != null, onclick: () => answer(v), text: t }))),
      picked != null && level() !== 'primaire' ? diagram(e) : '',
      picked != null ? el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: newGame, text: tx('Autre exoplanète', 'Another exoplanet') }), el('small', { class: 'credit', text: tx(`Série : ${streak}`, `Streak: ${streak}`) })) : '',
      out);
    if (picked != null) {
      const ok = picked === pz.answer;
      verdict(out, { ok, title: ok ? tx(`Bonne réponse ! +${10 + Math.min(streak - 1, 5) * 2} points.`, `Right! +${10 + Math.min(streak - 1, 5) * 2} points.`) : tx('Raté !', 'Missed!'),
        text: habitableExplain(e, pz.where, L, m), objects: [{ id: e.i, n: e.n }], badges: lastBadges });
    }
  }
  let lastBadges = [];
  function answer(v) {
    picked = v; const ok = v === pz.answer;
    streak = ok ? streak + 1 : 0;
    lastBadges = reward('habitable-ou-pas', ok ? 10 + Math.min(streak - 1, 5) * 2 : 0, ok ? [{ id: pz.exo.i, n: pz.exo.n, k: 'exoplanet' }] : []);
    draw();
  }
  onLang(draw); onLevel(() => { streak = 0; newGame(); }); document.addEventListener('jeux:update', () => { if (pz) draw(); });
  newGame();
}
