// « Relie les étoiles » : les étoiles les plus brillantes d'une constellation, à leur vraie position (SIMBAD).
// On trace sa propre figure en reliant les points, puis on la compare à la carte officielle de l'UAI et on répond à une question.
import { rngFrom, pick } from '../../../lib/games.mjs';
import { projectStars, brightestQuestion } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, gameData, reward, mountBar } from './core.js';
import { mountQuiz } from './quiz.js';

const S = 420;
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  let c, pts, lines, sel, compared;
  const nm = o => (lang() === 'fr' ? o.nf ?? o.n : o.n);
  const choose = id => { c = id ? d.constellations.find(x => x.i === id) : pick(d.constellations, rngFrom()); pts = projectStars(c.stars); lines = []; sel = null; compared = false; draw(); };
  const key = (a, b) => [a, b].sort().join('|');
  function tap(id) {
    if (sel == null) { sel = id; }
    else if (sel === id) { sel = null; }
    else { const k = key(sel, id), j = lines.indexOf(k); if (j >= 0) lines.splice(j, 1); else lines.push(k); sel = id; }
    draw();
  }
  function sky() {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), P = p => [24 + p.x * (S - 48), 24 + p.y * (S - 48)];
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`); svg.setAttribute('class', 'gm-sky'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', tx(`Étoiles de la constellation ${nm(c)} et lignes tracées (${lines.length}). Utilise la liste des étoiles pour relier au clavier.`, `Stars of ${nm(c)} and drawn lines (${lines.length}). Use the star list to connect them with the keyboard.`));
    let h = '';
    for (const k of lines) { const [a, b] = k.split('|').map(id => P(pts.find(p => p.id === id))); h += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#6ea8ff" stroke-width="2"/>`; }
    for (const p of pts) { const [x, y] = P(p), r = Math.max(3, 9 - p.mag * 1.4);
      h += `<g data-id="${p.id}" class="st${sel === p.id ? ' sel' : ''}"><circle cx="${x}" cy="${y}" r="22" fill="transparent"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff6d8"/>${sel === p.id ? `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="#f2c261" stroke-width="2"/>` : ''}<text x="${x + r + 4}" y="${y + 4}" fill="#9aa8c7" font-size="12">${p.n.replace(/[<&]/g, '')}</text></g>`; }
    svg.innerHTML = h;
    svg.addEventListener('click', e => { const g = e.target.closest('g[data-id]'); if (g) tap(g.dataset.id); });
    return svg;
  }
  function draw() {
    const L = lang();
    root.replaceChildren(
      el('div', { class: 'gm-actions' }, el('label', { for: 'gm-const', text: tx('Constellation : ', 'Constellation: ') }),
        el('select', { id: 'gm-const', class: 'gm-select', style: 'width:auto', onchange: e => choose(e.target.value) }, d.constellations.map(x => { const o = el('option', { value: x.i, text: nm(x) }); if (x.i === c.i) o.selected = true; return o; }))),
      el('p', { class: 'gm-q', text: tx('Relie les étoiles pour dessiner ta figure : touche une étoile, puis une autre. Toucher à nouveau une ligne existante l’efface.', 'Connect the stars to draw your figure: tap one star, then another. Tapping an existing line again erases it.') }),
      el('div', { class: 'gm-sky-wrap' }, sky()),
      el('details', { class: 'gm-segs' }, el('summary', { text: tx('Relier au clavier', 'Connect with the keyboard') }),
        el('div', { class: 'gm-seg-btns' }, pts.map(p => el('button', { type: 'button', class: 'btn', 'aria-pressed': String(sel === p.id), onclick: () => tap(p.id), text: `${p.n} (${tx('magnitude', 'magnitude')} ${p.mag.toLocaleString(L)})` })))),
      el('p', { class: 'credit', text: tx(`${lines.length} ligne${lines.length > 1 ? 's' : ''} tracée${lines.length > 1 ? 's' : ''}. Positions des ${pts.length} étoiles les plus brillantes : SIMBAD (CDS). Les lignes traditionnelles ne sont pas fixées par l’UAI : chaque carte du ciel les dessine un peu différemment.`, `${lines.length} line${lines.length > 1 ? 's' : ''} drawn. Positions of the ${pts.length} brightest stars: SIMBAD (CDS). Traditional lines are not set by the IAU: every star chart draws them a little differently.`) }),
      el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', disabled: compared || lines.length < 2, onclick: () => { compared = true; reward('relie-les-etoiles', 5, []); draw(); }, text: tx('Comparer avec la carte officielle', 'Compare with the official chart') }),
        el('button', { type: 'button', class: 'btn', onclick: () => choose(), text: tx('Autre constellation', 'Another constellation') })),
      compared ? el('figure', { class: 'gm-chart' }, c.chart ? el('img', { src: c.chart.src, alt: tx(`Carte officielle de la constellation ${nm(c)} (UAI)`, `Official chart of ${nm(c)} (IAU)`), loading: 'lazy' }) : el('p', { class: 'na', text: tx('Carte non disponible.', 'Chart not available.') }),
        c.chart ? el('figcaption', { class: 'credit' }, `${c.chart.credit} · ${c.chart.license} · `, el('a', { href: c.chart.source, rel: 'noopener', text: tx('source', 'source') }), ' · ', el('a', { href: `/objet/${encodeURIComponent(c.i)}`, text: tx('fiche de la constellation', 'constellation page') })) : '') : '',
      compared ? quizBox : '');
    // un nouveau conteneur par constellation : l'ancien quiz (et ses écouteurs) reste attaché à l'ancien conteneur, détaché de la page
    if (compared && quizFor !== c.i) { quizFor = c.i; const box = el('div', { class: 'gm-quizbox' }); quizBox.replaceWith(box); quizBox = box; mountQuiz(quizBox, { game: 'relie-les-etoiles', points: 10, make: (rng, L2) => brightestQuestion(c, L2), newLabel: () => tx('Reposer la question', 'Ask again') }); }
  }
  let quizBox = el('div', { class: 'gm-quizbox' }), quizFor = null;
  onLang(draw); choose('constellation-orion');
}
